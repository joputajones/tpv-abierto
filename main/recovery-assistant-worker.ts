import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import {
  PackageValidationError,
  sha256File,
  validateAssistantSelection,
} from './backup-package-validation';
import {
  closeDatabase,
  getDatabase,
  initDatabase,
  MIGRATIONS,
  restoreBackup,
} from './db';
import {
  friendlyFailure,
  type RecoveryAssistantReport,
  type RecoveryCheckResult,
} from './recovery-assistant-report';

interface WorkerMessage {
  type: 'progress' | 'result';
  state?: string;
  report?: RecoveryAssistantReport;
  failureCode?: string;
  friendlyMessage?: string;
}

function send(message: WorkerMessage): void {
  if (typeof process.send === 'function') process.send(message);
}

function progress(state: string): void {
  send({ type: 'progress', state });
  const pause = process.env.FLO_RECOVERY_TEST_PAUSE_PHASE;
  if (pause === state) {
    const end = Date.now() + 30_000;
    while (Date.now() < end) {
      // Test-only cancellation point. The process is terminated by the parent.
    }
  }
}

function injectedFailure(phase: string, code: string): void {
  if (process.env.FLO_RECOVERY_TEST_FAIL_PHASE === phase) throw new PackageValidationError(code, code);
}

function check(id: string, status: 'passed' | 'warning' | 'failed'): RecoveryCheckResult {
  return { id, status };
}

function resultReport(
  status: 'green' | 'yellow' | 'red',
  checks: RecoveryCheckResult[],
  warnings: string[],
  values: Partial<RecoveryAssistantReport>,
): RecoveryAssistantReport {
  const recommendedAction = status === 'green'
    ? 'Guarda este informe junto a la copia y conserva otra copia en un lugar distinto.'
    : status === 'yellow'
      ? 'Conserva otra copia y resuelve las advertencias antes de depender de este archivo.'
      : 'No utilices esta copia. Conserva el archivo original y prueba con otra copia.';
  return {
    reportVersion: 1,
    dateUtc: new Date().toISOString(),
    appVersion: process.env.FLO_RECOVERY_APP_VERSION || 'unknown',
    overallStatus: status,
    checkResults: checks,
    warnings,
    recommendedAction,
    backupSize: null,
    backupSchemaVersion: null,
    manifestFormatVersion: null,
    checksumMatched: null,
    testRestoreSucceeded: false,
    testWriteSucceeded: false,
    platform: process.platform,
    ...values,
  };
}

export function executeRecoveryCheck(selectionPath: string, sandbox: string): RecoveryAssistantReport {
  const checks: RecoveryCheckResult[] = [];
  const warnings: string[] = [];
  let values: Partial<RecoveryAssistantReport> = {};
  let sourceHash: string | null = null;
  let sourcePath: string | null = null;

  try {
    progress('checking');
    const selection = validateAssistantSelection(selectionPath);
    sourcePath = selection.backupPath;
    sourceHash = selection.actualSha256;
    values = {
      backupSize: selection.backupSize,
      manifestFormatVersion: selection.manifestFormatVersion,
      checksumMatched: selection.checksumMatched,
    };
    checks.push(check('content', 'passed'));
    checks.push(check('checksum', selection.checksumMatched === true ? 'passed' : 'warning'));
    checks.push(check('manifest', selection.manifest ? 'passed' : 'warning'));
    if (selection.kind === 'standalone') warnings.push('La copia no incluye checksum ni manifiesto.');

    injectedFailure('open', 'OPEN_FAILED');
    progress('restoring');
    const auxiliaryPaths = ['-wal', '-shm', '-journal'].map((suffix) => `${selection.backupPath}${suffix}`);
    if (auxiliaryPaths.some((candidate) => fs.existsSync(candidate))) {
      throw new PackageValidationError('UNSAFE_SELECTION', 'UNSAFE_SELECTION');
    }
    const sourceDb = new Database(selection.backupPath, { readonly: true, fileMustExist: true });
    let userVersion = 0;
    let metaVersion: number | null = null;
    try {
      const integrityRows = sourceDb.pragma('integrity_check') as { integrity_check: string }[];
      if (integrityRows.length !== 1 || integrityRows[0].integrity_check !== 'ok') {
        throw new PackageValidationError('INTEGRITY_FAILED', 'INTEGRITY_FAILED');
      }
      userVersion = Number(sourceDb.pragma('user_version', { simple: true }));
      const hasMeta = sourceDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_flo_meta'").get();
      if (hasMeta) {
        const row = sourceDb.prepare("SELECT value FROM _flo_meta WHERE key='schema_version'").get() as { value?: string } | undefined;
        if (row?.value !== undefined) metaVersion = Number(row.value);
      }
      const expectedTables = ['settings', 'products', 'orders', 'order_items', 'bills'];
      const present = sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      const presentNames = new Set(present.map((row) => row.name));
      if (!expectedTables.every((name) => presentNames.has(name))) throw new PackageValidationError('REQUIRED_DATA_MISSING', 'REQUIRED_DATA_MISSING');
      const foreignKeyProblems = sourceDb.pragma('foreign_key_check') as unknown[];
      if (foreignKeyProblems.length > 0) throw new PackageValidationError('RELATIONSHIP_CHECK_FAILED', 'RELATIONSHIP_CHECK_FAILED');
    } finally {
      sourceDb.close();
    }
    if (auxiliaryPaths.some((candidate) => fs.existsSync(candidate))) {
      throw new PackageValidationError('SOURCE_MODIFIED', 'SOURCE_MODIFIED');
    }
    checks.push(check('open-read-only', 'passed'), check('integrity', 'passed'), check('minimum-data', 'passed'));

    const currentVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version || 0;
    if (!Number.isSafeInteger(userVersion) || userVersion <= 0) throw new PackageValidationError('SCHEMA_INCONSISTENT', 'SCHEMA_INCONSISTENT');
    if (metaVersion !== null && (!Number.isSafeInteger(metaVersion) || metaVersion !== userVersion)) {
      throw new PackageValidationError('SCHEMA_INCONSISTENT', 'SCHEMA_INCONSISTENT');
    }
    if (selection.manifest && Number(selection.manifest.schemaVersion) !== userVersion) {
      throw new PackageValidationError('MANIFEST_SCHEMA_MISMATCH', 'MANIFEST_SCHEMA_MISMATCH');
    }
    if (userVersion > currentVersion) throw new PackageValidationError('SCHEMA_NEWER', 'SCHEMA_NEWER');
    if (userVersion < currentVersion) warnings.push('La copia procede de una versión anterior y se ha actualizado solo en la prueba.');
    if (metaVersion === null) warnings.push('La copia no incluye todos los metadatos opcionales.');
    values.backupSchemaVersion = userVersion;
    checks.push(check('version', userVersion < currentVersion || metaVersion === null ? 'warning' : 'passed'));

    injectedFailure('restore', 'RESTORE_FAILED');
    const disposableDb = path.join(sandbox, 'flo.db');
    const appVersion = process.env.FLO_RECOVERY_APP_VERSION || 'recovery-assistant';
    initDatabase({
      databasePath: disposableDb,
      backupDirectory: path.join(sandbox, 'backups'),
      appVersion,
    });
    const restore = restoreBackup(selection.backupPath, false);
    if (!restore.success) {
      if (process.env.FLO_RECOVERY_TEST_DEBUG === '1') process.stderr.write(`RESTORE_DEBUG=${restore.error || 'unknown'}\n`);
      throw new PackageValidationError('RESTORE_FAILED', 'RESTORE_FAILED');
    }
    values.testRestoreSucceeded = true;
    checks.push(check('test-restore', 'passed'));

    injectedFailure('reopen', 'REOPEN_FAILED');
    progress('reopening');
    closeDatabase();
    initDatabase({
      databasePath: disposableDb,
      backupDirectory: path.join(sandbox, 'backups'),
      appVersion,
    });
    checks.push(check('reopen', 'passed'));

    injectedFailure('write', 'WRITE_FAILED');
    progress('writing');
    const syntheticId = `SYNTHETIC-RECOVERY-CHECK-${process.pid}`;
    getDatabase().prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(syntheticId, 'test-only', new Date().toISOString());
    closeDatabase();
    const reopened = new Database(disposableDb, { readonly: true, fileMustExist: true });
    try {
      const persisted = reopened.prepare('SELECT value FROM settings WHERE key=?').get(syntheticId) as { value?: string } | undefined;
      if (persisted?.value !== 'test-only') throw new PackageValidationError('WRITE_FAILED', 'WRITE_FAILED');
    } finally {
      reopened.close();
    }
    values.testWriteSucceeded = true;
    checks.push(check('synthetic-write', 'passed'));
    if (sha256File(selection.backupPath) !== sourceHash) throw new PackageValidationError('SOURCE_MODIFIED', 'SOURCE_MODIFIED');
    progress('complete');
    return resultReport(warnings.length ? 'yellow' : 'green', checks, warnings, values);
  } catch (error) {
    try { closeDatabase(); } catch { /* no open production handle */ }
    const code = error instanceof PackageValidationError ? error.code : 'UNEXPECTED_FAILURE';
    checks.push(check(code.toLowerCase(), 'failed'));
    if (sourcePath && sourceHash && fs.existsSync(sourcePath) && sha256File(sourcePath) !== sourceHash) {
      checks.push(check('source-unchanged', 'failed'));
    }
    return resultReport('red', checks, [friendlyFailure(code)], values);
  }
}

function main(): void {
  const selection = process.env.FLO_RECOVERY_SELECTION;
  const sandbox = process.env.FLO_RECOVERY_SANDBOX;
  if (!selection || !sandbox) throw new Error('RECOVERY_WORKER_CONFIGURATION_MISSING');
  const report = executeRecoveryCheck(selection, sandbox);
  send({
    type: 'result',
    report,
    failureCode: report.overallStatus === 'red' ? report.checkResults.find((item) => item.status === 'failed')?.id : undefined,
    friendlyMessage: report.overallStatus === 'red' ? report.warnings[0] : undefined,
  });
}

if (require.main === module) {
  try {
    main();
  } catch {
    send({ type: 'result', failureCode: 'UNEXPECTED_FAILURE', friendlyMessage: friendlyFailure('UNEXPECTED_FAILURE') });
    process.exitCode = 1;
  }
}
