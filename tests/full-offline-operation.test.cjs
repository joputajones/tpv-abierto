'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const electronPath = require('electron');

const repositoryRoot = path.resolve(__dirname, '..');
const workerPath = path.join(__dirname, 'offline-operation-worker.cjs');
const rendererProbePath = path.join(__dirname, 'offline-renderer-probe.cjs');
const testPath = path.join(__dirname, 'full-offline-operation.test.cjs');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');
const CURRENT_SCHEMA_VERSION = 38;
const FAIL_FAST_LIMIT_MS = 250;
const activeControllers = new Set();
const allControllers = [];
const guardSummaries = [];
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

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function isolatedPorts() {
  let apiPort;
  let kdsPort;
  do { apiPort = await getFreePort(); } while ([3000, 3001, 3002].includes(apiPort));
  do { kdsPort = await getFreePort(); } while (kdsPort === apiPort || [3000, 3001, 3002].includes(kdsPort));
  return { apiPort, kdsPort };
}

async function assertPortReusable(port) {
  await withTimeout(new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  }), 5_000, `port ${port} reuse`);
}

function fingerprint(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false };
  const contents = fs.readFileSync(filePath);
  const stat = fs.statSync(filePath);
  return {
    exists: true,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    sha256: crypto.createHash('sha256').update(contents).digest('hex'),
  };
}

function probableRealProfileFiles() {
  const bases = [process.env.APPDATA, process.env.LOCALAPPDATA].filter(Boolean);
  const names = ['flo-desktop', 'Flo Cafe', 'FloCafe'];
  return bases.flatMap((base) => names.map((name) => path.join(base, name, 'flo.db')));
}

class WorkerController {
  constructor({ userDataPath, apiPort, kdsPort }) {
    this.userDataPath = userDataPath;
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
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: String(apiPort),
      KDS_PORT: String(kdsPort),
      FLO_OFFLINE_USER_DATA: userDataPath,
      JWT_SECRET: 'SYNTHETIC-OFFLINE-JWT-SECRET-NOT-FOR-PRODUCTION',
    };
    this.child = spawn(electronPath, [
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
    this.exitPromise = new Promise((resolve) => { this.resolveExit = resolve; });
    this.child.stdout.on('data', (chunk) => { this.stdout += chunk.toString(); });
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk.toString(); });
    this.child.once('error', (error) => {
      this.rejectReady(error);
      this.rejectPending(error);
    });
    this.child.on('message', (message) => this.onMessage(message));
    this.child.once('exit', (code, signal) => {
      this.exitResult = { code, signal };
      activeControllers.delete(this);
      this.resolveExit(this.exitResult);
      if (!this.readyMessage) this.rejectReady(new Error(this.failureContext('worker exited before ready')));
      this.rejectPending(new Error(this.failureContext(`worker exited code=${code} signal=${signal}`)));
    });
  }

  failureContext(message) {
    return `${message}\nstdout tail:\n${this.stdout.slice(-5_000)}\nstderr tail:\n${this.stderr.slice(-5_000)}`;
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
    if (message.type !== 'response') return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(new Error(this.failureContext(message.error)));
  }

  async ready() {
    let ready;
    try {
      // A freshly installed Electron binary can spend over 30 seconds in
      // first-run antivirus/native-module initialization on Windows. This is
      // a process-readiness bound, separate from the 250 ms network-failure
      // requirement enforced by O-16.
      ready = await withTimeout(this.readyPromise, 60_000, 'offline worker ready');
    } catch (error) {
      throw new Error(this.failureContext(error.message));
    }
    assert.equal(ready.pid, this.child.pid);
    assert.equal(path.resolve(ready.userDataPath), path.resolve(this.userDataPath));
    assert.equal(path.resolve(ready.dbPath), path.resolve(this.userDataPath, 'flo.db'));
    assert.ok(isWithin(ready.dbPath, this.userDataPath));
    assert.equal(ready.snapshot.userVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(String(ready.snapshot.journalMode).toLowerCase(), 'wal');
    assert.equal(ready.snapshot.apiHealth, 200);
    assert.equal(ready.snapshot.kdsHealth, 200);
    assert.equal(ready.snapshot.frontendStatus, 200);
    assert.equal(ready.snapshot.frontendBuilt, true, 'frontend/out must contain the real static frontend');
    assert.deepEqual(ready.isolation, {
      printing: 'not-started',
      mdns: 'not-started',
      devices: 'not-started',
      visibleWindows: 0,
    });
    return ready;
  }

  command(command, payload = {}, timeoutMs = 15_000) {
    if (!this.child.connected) return Promise.reject(new Error(`worker IPC closed before ${command}`));
    const id = `offline-command-${++commandSequence}`;
    return withTimeout(new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.send({ id, command, payload }, (error) => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    }), timeoutMs, `offline worker command ${command}`);
  }

  async collectSummary() {
    const summary = await this.command('guard-summary');
    guardSummaries.push(summary);
    return summary;
  }

  async gracefulStop() {
    const response = await this.command('shutdown');
    guardSummaries.push(response.guard);
    const exit = await withTimeout(this.exitPromise, 10_000, 'graceful worker exit');
    assert.equal(exit.code, 0, this.failureContext('graceful worker must exit cleanly'));
    return response;
  }

  async abruptStop() {
    await this.collectSummary();
    const killed = process.platform === 'win32' ? this.child.kill() : this.child.kill('SIGKILL');
    assert.equal(killed, true, this.failureContext('abrupt worker termination was requested'));
    const exit = await withTimeout(this.exitPromise, 10_000, 'abrupt worker exit');
    assert.ok(exit.signal || exit.code !== 0, this.failureContext('abrupt worker must not look graceful'));
    return exit;
  }
}

async function runCase(id, name, callback) {
  const startedAt = Date.now();
  try {
    const evidence = await callback();
    const durationMs = Date.now() - startedAt;
    caseResults.push({ id, name, result: 'PASS', durationMs, evidence });
    console.log(`[${id}] PASS ${name} (${durationMs} ms)`);
    return evidence;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    caseResults.push({ id, name, result: 'FAIL', durationMs, error: error.message });
    console.error(`[${id}] FAIL ${name} (${durationMs} ms): ${error.stack || error}`);
    throw error;
  }
}

function runRendererProbe({ apiPort, userDataPath }) {
  return withTimeout(new Promise((resolve, reject) => {
    const env = { ...process.env, FLO_OFFLINE_RENDERER_PORT: String(apiPort), FLO_OFFLINE_RENDERER_USER_DATA: userDataPath };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electronPath, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      rendererProbePath,
    ], { cwd: repositoryRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`renderer probe failed code=${code} signal=${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      const marker = stdout.split(/\r?\n/).find((line) => line.startsWith('OFFLINE_RENDERER_RESULT='));
      if (!marker) {
        reject(new Error(`renderer probe did not emit evidence\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve(JSON.parse(marker.slice('OFFLINE_RENDERER_RESULT='.length)));
    });
  }), 20_000, 'Electron renderer offline probe');
}

async function falsePositiveProbe() {
  const { OfflineNetworkGuard } = require('./offline-network-guard.cjs');
  const guard = new OfflineNetworkGuard().install();
  const server = http.createServer((_req, res) => res.end('synthetic unauthorized success'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    guard.setSyntheticEndpoint('unauthorized.external.test', `http://127.0.0.1:${port}`);
    const response = await guard.runWithService('false-positive-probe', () => fetch('https://unauthorized.external.test/probe'));
    assert.equal(await response.text(), 'synthetic unauthorized success');
    const unauthorized = guard.summary().events.find((event) =>
      event.host === 'unauthorized.external.test' && event.result === 'redirected-to-loopback');
    if (!unauthorized) throw new Error('O-FP failed to observe the unauthorized synthetic connection');
    process.stderr.write(`[O-FP] unauthorized synthetic external connection detected host=${unauthorized.host} service=${unauthorized.service}\n`);
    process.exitCode = 17;
  } finally {
    guard.uninstall();
    await new Promise((resolve) => server.close(resolve));
  }
}

function runFalsePositiveChild() {
  return withTimeout(new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [testPath, '--false-positive-probe'], {
      cwd: repositoryRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal, output }));
  }), 10_000, 'false-positive child');
}

function aggregateGuard(rendererEvidence) {
  const events = guardSummaries.flatMap((summary) => summary.events || []).concat(rendererEvidence.events || []);
  return {
    totalAttempts: events.length,
    blockedAttempts: events.filter((event) => String(event.result).startsWith('blocked')).length,
    redirectedToLoopback: events.filter((event) => event.result === 'redirected-to-loopback').length,
    successfulExternalConnections: guardSummaries.reduce((sum, summary) => sum + summary.successfulExternalConnections, 0)
      + rendererEvidence.successfulExternalConnections,
    maxFailureMs: events.reduce((max, event) => Math.max(max, Number(event.durationMs || 0)), 0),
    services: [...new Set(events.map((event) => event.service))].sort(),
    events,
  };
}

async function main() {
  if (process.argv.includes('--false-positive-probe')) {
    await falsePositiveProbe();
    return;
  }

  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-full-offline-'));
  const userDataPath = path.join(testRoot, 'profile');
  const rendererUserDataPath = path.join(testRoot, 'renderer-profile');
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(rendererUserDataPath, { recursive: true });
  const ports = await isolatedPorts();
  const realProfileBefore = Object.fromEntries(probableRealProfileFiles().map((file) => [file, fingerprint(file)]));
  let current;
  let token;
  let catalog;
  let flow;
  let abrupt;
  let rendererEvidence = { events: [], successfulExternalConnections: 0 };

  try {
    current = new WorkerController({ userDataPath, ...ports });
    await runCase('O-01', 'fresh Electron child, API, KDS and frontend start with external traffic blocked', async () => {
      const ready = await current.ready();
      assert.ok(isWithin(ready.dbPath, testRoot));
      const network = await current.command('guard-summary');
      assert.equal(network.totalAttempts, 0, 'fresh install must not attempt telemetry or cloud before consent');
      return { ...ready.snapshot, startupExternalAttempts: network.totalAttempts };
    });

    await runCase('O-02', 'local first-run setup completes and survives restart', async () => {
      const setup = await current.command('setup');
      assert.equal(setup.ownerName, 'SYNTHETIC-OFFLINE-OWNER');
      token = setup.token;
      await current.gracefulStop();
      current = new WorkerController({ userDataPath, ...ports });
      const ready = await current.ready();
      return { ownerId: setup.userId, restartedHealth: ready.snapshot.apiHealth };
    });

    await runCase('O-03', 'category, product edit, catalog query and table remain local', async () => {
      catalog = await current.command('catalog', { token });
      assert.equal(catalog.updatedName, 'SYNTHETIC-OFFLINE-PRODUCT-EDITED');
      assert.equal(catalog.updatedPrice, 12);
      assert.equal(catalog.queryFound, true);
      return catalog;
    });

    await runCase('O-04', 'order creation, quantity change, confirmation and local KDS work offline', async () => {
      flow = await current.command('main-flow', { token, productId: catalog.productId, tableId: catalog.tableId });
      assert.deepEqual(flow.itemQuantities, [1, 2]);
      assert.equal(flow.confirmedStatus, 'preparing');
      assert.equal(flow.kdsFound, true);
      return { orderId: flow.orderId, itemQuantities: flow.itemQuantities, kdsFound: flow.kdsFound };
    });

    await runCase('O-05', 'synthetic bill and cash payment persist with correct local totals', async () => {
      assert.equal(flow.total, 36);
      assert.equal(flow.paymentStatus, 'paid');
      assert.equal(flow.persistedStatus, 'completed');
      return { billId: flow.billId, total: flow.total, paymentStatus: flow.paymentStatus };
    });

    await runCase('O-06', 'orderly restart preserves product, order, bill and payment while offline', async () => {
      await current.gracefulStop();
      current = new WorkerController({ userDataPath, ...ports });
      await current.ready();
      const snapshot = await current.command('snapshot', {
        ids: { ...catalog, orderId: flow.orderId, billId: flow.billId }, probeWrite: true,
      });
      assert.equal(snapshot.integrity[0], 'ok');
      assert.equal(snapshot.foreignKeys.length, 0);
      assert.equal(snapshot.product.id, catalog.productId);
      assert.equal(snapshot.order.status, 'completed');
      assert.equal(snapshot.bill.payment_status, 'paid');
      return snapshot;
    });

    await runCase('O-07', 'abrupt child termination preserves committed data, WAL integrity and writability', async () => {
      abrupt = await current.command('abrupt-operation', { token, productId: catalog.productId });
      await current.abruptStop();
      current = new WorkerController({ userDataPath, ...ports });
      await current.ready();
      const snapshot = await current.command('snapshot', {
        ids: { ...catalog, orderId: flow.orderId, billId: flow.billId, abruptOrderId: abrupt.abruptOrderId },
        probeWrite: true,
      });
      assert.equal(snapshot.integrity[0], 'ok');
      assert.equal(snapshot.foreignKeys.length, 0);
      assert.equal(snapshot.userVersion, CURRENT_SCHEMA_VERSION);
      assert.equal(snapshot.abruptOrder.id, abrupt.abruptOrderId);
      return snapshot;
    });

    await runCase('O-08', 'unconfigured cloud, Drive and WhatsApp cause no external attempt', async () => {
      const result = await current.command('optional-unconfigured', { token });
      assert.equal(result.attempts, 0);
      assert.ok(['0', 'false'].includes(result.settings.cloud_sync_enabled));
      assert.equal(result.settings.telemetry_enabled, 'false');
      assert.equal(result.settings.whatsapp_enabled, 'false');
      assert.equal(result.apiHealth, 200);
      return result;
    });

    await runCase('O-09', 'configured cloud failure is immediate and leaves API, KDS and local outbox available', async () => {
      const result = await current.command('cloud-blocked', { token, orderId: flow.orderId });
      assert.equal(result.event.host, 'cloud.offline.invalid');
      assert.ok(result.elapsedMs < 1_000, `cloud failure took ${result.elapsedMs} ms`);
      assert.equal(result.apiHealth, 200);
      assert.equal(result.kdsHealth, 200);
      assert.ok(result.outbox >= 1);
      return result;
    });

    await runCase('O-10', 'telemetry without consent makes zero telemetry attempts', async () => {
      const result = await current.command('telemetry', { consent: false, token });
      assert.equal(result.attempts.length, 0);
      assert.equal(result.apiHealth, 200);
      return result;
    });

    await runCase('O-11', 'consented telemetry fails closed and non-fatally without Internet', async () => {
      const result = await current.command('telemetry', { consent: true, token });
      assert.ok(result.attempts.length >= 1);
      assert.ok(result.attempts.every((event) => event.host === 'telemetry.flopos.com' && event.result === 'blocked'));
      assert.equal(result.apiHealth, 200);
      return result;
    });

    await runCase('O-12', 'update check failure is fast, handled and does not freeze local operation', async () => {
      const result = await current.command('updater', { token });
      assert.equal(result.handled, true);
      assert.ok(result.elapsedMs < 1_000);
      assert.equal(result.apiHealth, 200);
      return result;
    });

    await runCase('O-13', 'real frontend and hidden Electron renderer use only local runtime resources', async () => {
      const resources = await current.command('frontend-resources');
      assert.equal(resources.rootStatus, 200);
      assert.deepEqual(resources.external, []);
      assert.ok(resources.htmlFileCount >= 20);
      assert.deepEqual(resources.missingLocalAssets, []);
      assert.ok(resources.statuses.every((status) => status === 200));
      rendererEvidence = await runRendererProbe({ apiPort: ports.apiPort, userDataPath: rendererUserDataPath });
      assert.equal(rendererEvidence.renderer.health, 200);
      assert.equal(rendererEvidence.renderer.readyState, 'complete');
      assert.ok(rendererEvidence.renderer.bodyLength > 0, 'root renderer must contain visible local content');
      assert.ok(rendererEvidence.renderer.finalUrl.startsWith(`http://127.0.0.1:${ports.apiPort}/`),
        `root renderer must remain on loopback; final URL was ${rendererEvidence.renderer.finalUrl}`);
      assert.equal(rendererEvidence.renderer.externalFetch, 'blocked');
      assert.equal(rendererEvidence.renderer.externalWebSocket, 'blocked');
      assert.equal(rendererEvidence.successfulExternalConnections, 0);
      assert.equal(rendererEvidence.visibleWindows, 0);
      assert.deepEqual(rendererEvidence.routes.map((route) => route.requested),
        ['/auth/login/', '/setup/', '/pos/', '/kds-standalone/', '/settings/']);
      for (const route of rendererEvidence.routes) {
        assert.equal(route.status, 200, `${route.requested} must load from the local server`);
        assert.equal(route.readyState, 'complete', `${route.requested} DOM must finish loading`);
        assert.ok(route.finalUrl.startsWith(`http://127.0.0.1:${ports.apiPort}/`),
          `${route.requested} must remain on loopback; final URL was ${route.finalUrl}`);
      }
      return { resources, renderer: rendererEvidence };
    });

    await runCase('O-14', 'brief prolonged local operation completes three sales without retry growth', async () => {
      const result = await current.command('prolonged', { token, productId: catalog.productId });
      assert.equal(result.results.length, 3);
      assert.ok(result.results.every((item) => item.paymentStatus === 'paid'));
      assert.equal(result.additionalAttempts, 0);
      return result;
    });

    await runCase('O-15', 'optional cloud outbox retries against an approved loopback simulator without restart', async () => {
      const result = await current.command('synthetic-reconnect', { token, orderId: flow.orderId }, 20_000);
      assert.equal(result.remaining, 0);
      assert.equal(result.apiHealth, 200);
      assert.ok(result.received.some((item) => item.path.endsWith('/api/pos/events')));
      assert.ok(result.redirected.length >= 1);
      return result;
    });

    await runCase('O-FP', 'matrix rejects an unauthorized synthetic external success', async () => {
      const result = await runFalsePositiveChild();
      assert.equal(result.code, 17);
      assert.match(result.output, /\[O-FP\]/);
      assert.match(result.output, /host=unauthorized\.external\.test/);
      assert.match(result.output, /service=false-positive-probe/);
      return { exitCode: result.code, diagnostic: result.output.trim() };
    });

    await current.gracefulStop();
    current = null;

    await runCase('O-16', 'sandbox, processes, ports, profile and external-success invariants hold', async () => {
      assert.equal(activeControllers.size, 0);
      await assertPortReusable(ports.apiPort);
      await assertPortReusable(ports.kdsPort);
      const realProfileAfter = Object.fromEntries(probableRealProfileFiles().map((file) => [file, fingerprint(file)]));
      assert.deepEqual(realProfileAfter, realProfileBefore, 'probable real profile files must remain byte-identical');
      const aggregate = aggregateGuard(rendererEvidence);
      assert.equal(aggregate.successfulExternalConnections, 0);
      assert.ok(aggregate.totalAttempts >= 5, 'configured optional services and renderer must produce observable blocked attempts');
      assert.ok(aggregate.blockedAttempts >= 4);
      assert.ok(aggregate.redirectedToLoopback >= 1, 'approved O-15 simulator must be observable');
      assert.ok(aggregate.maxFailureMs <= FAIL_FAST_LIMIT_MS);
      for (const controller of allControllers) {
        assert.ok(isWithin(controller.userDataPath, testRoot));
        assert.ok(controller.exitResult, 'every worker has exited');
      }
      return {
        sandbox: testRoot,
        apiPort: ports.apiPort,
        kdsPort: ports.kdsPort,
        failFastLimitMs: FAIL_FAST_LIMIT_MS,
        ...aggregate,
        events: aggregate.events.map(({ protocol, host, port, service, result, durationMs }) =>
          ({ protocol, host, port, service, result, durationMs })),
      };
    });

    const aggregate = aggregateGuard(rendererEvidence);
    console.log(`OFFLINE_MATRIX_RESULT=${JSON.stringify({
      cases: caseResults.map(({ id, name, result, durationMs }) => ({ id, name, result, durationMs })),
      totalAttempts: aggregate.totalAttempts,
      blockedAttempts: aggregate.blockedAttempts,
      redirectedToLoopback: aggregate.redirectedToLoopback,
      successfulExternalConnections: aggregate.successfulExternalConnections,
      maxFailureMs: aggregate.maxFailureMs,
      services: aggregate.services,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      failFastLimitMs: FAIL_FAST_LIMIT_MS,
    })}`);
  } finally {
    if (current && activeControllers.has(current)) {
      try { await current.gracefulStop(); } catch { current.child.kill(); }
    }
    for (const controller of [...activeControllers]) {
      controller.child.kill();
      try { await withTimeout(controller.exitPromise, 5_000, 'emergency worker cleanup'); } catch {}
    }
    if (fs.existsSync(testRoot)) fs.rmSync(testRoot, { recursive: true, force: true });
    assert.equal(activeControllers.size, 0, 'offline matrix leaves no worker process behind');
    assert.equal(fs.existsSync(testRoot), false, 'offline matrix removes its sandbox');
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
