'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, Menu, session } = require('electron');
const { OfflineNetworkGuard, isLoopbackHost } = require('./offline-network-guard.cjs');

const validPackage = process.env.FLO_RECOVERY_E2E_VALID;
const alteredPackage = process.env.FLO_RECOVERY_E2E_ALTERED;
const reportPath = process.env.FLO_RECOVERY_E2E_REPORT;
if (!validPackage || !alteredPackage || !reportPath) throw new Error('E2E probe configuration missing');

const startedServices = [];
function blockFunction(modulePath, exportName) {
  const target = require(modulePath);
  target[exportName] = () => {
    startedServices.push(exportName);
    throw new Error(`isolated mode started ${exportName}`);
  };
}
blockFunction('../dist/db', 'initDatabase');
blockFunction('../dist/server', 'startServer');
blockFunction('../dist/kds-server', 'startKdsServer');
blockFunction('../dist/printers/thermal', 'initPrinter');
blockFunction('../dist/services/whatsapp', 'initFromDb');
for (const [modulePath, objectName] of [
  ['../dist/services/cloud-sync', 'cloudSync'],
  ['../dist/services/telemetry', 'telemetry'],
  ['../dist/services/google-drive', 'googleDrive'],
]) {
  const target = require(modulePath)[objectName];
  target.start = () => {
    startedServices.push(`${objectName}.start`);
    throw new Error(`isolated mode started ${objectName}`);
  };
}

const guard = new OfflineNetworkGuard().install();
const rendererExternalRequests = [];
app.on('ready', () => {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      const url = new URL(details.url);
      if (isLoopbackHost(url.hostname)) callback({ cancel: false });
      else {
        rendererExternalRequests.push({ protocol: url.protocol.replace(':', ''), host: url.hostname });
        callback({ cancel: true });
      }
    },
  );
});

dialog.showSaveDialog = async () => ({ canceled: false, filePath: reportPath });
process.env.FLO_RECOVERY_TEST_SELECTION = validPackage;
process.argv.push('--recovery-assistant');
require('../dist/index');

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(predicate, message, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`${message}; ${lastError?.message || 'timeout'}`);
}

async function pressKey(window, keyCode) {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  await delay(100);
}

async function focusNativeControl(window, testId) {
  const control = await window.webContents.executeJavaScript(`(() => {
    const target = document.querySelector('[data-testid=${testId}]');
    target?.focus({ preventScroll: true });
    return {
      tag: target?.tagName,
      tabIndex: target?.tabIndex,
      activeTestId: document.activeElement?.getAttribute('data-testid'),
    };
  })()`);
  assert.equal(control.tag, 'BUTTON', `${testId} is not a native button`);
  assert.equal(control.tabIndex, 0, `${testId} is not in the default keyboard order`);
  assert.equal(control.activeTestId, testId, `${testId} could not receive focus`);
}

async function focusByTab(window, testId, maxTabs = 6) {
  for (let tab = 1; tab <= maxTabs; tab += 1) {
    await pressKey(window, 'TAB');
    const focused = await window.webContents.executeJavaScript(
      `document.activeElement?.getAttribute('data-testid') === ${JSON.stringify(testId)}`,
    );
    if (focused) return { method: 'native-tab', tab };
  }
  const active = await window.webContents.executeJavaScript(
    "({ tag: document.activeElement?.tagName, testId: document.activeElement?.getAttribute('data-testid') })",
  );
  if (process.platform !== 'linux') {
    throw new Error(`keyboard focus did not reach ${testId}; active=${JSON.stringify(active)}`);
  }

  // Chromium on headless Linux does not apply Tab's default focus action to
  // sendInputEvent, even with a focused BrowserWindow. Keep the Linux gate
  // deterministic by verifying the real DOM tab order, then focus the same
  // native control before exercising its actual Space-key activation.
  const order = await window.webContents.executeJavaScript(`(() => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const controls = [...document.querySelectorAll(selector)].filter((element) =>
      element.tabIndex >= 0 && !element.hidden && element.getAttribute('aria-hidden') !== 'true'
    );
    return controls.map((element) => element.getAttribute('data-testid'));
  })()`);
  assert.equal(order[0], testId, `${testId} is not first in the keyboard order: ${JSON.stringify(order)}`);
  await focusNativeControl(window, testId);
  return { method: 'verified-order', tab: 0 };
}

async function main() {
  await app.whenReady();
  const firstWindow = await waitFor(
    () => BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()),
    'isolated assistant window did not open',
  );
  await waitFor(
    () => firstWindow.webContents.executeJavaScript("document.querySelector('[data-testid=recovery-assistant]') !== null"),
    'assistant UI did not render',
  );

  const tools = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Herramientas');
  const checkBackup = tools?.submenu?.items.find((item) => item.label === 'Comprobar copia de seguridad');
  assert.ok(checkBackup, 'graphical Tools menu entry is missing');
  checkBackup.click?.(undefined, firstWindow, {});
  const window = await waitFor(
    () => BrowserWindow.getAllWindows().find((candidate) => candidate !== firstWindow && !candidate.isDestroyed()),
    'Tools menu did not open the assistant',
  );
  firstWindow.destroy();
  await waitFor(
    () => window.webContents.executeJavaScript("document.querySelector('[data-testid=recovery-assistant]') !== null"),
    'menu-opened assistant UI did not render',
  );

  const initial = await window.webContents.executeJavaScript(`(() => {
    const root = document.querySelector('[data-testid=recovery-assistant]');
    const details = document.querySelector('[data-testid=technical-details]');
    window.__recoveryStates = [root?.getAttribute('data-state')];
    new MutationObserver(() => window.__recoveryStates.push(root?.getAttribute('data-state')))
      .observe(root, { attributes: true, attributeFilter: ['data-state'] });
    return {
      state: root?.getAttribute('data-state'),
      title: document.querySelector('h1')?.textContent,
      detailsPresent: Boolean(details),
      body: document.body.innerText,
    };
  })()`);
  assert.equal(initial.state, 'idle');
  assert.match(initial.title, /backup|copia/i);
  assert.equal(initial.detailsPresent, false);
  assert.doesNotMatch(initial.body, /PRAGMA|_flo_meta|foreign keys|WAL/i);

  window.show();
  window.focus();
  await waitFor(() => window.isFocused(), 'assistant window could not receive keyboard input');
  window.webContents.focus();
  const keyboardEvidence = await focusByTab(window, 'choose-backup');
  await pressKey(window, 'Space');
  await waitFor(
    () => window.webContents.executeJavaScript("document.querySelector('[data-testid=recovery-assistant]')?.getAttribute('data-state') === 'selected'"),
    'native selection did not reach selected state',
  );

  await focusNativeControl(window, 'start-check');
  await pressKey(window, 'Space');
  await waitFor(
    () => window.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=result-green]'))"),
    'valid package did not produce a green result',
    60_000,
  );
  const validUi = await window.webContents.executeJavaScript(`({
    states: window.__recoveryStates,
    detailsClosed: document.querySelector('[data-testid=technical-details]').open === false,
    resultText: document.querySelector('[data-testid=result-green]').innerText,
  })`);
  assert.ok(validUi.states.includes('checking'), 'checking progress was not visible');
  assert.ok(validUi.states.includes('restoring'), 'restore progress was not visible');
  assert.equal(validUi.detailsClosed, true);
  assert.match(validUi.resultText, /checked|comprobada|verificado/i);

  await window.webContents.executeJavaScript("document.querySelector('[data-testid=technical-details] summary').click()");
  assert.equal(await window.webContents.executeJavaScript("document.querySelector('[data-testid=technical-details]').open"), true);
  await window.webContents.executeJavaScript("document.querySelector('[data-testid=save-report]').click()");
  await waitFor(() => fs.existsSync(reportPath), 'sanitized JSON report was not saved');
  const exported = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(exported.overallStatus, 'green');
  assert.equal(JSON.stringify(exported).includes(validPackage), false);
  assert.equal(fs.existsSync(reportPath.replace(/\.json$/i, '.txt')), true);

  process.env.FLO_RECOVERY_TEST_SELECTION = alteredPackage;
  await window.webContents.executeJavaScript("document.querySelector('[data-testid=check-another]').click()");
  await waitFor(
    () => window.webContents.executeJavaScript("document.querySelector('[data-testid=recovery-assistant]')?.getAttribute('data-state') === 'selected'"),
    'altered package was not selected',
  );
  await window.webContents.executeJavaScript("document.querySelector('[data-testid=start-check]').click()");
  await waitFor(
    () => window.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=result-red]'))"),
    'altered package did not produce a red result',
    60_000,
  );

  assert.deepEqual(startedServices, [], 'isolated mode initialized a production service');
  assert.equal(guard.summary().successfulExternalConnections, 0);
  assert.deepEqual(rendererExternalRequests, []);
  process.stdout.write(`RECOVERY_E2E_RESULT=${JSON.stringify({
    menuOpened: true,
    isolatedServicesStarted: startedServices.length,
    externalConnections: 0,
    validStatus: 'green',
    alteredStatus: 'red',
    keyboardNavigation: true,
    keyboardMethod: keyboardEvidence.method,
    detailsInitiallyClosed: true,
    reportSanitized: true,
  })}\n`);
  window.destroy();
  app.quit();
}

main().catch((error) => {
  process.stderr.write(`RECOVERY_E2E_FATAL=${error.stack || error.message}\n`);
  app.exit(1);
});
