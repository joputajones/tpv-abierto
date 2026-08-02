import { fork, type ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  assertSanitizedRecoveryReport,
  friendlyFailure,
  type RecoveryAssistantReport,
} from './recovery-assistant-report';

const ROOT_NAME = 'flo-recovery-check';
const MARKER_NAME = '.flo-recovery-assistant';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface RecoveryRunEvent {
  state: string;
}

export interface RecoveryRunResult {
  cancelled: boolean;
  report: RecoveryAssistantReport | null;
}

export interface RecoveryRunHandle {
  readonly sandbox: string;
  readonly result: Promise<RecoveryRunResult>;
  cancel(): Promise<void>;
}

interface RunnerOptions {
  appVersion: string;
  onProgress?: (event: RecoveryRunEvent) => void;
  testEnvironment?: Record<string, string>;
}

function recoveryRoot(): string {
  return path.join(os.tmpdir(), ROOT_NAME);
}

function removeMarkedSandbox(directory: string): boolean {
  const root = recoveryRoot();
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  if (!fs.existsSync(path.join(directory, MARKER_NAME))) return false;
  fs.rmSync(directory, { recursive: true, force: true });
  return !fs.existsSync(directory);
}

export function cleanupStaleRecoveryChecks(now = Date.now()): number {
  const root = recoveryRoot();
  if (!fs.existsSync(root)) return 0;
  let cleaned = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(root, entry.name);
    const marker = path.join(directory, MARKER_NAME);
    if (!fs.existsSync(marker)) continue;
    const stat = fs.statSync(marker);
    if (now - stat.mtimeMs >= STALE_AFTER_MS && removeMarkedSandbox(directory)) cleaned++;
  }
  return cleaned;
}

function failureReport(appVersion: string): RecoveryAssistantReport {
  return {
    reportVersion: 1,
    dateUtc: new Date().toISOString(),
    appVersion,
    overallStatus: 'red',
    checkResults: [{ id: 'worker', status: 'failed' }],
    warnings: [friendlyFailure('UNEXPECTED_FAILURE')],
    recommendedAction: 'No utilices esta copia. Conserva el archivo original y prueba con otra copia.',
    backupSize: null,
    backupSchemaVersion: null,
    manifestFormatVersion: null,
    checksumMatched: null,
    testRestoreSucceeded: false,
    testWriteSucceeded: false,
    platform: process.platform,
  };
}

export function startRecoveryCheck(selectionPath: string, options: RunnerOptions): RecoveryRunHandle {
  cleanupStaleRecoveryChecks();
  const root = recoveryRoot();
  fs.mkdirSync(root, { recursive: true });
  const sandbox = path.join(root, crypto.randomUUID());
  fs.mkdirSync(sandbox, { recursive: false });
  fs.writeFileSync(path.join(sandbox, MARKER_NAME), 'FloCafe recovery assistant sandbox\n', { encoding: 'utf8', flag: 'wx' });

  const workerPath = path.join(__dirname, 'recovery-assistant-worker.js');
  const child: ChildProcess = fork(workerPath, [], {
    execPath: process.execPath,
    silent: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      FLO_RECOVERY_SELECTION: path.resolve(selectionPath),
      FLO_RECOVERY_SANDBOX: sandbox,
      FLO_RECOVERY_APP_VERSION: options.appVersion,
      ...options.testEnvironment,
    },
  });
  // The worker may emit database diagnostics. Discard them so selected paths
  // never reach the parent log and the pipe cannot fill during long checks.
  if (options.testEnvironment?.FLO_RECOVERY_TEST_DEBUG === '1') {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  } else {
    child.stdout?.resume();
    child.stderr?.resume();
  }
  let cancelled = false;
  let settled = false;
  let report: RecoveryAssistantReport | null = null;

  const result = new Promise<RecoveryRunResult>((resolve) => {
    child.on('message', (message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const typed = message as { type?: string; state?: string; report?: unknown };
      if (typed.type === 'progress' && typeof typed.state === 'string') options.onProgress?.({ state: typed.state });
      if (typed.type === 'result' && typed.report) {
        try {
          assertSanitizedRecoveryReport(typed.report);
          report = typed.report;
        } catch {
          report = failureReport(options.appVersion);
        }
      }
    });
    child.once('error', () => {
      report = failureReport(options.appVersion);
    });
    child.once('close', () => {
      if (settled) return;
      settled = true;
      let cleaned = false;
      try { cleaned = removeMarkedSandbox(sandbox); } catch { cleaned = false; }
      if (!cleaned && report) {
        report.warnings.push('No se ha podido completar la limpieza temporal. Cierra FloCafe y vuelve a abrirlo.');
        if (report.overallStatus === 'green') report.overallStatus = 'yellow';
      }
      resolve({ cancelled, report: cancelled ? null : (report || failureReport(options.appVersion)) });
    });
  });

  return {
    sandbox,
    result,
    async cancel() {
      if (settled || cancelled) return;
      cancelled = true;
      child.kill();
      await result;
    },
  };
}
