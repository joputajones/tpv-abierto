'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const Database = require('better-sqlite3');
const packageJson = require('../package.json');
const {
  BACKUP_FILE,
  CHECKSUM_FILE,
  CURRENT_SCHEMA_VERSION,
  DATASET_ID,
  EVIDENCE_LEVEL,
  INSTRUCTIONS_FILE,
  MANIFEST_FILE,
  PACKAGE_FILES,
  fail,
  isWithin,
  outputResult,
  parseArguments,
  sanitizedFailure,
  sha256File,
  validatePackagePreflight,
} = require('./off-device-backup-common.cjs');

const repositoryRoot = path.resolve(__dirname, '..');

const SYNTHETIC = Object.freeze({
  userId: 'SYNTHETIC-RESTORE-USER',
  categoryId: 'SYNTHETIC-RESTORE-CATEGORY',
  productId: 'SYNTHETIC-RESTORE-PRODUCT',
  orderNumber: 'SYNTHETIC-RESTORE-ORDER-001',
  billNumber: 'SYNTHETIC-RESTORE-BILL-001',
});

const SENSITIVE_SETTING_KEYS = Object.freeze([
  'cloud_api_key',
  'cloud_device_created_at',
  'cloud_device_secret',
  'cloud_pos_hash',
  'cloud_store_id',
  'jwt_secret',
  'mobile_pairing_code',
  'mobile_pairing_code_expires_at',
]);
const FORBIDDEN_CONTENT_MARKERS = Object.freeze([
  '-----BEGIN PRIVATE KEY-----',
  'C:\\Users\\runneradmin',
  '/home/runner/',
  'github_pat_',
  'ghp_',
]);

function installElectronMock(userDataPath) {
  const originalLoad = Module._load;
  const app = {
    isPackaged: true,
    getPath(name) {
      if (name !== 'userData') throw new Error(`Unsupported Electron path: ${name}`);
      return userDataPath;
    },
    getVersion() {
      return packageJson.version;
    },
  };
  Module._load = function mockElectron(request, parent, isMain) {
    if (request === 'electron') return { app };
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => { Module._load = originalLoad; };
}

function createSyntheticDataset(database, dbModule) {
  database.transaction(() => {
    database.prepare(`
      INSERT INTO users (id, name, email, password, role, is_active, terms_accepted_at)
      VALUES (?, ?, ?, ?, 'owner', 0, ?)
    `).run(
      SYNTHETIC.userId,
      'Synthetic Restore Operator',
      'restore-operator@example.invalid',
      'SYNTHETIC_DISABLED_ACCOUNT',
      '2026-01-01T00:00:00.000Z',
    );
    database.prepare(`
      INSERT INTO categories (id, name, description, sort_order, is_active)
      VALUES (?, 'Synthetic Recovery', 'Non-production recovery fixture', 901, 1)
    `).run(SYNTHETIC.categoryId);
    database.prepare(`
      INSERT INTO products (id, category_id, name, description, price, cost, sku, is_active, sort_order, tax_type, tax_rate)
      VALUES (?, ?, 'Synthetic Espresso', 'Non-production recovery fixture', 2.5, 0.5, 'SYN-RESTORE-001', 1, 901, 'none', 0)
    `).run(SYNTHETIC.productId, SYNTHETIC.categoryId);
    const order = database.prepare(`
      INSERT INTO orders (order_number, user_id, type, status, subtotal, total, completed_at)
      VALUES (?, ?, 'takeaway', 'completed', 5, 5, '2026-01-01T00:05:00.000Z')
    `).run(SYNTHETIC.orderNumber, SYNTHETIC.userId);
    database.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, product_sku, unit_price, quantity, subtotal, total, status)
      VALUES (?, ?, 'Synthetic Espresso', 'SYN-RESTORE-001', 2.5, 2, 5, 5, 'served')
    `).run(order.lastInsertRowid, SYNTHETIC.productId);
    database.prepare(`
      INSERT INTO bills (bill_number, order_id, subtotal, total, paid_amount, balance, payment_status, payment_details, paid_at)
      VALUES (?, ?, 5, 5, 5, 0, 'paid', ?, '2026-01-01T00:06:00.000Z')
    `).run(SYNTHETIC.billNumber, order.lastInsertRowid, JSON.stringify([{ method: 'cash', amount: 5, synthetic: true }]));
  })();

  dbModule.upsertSettings({
    order_number_include_date: 'false',
    order_number_reset_daily: 'false',
  });
  const orderSeed = dbModule.generateOrderNumber();
  const billSeed = dbModule.generateBillNumber();
  dbModule.upsertSettings({
    synthetic_restore_dataset: DATASET_ID,
    synthetic_restore_order_seed: orderSeed,
    synthetic_restore_bill_seed: billSeed,
  });
}

function removeSensitiveSyntheticState(database) {
  const placeholders = SENSITIVE_SETTING_KEYS.map(() => '?').join(', ');
  database.prepare(`DELETE FROM settings WHERE key IN (${placeholders})`).run(...SENSITIVE_SETTING_KEYS);
}

function assertSyntheticDatabase(backupPath, forbiddenLocalValues) {
  const database = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    assert.deepEqual(database.pragma('integrity_check'), [{ integrity_check: 'ok' }]);
    assert.equal(database.pragma('user_version', { simple: true }), CURRENT_SCHEMA_VERSION);
    const meta = Object.fromEntries(database.prepare('SELECT key, value FROM _flo_meta').all().map((row) => [row.key, row.value]));
    assert.equal(Number(meta.schema_version), CURRENT_SCHEMA_VERSION);
    assert.equal(meta.app_version, packageJson.version);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users WHERE id = ? AND is_active = 0').get(SYNTHETIC.userId).count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM categories WHERE id = ?').get(SYNTHETIC.categoryId).count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM products WHERE id = ? AND category_id = ?').get(SYNTHETIC.productId, SYNTHETIC.categoryId).count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM orders WHERE order_number = ?').get(SYNTHETIC.orderNumber).count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?').get(SYNTHETIC.productId).count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM bills WHERE bill_number = ? AND payment_status = ?').get(SYNTHETIC.billNumber, 'paid').count, 1);
    assert.equal(database.prepare("SELECT value FROM settings WHERE key = 'synthetic_restore_dataset'").get().value, DATASET_ID);
    assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM settings WHERE key IN (${SENSITIVE_SETTING_KEYS.map(() => '?').join(', ')})`).get(...SENSITIVE_SETTING_KEYS).count, 0);
    assert.deepEqual(database.pragma('foreign_key_check'), []);
  } finally {
    database.close();
  }

  const raw = fs.readFileSync(backupPath);
  assert.equal(raw.includes(Buffer.from('cloud_device_secret')), false);
  assert.equal(raw.includes(Buffer.from('mobile_pairing_code')), false);
  for (const marker of FORBIDDEN_CONTENT_MARKERS) {
    assert.equal(raw.includes(Buffer.from(marker)), false, 'The backup contains a forbidden secret or runner marker.');
  }
  for (const value of forbiddenLocalValues.filter((entry) => typeof entry === 'string' && entry.length >= 4)) {
    assert.equal(raw.includes(Buffer.from(value)), false, 'The backup contains a local producer or runner path.');
  }
}

function writePackageMetadata(packageDir, backupPath) {
  const stat = fs.statSync(backupPath);
  const sha256 = sha256File(backupPath);
  const manifest = {
    formatVersion: 1,
    backupFile: BACKUP_FILE,
    sha256,
    sizeBytes: stat.size,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: packageJson.version,
    createdAt: new Date().toISOString(),
    datasetId: DATASET_ID,
    sourcePlatform: process.platform,
    evidenceLevel: EVIDENCE_LEVEL,
  };
  fs.writeFileSync(path.join(packageDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.writeFileSync(path.join(packageDir, CHECKSUM_FILE), `${sha256}  ${BACKUP_FILE}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.writeFileSync(path.join(packageDir, INSTRUCTIONS_FILE), [
    '# Synthetic off-device restore package',
    '',
    'This package contains synthetic test data only. It is not a restaurant backup.',
    '',
    '1. Keep the four files together and do not rename them.',
    '2. Verify SHA256SUMS before opening or copying the database.',
    '3. Use the documented recovery procedure in docs/operations/OFF_DEVICE_RESTORE_DRILL.md.',
    '4. Restore only into an empty isolated user-data directory.',
    '',
    'A passing automated check is CI_CROSS_RUNNER evidence. It does not replace the separate human drill.',
    '',
  ].join('\n'), { encoding: 'utf8', flag: 'wx' });
  return manifest;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const packageDir = args['package-dir'] || (process.env.FLO_OFF_DEVICE_PACKAGE_DIR && path.resolve(process.env.FLO_OFF_DEVICE_PACKAGE_DIR));
  const workRoot = args['work-root'] || (process.env.FLO_OFF_DEVICE_WORK_ROOT && path.resolve(process.env.FLO_OFF_DEVICE_WORK_ROOT));
  if (!packageDir || !workRoot) fail('ARGUMENTS_REQUIRED', 'Package and work directories are required.');
  if (isWithin(packageDir, workRoot) || isWithin(workRoot, packageDir)) {
    fail('DIRECTORIES_NOT_INDEPENDENT', 'The package and producer work directories must be independent.');
  }
  if (fs.existsSync(packageDir) && fs.readdirSync(packageDir).length > 0) {
    fail('PACKAGE_NOT_EMPTY', 'The package directory must be empty.');
  }

  const userDataPath = path.join(workRoot, 'source-user-data');
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(packageDir, { recursive: true });
  const restoreElectron = installElectronMock(userDataPath);
  let dbModule;
  try {
    dbModule = require('../main/db');
    dbModule.initDatabase();
    const database = dbModule.getDatabase();
    removeSensitiveSyntheticState(database);
    createSyntheticDataset(database, dbModule);
    removeSensitiveSyntheticState(database);
    const backupPath = path.join(packageDir, BACKUP_FILE);
    const backupResult = await dbModule.createBackup(backupPath);
    assert.equal(backupResult.path, backupPath);
    assert.equal(backupResult.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(fs.existsSync(`${backupPath}-wal`), false);
    assert.equal(fs.existsSync(`${backupPath}-shm`), false);
    assertSyntheticDatabase(backupPath, [
      workRoot,
      userDataPath,
      packageDir,
      repositoryRoot,
      process.env.GITHUB_WORKSPACE,
      process.env.RUNNER_TEMP,
    ]);
    const manifest = writePackageMetadata(packageDir, backupPath);
    const validated = validatePackagePreflight(packageDir);
    assert.deepEqual(fs.readdirSync(packageDir).sort(), [...PACKAGE_FILES]);
    assert.equal(validated.actualSha256, manifest.sha256);
    outputResult({
      ok: true,
      phase: 'producer',
      datasetId: manifest.datasetId,
      schemaVersion: manifest.schemaVersion,
      appVersion: manifest.appVersion,
      sha256: manifest.sha256,
      sizeBytes: manifest.sizeBytes,
      sourcePlatform: manifest.sourcePlatform,
      fileCount: PACKAGE_FILES.length,
      syntheticOnly: true,
    });
  } finally {
    if (dbModule) dbModule.closeDatabase();
    restoreElectron();
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  outputResult(sanitizedFailure(error, { phase: 'producer' }));
  process.exitCode = 1;
});
