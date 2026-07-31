'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const workerPath = path.join(__dirname, 'restart-recovery-worker.cjs');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');
const upgradeFixture = path.join(__dirname, 'fixtures', 'upgrade-snapshots', 'pre-migration-scheme-v1.5.0.db');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-restart-recovery-'));
const CURRENT_SCHEMA_VERSION = 38;
const activeControllers = new Set();
const allControllers = [];
const readyRecords = [];
const walObservations = [];
const caseResults = [];
let commandSequence = 0;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withTimeout(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds} ms`)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function describeFile(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, size: 0 };
  return { exists: true, size: fs.statSync(filePath).size };
}

function describeDatabaseFiles(userDataPath) {
  const dbPath = path.join(userDataPath, 'flo.db');
  return {
    db: describeFile(dbPath),
    wal: describeFile(`${dbPath}-wal`),
    shm: describeFile(`${dbPath}-shm`),
  };
}

function recordWal(caseId, phase, userDataPath, state = describeDatabaseFiles(userDataPath)) {
  walObservations.push({ caseId, phase, state });
}

function makeCaseDirectory(caseId) {
  const directory = path.join(testRoot, caseId.toLowerCase());
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function getIsolatedPorts() {
  let apiPort;
  let kdsPort;
  do { apiPort = await getFreePort(); } while (apiPort === 3001 || apiPort === 3002);
  do { kdsPort = await getFreePort(); } while (kdsPort === apiPort || kdsPort === 3001 || kdsPort === 3002);
  return { apiPort, kdsPort };
}

function requestHealth(port) {
  return withTimeout(new Promise((resolve, reject) => {
    const request = http.get({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      headers: { Connection: 'close' },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.once('end', () => resolve({ status: response.statusCode, body }));
    });
    request.once('error', reject);
  }), 5_000, `health request on ${port}`);
}

function assertPortReusable(port) {
  return withTimeout(new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }), 5_000, `port reuse ${port}`);
}

class WorkerController {
  constructor({ userDataPath, services = false, apiPort = null, kdsPort = null }) {
    this.userDataPath = userDataPath;
    this.services = services;
    this.apiPort = apiPort;
    this.kdsPort = kdsPort;
    this.stdout = '';
    this.stderr = '';
    this.pending = new Map();
    this.readyMessage = null;
    this.exitResult = null;

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'test',
      FLO_RESTART_USER_DATA: userDataPath,
      FLO_RESTART_SERVICES: services ? '1' : '0',
    };
    if (apiPort !== null) env.PORT = String(apiPort);
    if (kdsPort !== null) env.KDS_PORT = String(kdsPort);

    this.child = spawn(process.execPath, [
      tsNodeBin,
      '--transpile-only',
      '-P',
      'tests/tsconfig.json',
      workerPath,
    ], {
      cwd: repositoryRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    });

    activeControllers.add(this);
    allControllers.push(this);

    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.exitPromise = new Promise((resolve) => {
      this.resolveExit = resolve;
    });

    this.child.stdout.on('data', (chunk) => { this.stdout += chunk.toString(); });
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk.toString(); });
    this.child.on('error', (error) => {
      this.rejectReady(error);
      this.rejectPending(error);
    });
    this.child.on('message', (message) => this.onMessage(message));
    this.child.on('exit', (code, signal) => {
      this.exitResult = { code, signal };
      activeControllers.delete(this);
      this.resolveExit(this.exitResult);
      if (!this.readyMessage) {
        this.rejectReady(new Error(this.failureContext(`worker exited before ready: code=${code}, signal=${signal}`)));
      }
      this.rejectPending(new Error(this.failureContext(`worker exited: code=${code}, signal=${signal}`)));
    });
  }

  failureContext(message) {
    const stdoutTail = this.stdout.slice(-4_000);
    const stderrTail = this.stderr.slice(-4_000);
    return `${message}\nstdout tail:\n${stdoutTail}\nstderr tail:\n${stderrTail}`;
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  onMessage(message) {
    if (message.type === 'ready') {
      this.readyMessage = message;
      this.resolveReady(message);
      return;
    }
    if (message.type === 'fatal') {
      const error = new Error(this.failureContext(`worker fatal: ${message.error}`));
      this.rejectReady(error);
      this.rejectPending(error);
      return;
    }
    if (message.type === 'response') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(this.failureContext(message.error)));
    }
  }

  async waitReady() {
    const ready = await withTimeout(this.readyPromise, 30_000, 'worker ready');
    assert.equal(ready.pid, this.child.pid, 'ready PID belongs to the spawned worker');
    assert.equal(path.resolve(ready.userDataPath), path.resolve(this.userDataPath));
    assert.equal(path.resolve(ready.dbPath), path.resolve(this.userDataPath, 'flo.db'));
    assert.ok(isWithin(ready.dbPath, testRoot), 'worker database stays inside the matrix sandbox');
    assert.equal(ready.userVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(String(ready.journalMode).toLowerCase(), 'wal');
    assert.deepEqual(ready.isolation, {
      whatsappDisabled: true,
      cloudStarted: false,
      telemetryStarted: false,
      mdnsStarted: false,
      printerStarted: false,
      windowCreated: false,
    });
    if (this.services) {
      assert.equal(ready.services.apiPort, this.apiPort);
      assert.equal(ready.services.kdsPort, this.kdsPort);
      assert.equal(ready.services.apiHealth, 200);
      assert.equal(ready.services.kdsHealth, 200);
    }
    readyRecords.push(ready);
    return ready;
  }

  command(command, payload = {}) {
    if (!this.child.connected) return Promise.reject(new Error(`worker IPC closed before ${command}`));
    const id = `command-${++commandSequence}`;
    return withTimeout(new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.send({ id, command, payload }, (error) => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    }), 15_000, `worker command ${command}`);
  }

  async gracefulStop() {
    const response = await this.command('shutdown');
    const exit = await withTimeout(this.exitPromise, 10_000, 'graceful worker exit');
    assert.equal(exit.code, 0, this.failureContext('graceful worker exits with code 0'));
    assert.equal(exit.signal, null);
    return { response, exit };
  }

  async abruptStop() {
    assert.ok(activeControllers.has(this), 'only a registered child can be terminated');
    assert.ok(Number.isInteger(this.child.pid) && this.child.pid > 0, 'child PID is valid');
    if (process.platform === 'win32') {
      const killed = spawnSync('taskkill', ['/PID', String(this.child.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(killed.status, 0, `taskkill failed for owned PID ${this.child.pid}: ${killed.stderr || killed.stdout}`);
    } else {
      assert.equal(this.child.kill('SIGKILL'), true, `SIGKILL accepted for owned PID ${this.child.pid}`);
    }
    const exit = await withTimeout(this.exitPromise, 10_000, 'abrupt worker exit');
    assert.ok(exit.code !== 0 || exit.signal !== null, 'forced termination is distinguishable from graceful exit');
    return exit;
  }
}

async function launchWorker(options) {
  const controller = new WorkerController(options);
  await controller.waitReady();
  return controller;
}

async function assertServiceHealth(apiPort, kdsPort) {
  const [api, kds] = await Promise.all([requestHealth(apiPort), requestHealth(kdsPort)]);
  assert.equal(api.status, 200, `API health on ${apiPort}`);
  assert.equal(kds.status, 200, `KDS health on ${kdsPort}`);
}

function assertHealthy(snapshot, message) {
  assert.deepEqual(snapshot.integrity, [{ integrity_check: 'ok' }], `${message}: integrity_check`);
  assert.deepEqual(snapshot.foreignKeys, [], `${message}: foreign_key_check`);
  assert.equal(snapshot.userVersion, CURRENT_SCHEMA_VERSION, `${message}: user_version`);
  assert.equal(String(snapshot.journalMode).toLowerCase(), 'wal', `${message}: WAL active`);
  assert.ok(isWithin(snapshot.dbPath, testRoot), `${message}: database inside sandbox`);
}

function assertMarker(snapshot, key, expected, message) {
  assert.equal(snapshot.markers[key], expected, `${message}: ${key}`);
}

function assertDatasetExactlyOnce(snapshot, message) {
  for (const [table, count] of Object.entries(snapshot.dataset)) {
    assert.equal(count, 1, `${message}: one synthetic row in ${table}`);
  }
}

function sequenceValue(orderNumber) {
  const match = String(orderNumber).match(/-(\d+)$/);
  assert.ok(match, `sequence suffix exists in ${orderNumber}`);
  return Number(match[1]);
}

function countManagedBackups(userDataPath) {
  const backupDir = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupDir)) return 0;
  return fs.readdirSync(backupDir).filter((name) => name.endsWith('.db') && !name.includes('.partial')).length;
}

async function runCase(caseId, name, run) {
  const started = Date.now();
  try {
    await run();
    const durationMs = Date.now() - started;
    caseResults.push({ caseId, name, status: 'PASS', durationMs });
    console.log(`[${caseId}] PASS (${durationMs} ms): ${name}`);
  } catch (error) {
    error.message = `[${caseId}] ${name}: ${error.message}`;
    throw error;
  }
}

async function runMatrix() {
  console.log(`Restart recovery sandbox: ${testRoot}`);
  console.log(`Termination helper: ${process.platform === 'win32' ? 'taskkill /PID <owned> /T /F' : 'SIGKILL owned child'}`);

  await runCase('R-01', 'graceful shutdown without activity', async () => {
    const userDataPath = makeCaseDirectory('R-01');
    const ports = await getIsolatedPorts();
    let worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    recordWal('R-01', 'before-graceful', userDataPath, worker.readyMessage.files);
    await worker.gracefulStop();
    recordWal('R-01', 'after-graceful', userDataPath);
    await assertPortReusable(ports.apiPort);
    await assertPortReusable(ports.kdsPort);

    worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    const recovered = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(recovered, 'R-01 recovered database');
    recordWal('R-01', 'after-reopen', userDataPath, recovered.files);
    await worker.gracefulStop();
  });

  await runCase('R-02', 'graceful shutdown after committed synthetic order and bill', async () => {
    const userDataPath = makeCaseDirectory('R-02');
    let worker = await launchWorker({ userDataPath });
    assert.deepEqual(await worker.command('seed-dataset'), {
      categories: 1, products: 1, users: 1, orders: 1, bills: 1,
    });
    recordWal('R-02', 'before-graceful', userDataPath, await worker.command('file-state'));
    await worker.gracefulStop();
    worker = await launchWorker({ userDataPath });
    const recovered = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(recovered, 'R-02 recovered database');
    assertDatasetExactlyOnce(recovered, 'R-02 committed dataset');
    recordWal('R-02', 'after-reopen', userDataPath, recovered.files);
    await worker.gracefulStop();
  });

  await runCase('R-03', 'abrupt termination while services are idle', async () => {
    const userDataPath = makeCaseDirectory('R-03');
    const ports = await getIsolatedPorts();
    let worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    await worker.abruptStop();
    recordWal('R-03', 'after-abrupt', userDataPath);
    worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    const recovered = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(recovered, 'R-03 recovered database');
    recordWal('R-03', 'after-reopen', userDataPath, recovered.files);
    await worker.gracefulStop();
  });

  await runCase('R-04', 'abrupt termination after a committed WAL write', async () => {
    const userDataPath = makeCaseDirectory('R-04');
    let worker = await launchWorker({ userDataPath });
    const committed = await worker.command('commit-marker', { key: 'restart:r04:committed' });
    assert.equal(committed.files.wal.exists, true, 'R-04 committed frames have a WAL file');
    assert.ok(committed.files.wal.size > 0, 'R-04 WAL contains committed bytes');
    await worker.abruptStop();
    recordWal('R-04', 'after-abrupt', userDataPath);
    worker = await launchWorker({ userDataPath });
    const recovered = await worker.command('snapshot', {
      markerKeys: ['restart:r04:committed'], probeWrite: true,
    });
    assertHealthy(recovered, 'R-04 recovered database');
    assertMarker(recovered, 'restart:r04:committed', 1, 'R-04 committed row survives');
    recordWal('R-04', 'after-reopen', userDataPath, recovered.files);
    await worker.gracefulStop();
  });

  await runCase('R-05', 'abrupt termination rolls back an open transaction', async () => {
    const userDataPath = makeCaseDirectory('R-05');
    let worker = await launchWorker({ userDataPath });
    await worker.command('commit-marker', { key: 'restart:r05:baseline' });
    const open = await worker.command('open-uncommitted', { key: 'restart:r05:uncommitted' });
    assert.equal(open.transactionOpen, true);
    await worker.abruptStop();
    recordWal('R-05', 'after-abrupt-open-transaction', userDataPath);
    worker = await launchWorker({ userDataPath });
    const recovered = await worker.command('snapshot', {
      markerKeys: ['restart:r05:baseline', 'restart:r05:uncommitted'], probeWrite: true,
    });
    assertHealthy(recovered, 'R-05 recovered database');
    assertMarker(recovered, 'restart:r05:baseline', 1, 'R-05 prior commit survives');
    assertMarker(recovered, 'restart:r05:uncommitted', 0, 'R-05 open transaction is absent');
    recordWal('R-05', 'after-reopen', userDataPath, recovered.files);
    await worker.gracefulStop();
  });

  await runCase('R-06', 'committed operation survives while following open operation rolls back', async () => {
    const userDataPath = makeCaseDirectory('R-06');
    let worker = await launchWorker({ userDataPath });
    await worker.command('commit-marker', { key: 'restart:r06:committed' });
    await worker.command('open-uncommitted', { key: 'restart:r06:uncommitted' });
    await worker.abruptStop();
    recordWal('R-06', 'after-abrupt-open-transaction', userDataPath);
    worker = await launchWorker({ userDataPath });
    const recovered = await worker.command('snapshot', {
      markerKeys: ['restart:r06:committed', 'restart:r06:uncommitted'], probeWrite: true,
    });
    assertHealthy(recovered, 'R-06 recovered database');
    assertMarker(recovered, 'restart:r06:committed', 1, 'R-06 committed operation survives');
    assertMarker(recovered, 'restart:r06:uncommitted', 0, 'R-06 uncommitted operation is absent');
    await worker.gracefulStop();
  });

  await runCase('R-07', 'order sequence remains unique and monotonic after restart', async () => {
    const userDataPath = makeCaseDirectory('R-07');
    let worker = await launchWorker({ userDataPath });
    const first = await worker.command('create-sequence-order', { label: '001' });
    await worker.abruptStop();
    worker = await launchWorker({ userDataPath });
    const second = await worker.command('create-sequence-order', { label: '002' });
    assert.notEqual(second.orderNumber, first.orderNumber, 'R-07 generated identifiers differ');
    assert.ok(sequenceValue(second.orderNumber) > sequenceValue(first.orderNumber), 'R-07 sequence is monotonic');
    const recovered = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(recovered, 'R-07 recovered database');
    assert.deepEqual(recovered.sequenceOrders, [first.orderNumber, second.orderNumber]);
    await worker.gracefulStop();
  });

  await runCase('R-08', 'five alternating graceful and abrupt reopen cycles', async () => {
    const userDataPath = makeCaseDirectory('R-08');
    const committedKeys = [];
    const uncommittedKeys = [];
    const modes = ['graceful', 'abrupt', 'graceful', 'abrupt', 'graceful'];
    for (let index = 0; index < modes.length; index++) {
      const worker = await launchWorker({ userDataPath });
      const before = await worker.command('snapshot', {
        markerKeys: [...committedKeys, ...uncommittedKeys], probeWrite: true,
      });
      assertHealthy(before, `R-08 cycle ${index + 1} reopen`);
      for (const key of committedKeys) assertMarker(before, key, 1, `R-08 committed before cycle ${index + 1}`);
      for (const key of uncommittedKeys) assertMarker(before, key, 0, `R-08 rollback before cycle ${index + 1}`);

      const committedKey = `restart:r08:committed:${index + 1}`;
      committedKeys.push(committedKey);
      await worker.command('commit-marker', { key: committedKey });
      if (modes[index] === 'abrupt') {
        const uncommittedKey = `restart:r08:uncommitted:${index + 1}`;
        uncommittedKeys.push(uncommittedKey);
        await worker.command('open-uncommitted', { key: uncommittedKey });
        await worker.abruptStop();
      } else {
        await worker.gracefulStop();
      }
      recordWal('R-08', `after-${modes[index]}-cycle-${index + 1}`, userDataPath);
    }

    const verifier = await launchWorker({ userDataPath });
    const finalSnapshot = await verifier.command('snapshot', {
      markerKeys: [...committedKeys, ...uncommittedKeys], probeWrite: true,
    });
    assertHealthy(finalSnapshot, 'R-08 final reopen');
    for (const key of committedKeys) assertMarker(finalSnapshot, key, 1, 'R-08 accumulated commit');
    for (const key of uncommittedKeys) assertMarker(finalSnapshot, key, 0, 'R-08 uncommitted row absent');
    await verifier.gracefulStop();
  });

  await runCase('R-09', 'synthetic legacy upgrade remains stable across two restarts', async () => {
    assert.equal(fs.existsSync(upgradeFixture), true, 'sanitized upgrade fixture exists');
    const userDataPath = makeCaseDirectory('R-09');
    fs.copyFileSync(upgradeFixture, path.join(userDataPath, 'flo.db'));
    let worker = await launchWorker({ userDataPath });
    const upgraded = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(upgraded, 'R-09 upgraded database');
    assert.ok(upgraded.productTotal > 0, 'R-09 sanitized fixture rows survive upgrade');
    assert.equal(countManagedBackups(userDataPath), 1, 'R-09 publishes one pre-migration backup');
    assert.match(worker.stdout, /Applying migration v1:/, 'R-09 first open runs migrations');
    await worker.abruptStop();
    recordWal('R-09', 'after-abrupt-post-upgrade', userDataPath);

    worker = await launchWorker({ userDataPath });
    const firstRestart = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(firstRestart, 'R-09 first restart');
    assert.equal(firstRestart.productTotal, upgraded.productTotal);
    assert.doesNotMatch(worker.stdout, /Applying migration v\d+:/, 'R-09 first restart does not repeat migrations');
    assert.equal(countManagedBackups(userDataPath), 1, 'R-09 first restart adds no backup');
    await worker.gracefulStop();

    worker = await launchWorker({ userDataPath });
    const secondRestart = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(secondRestart, 'R-09 second restart');
    assert.equal(secondRestart.productTotal, upgraded.productTotal);
    assert.doesNotMatch(worker.stdout, /Applying migration v\d+:/, 'R-09 second restart does not repeat migrations');
    assert.equal(countManagedBackups(userDataPath), 1, 'R-09 second restart adds no backup');
    await worker.gracefulStop();
  });

  await runCase('R-10', 'API and KDS ports are reusable after both termination modes', async () => {
    const userDataPath = makeCaseDirectory('R-10');
    const ports = await getIsolatedPorts();
    let worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    await worker.gracefulStop();
    await assertPortReusable(ports.apiPort);
    await assertPortReusable(ports.kdsPort);

    worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    await worker.abruptStop();

    worker = await launchWorker({ userDataPath, services: true, ...ports });
    await assertServiceHealth(ports.apiPort, ports.kdsPort);
    const recovered = await worker.command('snapshot', { probeWrite: true });
    assertHealthy(recovered, 'R-10 database after service restarts');
    await worker.gracefulStop();
    await assertPortReusable(ports.apiPort);
    await assertPortReusable(ports.kdsPort);
  });

  await runCase('R-11', 'WAL and SHM states are evidence, not standalone failures', async () => {
    assert.ok(walObservations.length >= 15, 'R-11 collected auxiliary-file states across cycles');
    assert.ok(walObservations.every((entry) => entry.state.db.exists), 'R-11 database exists in every recorded state');
    assert.ok(
      walObservations.some((entry) => entry.phase.includes('abrupt') && entry.state.wal.exists),
      'R-11 records at least one WAL left by abrupt termination',
    );
    assert.ok(
      walObservations.some((entry) => entry.phase.includes('reopen') && entry.state.shm.exists),
      'R-11 records SHM while a recovered database is open',
    );
  });

  await runCase('R-12', 'sandbox and child-process isolation', async () => {
    assert.equal(activeControllers.size, 0, 'R-12 has no live worker processes');
    assert.ok(readyRecords.length >= 20, 'R-12 observed every worker ready signal');
    for (const ready of readyRecords) {
      assert.ok(isWithin(ready.userDataPath, testRoot), 'R-12 userData stays inside sandbox');
      assert.ok(isWithin(ready.dbPath, testRoot), 'R-12 database stays inside sandbox');
      assert.equal(ready.isolation.cloudStarted, false);
      assert.equal(ready.isolation.telemetryStarted, false);
      assert.equal(ready.isolation.mdnsStarted, false);
      assert.equal(ready.isolation.printerStarted, false);
    }
    const files = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(fullPath);
        else files.push(fullPath);
      }
    };
    visit(testRoot);
    assert.ok(files.every((file) => isWithin(file, testRoot)), 'R-12 all created files stay in sandbox');
    assert.equal(files.some((file) => file.toLowerCase().endsWith('.log')), false, 'R-12 creates no log files');
  });

  assert.equal(caseResults.length, 12, 'all R-01 through R-12 cases ran');
  console.log('\nRestart recovery matrix summary');
  for (const result of caseResults) {
    console.log(`  ${result.caseId}: ${result.status} (${result.durationMs} ms) — ${result.name}`);
  }
  console.log(`  WAL/SHM observations: ${walObservations.length}`);
  console.log('Evidence level: SIM (controlled child-process termination; not a physical power-loss test)');
}

async function cleanup() {
  const controllers = Array.from(activeControllers);
  for (const controller of controllers) {
    try { await controller.abruptStop(); } catch (error) {
      console.error(`cleanup could not terminate owned PID ${controller.child.pid}:`, error.message);
    }
  }
  for (let attempt = 0; attempt < 20 && activeControllers.size > 0; attempt++) await delay(25);
  assert.equal(activeControllers.size, 0, 'cleanup leaves no registered child process');
  fs.rmSync(testRoot, { recursive: true, force: true });
  assert.equal(fs.existsSync(testRoot), false, 'cleanup removes the matrix sandbox');
}

async function main() {
  let failure = null;
  try {
    await runMatrix();
  } catch (error) {
    failure = error;
    console.error(error.stack || error.message);
  } finally {
    try {
      await cleanup();
      console.log('Cleanup PASS: all owned children exited and the temporary sandbox was removed');
    } catch (cleanupError) {
      failure = failure || cleanupError;
      console.error(cleanupError.stack || cleanupError.message);
    }
  }
  process.exitCode = failure ? 1 : 0;
}

void main();
