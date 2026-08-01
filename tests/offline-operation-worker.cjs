'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');

const { OfflineNetworkGuard } = require('./offline-network-guard.cjs');

const userDataPath = process.env.FLO_OFFLINE_USER_DATA;
const apiPort = Number(process.env.PORT);
const kdsPort = Number(process.env.KDS_PORT);
if (!userDataPath || !path.isAbsolute(userDataPath)) {
  throw new Error('FLO_OFFLINE_USER_DATA must be an absolute test directory');
}
if (!Number.isInteger(apiPort) || !Number.isInteger(kdsPort)) {
  throw new Error('PORT and KDS_PORT must be isolated integer ports');
}

const guard = new OfflineNetworkGuard().install();
const originalLoad = Module._load;
const mockApp = Object.freeze({
  isPackaged: true,
  getPath: () => userDataPath,
  getVersion: () => require('../package.json').version,
});
const mockSafeStorage = Object.freeze({
  isEncryptionAvailable: () => false,
  encryptString: () => { throw new Error('safeStorage disabled in offline test sandbox'); },
  decryptString: () => { throw new Error('safeStorage disabled in offline test sandbox'); },
});

Module._load = function loadForOfflineHarness(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: mockApp,
      safeStorage: mockSafeStorage,
      shell: { openExternal: async () => { throw new Error('external shell disabled in offline test sandbox'); } },
    };
  }
  if (request === 'ws') {
    return guard.wrapWebSocketModule(originalLoad.call(this, request, parent, isMain));
  }
  return originalLoad.call(this, request, parent, isMain);
};

const dbModule = require('../main/db');
const serverModule = require('../main/server');
const kdsModule = require('../main/kds-server');
const { cloudSync } = require('../main/services/cloud-sync');
const { telemetry, sendEvent } = require('../main/services/telemetry');
const { googleDrive } = require('../main/services/google-drive');
const whatsapp = require('../main/services/whatsapp');
const WebSocket = require('ws');

const PASSWORD = 'OfflineTest42';
const EMAIL = 'offline-owner@example.invalid';
const SCHEMA_VERSION = 38;
let shuttingDown = false;

function send(message) {
  if (process.connected && typeof process.send === 'function') process.send(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await delay(20);
  }
  throw new Error(`${label} timed out after ${timeoutMs} ms; last=${JSON.stringify(last)}`);
}

function upsertSettings(entries) {
  const statement = dbModule.getDatabase().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const updatedAt = new Date().toISOString();
  for (const [key, value] of Object.entries(entries)) statement.run(key, String(value), updatedAt);
}

async function request(basePort, pathname, { method = 'GET', token, body, service = 'local-api' } = {}) {
  return guard.runWithService(service, async () => {
    const serialized = body === undefined ? null : JSON.stringify(body);
    const response = await new Promise((resolve, reject) => {
      const outgoing = http.request({
        host: '127.0.0.1',
        port: basePort,
        path: pathname,
        method,
        timeout: 5_000,
        headers: {
          Connection: 'close',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(serialized !== null ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(serialized),
          } : {}),
        },
      }, (incoming) => {
        let text = '';
        incoming.setEncoding('utf8');
        incoming.on('data', (chunk) => { text += chunk; });
        incoming.once('end', () => resolve({ status: incoming.statusCode || 0, text }));
      });
      outgoing.once('timeout', () => outgoing.destroy(new Error(`local request ${basePort}${pathname} timed out`)));
      outgoing.once('error', reject);
      if (serialized !== null) outgoing.write(serialized);
      outgoing.end();
    });
    const text = response.text;
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${method} ${pathname} returned ${response.status}: ${JSON.stringify(data)}`);
    }
    return { status: response.status, data, text };
  });
}

function databaseSnapshot(ids = {}, probeWrite = false) {
  const db = dbModule.getDatabase();
  if (probeWrite) {
    db.transaction(() => {
      upsertSettings({ 'offline:test-write-probe': 'synthetic' });
      db.prepare("DELETE FROM settings WHERE key = 'offline:test-write-probe'").run();
    })();
  }
  const one = (sql, value) => value === undefined ? null : db.prepare(sql).get(value);
  return {
    dbPath: dbModule.getDbPath(),
    userVersion: db.pragma('user_version', { simple: true }),
    journalMode: db.pragma('journal_mode', { simple: true }),
    integrity: db.pragma('integrity_check').map((row) => row.integrity_check),
    foreignKeys: db.pragma('foreign_key_check'),
    category: one('SELECT id, name FROM categories WHERE id = ?', ids.categoryId),
    product: one('SELECT id, name, price FROM products WHERE id = ?', ids.productId),
    table: one('SELECT id, number FROM tables WHERE id = ?', ids.tableId),
    order: one('SELECT id, order_number, total, status FROM orders WHERE id = ?', ids.orderId),
    bill: one('SELECT id, bill_number, total, payment_status FROM bills WHERE id = ?', ids.billId),
    abruptOrder: one('SELECT id, order_number, total, status FROM orders WHERE id = ?', ids.abruptOrderId),
  };
}

async function startupSnapshot() {
  const [apiHealth, kdsHealth, frontend] = await Promise.all([
    request(apiPort, '/api/health'),
    request(kdsPort, '/api/health', { service: 'local-kds' }),
    request(apiPort, '/', { service: 'local-frontend' }),
  ]);
  const db = databaseSnapshot();
  return {
    apiHealth: apiHealth.status,
    kdsHealth: kdsHealth.status,
    frontendStatus: frontend.status,
    frontendBuilt: !frontend.text.includes('Frontend not built'),
    ...db,
  };
}

async function initializeSetup() {
  const response = await request(apiPort, '/api/auth/setup/initialize', {
    method: 'POST',
    body: {
      name: 'SYNTHETIC-OFFLINE-OWNER',
      email: EMAIL,
      password: PASSWORD,
      business_type: 'restaurant',
      setup_profile: 'empty',
      service_model: 'finedine',
      language: 'en',
      business_name: 'SYNTHETIC-OFFLINE-STORE',
      country: 'ES',
      currency: 'EUR',
      timezone: 'Europe/Madrid',
      terms_accepted: true,
      anonymous_data_consent: false,
      cloud_sync_enabled: false,
    },
  });
  return {
    token: response.data.access_token,
    userId: response.data.user.id,
    ownerName: response.data.user.name,
  };
}

async function createCatalog(token) {
  const category = (await request(apiPort, '/api/categories', {
    method: 'POST', token,
    body: { name: 'SYNTHETIC-OFFLINE-CATEGORY', color: '#123456', is_active: true },
  })).data.category;
  const product = (await request(apiPort, '/api/products', {
    method: 'POST', token,
    body: { category_id: category.id, name: 'SYNTHETIC-OFFLINE-PRODUCT', price: 10, is_active: true },
  })).data.product;
  const updated = (await request(apiPort, `/api/products/${product.id}`, {
    method: 'PUT', token,
    body: { name: 'SYNTHETIC-OFFLINE-PRODUCT-EDITED', price: 12 },
  })).data.product;
  const table = (await request(apiPort, '/api/tables', {
    method: 'POST', token,
    body: { number: 'SYNTHETIC-OFFLINE-TABLE', capacity: 4 },
  })).data.table;
  const catalog = (await request(apiPort, '/api/products', { token })).data.products;
  return {
    categoryId: category.id,
    productId: product.id,
    tableId: table.id,
    updatedName: updated.name,
    updatedPrice: Number(updated.price),
    queryFound: catalog.some((item) => item.id === product.id),
  };
}

function connectKds(token) {
  return new Promise((resolve, reject) => {
    const socket = guard.runWithService('local-kds-websocket', () => new WebSocket(`ws://127.0.0.1:${kdsPort}/kds`));
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('KDS WebSocket authentication timed out'));
    }, 5_000);
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'connected') socket.send(JSON.stringify({ type: 'auth', token }));
      if (message.type === 'auth_error') {
        clearTimeout(timer);
        socket.terminate();
        reject(new Error(`KDS WebSocket auth failed: ${message.message}`));
      }
      if (message.type === 'auth_success') {
        clearTimeout(timer);
        resolve(socket);
      }
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function mainFlow({ token, productId, tableId }) {
  const kdsLogin = await request(kdsPort, '/api/auth/login', {
    method: 'POST', service: 'local-kds', body: { email: EMAIL, password: PASSWORD },
  });
  const socket = await connectKds(kdsLogin.data.access_token);
  try {
    const order = (await request(apiPort, '/api/orders', {
      method: 'POST', token,
      body: {
        table_id: tableId,
        type: 'dine_in',
        guest_count: 1,
        special_instructions: 'SYNTHETIC-OFFLINE-ORDER-001',
        items: [{ product_id: productId, quantity: 1 }],
      },
    })).data.order;
    const changed = (await request(apiPort, `/api/orders/${order.id}/items`, {
      method: 'POST', token,
      body: { items: [{ product_id: productId, quantity: 2 }] },
    })).data.order;
    const confirmed = (await request(apiPort, `/api/orders/${order.id}/status`, {
      method: 'PATCH', token, body: { status: 'preparing' },
    })).data.order;
    const kdsOrders = (await request(kdsPort, '/api/kds/orders', {
      token: kdsLogin.data.access_token, service: 'local-kds',
    })).data.orders;
    const bill = (await request(apiPort, '/api/bills/generate', {
      method: 'POST', token, body: { order_id: order.id },
    })).data.bill;
    const payment = (await request(apiPort, `/api/bills/${bill.id}/payment`, {
      method: 'POST', token,
      body: { method: 'cash', amount: bill.total, notes: 'SYNTHETIC-OFFLINE-PAYMENT' },
    })).data.bill;
    const persisted = (await request(apiPort, `/api/orders/${order.id}`, { token })).data.order;
    return {
      orderId: order.id,
      billId: bill.id,
      orderNumber: order.order_number,
      billNumber: bill.bill_number,
      itemQuantities: changed.items.map((item) => Number(item.quantity)).sort((a, b) => a - b),
      confirmedStatus: confirmed.status,
      kdsFound: kdsOrders.some((item) => Number(item.id) === Number(order.id)),
      total: Number(payment.total),
      paymentStatus: payment.payment_status,
      persistedStatus: persisted.status,
    };
  } finally {
    socket.close();
  }
}

async function createAbruptOperation({ token, productId }) {
  const order = (await request(apiPort, '/api/orders', {
    method: 'POST', token,
    body: {
      type: 'takeaway',
      special_instructions: 'SYNTHETIC-OFFLINE-ABRUPT-ORDER',
      items: [{ product_id: productId, quantity: 1 }],
    },
  })).data.order;
  return { abruptOrderId: order.id, orderNumber: order.order_number, total: Number(order.total) };
}

async function verifyOptionalUnconfigured(token) {
  const before = guard.summary().totalAttempts;
  cloudSync.stop();
  await guard.runWithService('cloud-unconfigured', async () => cloudSync.start());
  telemetry.stop();
  guard.runWithService('telemetry-no-consent', () => telemetry.start());
  googleDrive.stop();
  guard.runWithService('google-drive-unconfigured', () => googleDrive.start());
  await delay(50);
  const settings = Object.fromEntries(dbModule.getDatabase().prepare(
    "SELECT key, value FROM settings WHERE key IN ('cloud_sync_enabled','telemetry_enabled','whatsapp_enabled')",
  ).all().map((row) => [row.key, row.value]));
  const health = await request(apiPort, '/api/health', { token });
  return { attempts: guard.summary().totalAttempts - before, settings, apiHealth: health.status };
}

async function verifyCloudBlocked({ token, orderId }) {
  const startedAt = Date.now();
  upsertSettings({
    cloud_server_url: 'https://cloud.offline.invalid',
    cloud_api_key: 'SYNTHETIC-NON-SECRET-KEY',
    cloud_store_id: 'SYNTHETIC-OFFLINE-STORE',
    cloud_registration_status: 'registered',
    cloud_sync_enabled: '1',
    cloud_orders_enabled: '1',
    cloud_command_polling_enabled: '0',
  });
  guard.runWithService('cloud-sync', () => cloudSync.reload());
  guard.runWithService('cloud-sync', () => cloudSync.recordOrderChanged(orderId, 'order.offline_probe'));
  const event = await guard.waitForEvent((item) => item.service === 'cloud-sync' && item.result === 'blocked');
  const [api, kds] = await Promise.all([
    request(apiPort, '/api/health', { token }),
    request(kdsPort, '/api/health', { service: 'local-kds' }),
  ]);
  const outbox = dbModule.getDatabase().prepare(
    "SELECT COUNT(*) AS count FROM cloud_sync_outbox WHERE status IN ('pending','failed','sending')",
  ).get().count;
  cloudSync.stop();
  upsertSettings({ cloud_sync_enabled: '0', cloud_command_polling_enabled: '0' });
  return { event, elapsedMs: Date.now() - startedAt, apiHealth: api.status, kdsHealth: kds.status, outbox };
}

async function verifyTelemetry({ consent, token }) {
  telemetry.stop();
  upsertSettings({ telemetry_enabled: consent ? 'true' : 'false', anonymous_data_consent: consent ? 'true' : 'false' });
  const before = guard.attemptsFor(consent ? 'telemetry-consented' : 'telemetry-no-consent').length;
  await guard.runWithService(consent ? 'telemetry-consented' : 'telemetry-no-consent', async () => {
    await sendEvent(consent ? 'offline_consented_probe' : 'offline_no_consent_probe');
  });
  const attempts = guard.attemptsFor(consent ? 'telemetry-consented' : 'telemetry-no-consent').slice(before);
  const health = await request(apiPort, '/api/health', { token });
  return { consent, attempts, apiHealth: health.status };
}

async function verifyUpdater(token) {
  const startedAt = Date.now();
  let handled = false;
  await guard.runWithService('auto-updater', async () => {
    try {
      await fetch('https://updates.offline.invalid/latest.yml', { signal: AbortSignal.timeout(1_000) });
    } catch (error) {
      handled = error?.code === 'OFFLINE_NETWORK_BLOCKED';
    }
  });
  const health = await request(apiPort, '/api/health', { token });
  return {
    handled,
    elapsedMs: Date.now() - startedAt,
    attempts: guard.attemptsFor('auto-updater'),
    apiHealth: health.status,
    userState: 'update unavailable; local operation remains available',
  };
}

async function verifyFrontendResources() {
  const root = await request(apiPort, '/', { service: 'local-frontend' });
  const frontendRoot = path.resolve(__dirname, '..', 'frontend', 'out');
  const htmlFiles = fs.readdirSync(frontendRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(entry.parentPath, entry.name));
  const cssFiles = fs.readdirSync(frontendRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => path.join(entry.parentPath, entry.name));
  const runtimeReferences = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<(?:script|img|source|video|audio|link)\b[^>]*?\b(?:src|href|poster)=["']([^"']+)["']/gi)) {
      runtimeReferences.push(match[1]);
    }
  }
  const cssExternal = cssFiles.flatMap((file) => {
    const css = fs.readFileSync(file, 'utf8');
    return [...css.matchAll(/(?:@import\s+(?:url\()?|url\()["']?(https?:\/\/[^\s"')]+)/gi)].map((match) => match[1]);
  });
  const external = [...new Set(runtimeReferences.filter((value) => /^(?:https?:)?\/\//i.test(value)).concat(cssExternal))];
  const localAssets = [...new Set(runtimeReferences.filter((value) => value.startsWith('/')))];
  const missingLocalAssets = localAssets.filter((value) => {
    const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    return !fs.existsSync(path.join(frontendRoot, pathname.replace(/^\//, '')));
  });
  const statuses = [];
  for (const asset of localAssets.slice(0, 24)) {
    statuses.push((await request(apiPort, asset, { service: 'local-frontend' })).status);
  }
  return {
    rootStatus: root.status,
    htmlFileCount: htmlFiles.length,
    runtimeReferenceCount: runtimeReferences.length,
    external,
    localAssetCount: localAssets.length,
    missingLocalAssets,
    sampledLocalAssets: localAssets.slice(0, 24),
    statuses,
  };
}

async function verifyProlonged({ token, productId }) {
  const before = guard.summary().totalAttempts;
  const results = [];
  for (let index = 1; index <= 3; index++) {
    const order = (await request(apiPort, '/api/orders', {
      method: 'POST', token,
      body: {
        type: 'takeaway',
        special_instructions: `SYNTHETIC-OFFLINE-PROLONGED-${index}`,
        items: [{ product_id: productId, quantity: index }],
      },
    })).data.order;
    const bill = (await request(apiPort, '/api/bills/generate', {
      method: 'POST', token, body: { order_id: order.id },
    })).data.bill;
    const paid = (await request(apiPort, `/api/bills/${bill.id}/payment`, {
      method: 'POST', token, body: { method: 'cash', amount: bill.total },
    })).data.bill;
    results.push({ orderId: order.id, billId: bill.id, paymentStatus: paid.payment_status });
  }
  await delay(100);
  return { results, additionalAttempts: guard.summary().totalAttempts - before };
}

async function verifySyntheticReconnect({ token, orderId }) {
  const received = [];
  const syntheticServer = http.createServer((req, res) => {
    received.push({ method: req.method, path: String(req.url || '').split('?')[0] });
    req.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, accepted: true }));
  });
  await new Promise((resolve, reject) => {
    syntheticServer.once('error', reject);
    syntheticServer.listen(0, '127.0.0.1', resolve);
  });
  const address = syntheticServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    guard.setSyntheticEndpoint('synthetic.external.test', `http://127.0.0.1:${port}`);
    upsertSettings({
      cloud_server_url: 'https://synthetic.external.test',
      cloud_api_key: 'SYNTHETIC-NON-SECRET-KEY',
      cloud_registration_status: 'registered',
      cloud_sync_enabled: '1',
      cloud_orders_enabled: '1',
      cloud_command_polling_enabled: '0',
    });
    dbModule.getDatabase().prepare(
      "UPDATE cloud_sync_outbox SET status = 'failed', next_attempt_at = NULL WHERE status != 'delivered'",
    ).run();
    guard.runWithService('cloud-reconnect', () => cloudSync.reload());
    await waitUntil(() => cloudSync.flushing === false, 1_000, 'initial synthetic cloud flush');
    if (dbModule.getDatabase().prepare(
      "SELECT COUNT(*) AS count FROM cloud_sync_outbox WHERE status != 'delivered'",
    ).get().count > 0) {
      dbModule.getDatabase().prepare(
        "UPDATE cloud_sync_outbox SET status = 'failed', next_attempt_at = NULL WHERE status != 'delivered'",
      ).run();
      await guard.runWithService('cloud-reconnect', () => cloudSync.flushOutbox());
    }
    guard.runWithService('cloud-reconnect', () => cloudSync.recordOrderChanged(orderId, 'order.reconnect_probe'));
    await waitUntil(() => cloudSync.flushing === false, 1_000, 'new synthetic cloud event flush');
    if (dbModule.getDatabase().prepare(
      "SELECT COUNT(*) AS count FROM cloud_sync_outbox WHERE status != 'delivered'",
    ).get().count > 0) {
      dbModule.getDatabase().prepare(
        "UPDATE cloud_sync_outbox SET status = 'failed', next_attempt_at = NULL WHERE status != 'delivered'",
      ).run();
      await guard.runWithService('cloud-reconnect', () => cloudSync.flushOutbox());
    }
    await waitUntil(() => {
      const pending = dbModule.getDatabase().prepare(
        "SELECT COUNT(*) AS count FROM cloud_sync_outbox WHERE status != 'delivered'",
      ).get().count;
      return pending === 0 ? true : false;
    }, 3_000, 'synthetic cloud outbox delivery');
    const health = await request(apiPort, '/api/health', { token });
    return {
      received,
      redirected: guard.attemptsFor('cloud-reconnect').filter((event) => event.result === 'redirected-to-loopback'),
      remaining: dbModule.getDatabase().prepare(
        "SELECT COUNT(*) AS count FROM cloud_sync_outbox WHERE status != 'delivered'",
      ).get().count,
      apiHealth: health.status,
    };
  } finally {
    cloudSync.stop();
    guard.clearSyntheticEndpoints();
    upsertSettings({ cloud_sync_enabled: '0', cloud_command_polling_enabled: '0' });
    await new Promise((resolve) => syntheticServer.close(resolve));
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  cloudSync.stop();
  telemetry.stop();
  googleDrive.stop();
  whatsapp.shutdown();
  kdsModule.stopKdsServer();
  serverModule.stopServer();
  dbModule.closeDatabase();
  guard.uninstall();
}

async function handleCommand(message) {
  const { id, command, payload = {} } = message;
  try {
    let result;
    switch (command) {
      case 'startup': result = await startupSnapshot(); break;
      case 'setup': result = await initializeSetup(); break;
      case 'catalog': result = await createCatalog(payload.token); break;
      case 'main-flow': result = await mainFlow(payload); break;
      case 'abrupt-operation': result = await createAbruptOperation(payload); break;
      case 'snapshot': result = databaseSnapshot(payload.ids, Boolean(payload.probeWrite)); break;
      case 'optional-unconfigured': result = await verifyOptionalUnconfigured(payload.token); break;
      case 'cloud-blocked': result = await verifyCloudBlocked(payload); break;
      case 'telemetry': result = await verifyTelemetry(payload); break;
      case 'updater': result = await verifyUpdater(payload.token); break;
      case 'frontend-resources': result = await verifyFrontendResources(); break;
      case 'prolonged': result = await verifyProlonged(payload); break;
      case 'synthetic-reconnect': result = await verifySyntheticReconnect(payload); break;
      case 'guard-summary': result = guard.summary(); break;
      case 'shutdown':
        result = { guard: guard.summary(), dbPath: dbModule.getDbPath() };
        send({ type: 'response', id, ok: true, result });
        await shutdown();
        process.exit(0);
        return;
      default: throw new Error(`Unknown offline worker command: ${command}`);
    }
    send({ type: 'response', id, ok: true, result });
  } catch (error) {
    send({ type: 'response', id, ok: false, error: error?.stack || String(error) });
  }
}

async function boot() {
  fs.mkdirSync(userDataPath, { recursive: true });
  dbModule.initDatabase();
  await serverModule.startServer();
  await kdsModule.startKdsServer();
  guard.runWithService('cloud-unconfigured', () => cloudSync.start());
  guard.runWithService('telemetry-no-consent', () => telemetry.start());
  guard.runWithService('google-drive-unconfigured', () => googleDrive.start());
  const snapshot = await startupSnapshot();
  if (snapshot.userVersion !== SCHEMA_VERSION) throw new Error(`unexpected schema version ${snapshot.userVersion}`);
  send({
    type: 'ready',
    pid: process.pid,
    userDataPath,
    dbPath: dbModule.getDbPath(),
    apiPort,
    kdsPort,
    snapshot,
    isolation: {
      printing: 'not-started',
      mdns: 'not-started',
      devices: 'not-started',
      visibleWindows: 0,
    },
  });
}

process.on('message', (message) => void handleCommand(message));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('disconnect', () => void shutdown().finally(() => process.exit(0)));
process.on('uncaughtException', (error) => {
  send({ type: 'fatal', error: error?.stack || String(error) });
  void shutdown().finally(() => process.exit(1));
});
process.on('unhandledRejection', (error) => {
  send({ type: 'fatal', error: error?.stack || String(error) });
  void shutdown().finally(() => process.exit(1));
});

boot().catch((error) => {
  send({ type: 'fatal', error: error?.stack || String(error) });
  void shutdown().finally(() => process.exit(1));
});
