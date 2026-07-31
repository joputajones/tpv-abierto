'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const Module = require('node:module');

const userDataPath = process.env.FLO_RESTART_USER_DATA;
if (!userDataPath || !path.isAbsolute(userDataPath)) {
  throw new Error('FLO_RESTART_USER_DATA must be an absolute test directory');
}

const originalLoad = Module._load;
const mockApp = Object.freeze({
  isPackaged: true,
  getPath: () => userDataPath,
  getVersion: () => 'restart-recovery-test',
});

// The worker intentionally does not import main/index.ts. This explicit mock
// prevents startServer() from initializing WhatsApp while preserving the real
// database, HTTP API, KDS and cleanup functions used by the desktop process.
Module._load = function loadForRestartHarness(request, parent, isMain) {
  if (request === 'electron') return { app: mockApp };
  if (request.endsWith('/services/whatsapp') || request === './services/whatsapp') {
    return {
      initFromDb: () => undefined,
      shutdown: () => undefined,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  closeDatabase,
  generateOrderNumber,
  getCurrentSchemaVersion,
  getDatabase,
  getDbPath,
  initDatabase,
} = require('../main/db');

let serverModule = null;
let kdsModule = null;
let servicesStarted = false;
let transactionOpen = false;
let shuttingDown = false;

function send(message) {
  if (process.connected && typeof process.send === 'function') process.send(message);
}

function fileState() {
  const dbPath = getDbPath();
  const describe = (filePath) => {
    if (!fs.existsSync(filePath)) return { exists: false, size: 0 };
    return { exists: true, size: fs.statSync(filePath).size };
  };
  return {
    db: describe(dbPath),
    wal: describe(`${dbPath}-wal`),
    shm: describe(`${dbPath}-shm`),
  };
}

function requestHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      headers: { Connection: 'close' },
      timeout: 5_000,
    }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('timeout', () => request.destroy(new Error(`health timeout on ${port}`)));
    request.once('error', reject);
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitForPortsClosed(ports) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const states = await Promise.all(ports.map(canConnect));
    if (states.every((connected) => !connected)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`service ports did not close: ${ports.join(', ')}`);
}

function upsertMarker(key, value) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, new Date().toISOString());
}

function markerCounts(keys) {
  const db = getDatabase();
  const statement = db.prepare('SELECT COUNT(*) AS count FROM settings WHERE key = ?');
  return Object.fromEntries(keys.map((key) => [key, statement.get(key).count]));
}

function datasetCounts() {
  const db = getDatabase();
  return {
    categories: db.prepare(`SELECT COUNT(*) AS count FROM categories WHERE id = 'TEST-RESTART-CATEGORY-001'`).get().count,
    products: db.prepare(`SELECT COUNT(*) AS count FROM products WHERE id = 'TEST-RESTART-PRODUCT-001'`).get().count,
    users: db.prepare(`SELECT COUNT(*) AS count FROM users WHERE id = 'test-restart-user'`).get().count,
    orders: db.prepare(`SELECT COUNT(*) AS count FROM orders WHERE order_number = 'TEST-RESTART-ORDER-001'`).get().count,
    bills: db.prepare(`SELECT COUNT(*) AS count FROM bills WHERE bill_number = 'TEST-RESTART-BILL-001'`).get().count,
  };
}

function snapshot(markerKeys = [], probeWrite = false) {
  const db = getDatabase();
  const integrityRows = db.pragma('integrity_check');
  const foreignKeyRows = db.pragma('foreign_key_check');
  if (probeWrite) {
    db.transaction(() => {
      upsertMarker('restart:write-probe', 'synthetic');
      db.prepare(`DELETE FROM settings WHERE key = 'restart:write-probe'`).run();
    })();
  }
  return {
    dbPath: getDbPath(),
    userDataPath,
    userVersion: getCurrentSchemaVersion(),
    journalMode: db.pragma('journal_mode', { simple: true }),
    integrity: integrityRows,
    foreignKeys: foreignKeyRows,
    markers: markerCounts(markerKeys),
    dataset: datasetCounts(),
    productTotal: db.prepare('SELECT COUNT(*) AS count FROM products').get().count,
    sequenceOrders: db.prepare(`
      SELECT order_number FROM orders
      WHERE special_instructions LIKE 'TEST-RESTART-SEQUENCE-%'
      ORDER BY id
    `).all().map((row) => row.order_number),
    files: fileState(),
  };
}

function seedSyntheticDataset() {
  const db = getDatabase();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO categories (id, name, is_active)
      VALUES ('TEST-RESTART-CATEGORY-001', 'Synthetic Category', 1)
    `).run();
    db.prepare(`
      INSERT INTO products (id, category_id, name, price, is_active)
      VALUES ('TEST-RESTART-PRODUCT-001', 'TEST-RESTART-CATEGORY-001', 'Synthetic Product', 123, 1)
    `).run();
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, is_active)
      VALUES ('test-restart-user', 'Synthetic Restart User', 'restart@example.invalid', 'TEST-ONLY', 'owner', 1)
    `).run();
    const order = db.prepare(`
      INSERT INTO orders (order_number, user_id, type, status, subtotal, total, special_instructions)
      VALUES ('TEST-RESTART-ORDER-001', 'test-restart-user', 'takeaway', 'pending', 123, 123, 'SYNTHETIC-RESTART-DATA')
    `).run();
    db.prepare(`
      INSERT INTO bills (bill_number, order_id, subtotal, total, balance, payment_status)
      VALUES ('TEST-RESTART-BILL-001', ?, 123, 123, 123, 'unpaid')
    `).run(order.lastInsertRowid);
  })();
  return datasetCounts();
}

function createSequenceOrder(label) {
  const db = getDatabase();
  const orderNumber = generateOrderNumber();
  const result = db.prepare(`
    INSERT INTO orders (order_number, type, status, subtotal, total, special_instructions)
    VALUES (?, 'takeaway', 'pending', 0, 0, ?)
  `).run(orderNumber, `TEST-RESTART-SEQUENCE-${label}`);
  return { id: Number(result.lastInsertRowid), orderNumber };
}

async function startServices() {
  serverModule = require('../main/server');
  kdsModule = require('../main/kds-server');
  await serverModule.startServer();
  await kdsModule.startKdsServer();
  servicesStarted = true;
  const apiPort = serverModule.getServerPort();
  const kdsPort = kdsModule.getKdsPort();
  const [apiHealth, kdsHealth] = await Promise.all([
    requestHealth(apiPort),
    requestHealth(kdsPort),
  ]);
  if (apiHealth !== 200 || kdsHealth !== 200) {
    throw new Error(`service health failed: api=${apiHealth}, kds=${kdsHealth}`);
  }
  return { apiPort, kdsPort, apiHealth, kdsHealth };
}

async function gracefulCleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  const ports = [];
  if (servicesStarted) {
    ports.push(serverModule.getServerPort(), kdsModule.getKdsPort());
    kdsModule.stopKdsServer();
    serverModule.stopServer();
  }
  if (transactionOpen) {
    // A real orderly shutdown must not silently commit a caller-owned open
    // transaction. Roll it back before closing the production connection.
    getDatabase().exec('ROLLBACK');
    transactionOpen = false;
  }
  closeDatabase();
  if (ports.length > 0) await waitForPortsClosed(ports);
}

async function handleCommand(message) {
  const { id, command, payload = {} } = message;
  try {
    let result;
    switch (command) {
      case 'snapshot':
        result = snapshot(payload.markerKeys || [], Boolean(payload.probeWrite));
        break;
      case 'commit-marker':
        getDatabase().transaction(() => upsertMarker(payload.key, payload.value || 'committed'))();
        result = { key: payload.key, files: fileState() };
        break;
      case 'open-uncommitted':
        if (transactionOpen) throw new Error('transaction already open');
        getDatabase().exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        upsertMarker(payload.key, payload.value || 'uncommitted');
        result = { key: payload.key, transactionOpen: true, files: fileState() };
        break;
      case 'seed-dataset':
        result = seedSyntheticDataset();
        break;
      case 'create-sequence-order':
        result = createSequenceOrder(payload.label);
        break;
      case 'file-state':
        result = fileState();
        break;
      case 'shutdown':
        await gracefulCleanup();
        result = { exitCode: 0, files: fileState() };
        send({ type: 'response', id, ok: true, result });
        if (process.connected) process.disconnect();
        process.exitCode = 0;
        return;
      default:
        throw new Error(`unknown worker command: ${command}`);
    }
    send({ type: 'response', id, ok: true, result });
  } catch (error) {
    send({ type: 'response', id, ok: false, error: error.stack || error.message });
  }
}

async function initialize() {
  fs.mkdirSync(userDataPath, { recursive: true });
  initDatabase();
  const services = process.env.FLO_RESTART_SERVICES === '1'
    ? await startServices()
    : { apiPort: null, kdsPort: null, apiHealth: null, kdsHealth: null };
  const dbPath = getDbPath();
  if (path.resolve(dbPath) !== path.resolve(userDataPath, 'flo.db')) {
    throw new Error(`database escaped test userData: ${dbPath}`);
  }
  send({
    type: 'ready',
    pid: process.pid,
    dbPath,
    userDataPath,
    userVersion: getCurrentSchemaVersion(),
    journalMode: getDatabase().pragma('journal_mode', { simple: true }),
    files: fileState(),
    services,
    isolation: {
      whatsappDisabled: true,
      cloudStarted: false,
      telemetryStarted: false,
      mdnsStarted: false,
      printerStarted: false,
      windowCreated: false,
    },
  });
}

process.on('message', (message) => {
  void handleCommand(message);
});

process.on('disconnect', () => {
  if (!shuttingDown) {
    void gracefulCleanup().finally(() => {
      process.exitCode = 0;
    });
  }
});

initialize().catch(async (error) => {
  send({ type: 'fatal', error: error.stack || error.message });
  try { await gracefulCleanup(); } catch {}
  process.exit(1);
});
