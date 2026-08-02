'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const { startRecoveryCheck } = require('../dist/recovery-assistant-runner');
const { assertSanitizedRecoveryReport } = require('../dist/recovery-assistant-report');
const { sha256File } = require('../dist/backup-package-validation');

const repositoryRoot = path.resolve(__dirname, '..');
const producerScript = path.join(__dirname, 'off-device-backup-producer.cjs');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-recovery-assistant-test-'));
const basePackage = path.join(testRoot, 'base-package');
const producerWork = path.join(testRoot, 'producer-work');

function producePackage() {
  const result = spawnSync(process.execPath, [tsNodeBin, '--transpile-only', '-P', 'tests/tsconfig.json', producerScript], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'test',
      FLO_OFF_DEVICE_PACKAGE_DIR: basePackage,
      FLO_OFF_DEVICE_WORK_ROOT: producerWork,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(result.status, 0, `synthetic producer failed: ${result.stderr || result.stdout}`);
}

function copyPackage(name) {
  const destination = path.join(testRoot, name);
  fs.cpSync(basePackage, destination, { recursive: true, errorOnExist: true });
  return destination;
}

function rewriteManifest(packageDir, mutate) {
  const manifestPath = path.join(packageDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mutate(manifest);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function refreshPackage(packageDir) {
  const backupPath = path.join(packageDir, 'flo-backup.db');
  const checksum = sha256File(backupPath);
  rewriteManifest(packageDir, (manifest) => {
    manifest.sha256 = checksum;
    manifest.sizeBytes = fs.statSync(backupPath).size;
  });
  fs.writeFileSync(path.join(packageDir, 'SHA256SUMS'), `${checksum}  flo-backup.db\n`, 'utf8');
}

function mutateDatabase(packageDir, callback) {
  const backupPath = path.join(packageDir, 'flo-backup.db');
  const database = new Database(backupPath);
  try { callback(database); } finally { database.close(); }
  for (const suffix of ['-wal', '-shm']) fs.rmSync(`${backupPath}${suffix}`, { force: true });
  refreshPackage(packageDir);
}

async function run(selectionPath, testEnvironment) {
  const sourcePath = fs.statSync(selectionPath).isDirectory()
    ? path.join(selectionPath, 'flo-backup.db')
    : selectionPath;
  const sourceBefore = sha256File(sourcePath);
  const handle = startRecoveryCheck(selectionPath, { appVersion: '2.4.7-test', testEnvironment });
  const outcome = await handle.result;
  assert.equal(fs.existsSync(handle.sandbox), false, 'assistant sandbox was not removed');
  assert.equal(sha256File(sourcePath), sourceBefore, 'source backup was modified');
  assert.equal(outcome.cancelled, false);
  assert.ok(outcome.report, 'assistant did not return a report');
  assertSanitizedRecoveryReport(outcome.report);
  return outcome.report;
}

async function main() {
  try {
    producePackage();

    const valid = await run(copyPackage('a01-valid'));
    assert.equal(valid.overallStatus, 'green');
    assert.equal(valid.testRestoreSucceeded, true);
    assert.equal(valid.testWriteSucceeded, true);
    console.log('PASS A-01: complete valid package is green');

    const standalone = path.join(testRoot, 'a02-standalone.db');
    fs.copyFileSync(path.join(basePackage, 'flo-backup.db'), standalone);
    const standaloneReport = await run(standalone);
    assert.equal(standaloneReport.overallStatus, 'yellow');
    assert.equal(standaloneReport.checksumMatched, null);
    console.log('PASS A-02: standalone database is yellow');

    const checksumPackage = copyPackage('a03-checksum');
    const checksumDb = path.join(checksumPackage, 'flo-backup.db');
    const byte = Buffer.alloc(1);
    const file = fs.openSync(checksumDb, 'r+');
    fs.readSync(file, byte, 0, 1, 128);
    byte[0] ^= 0xff;
    fs.writeSync(file, byte, 0, 1, 128);
    fs.closeSync(file);
    const checksumReport = await run(checksumPackage);
    assert.equal(checksumReport.overallStatus, 'red');
    assert.equal(checksumReport.checkResults.some((item) => item.id === 'open-read-only'), false);
    console.log('PASS A-03: checksum mismatch is red before SQLite opens');

    const manifestPackage = copyPackage('a04-manifest');
    rewriteManifest(manifestPackage, (manifest) => { manifest.sha256 = '0'.repeat(64); });
    assert.equal((await run(manifestPackage)).overallStatus, 'red');
    console.log('PASS A-04: altered manifest is red');

    const truncated = path.join(testRoot, 'a05-truncated.db');
    fs.copyFileSync(path.join(basePackage, 'flo-backup.db'), truncated);
    fs.truncateSync(truncated, 2048);
    assert.equal((await run(truncated)).overallStatus, 'red');
    console.log('PASS A-05: truncated database is red');

    const inconsistent = copyPackage('a06-inconsistent');
    mutateDatabase(inconsistent, (db) => db.prepare("UPDATE _flo_meta SET value='37' WHERE key='schema_version'").run());
    assert.equal((await run(inconsistent)).overallStatus, 'red');
    console.log('PASS A-06: inconsistent internal version is red');

    const newer = copyPackage('a07-newer');
    mutateDatabase(newer, (db) => {
      db.pragma('user_version = 39');
      db.prepare("UPDATE _flo_meta SET value='39' WHERE key='schema_version'").run();
    });
    rewriteManifest(newer, (manifest) => { manifest.schemaVersion = 39; });
    assert.equal((await run(newer)).overallStatus, 'red');
    console.log('PASS A-07: newer version is red');

    const older = copyPackage('a08-older');
    mutateDatabase(older, (db) => {
      db.pragma('user_version = 37');
      db.prepare("UPDATE _flo_meta SET value='37' WHERE key='schema_version'").run();
    });
    rewriteManifest(older, (manifest) => { manifest.schemaVersion = 37; });
    const olderReport = await run(older);
    assert.equal(olderReport.overallStatus, 'yellow', JSON.stringify(olderReport));
    assert.equal(olderReport.testRestoreSucceeded, true);
    console.log('PASS A-08: older recoverable version is yellow after isolated upgrade');

    const restoreFailure = await run(copyPackage('a09-restore-failure'), { FLO_RECOVERY_TEST_FAIL_PHASE: 'restore' });
    assert.equal(restoreFailure.overallStatus, 'red');
    assert.equal(restoreFailure.testRestoreSucceeded, false);
    console.log('PASS A-09: injected test restore failure is red');

    const writeFailure = await run(copyPackage('a10-write-failure'), { FLO_RECOVERY_TEST_FAIL_PHASE: 'write' });
    assert.equal(writeFailure.overallStatus, 'red');
    assert.equal(writeFailure.testRestoreSucceeded, true);
    assert.equal(writeFailure.testWriteSucceeded, false);
    console.log('PASS A-10: injected post-restore write failure is red');

    const unexpected = copyPackage('a11-unexpected');
    fs.writeFileSync(path.join(unexpected, 'unexpected.log'), 'synthetic test only\n');
    assert.equal((await run(unexpected)).overallStatus, 'red');
    console.log('PASS A-11: unexpected package file is red');

    const cancelPackage = copyPackage('a12-cancel');
    const cancelSource = path.join(cancelPackage, 'flo-backup.db');
    const cancelHash = sha256File(cancelSource);
    let cancelTriggeredResolve;
    const cancelTriggered = new Promise((resolve) => { cancelTriggeredResolve = resolve; });
    const cancelHandle = startRecoveryCheck(cancelPackage, {
      appVersion: '2.4.7-test',
      testEnvironment: { FLO_RECOVERY_TEST_PAUSE_PHASE: 'checking' },
      onProgress: ({ state }) => { if (state === 'checking') cancelTriggeredResolve(); },
    });
    await cancelTriggered;
    await cancelHandle.cancel();
    const cancelled = await cancelHandle.result;
    assert.equal(cancelled.cancelled, true);
    assert.equal(cancelled.report, null);
    assert.equal(fs.existsSync(cancelHandle.sandbox), false);
    assert.equal(sha256File(cancelSource), cancelHash);
    console.log('PASS A-12: cancellation preserves source and removes sandbox');

    assertSanitizedRecoveryReport(valid);
    assert.throws(() => assertSanitizedRecoveryReport({ ...valid, sourcePath: 'C:\\Users\\person\\backup.db' }), /REPORT_FORBIDDEN_FIELD/);
    assert.equal(JSON.stringify(valid).includes(testRoot), false);
    console.log('PASS A-13: exported report rejects paths and forbidden fields');
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`FAIL recovery assistant: ${error.stack || error.message}`);
  process.exitCode = 1;
});
