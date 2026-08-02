'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const asar = require('@electron/asar');
const electronPath = require('electron');

const repositoryRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(repositoryRoot, 'release');

function findRecursive(directory, predicate) {
  if (!fs.existsSync(directory)) return null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (predicate(candidate, entry)) return candidate;
    if (entry.isDirectory()) {
      const found = findRecursive(candidate, predicate);
      if (found) return found;
    }
  }
  return null;
}

const appAsar = findRecursive(releaseRoot, (candidate, entry) => entry.isFile() && path.basename(candidate) === 'app.asar');
assert.ok(appAsar, 'packaged app.asar was not found');
const entries = new Set(asar.listPackage(appAsar).map((entry) => entry.replace(/^[\\/]/, '').replace(/\\/g, '/')));
for (const required of [
  'dist/index.js',
  'dist/preload.js',
  'dist/recovery-assistant.js',
  'dist/recovery-assistant-worker.js',
  'dist/recovery-assistant-runner.js',
  'dist/backup-package-validation.js',
]) {
  assert.ok(entries.has(required), `packaged ASAR is missing ${required}`);
}

const resources = path.dirname(appAsar);
assert.ok(fs.existsSync(path.join(resources, 'frontend-out', 'recovery-assistant', 'index.html')), 'packaged recovery UI is missing');

let executable;
if (process.platform === 'win32') {
  executable = findRecursive(releaseRoot, (candidate, entry) => entry.isFile() && /Flo Cafe\.exe$/i.test(candidate));
} else if (process.platform === 'darwin') {
  const macExecutableDirectory = path.join(path.dirname(resources), 'MacOS');
  executable = fs.existsSync(macExecutableDirectory)
    ? fs.readdirSync(macExecutableDirectory, { withFileTypes: true })
      .find((entry) => entry.isFile())
    : null;
  executable = executable ? path.join(macExecutableDirectory, executable.name) : null;
} else {
  executable = findRecursive(releaseRoot, (candidate, entry) => entry.isFile() && path.basename(candidate) === 'flocafe' && candidate.includes('linux-unpacked'));
}
assert.ok(executable, 'packaged executable was not found');

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-recovery-package-smoke-'));
const resultFile = path.join(smokeRoot, 'result.txt');
try {
  const packageDirectory = path.join(smokeRoot, 'synthetic-package');
  const producerWork = path.join(smokeRoot, 'producer-work');
  const producer = path.join(repositoryRoot, 'tests', 'off-device-backup-producer.cjs');
  const tsNodeBin = require.resolve('ts-node/dist/bin.js');
  const produced = spawnSync(electronPath, [tsNodeBin, '--transpile-only', '-P', 'tests/tsconfig.json', producer], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'test',
      FLO_OFF_DEVICE_PACKAGE_DIR: packageDirectory,
      FLO_OFF_DEVICE_WORK_ROOT: producerWork,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(produced.status, 0, `packaged smoke fixture failed: ${produced.stderr || produced.stdout || produced.error || ''}`);
  const environment = {
    ...process.env,
    FLO_RECOVERY_SMOKE_RESULT: resultFile,
    FLO_RECOVERY_TEST_SELECTION: packageDirectory,
    FLO_RECOVERY_TEST_DEBUG: '1',
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  const args = [
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    '--recovery-assistant',
    '--recovery-assistant-smoke-exit',
  ];
  const result = process.platform === 'linux'
    ? spawnSync('xvfb-run', ['-a', executable, ...args], { env: environment, encoding: 'utf8', timeout: 60_000 })
    : spawnSync(executable, args, { env: environment, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `packaged isolated assistant failed: ${result.stderr || result.stdout || result.error || ''}`);
  assert.equal(fs.readFileSync(resultFile, 'utf8'), 'ok\n');
  console.log('PASS: packaged recovery assistant assets, worker and isolated UI');
} finally {
  fs.rmSync(smokeRoot, { recursive: true, force: true });
}
