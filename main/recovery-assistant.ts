import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as crypto from 'crypto';
import { startRecoveryCheck, cleanupStaleRecoveryChecks, type RecoveryRunHandle } from './recovery-assistant-runner';
import {
  assertSanitizedRecoveryReport,
  recoveryReportAsText,
  type RecoveryAssistantReport,
} from './recovery-assistant-report';

const selections = new Map<string, string>();
const reports = new Map<string, RecoveryAssistantReport>();
const activeRuns = new Map<number, RecoveryRunHandle>();
const recoveryWindows = new Set<BrowserWindow>();
let ipcRegistered = false;

export interface RecoveryAssetServer {
  baseUrl: string;
  close(): Promise<void>;
}

function frontendDirectory(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'frontend-out')
    : path.join(__dirname, '../frontend/out');
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  } as Record<string, string>)[extension] || 'application/octet-stream';
}

export async function startRecoveryAssetServer(): Promise<RecoveryAssetServer> {
  const root = frontendDirectory();
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      let candidate = path.resolve(root, relative);
      const insideRoot = path.relative(root, candidate);
      if (insideRoot.startsWith('..') || path.isAbsolute(insideRoot)) throw new Error('OUTSIDE_ASSET_ROOT');
      if (!fs.existsSync(candidate) && !path.extname(candidate)) candidate = path.join(candidate, 'index.html');
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': contentType(candidate),
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:*; font-src 'self' data:; object-src 'none'; base-uri 'self'",
      });
      fs.createReadStream(candidate).pipe(response);
    } catch {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Invalid request');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('RECOVERY_ASSET_SERVER_FAILED');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function chooseRecoverySelection(parent: BrowserWindow | null): Promise<{ selected: boolean; token?: string }> {
  let selectedPath = process.env.FLO_RECOVERY_TEST_SELECTION;
  if (!selectedPath) {
    const messageOptions: Electron.MessageBoxOptions = {
      type: 'question',
      title: 'Elegir copia',
      message: '¿Qué quieres comprobar?',
      detail: 'Elige una carpeta si tienes un paquete completo. Elige un archivo si solo tienes una copia .db.',
      buttons: ['Carpeta de copia', 'Archivo .db', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    };
    const choice = parent
      ? await dialog.showMessageBox(parent, messageOptions)
      : await dialog.showMessageBox(messageOptions);
    if (choice.response === 2) return { selected: false };
    const openOptions: Electron.OpenDialogOptions = choice.response === 0
      ? { title: 'Elegir carpeta de copia', properties: ['openDirectory'] }
      : { title: 'Elegir archivo de copia', properties: ['openFile'], filters: [{ name: 'Copia de FloCafe', extensions: ['db'] }] };
    const picked = parent
      ? await dialog.showOpenDialog(parent, openOptions)
      : await dialog.showOpenDialog(openOptions);
    if (picked.canceled || picked.filePaths.length !== 1) return { selected: false };
    selectedPath = picked.filePaths[0];
  }
  const token = crypto.randomUUID();
  selections.set(token, selectedPath);
  return { selected: true, token };
}

export function registerRecoveryAssistantIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;
  cleanupStaleRecoveryChecks();

  ipcMain.handle('recovery-assistant:choose', (event) => chooseRecoverySelection(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle('recovery-assistant:start', async (event, token: string) => {
    const selectionPath = selections.get(token);
    selections.delete(token);
    if (!selectionPath) return { success: false, error: 'La selección ha caducado. Vuelve a elegir la copia.' };
    const senderId = event.sender.id;
    await activeRuns.get(senderId)?.cancel();
    const run = startRecoveryCheck(selectionPath, {
      appVersion: app.getVersion(),
      onProgress: ({ state }) => {
        if (!event.sender.isDestroyed()) event.sender.send('recovery-assistant:progress', { state });
      },
      testEnvironment: {
        ...(process.env.FLO_RECOVERY_TEST_FAIL_PHASE
          ? { FLO_RECOVERY_TEST_FAIL_PHASE: process.env.FLO_RECOVERY_TEST_FAIL_PHASE }
          : {}),
        ...(process.env.FLO_RECOVERY_TEST_DEBUG === '1'
          ? { FLO_RECOVERY_TEST_DEBUG: '1' }
          : {}),
      },
    });
    activeRuns.set(senderId, run);
    const outcome = await run.result;
    activeRuns.delete(senderId);
    if (outcome.cancelled) return { success: false, cancelled: true };
    if (!outcome.report) return { success: false, error: 'No se ha podido completar la comprobación.' };
    assertSanitizedRecoveryReport(outcome.report);
    const reportId = crypto.randomUUID();
    reports.set(reportId, outcome.report);
    return { success: true, reportId, report: outcome.report };
  });
  ipcMain.handle('recovery-assistant:cancel', async (event) => {
    const run = activeRuns.get(event.sender.id);
    if (!run) return { cancelled: false };
    await run.cancel();
    activeRuns.delete(event.sender.id);
    return { cancelled: true };
  });
  ipcMain.handle('recovery-assistant:save-report', async (event, reportId: string) => {
    const report = reports.get(reportId);
    if (!report) return { saved: false, error: 'El informe ya no está disponible.' };
    assertSanitizedRecoveryReport(report);
    const parent = BrowserWindow.fromWebContents(event.sender);
    const saveOptions: Electron.SaveDialogOptions = {
      title: 'Guardar informe',
      defaultPath: path.join(app.getPath('documents'), 'recovery-check-report.json'),
      filters: [{ name: 'Informe JSON', extensions: ['json'] }],
    };
    const choice = parent
      ? await dialog.showSaveDialog(parent, saveOptions)
      : await dialog.showSaveDialog(saveOptions);
    if (choice.canceled || !choice.filePath) return { saved: false };
    const jsonPath = choice.filePath.toLowerCase().endsWith('.json') ? choice.filePath : `${choice.filePath}.json`;
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
    const textPath = jsonPath.replace(/\.json$/i, '.txt');
    fs.writeFileSync(textPath, recoveryReportAsText(report), { encoding: 'utf8', flag: 'w' });
    return { saved: true };
  });
}

export function openRecoveryAssistantWindow(baseUrl: string): BrowserWindow {
  registerRecoveryAssistantIpc();
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Comprobar copia de seguridad — FloCafe',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const senderId = window.webContents.id;
  recoveryWindows.add(window);
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    recoveryWindows.delete(window);
    const run = activeRuns.get(senderId);
    if (run) void run.cancel();
  });
  window.loadURL(`${baseUrl.replace(/\/$/, '')}/recovery-assistant/`);
  return window;
}

export async function closeRecoveryAssistant(): Promise<void> {
  const cancellations = [...activeRuns.values()].map((run) => run.cancel());
  await Promise.allSettled(cancellations);
  activeRuns.clear();
  for (const window of recoveryWindows) if (!window.isDestroyed()) window.destroy();
  recoveryWindows.clear();
}
