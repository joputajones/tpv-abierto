'use strict';

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const Database = require('better-sqlite3');
const packageJson = require('../package.json');
const {
  CURRENT_SCHEMA_VERSION,
  DATASET_ID,
  fail,
  isWithin,
  outputResult,
  parseArguments,
  sanitizedFailure,
  validatePackagePreflight,
} = require('./off-device-backup-common.cjs');

const SYNTHETIC = Object.freeze({
  userId: 'SYNTHETIC-RESTORE-USER',
  categoryId: 'SYNTHETIC-RESTORE-CATEGORY',
  productId: 'SYNTHETIC-RESTORE-PRODUCT',
  orderNumber: 'SYNTHETIC-RESTORE-ORDER-001',
  billNumber: 'SYNTHETIC-RESTORE-BILL-001',
});

const FORBIDDEN_PACKAGE_SETTINGS = Object.freeze([
  'cloud_api_key',
  'cloud_device_created_at',
  'cloud_device_secret',
  'cloud_pos_hash',
  'cloud_store_id',
  'jwt_secret',
  'mobile_pairing_code',
  'mobile_pairing_code_expires_at',
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

function requireSingle(database, sql, parameters, code, message) {
  const row = database.prepare(sql).get(...parameters);
  if (!row || row.count !== 1) fail(code, message);
}

function inspectBackup(backupPath, manifest) {
  let database;
  try {
    database = new Database(backupPath, { readonly: true, fileMustExist: true });
    const integrity = database.pragma('integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      fail('SQLITE_INTEGRITY_FAILED', 'The backup failed SQLite integrity_check.');
    }
    const userVersion = database.pragma('user_version', { simple: true });
    if (manifest.schemaVersion !== CURRENT_SCHEMA_VERSION || userVersion !== manifest.schemaVersion) {
      fail('MANIFEST_SCHEMA_MISMATCH', 'The manifest and database schema versions do not match the supported schema.');
    }
    let metaRows;
    try {
      metaRows = database.prepare('SELECT key, value FROM _flo_meta').all();
    } catch {
      fail('BACKUP_METADATA_MISSING', 'The database does not contain backup metadata.');
    }
    const meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
    if (Number(meta.schema_version) !== userVersion) {
      fail('META_SCHEMA_MISMATCH', 'The database metadata and SQLite schema version do not match.');
    }
    if (meta.app_version !== manifest.appVersion || manifest.appVersion !== packageJson.version) {
      fail('APP_VERSION_MISMATCH', 'The package app version does not match this recovery validator.');
    }
    const backupCreatedAt = Date.parse(meta.backup_created_at);
    if (Number.isNaN(backupCreatedAt) || Math.abs(Date.parse(manifest.createdAt) - backupCreatedAt) > 5 * 60 * 1000) {
      fail('BACKUP_TIMESTAMP_MISMATCH', 'The manifest and database backup timestamps are inconsistent.');
    }
    requireSingle(database, 'SELECT COUNT(*) AS count FROM users WHERE id = ? AND email = ? AND is_active = 0', [SYNTHETIC.userId, 'restore-operator@example.invalid'], 'DATASET_USER_INVALID', 'The synthetic operator record is missing or duplicated.');
    requireSingle(database, 'SELECT COUNT(*) AS count FROM categories WHERE id = ?', [SYNTHETIC.categoryId], 'DATASET_CATEGORY_INVALID', 'The synthetic category is missing or duplicated.');
    requireSingle(database, 'SELECT COUNT(*) AS count FROM products WHERE id = ? AND category_id = ?', [SYNTHETIC.productId, SYNTHETIC.categoryId], 'DATASET_PRODUCT_INVALID', 'The synthetic product is missing or duplicated.');
    requireSingle(database, 'SELECT COUNT(*) AS count FROM orders WHERE order_number = ? AND total = 5', [SYNTHETIC.orderNumber], 'DATASET_ORDER_INVALID', 'The synthetic order is missing or duplicated.');
    requireSingle(database, 'SELECT COUNT(*) AS count FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.order_number = ? AND oi.product_id = ? AND oi.quantity = 2', [SYNTHETIC.orderNumber, SYNTHETIC.productId], 'DATASET_ITEM_INVALID', 'The synthetic order item is missing or duplicated.');
    requireSingle(database, 'SELECT COUNT(*) AS count FROM bills b JOIN orders o ON o.id = b.order_id WHERE b.bill_number = ? AND o.order_number = ? AND b.payment_status = ? AND b.paid_amount = 5', [SYNTHETIC.billNumber, SYNTHETIC.orderNumber, 'paid'], 'DATASET_BILL_INVALID', 'The synthetic paid bill is missing or duplicated.');
    const bill = database.prepare('SELECT payment_details FROM bills WHERE bill_number = ?').get(SYNTHETIC.billNumber);
    let payment;
    try {
      payment = JSON.parse(bill.payment_details);
    } catch {
      fail('DATASET_PAYMENT_INVALID', 'The synthetic payment details are invalid.');
    }
    if (!Array.isArray(payment) || payment.length !== 1 || payment[0].method !== 'cash' || payment[0].amount !== 5 || payment[0].synthetic !== true) {
      fail('DATASET_PAYMENT_INVALID', 'The synthetic payment details are incomplete.');
    }
    const dataset = database.prepare("SELECT value FROM settings WHERE key = 'synthetic_restore_dataset'").get();
    if (!dataset || dataset.value !== DATASET_ID) fail('DATASET_MARKER_INVALID', 'The synthetic dataset marker is missing.');
    const orderSeed = database.prepare("SELECT value FROM settings WHERE key = 'synthetic_restore_order_seed'").get();
    const billSeed = database.prepare("SELECT value FROM settings WHERE key = 'synthetic_restore_bill_seed'").get();
    if (!orderSeed || !billSeed) fail('SEQUENCE_SEED_MISSING', 'The sequence evidence is missing.');
    const forbiddenPlaceholders = FORBIDDEN_PACKAGE_SETTINGS.map(() => '?').join(', ');
    const forbidden = database.prepare(`SELECT COUNT(*) AS count FROM settings WHERE key IN (${forbiddenPlaceholders})`).get(...FORBIDDEN_PACKAGE_SETTINGS);
    if (forbidden.count !== 0) fail('PACKAGE_CONTAINS_IDENTITY', 'The synthetic package contains a device identity or credential setting.');
    if (database.pragma('foreign_key_check').length !== 0) fail('FOREIGN_KEY_CHECK_FAILED', 'The backup contains broken foreign-key references.');
    return { orderSeed: orderSeed.value, billSeed: billSeed.value };
  } catch (error) {
    if (error && typeof error.code === 'string') throw error;
    fail('SQLITE_READ_FAILED', 'The backup could not be validated as a SQLite database.');
  } finally {
    if (database) database.close();
  }
}

function suffixNumber(value) {
  const match = /-(\d+)$/.exec(value);
  if (!match) fail('SEQUENCE_FORMAT_INVALID', 'A generated sequence has an unexpected format.');
  return Number(match[1]);
}

function billSequence(value) {
  const match = /^INV-(\d{8})-(\d+)$/.exec(value);
  if (!match) fail('SEQUENCE_FORMAT_INVALID', 'A generated bill sequence has an unexpected format.');
  return { date: match[1], value: Number(match[2]) };
}

function verifyRestoredDatabase(dbModule, sequenceEvidence) {
  let database = dbModule.getDatabase();
  requireSingle(database, 'SELECT COUNT(*) AS count FROM orders WHERE order_number = ?', [SYNTHETIC.orderNumber], 'RESTORED_ORDER_INVALID', 'The restored order is missing or duplicated.');
  requireSingle(database, 'SELECT COUNT(*) AS count FROM bills WHERE bill_number = ?', [SYNTHETIC.billNumber], 'RESTORED_BILL_INVALID', 'The restored bill is missing or duplicated.');

  const nextOrderNumber = dbModule.generateOrderNumber();
  const nextBillNumber = dbModule.generateBillNumber();
  if (suffixNumber(nextOrderNumber) <= suffixNumber(sequenceEvidence.orderSeed)) {
    fail('ORDER_SEQUENCE_NOT_MONOTONIC', 'The restored order sequence did not advance.');
  }
  const priorBill = billSequence(sequenceEvidence.billSeed);
  const nextBill = billSequence(nextBillNumber);
  if (nextBill.date < priorBill.date || (nextBill.date === priorBill.date && nextBill.value <= priorBill.value)) {
    fail('BILL_SEQUENCE_NOT_MONOTONIC', 'The restored bill sequence did not advance.');
  }
  database.transaction(() => {
    const order = database.prepare(`
      INSERT INTO orders (order_number, user_id, type, status, subtotal, total)
      VALUES (?, ?, 'takeaway', 'completed', 2.5, 2.5)
    `).run(nextOrderNumber, SYNTHETIC.userId);
    database.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, product_sku, unit_price, quantity, subtotal, total, status)
      VALUES (?, ?, 'Synthetic Espresso', 'SYN-RESTORE-001', 2.5, 1, 2.5, 2.5, 'served')
    `).run(order.lastInsertRowid, SYNTHETIC.productId);
    database.prepare(`
      INSERT INTO bills (bill_number, order_id, subtotal, total, paid_amount, balance, payment_status, payment_details)
      VALUES (?, ?, 2.5, 2.5, 2.5, 0, 'paid', ?)
    `).run(nextBillNumber, order.lastInsertRowid, JSON.stringify([{ method: 'cash', amount: 2.5, synthetic: true }]));
  })();
  if (database.pragma('foreign_key_check').length !== 0) fail('RESTORED_FOREIGN_KEY_FAILED', 'The restored database has broken foreign-key references.');
  if (database.pragma('integrity_check')[0].integrity_check !== 'ok') fail('RESTORED_INTEGRITY_FAILED', 'The restored database failed integrity_check.');

  dbModule.closeDatabase();
  dbModule.initDatabase();
  database = dbModule.getDatabase();
  if (database.prepare('SELECT COUNT(*) AS count FROM orders WHERE order_number IN (?, ?)').get(SYNTHETIC.orderNumber, nextOrderNumber).count !== 2) {
    fail('REOPEN_ORDER_INVALID', 'Orders did not persist exactly once across reopen.');
  }
  if (database.prepare('SELECT COUNT(*) AS count FROM bills WHERE bill_number IN (?, ?)').get(SYNTHETIC.billNumber, nextBillNumber).count !== 2) {
    fail('REOPEN_BILL_INVALID', 'Bills did not persist exactly once across reopen.');
  }
  if (database.pragma('user_version', { simple: true }) !== CURRENT_SCHEMA_VERSION) fail('RESTORED_SCHEMA_INVALID', 'The restored schema version changed unexpectedly.');
  if (database.pragma('foreign_key_check').length !== 0) fail('REOPEN_FOREIGN_KEY_FAILED', 'The reopened database has broken foreign-key references.');
  if (database.pragma('integrity_check')[0].integrity_check !== 'ok') fail('REOPEN_INTEGRITY_FAILED', 'The reopened database failed integrity_check.');
  return { nextOrderNumber, nextBillNumber };
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const packageDir = args['package-dir'] || (process.env.FLO_OFF_DEVICE_PACKAGE_DIR && path.resolve(process.env.FLO_OFF_DEVICE_PACKAGE_DIR));
  const destinationRoot = args['destination-root'] || (process.env.FLO_OFF_DEVICE_DESTINATION_ROOT && path.resolve(process.env.FLO_OFF_DEVICE_DESTINATION_ROOT));
  const expectedSha256 = process.env.FLO_OFF_DEVICE_EXPECTED_SHA256 || undefined;
  if (!packageDir || !destinationRoot) fail('ARGUMENTS_REQUIRED', 'Package and destination directories are required.');
  if (isWithin(destinationRoot, packageDir) || isWithin(packageDir, destinationRoot)) {
    fail('DIRECTORIES_NOT_INDEPENDENT', 'The package and destination directories must be independent.');
  }
  if (fs.existsSync(destinationRoot)) fail('DESTINATION_EXISTS', 'The restore destination must not already exist.');

  let dbModule;
  let restoreElectron;
  try {
    const preflight = validatePackagePreflight(packageDir, expectedSha256);
    const sequenceEvidence = inspectBackup(preflight.backupPath, preflight.manifest);
    fs.mkdirSync(destinationRoot, { recursive: false });
    restoreElectron = installElectronMock(destinationRoot);
    dbModule = require('../main/db');
    dbModule.initDatabase();
    const restoreResult = dbModule.restoreBackup(preflight.backupPath, true);
    if (!restoreResult.success || restoreResult.mode !== 'direct' || restoreResult.backupSchemaVersion !== CURRENT_SCHEMA_VERSION) {
      fail('PRODUCTION_RESTORE_FAILED', 'The production restore path did not complete a direct restore.');
    }
    const generated = verifyRestoredDatabase(dbModule, sequenceEvidence);
    dbModule.closeDatabase();
    restoreElectron();
    outputResult({
      ok: true,
      phase: 'consumer',
      datasetId: preflight.manifest.datasetId,
      schemaVersion: preflight.manifest.schemaVersion,
      appVersion: preflight.manifest.appVersion,
      sha256: preflight.actualSha256,
      sourcePlatform: preflight.manifest.sourcePlatform,
      consumerPlatform: process.platform,
      restoreMode: restoreResult.mode,
      integrityCheck: 'ok',
      foreignKeyViolations: 0,
      sequenceAdvanced: true,
      reopenVerified: true,
      destinationCreated: true,
      generatedOrderFormat: generated.nextOrderNumber.startsWith('ORD-') ? 'ORD-*' : 'unexpected',
      generatedBillFormat: generated.nextBillNumber.startsWith('INV-') ? 'INV-*' : 'unexpected',
    });
  } catch (error) {
    if (dbModule) {
      try { dbModule.closeDatabase(); } catch {}
    }
    if (restoreElectron) restoreElectron();
    fs.rmSync(destinationRoot, { recursive: true, force: true });
    outputResult(sanitizedFailure(error, { phase: 'consumer', destinationCreated: false }));
    process.exitCode = 1;
  }
}

run().catch((error) => {
  outputResult(sanitizedFailure(error, { phase: 'consumer', destinationCreated: false }));
  process.exitCode = 1;
});
