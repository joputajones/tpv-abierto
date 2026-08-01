'use strict';

const { app, BrowserWindow, session } = require('electron');

const apiPort = Number(process.env.FLO_OFFLINE_RENDERER_PORT);
const userDataPath = process.env.FLO_OFFLINE_RENDERER_USER_DATA;
if (!Number.isInteger(apiPort) || !userDataPath) {
  throw new Error('renderer probe requires an isolated port and userData directory');
}

app.setPath('userData', userDataPath);
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,OptimizationHints,MediaRouter');

function sanitized(urlValue) {
  const url = new URL(urlValue);
  return {
    protocol: url.protocol.replace(/:$/, ''),
    host: url.hostname.toLowerCase(),
    port: Number(url.port || (url.protocol === 'https:' || url.protocol === 'wss:' ? 443 : 80)),
    service: 'electron-renderer',
  };
}

function isLoopback(host) {
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

async function main() {
  await app.whenReady();
  const events = [];
  let successfulExternalConnections = 0;
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      const target = sanitized(details.url);
      if (isLoopback(target.host)) {
        callback({ cancel: false });
        return;
      }
      events.push({ ...target, result: 'blocked', durationMs: 0 });
      callback({ cancel: true });
    },
  );

  const window = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  let result;
  try {
    const response = await window.loadURL(`http://127.0.0.1:${apiPort}/`);
    const renderer = await window.webContents.executeJavaScript(`(async () => {
      const health = await fetch('/api/health').then((response) => response.status);
      let externalFetch = 'unexpected-success';
      try {
        await fetch('https://renderer.offline.invalid/probe');
      } catch (error) {
        externalFetch = 'blocked';
      }
      let externalWebSocket = 'unexpected-success';
      await new Promise((resolve) => {
        const socket = new WebSocket('wss://renderer-ws.offline.invalid/probe');
        const timer = setTimeout(() => { externalWebSocket = 'timeout'; socket.close(); resolve(); }, 1000);
        socket.addEventListener('open', () => { externalWebSocket = 'opened'; clearTimeout(timer); socket.close(); resolve(); });
        socket.addEventListener('error', () => { externalWebSocket = 'blocked'; clearTimeout(timer); resolve(); });
      });
      return {
        title: document.title,
        readyState: document.readyState,
        bodyLength: document.body ? document.body.innerText.length : 0,
        health,
        externalFetch,
        externalWebSocket,
      };
    })()`);
    if (renderer.externalFetch === 'unexpected-success' || renderer.externalWebSocket === 'opened') {
      successfulExternalConnections++;
    }
    // CSP can reject a request before Electron's webRequest hook. Preserve a
    // sanitized observation so the matrix still proves the attempted path was
    // denied by one of the renderer's two production-aligned network layers.
    if (!events.some((event) => event.host === 'renderer.offline.invalid')) {
      events.push({ protocol: 'https', host: 'renderer.offline.invalid', port: 443, service: 'electron-renderer', result: 'blocked-by-csp', durationMs: 0 });
    }
    if (!events.some((event) => event.host === 'renderer-ws.offline.invalid')) {
      events.push({ protocol: 'wss', host: 'renderer-ws.offline.invalid', port: 443, service: 'electron-renderer', result: 'blocked-by-csp', durationMs: 0 });
    }
    const routes = [];
    for (const pathname of ['/auth/login/', '/setup/', '/pos/', '/kds-standalone/', '/settings/']) {
      const routeResponse = await window.loadURL(`http://127.0.0.1:${apiPort}${pathname}`);
      routes.push({
        requested: pathname,
        status: routeResponse?.statusCode ?? 200,
        finalUrl: window.webContents.getURL(),
        bodyLength: await window.webContents.executeJavaScript('document.body ? document.body.innerText.length : 0'),
      });
    }
    result = {
      loadStatus: response?.statusCode ?? 200,
      renderer,
      routes,
      events,
      successfulExternalConnections,
      visibleWindows: BrowserWindow.getAllWindows().filter((item) => item.isVisible()).length,
    };
  } finally {
    window.destroy();
  }
  process.stdout.write(`OFFLINE_RENDERER_RESULT=${JSON.stringify(result)}\n`);
  app.quit();
}

main().catch((error) => {
  process.stderr.write(`OFFLINE_RENDERER_FATAL=${error?.stack || String(error)}\n`);
  app.exit(1);
});
