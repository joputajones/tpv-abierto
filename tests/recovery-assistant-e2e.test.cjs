'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const electronPath = require('electron');

const repositoryRoot = path.resolve(__dirname, '..');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-recovery-e2e-'));
const validPackage = path.join(testRoot, 'valid-package');
const alteredPackage = path.join(testRoot, 'altered-package');
const workRoot = path.join(testRoot, 'producer-work');
const reportPath = path.join(testRoot, 'recovery-check-report.json');
const producer = path.join(__dirname, 'off-device-backup-producer.cjs');
const probe = path.join(__dirname, 'recovery-assistant-e2e-probe.cjs');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');

try {
  const produced = spawnSync(electronPath, [tsNodeBin, '--transpile-only', '-P', 'tests/tsconfig.json', producer], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'test',
      FLO_OFF_DEVICE_PACKAGE_DIR: validPackage,
      FLO_OFF_DEVICE_WORK_ROOT: workRoot,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(produced.status, 0, `synthetic package generation failed: ${produced.stderr || produced.stdout}`);
  fs.cpSync(validPackage, alteredPackage, { recursive: true, errorOnExist: true });
  const alteredDb = path.join(alteredPackage, 'flo-backup.db');
  const file = fs.openSync(alteredDb, 'r+');
  const byte = Buffer.alloc(1);
  fs.readSync(file, byte, 0, 1, 128);
  byte[0] ^= 0xff;
  fs.writeSync(file, byte, 0, 1, 128);
  fs.closeSync(file);

  const probeEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    FLO_RECOVERY_E2E_VALID: validPackage,
    FLO_RECOVERY_E2E_ALTERED: alteredPackage,
    FLO_RECOVERY_E2E_REPORT: reportPath,
  };
  delete probeEnvironment.ELECTRON_RUN_AS_NODE;
  const electronArgs = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), probe];
  const result = spawnSync(electronPath, electronArgs, {
    cwd: repositoryRoot,
    env: probeEnvironment,
    encoding: 'utf8',
    timeout: 180_000,
  });
  const evidenceLine = String(result.stdout || '').split(/\r?\n/).find((line) => line.startsWith('RECOVERY_E2E_RESULT='));
  assert.equal(result.status, 0, `Electron E2E failed: ${result.stderr || result.stdout}`);
  assert.ok(evidenceLine, 'Electron E2E did not return structured evidence');
  const evidence = JSON.parse(evidenceLine.slice('RECOVERY_E2E_RESULT='.length));
  assert.deepEqual(evidence, {
    menuOpened: true,
    isolatedServicesStarted: 0,
    externalConnections: 0,
    validStatus: 'green',
    alteredStatus: 'red',
    keyboardNavigation: true,
    detailsInitiallyClosed: true,
    reportSanitized: true,
  });
  console.log('PASS A-14: isolated mode opens without live database or production services');
  console.log('PASS A-15: main process and renderer made zero external connections');
  console.log('PASS A-16: real Electron UI covers menu, keyboard, progress, reports, green and red states');
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
