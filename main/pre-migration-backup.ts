import Database from 'better-sqlite3';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type PreMigrationBackupStage =
  | 'prepare'
  | 'checkpoint'
  | 'copy'
  | 'open'
  | 'stamp'
  | 'integrity'
  | 'version'
  | 'finalize'
  | 'cleanup';

export class PreMigrationBackupError extends Error {
  public readonly cause?: unknown;
  public cleanupCause?: unknown;

  constructor(
    public readonly stage: PreMigrationBackupStage,
    public readonly fromVersion: number,
    public readonly targetVersion: number,
    cause?: unknown,
  ) {
    super(`Required pre-migration backup failed during ${stage} (v${fromVersion} to v${targetVersion})`);
    this.name = 'PreMigrationBackupError';
    this.cause = cause;
  }
}

export const PRE_MIGRATION_BACKUP_OPERATOR_MESSAGE = [
  'Flo could not create and verify the required backup before updating the database. No migration was applied and the original database remains unchanged.',
  '',
  'Check free disk space and local storage permissions, close any other Flo instances, and try again. If the problem continues, keep the current database and contact support.',
].join('\n');

export function getPreMigrationBackupTelemetryPayload(
  error: PreMigrationBackupError,
): Record<string, string | number> {
  return {
    error_type: 'pre_migration_backup',
    failure_stage: error.stage,
    db_schema_version: error.fromVersion,
    target_schema_version: error.targetVersion,
  };
}

type OpenDatabaseOptions = { readonly?: boolean; fileMustExist?: boolean };

export interface PreMigrationBackupDependencies {
  existsSync(filePath: string): boolean;
  isDirectory(filePath: string): boolean;
  mkdirSync(directoryPath: string): void;
  copyFileExclusive(sourcePath: string, targetPath: string): void;
  renameSync(sourcePath: string, targetPath: string): void;
  unlinkSync(filePath: string): void;
  openDatabase(filePath: string, options?: OpenDatabaseOptions): Database.Database;
  checkpoint(sourceDb: Database.Database): unknown;
  readSchemaVersion(database: Database.Database): number;
  readIntegrity(database: Database.Database): unknown;
  now(): Date;
  uniqueId(): string;
}

const DEFAULT_DEPENDENCIES: PreMigrationBackupDependencies = {
  existsSync: fs.existsSync,
  isDirectory: (filePath) => fs.statSync(filePath).isDirectory(),
  mkdirSync: (directoryPath) => fs.mkdirSync(directoryPath, { recursive: true }),
  copyFileExclusive: (sourcePath, targetPath) => {
    fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  },
  renameSync: fs.renameSync,
  unlinkSync: fs.unlinkSync,
  openDatabase: (filePath, options) => new Database(filePath, options),
  checkpoint: (sourceDb) => sourceDb.pragma('wal_checkpoint(TRUNCATE)'),
  readSchemaVersion: (database) => database.pragma('user_version', { simple: true }) as number,
  readIntegrity: (database) => database.pragma('integrity_check'),
  now: () => new Date(),
  uniqueId: () => crypto.randomUUID(),
};

export interface VerifiedPreMigrationBackupOptions {
  sourceDb: Database.Database;
  sourcePath: string;
  backupDir: string;
  fromVersion: number;
  targetVersion: number;
  appVersion: string;
  dependencies?: Partial<PreMigrationBackupDependencies>;
}

export interface VerifiedPreMigrationBackupResult {
  path: string;
  schemaVersion: number;
}

function asBackupError(
  stage: PreMigrationBackupStage,
  fromVersion: number,
  targetVersion: number,
  cause: unknown,
): PreMigrationBackupError {
  return cause instanceof PreMigrationBackupError
    ? cause
    : new PreMigrationBackupError(stage, fromVersion, targetVersion, cause);
}

function validateCheckpoint(
  result: unknown,
  fromVersion: number,
  targetVersion: number,
): void {
  const rows = Array.isArray(result) ? result : [];
  const row = rows.length === 1 ? rows[0] as Record<string, unknown> : undefined;
  const busy = row?.busy;
  const logFrames = row?.log;
  const checkpointedFrames = row?.checkpointed;

  if (
    typeof busy !== 'number'
    || typeof logFrames !== 'number'
    || typeof checkpointedFrames !== 'number'
    || busy !== 0
    || checkpointedFrames !== logFrames
  ) {
    throw new PreMigrationBackupError(
      'checkpoint',
      fromVersion,
      targetVersion,
      new Error('WAL checkpoint did not complete'),
    );
  }
}

function readMetadataVersion(database: Database.Database): number | null {
  const row = database.prepare(
    `SELECT value FROM _flo_meta WHERE key = 'schema_version'`,
  ).get() as { value: string } | undefined;
  if (!row) return null;
  const version = Number.parseInt(row.value, 10);
  return Number.isInteger(version) ? version : null;
}

function validateVersion(
  database: Database.Database,
  expectedVersion: number,
  targetVersion: number,
  dependencies: PreMigrationBackupDependencies,
): void {
  const schemaVersion = dependencies.readSchemaVersion(database);
  const metadataVersion = readMetadataVersion(database);
  if (schemaVersion !== expectedVersion || metadataVersion !== expectedVersion) {
    throw new PreMigrationBackupError(
      'version',
      expectedVersion,
      targetVersion,
      new Error('Backup schema version did not match the source'),
    );
  }
}

function validateIntegrity(
  database: Database.Database,
  fromVersion: number,
  targetVersion: number,
  dependencies: PreMigrationBackupDependencies,
): void {
  const rows = dependencies.readIntegrity(database);
  const valid = Array.isArray(rows)
    && rows.length === 1
    && typeof rows[0] === 'object'
    && rows[0] !== null
    && (rows[0] as Record<string, unknown>).integrity_check === 'ok';
  if (!valid) {
    throw new PreMigrationBackupError(
      'integrity',
      fromVersion,
      targetVersion,
      new Error('Backup integrity check did not return ok'),
    );
  }
}

function closeQuietly(database: Database.Database | undefined): void {
  if (!database) return;
  try {
    database.close();
  } catch {
    // The primary error remains authoritative; cleanup is attempted below.
  }
}

function cleanupPartialArtifacts(
  candidatePath: string,
  dependencies: PreMigrationBackupDependencies,
): unknown {
  let cleanupError: unknown;
  for (const artifact of [candidatePath, `${candidatePath}-wal`, `${candidatePath}-shm`]) {
    try {
      if (dependencies.existsSync(artifact)) dependencies.unlinkSync(artifact);
    } catch (error) {
      cleanupError ??= error;
    }
  }
  return cleanupError;
}

export function createVerifiedPreMigrationBackup(
  options: VerifiedPreMigrationBackupOptions,
): VerifiedPreMigrationBackupResult {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies };
  const { sourceDb, sourcePath, backupDir, fromVersion, targetVersion, appVersion } = options;
  let stage: PreMigrationBackupStage = 'prepare';
  let candidateDb: Database.Database | undefined;
  let candidatePath = '';

  try {
    if (!dependencies.existsSync(backupDir)) {
      dependencies.mkdirSync(backupDir);
    } else if (!dependencies.isDirectory(backupDir)) {
      throw new Error('Managed backup location is not a directory');
    }

    const timestamp = dependencies.now().toISOString().replace(/[:.]/g, '-');
    const uniqueId = dependencies.uniqueId().replace(/[^a-zA-Z0-9_-]/g, '');
    const baseName = `flo-backup-${timestamp}-${uniqueId}-pre-v${fromVersion}-to-v${targetVersion}.db`;
    const finalPath = path.join(backupDir, baseName);
    candidatePath = `${finalPath}.partial`;

    if (
      path.dirname(finalPath) !== path.resolve(backupDir)
      || path.dirname(candidatePath) !== path.resolve(backupDir)
      || dependencies.existsSync(finalPath)
      || dependencies.existsSync(candidatePath)
    ) {
      throw new Error('Managed backup path is not available');
    }

    stage = 'checkpoint';
    validateCheckpoint(dependencies.checkpoint(sourceDb), fromVersion, targetVersion);

    stage = 'copy';
    dependencies.copyFileExclusive(sourcePath, candidatePath);

    stage = 'open';
    candidateDb = dependencies.openDatabase(candidatePath);
    candidateDb.pragma('journal_mode = DELETE');

    stage = 'stamp';
    candidateDb.exec(`
      CREATE TABLE IF NOT EXISTS _flo_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    const stamp = candidateDb.prepare(
      `INSERT OR REPLACE INTO _flo_meta (key, value) VALUES (?, ?)`,
    );
    stamp.run('schema_version', String(fromVersion));
    stamp.run('backup_created_at', dependencies.now().toISOString());
    stamp.run('app_version', appVersion);

    stage = 'version';
    validateVersion(candidateDb, fromVersion, targetVersion, dependencies);
    stage = 'integrity';
    validateIntegrity(candidateDb, fromVersion, targetVersion, dependencies);
    candidateDb.close();
    candidateDb = undefined;

    stage = 'open';
    candidateDb = dependencies.openDatabase(candidatePath, { readonly: true, fileMustExist: true });
    stage = 'version';
    validateVersion(candidateDb, fromVersion, targetVersion, dependencies);
    stage = 'integrity';
    validateIntegrity(candidateDb, fromVersion, targetVersion, dependencies);
    candidateDb.close();
    candidateDb = undefined;

    stage = 'finalize';
    dependencies.renameSync(candidatePath, finalPath);

    return { path: finalPath, schemaVersion: fromVersion };
  } catch (error) {
    closeQuietly(candidateDb);
    const primaryError = asBackupError(stage, fromVersion, targetVersion, error);
    if (candidatePath) {
      primaryError.cleanupCause = cleanupPartialArtifacts(candidatePath, dependencies);
    }
    throw primaryError;
  }
}
