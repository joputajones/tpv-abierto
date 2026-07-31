import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const NativeDatabase = require('better-sqlite3');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-pre-migration-backup-'));
const fixturePath = path.join(__dirname, 'fixtures/upgrade-snapshots/pre-migration-scheme-v1.5.0.db');
let activeUserDataPath = testRoot;

const mockApp = {
  isPackaged: true,
  getPath: (_name: string) => activeUserDataPath,
  getVersion: () => 'test-version',
};

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: mockApp };
  return originalLoad.apply(this, arguments as any);
};

const {
  initDatabase,
  getDatabase,
  closeDatabase,
  getCurrentSchemaVersion,
  PreMigrationBackupError,
} = require('../main/db');
const {
  PRE_MIGRATION_BACKUP_OPERATOR_MESSAGE,
  getPreMigrationBackupTelemetryPayload,
} = require('../main/pre-migration-backup');
const { runHealthCheck } = require('../main/services/schema-health');

type FailureStage =
  | 'prepare'
  | 'checkpoint'
  | 'copy'
  | 'open'
  | 'stamp'
  | 'integrity'
  | 'version'
  | 'finalize'
  | 'cleanup';

interface SourceSnapshot {
  userVersion: number;
  productCount: number;
  hasCountryPacks: boolean;
  hasTagCounts: boolean;
}

function makeCaseDirectory(name: string): string {
  const directory = path.join(testRoot, name);
  fs.mkdirSync(directory, { recursive: true });
  activeUserDataPath = directory;
  return directory;
}

function installExistingFixture(name: string): string {
  const directory = makeCaseDirectory(name);
  fs.copyFileSync(fixturePath, path.join(directory, 'flo.db'));
  return directory;
}

function readSourceSnapshot(databasePath: string): SourceSnapshot {
  const database = new NativeDatabase(databasePath, { readonly: true, fileMustExist: true });
  try {
    const customerColumns = database.pragma('table_info(customers)') as { name: string }[];
    return {
      userVersion: database.pragma('user_version', { simple: true }) as number,
      productCount: (database.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
      hasCountryPacks: Boolean(
        database.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'country_packs'`).get(),
      ),
      hasTagCounts: customerColumns.some((column) => column.name === 'tag_counts'),
    };
  } finally {
    database.close();
  }
}

function listManagedBackupFiles(directory: string): string[] {
  const backupDir = path.join(directory, 'backups');
  if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) return [];
  return fs.readdirSync(backupDir);
}

function assertSourceUnchanged(before: SourceSnapshot, databasePath: string): void {
  const after = readSourceSnapshot(databasePath);
  assert.deepEqual(after, before, 'source data, version, tables, and columns remain unchanged');
  assert.equal(after.userVersion, 0, 'source user_version remains at v0');
  assert.equal(after.hasCountryPacks, false, 'no later migration table appears');
  assert.equal(after.hasTagCounts, false, 'no later migration column appears');
}

function expectFailClosed(
  name: string,
  expectedStage: FailureStage,
  dependencies: Record<string, unknown> = {},
  prepare?: (directory: string) => void,
): PreMigrationBackupError {
  const directory = installExistingFixture(name);
  const databasePath = path.join(directory, 'flo.db');
  const before = readSourceSnapshot(databasePath);
  prepare?.(directory);

  let thrown: unknown;
  try {
    initDatabase({ preMigrationBackup: dependencies });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof PreMigrationBackupError, `${name} throws PreMigrationBackupError`);
  const backupError = thrown as PreMigrationBackupError;
  assert.equal(backupError.stage, expectedStage, `${name} reports the expected failure stage`);
  assert.equal(backupError.fromVersion, 0, `${name} reports source v0`);
  assert.equal(backupError.targetVersion, 38, `${name} reports target v38`);
  assert.throws(() => getDatabase(), /not initialized/i, `${name} leaves no open module database`);
  assertSourceUnchanged(before, databasePath);
  assert.equal(
    listManagedBackupFiles(directory).length,
    0,
    `${name} leaves no valid or partial managed backup`,
  );
  closeDatabase();
  return backupError;
}

function verifyBackupFile(backupPath: string, expectedProductCount: number): void {
  const backup = new NativeDatabase(backupPath, { readonly: true, fileMustExist: true });
  try {
    assert.equal(backup.pragma('user_version', { simple: true }), 0, 'backup preserves source user_version');
    assert.deepEqual(backup.pragma('integrity_check'), [{ integrity_check: 'ok' }], 'backup integrity is ok');
    const metadata = backup.prepare(
      `SELECT value FROM _flo_meta WHERE key = 'schema_version'`,
    ).get() as { value: string };
    assert.equal(metadata.value, '0', 'backup metadata matches source user_version');
    assert.equal(
      (backup.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
      expectedProductCount,
      'backup contains the synthetic source rows',
    );
  } finally {
    backup.close();
  }
}

function main(): void {
  console.log('Flo pre-migration backup fail-closed tests');

  expectFailClosed(
    'checkpoint-busy',
    'checkpoint',
    { checkpoint: () => [{ busy: 1, log: 4, checkpointed: 2 }] },
  );
  console.log('  PASS: busy/incomplete checkpoint blocks the migration batch');

  expectFailClosed(
    'invalid-destination',
    'prepare',
    {},
    (directory) => fs.writeFileSync(path.join(directory, 'backups'), 'not a directory'),
  );
  console.log('  PASS: invalid managed destination blocks the migration batch');

  const rawCopyFailure = 'copy failed for PRIVATE_USER with SECRET_ROW';
  const copyError = expectFailClosed(
    'copy-failure',
    'copy',
    {
      copyFileExclusive: (sourcePath: string, targetPath: string) => {
        fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
        throw new Error(rawCopyFailure);
      },
    },
  );
  assert.equal((copyError.cause as Error).message, rawCopyFailure, 'internal cause remains available locally');
  console.log('  PASS: copy failure removes the partial file and blocks migrations');

  expectFailClosed(
    'open-failure',
    'open',
    { openDatabase: () => { throw new Error('candidate cannot be opened'); } },
  );
  console.log('  PASS: candidate-open failure removes the partial file and blocks migrations');

  expectFailClosed(
    'integrity-failure',
    'integrity',
    { readIntegrity: () => [{ integrity_check: 'database disk image is malformed' }] },
  );
  console.log('  PASS: integrity failure removes the partial file and blocks migrations');

  expectFailClosed(
    'version-failure',
    'version',
    { readSchemaVersion: () => 999 },
  );
  console.log('  PASS: version mismatch removes the partial file and blocks migrations');

  expectFailClosed(
    'finalize-failure',
    'finalize',
    { renameSync: () => { throw new Error('rename blocked'); } },
  );
  console.log('  PASS: finalization failure removes the partial file and blocks migrations');

  const zeroByteDirectory = makeCaseDirectory('existing-zero-byte');
  const zeroBytePath = path.join(zeroByteDirectory, 'flo.db');
  fs.writeFileSync(zeroBytePath, '');
  let zeroByteError: unknown;
  try {
    initDatabase({
      preMigrationBackup: {
        copyFileExclusive: () => { throw new Error('zero-byte copy blocked'); },
      },
    });
  } catch (error) {
    zeroByteError = error;
  }
  assert.ok(zeroByteError instanceof PreMigrationBackupError, 'existing zero-byte file requires a backup');
  assert.equal((zeroByteError as PreMigrationBackupError).stage, 'copy');
  const zeroByteSource = new NativeDatabase(zeroBytePath, { readonly: true, fileMustExist: true });
  assert.equal(zeroByteSource.pragma('user_version', { simple: true }), 0, 'zero-byte source remains at v0');
  assert.equal(
    (zeroByteSource.prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'`).get() as { count: number }).count,
    0,
    'zero-byte source receives no migration tables',
  );
  zeroByteSource.close();
  assert.throws(() => getDatabase(), /not initialized/i);
  closeDatabase();
  console.log('  PASS: a pre-existing zero-byte file is not classified as a new installation');

  const upgradeDirectory = installExistingFixture('verified-upgrade');
  const upgradePath = path.join(upgradeDirectory, 'flo.db');
  const original = readSourceSnapshot(upgradePath);
  initDatabase();
  assert.equal(getCurrentSchemaVersion(), 38, 'existing v0 fixture upgrades to v38 after verified backup');
  assert.equal(
    (getDatabase().prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
    original.productCount,
    'upgrade preserves synthetic product rows',
  );
  assert.equal(runHealthCheck().findings.length, 0, 'upgraded schema matches the ideal schema');
  closeDatabase();

  const managedBackups = listManagedBackupFiles(upgradeDirectory);
  assert.equal(managedBackups.length, 1, 'exactly one verified pre-migration backup is published');
  assert.ok(managedBackups[0].endsWith('.db'), 'published backup uses the valid backup suffix');
  assert.ok(!managedBackups[0].includes('.partial'), 'published backup is not marked partial');
  const verifiedBackupPath = path.join(upgradeDirectory, 'backups', managedBackups[0]);
  verifyBackupFile(verifiedBackupPath, original.productCount);
  console.log('  PASS: verified backup preserves v0, integrity, metadata, and synthetic rows');

  initDatabase();
  assert.equal(getCurrentSchemaVersion(), 38, 'reopening the migrated source is idempotent');
  closeDatabase();
  assert.equal(listManagedBackupFiles(upgradeDirectory).length, 1, 'up-to-date source creates no extra backup');
  console.log('  PASS: an up-to-date existing database does not require another backup');

  const retryDirectory = makeCaseDirectory('isolated-retry');
  fs.copyFileSync(verifiedBackupPath, path.join(retryDirectory, 'flo.db'));
  verifyBackupFile(path.join(retryDirectory, 'flo.db'), original.productCount);
  initDatabase();
  assert.equal(getCurrentSchemaVersion(), 38, 'independent copy can retry the real v0 to v38 upgrade');
  assert.equal(
    (getDatabase().prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
    original.productCount,
    'isolated retry preserves synthetic rows',
  );
  assert.equal(runHealthCheck().findings.length, 0, 'isolated retry reaches ideal schema parity');
  closeDatabase();
  console.log('  PASS: verified copy is reusable for an isolated synthetic upgrade retry');

  const freshDirectory = makeCaseDirectory('fresh-install');
  assert.equal(fs.existsSync(path.join(freshDirectory, 'flo.db')), false, 'fresh database file starts absent');
  initDatabase();
  assert.equal(getCurrentSchemaVersion(), 38, 'fresh installation reaches v38');
  assert.equal(runHealthCheck().findings.length, 0, 'fresh installation matches ideal schema');
  closeDatabase();
  assert.equal(fs.existsSync(path.join(freshDirectory, 'backups')), false, 'fresh install creates no meaningless backup');
  console.log('  PASS: only prior file absence classifies a truly fresh install');

  const publicMessage = PRE_MIGRATION_BACKUP_OPERATOR_MESSAGE;
  assert.match(publicMessage, /No migration was applied/i, 'operator message states that migration did not run');
  assert.match(publicMessage, /disk space/i, 'operator message gives a recoverable storage action');
  assert.match(publicMessage, /close any other Flo instances/i, 'operator message asks to close other instances');
  assert.match(publicMessage, /try again/i, 'operator message asks the operator to retry');
  assert.match(publicMessage, /contact support/i, 'operator message gives an escalation action');
  assert.doesNotMatch(publicMessage, /(?:[A-Za-z]:\\|\/(?:Users|home)\/)/, 'operator message excludes absolute user paths');
  for (const sensitiveValue of ['PRIVATE_USER', 'SECRET_ROW', rawCopyFailure]) {
    assert.ok(!publicMessage.includes(sensitiveValue), `operator message excludes ${sensitiveValue}`);
  }

  const sanitizedPayload = getPreMigrationBackupTelemetryPayload(copyError);
  assert.deepEqual(sanitizedPayload, {
    error_type: 'pre_migration_backup',
    failure_stage: 'copy',
    db_schema_version: 0,
    target_schema_version: 38,
  });
  const serializedPayload = JSON.stringify(sanitizedPayload);
  assert.doesNotMatch(serializedPayload, /(?:[A-Za-z]:\\|\/(?:Users|home)\/)/, 'telemetry excludes absolute user paths');
  for (const sensitiveValue of ['PRIVATE_USER', 'SECRET_ROW', rawCopyFailure]) {
    assert.ok(!serializedPayload.includes(sensitiveValue), `telemetry excludes ${sensitiveValue}`);
  }
  console.log('  PASS: operator message and telemetry are structured and sanitized');
}

try {
  main();
  console.log('Pre-migration backup fail-closed tests passed');
} finally {
  closeDatabase();
  Module._load = originalLoad;
  fs.rmSync(testRoot, { recursive: true, force: true });
}
