'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const {
  BACKUP_FILE,
  CHECKSUM_FILE,
  MANIFEST_FILE,
  PACKAGE_FILES,
  RESULT_PREFIX,
  sha256File,
} = require('./off-device-backup-common.cjs');

const repositoryRoot = path.resolve(__dirname, '..');
const producerScript = path.join(__dirname, 'off-device-backup-producer.cjs');
const consumerScript = path.join(__dirname, 'off-device-backup-consumer.cjs');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-off-device-'));
const producerWork = path.join(testRoot, 'producer-work');
const producerExport = path.join(testRoot, 'producer-export');
const transportedPackage = path.join(testRoot, 'transported-package');

function runWorker(script, env) {
  const result = spawnSync(process.execPath, [
    tsNodeBin,
    '--transpile-only',
    '-P',
    'tests/tsconfig.json',
    script,
  ], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'test',
      ...env,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  const line = String(result.stdout || '').split(/\r?\n/).findLast((entry) => entry.startsWith(RESULT_PREFIX));
  assert.ok(line, 'Worker did not emit structured recovery evidence.');
  return { status: result.status, signal: result.signal, evidence: JSON.parse(line.slice(RESULT_PREFIX.length)) };
}

function copyPackage(source, destination) {
  fs.mkdirSync(destination, { recursive: false });
  for (const fileName of PACKAGE_FILES) {
    fs.copyFileSync(path.join(source, fileName), path.join(destination, fileName));
  }
}

function rewriteManifest(packageDir, mutate) {
  const manifestPath = path.join(packageDir, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mutate(manifest);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function refreshChecksums(packageDir) {
  const backupPath = path.join(packageDir, BACKUP_FILE);
  const sha256 = sha256File(backupPath);
  rewriteManifest(packageDir, (manifest) => {
    manifest.sha256 = sha256;
    manifest.sizeBytes = fs.statSync(backupPath).size;
  });
  fs.writeFileSync(path.join(packageDir, CHECKSUM_FILE), `${sha256}  ${BACKUP_FILE}\n`, 'utf8');
}

function runNegative(caseId, mutate, expectedCode) {
  const packageDir = path.join(testRoot, `${caseId.toLowerCase()}-package`);
  const destinationRoot = path.join(testRoot, `${caseId.toLowerCase()}-destination`);
  copyPackage(transportedPackage, packageDir);
  mutate(packageDir);
  const result = runWorker(consumerScript, {
    FLO_OFF_DEVICE_PACKAGE_DIR: packageDir,
    FLO_OFF_DEVICE_DESTINATION_ROOT: destinationRoot,
  });
  assert.notEqual(result.status, 0, `${caseId} unexpectedly succeeded.`);
  assert.equal(result.signal, null, `${caseId} terminated by signal.`);
  assert.equal(result.evidence.ok, false, `${caseId} did not report failure evidence.`);
  assert.equal(result.evidence.code, expectedCode, `${caseId} returned the wrong rejection code.`);
  assert.equal(result.evidence.destinationCreated, false, `${caseId} reported a partial destination.`);
  assert.equal(fs.existsSync(destinationRoot), false, `${caseId} left a partial restore destination.`);
  console.log(`PASS ${caseId}: ${expectedCode}`);
}

function main() {
  try {
    const produced = runWorker(producerScript, {
      FLO_OFF_DEVICE_PACKAGE_DIR: producerExport,
      FLO_OFF_DEVICE_WORK_ROOT: producerWork,
    });
    assert.equal(produced.status, 0, `The synthetic producer failed: ${produced.evidence.code || 'unknown'}.`);
    assert.equal(produced.evidence.ok, true);
    assert.equal(produced.evidence.syntheticOnly, true);
    assert.equal(produced.evidence.fileCount, PACKAGE_FILES.length);
    assert.equal(fs.existsSync(producerWork), false, 'Producer work data was not removed.');

    copyPackage(producerExport, transportedPackage);
    fs.rmSync(producerExport, { recursive: true, force: true });
    assert.equal(fs.existsSync(producerExport), false, 'Source export remained available to the consumer.');
    assert.deepEqual(fs.readdirSync(transportedPackage).sort(), [...PACKAGE_FILES]);
    console.log(`PASS A01: external package produced and transported (${produced.evidence.sha256.slice(0, 12)}...)`);

    const positiveDestination = path.join(testRoot, 'positive-destination');
    const consumed = runWorker(consumerScript, {
      FLO_OFF_DEVICE_PACKAGE_DIR: transportedPackage,
      FLO_OFF_DEVICE_DESTINATION_ROOT: positiveDestination,
      FLO_OFF_DEVICE_EXPECTED_SHA256: produced.evidence.sha256,
    });
    assert.equal(consumed.status, 0, `The independent consumer failed: ${consumed.evidence.code || 'unknown'}.`);
    assert.equal(consumed.evidence.ok, true);
    assert.equal(consumed.evidence.sha256, produced.evidence.sha256);
    assert.equal(consumed.evidence.restoreMode, 'direct');
    assert.equal(consumed.evidence.reopenVerified, true);
    console.log(`PASS A02: isolated restore, reopen and sequence advance on ${consumed.evidence.consumerPlatform}`);

    runNegative('B01', (packageDir) => {
      const backupPath = path.join(packageDir, BACKUP_FILE);
      const file = fs.openSync(backupPath, 'r+');
      try {
        const byte = Buffer.alloc(1);
        fs.readSync(file, byte, 0, 1, 128);
        byte[0] ^= 0xff;
        fs.writeSync(file, byte, 0, 1, 128);
      } finally {
        fs.closeSync(file);
      }
    }, 'CHECKSUM_MISMATCH');

    runNegative('B02', (packageDir) => {
      rewriteManifest(packageDir, (manifest) => { manifest.sha256 = '0'.repeat(64); });
    }, 'MANIFEST_HASH_MISMATCH');

    runNegative('B03', (packageDir) => {
      const backupPath = path.join(packageDir, BACKUP_FILE);
      fs.truncateSync(backupPath, Math.max(1, fs.statSync(backupPath).size - 4096));
    }, 'SIZE_MISMATCH');

    runNegative('B04', (packageDir) => {
      rewriteManifest(packageDir, (manifest) => { manifest.schemaVersion = 37; });
    }, 'MANIFEST_SCHEMA_MISMATCH');

    runNegative('B05', (packageDir) => {
      const database = new Database(path.join(packageDir, BACKUP_FILE));
      database.prepare("UPDATE _flo_meta SET value = '37' WHERE key = 'schema_version'").run();
      database.close();
      refreshChecksums(packageDir);
    }, 'META_SCHEMA_MISMATCH');

    runNegative('B06a', (packageDir) => {
      fs.unlinkSync(path.join(packageDir, CHECKSUM_FILE));
    }, 'UNEXPECTED_FILE_SET');

    runNegative('B06b', (packageDir) => {
      fs.unlinkSync(path.join(packageDir, MANIFEST_FILE));
    }, 'UNEXPECTED_FILE_SET');

    runNegative('B07', (packageDir) => {
      fs.writeFileSync(path.join(packageDir, 'secret.log'), 'must never be accepted or copied\n', 'utf8');
    }, 'UNEXPECTED_FILE_SET');

    console.log('PASS: off-device backup package lifecycle and B01-B07 rejection matrix');
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(testRoot), false, 'The test root was not removed.');
  }
}

try {
  main();
} catch (error) {
  console.error(`FAIL: off-device recovery validation (${error && error.code ? error.code : 'assertion'}): ${error.message}`);
  process.exitCode = 1;
}
