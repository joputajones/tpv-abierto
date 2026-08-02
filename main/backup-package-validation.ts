import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const BACKUP_FILE = 'flo-backup.db';
export const CHECKSUM_FILE = 'SHA256SUMS';
export const MANIFEST_FILE = 'manifest.json';
export const HANDOFF_MANIFEST_FILE = 'HANDOFF-MANIFEST.json';
export const INSTRUCTIONS_FILE = 'RESTORE-INSTRUCTIONS.md';
export const RESULT_FILE = 'OFF_DEVICE_RESTORE_RESULT.md';
export const DATASET_ID = 'synthetic-off-device-restore-v1';
export const EVIDENCE_LEVEL = 'CI_CROSS_RUNNER';

export const PACKAGE_FILES = Object.freeze([
  BACKUP_FILE,
  CHECKSUM_FILE,
  INSTRUCTIONS_FILE,
  MANIFEST_FILE,
].sort());

export const MANIFEST_KEYS = Object.freeze([
  'appVersion',
  'backupFile',
  'createdAt',
  'datasetId',
  'evidenceLevel',
  'formatVersion',
  'schemaVersion',
  'sha256',
  'sizeBytes',
  'sourcePlatform',
].sort());

const ASSISTANT_ALLOWED_NAMES = new Set([
  'backup.db',
  BACKUP_FILE,
  CHECKSUM_FILE,
  MANIFEST_FILE,
  HANDOFF_MANIFEST_FILE,
  INSTRUCTIONS_FILE,
  RESULT_FILE,
]);

export class PackageValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PackageValidationError';
  }
}

export function fail(code: string, message: string): never {
  throw new PackageValidationError(code, message);
}

export function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const file = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(file);
  }
  return hash.digest('hex');
}

function readJson(filePath: string, code: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(code, 'The recovery manifest must be an object.');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof PackageValidationError) throw error;
    fail(code, 'The recovery manifest is not valid JSON.');
  }
}

function validateCommonManifest(manifest: Record<string, unknown>, backupFile: string): void {
  if (manifest.formatVersion !== 1) fail('FORMAT_VERSION_UNSUPPORTED', 'The recovery package format is unsupported.');
  if (manifest.backupFile !== backupFile) fail('BACKUP_FILE_INVALID', 'The recovery manifest names an unexpected database file.');
  if (!Number.isSafeInteger(manifest.sizeBytes) || Number(manifest.sizeBytes) <= 0) {
    fail('MANIFEST_SIZE_INVALID', 'The recovery manifest size is invalid.');
  }
  if (!Number.isSafeInteger(manifest.schemaVersion) || Number(manifest.schemaVersion) <= 0) {
    fail('MANIFEST_SCHEMA_INVALID', 'The recovery manifest schema version is invalid.');
  }
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    fail('MANIFEST_HASH_INVALID', 'The recovery manifest checksum is invalid.');
  }
}

export function validateOffDeviceManifest(manifest: Record<string, unknown>): void {
  const keys = Object.keys(manifest).sort();
  if (keys.length !== MANIFEST_KEYS.length || keys.some((key, index) => key !== MANIFEST_KEYS[index])) {
    fail('MANIFEST_KEYS_INVALID', 'The recovery manifest has missing or unexpected fields.');
  }
  validateCommonManifest(manifest, BACKUP_FILE);
  if (typeof manifest.appVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.appVersion)) {
    fail('MANIFEST_APP_VERSION_INVALID', 'The recovery manifest app version is invalid.');
  }
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt)) || !manifest.createdAt.endsWith('Z')) {
    fail('MANIFEST_DATE_INVALID', 'The recovery manifest timestamp is invalid.');
  }
  if (manifest.datasetId !== DATASET_ID) fail('DATASET_ID_INVALID', 'The recovery package dataset is unexpected.');
  if (manifest.evidenceLevel !== EVIDENCE_LEVEL) fail('EVIDENCE_LEVEL_INVALID', 'The recovery evidence level is unexpected.');
  if (!['win32', 'linux', 'darwin'].includes(String(manifest.sourcePlatform))) {
    fail('SOURCE_PLATFORM_INVALID', 'The recovery source platform is invalid.');
  }
}

function parseChecksum(contents: string, backupFile: string): string {
  const normalized = contents.trimEnd();
  const separator = normalized.indexOf('  ');
  if (separator !== 64 || normalized.slice(separator + 2) !== backupFile) {
    fail('CHECKSUM_FILE_INVALID', 'The checksum file is invalid.');
  }
  const checksum = normalized.slice(0, 64);
  if (!/^[a-f0-9]{64}$/.test(checksum)) fail('CHECKSUM_FILE_INVALID', 'The checksum file is invalid.');
  return checksum;
}

function regularEntries(directory: string): fs.Dirent[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    fail('PACKAGE_UNREADABLE', 'The recovery package cannot be read.');
  }
  for (const entry of entries) {
    const stat = fs.lstatSync(path.join(directory, entry.name));
    if (!entry.isFile() || stat.isSymbolicLink()) {
      fail('UNSAFE_PACKAGE_ENTRY', 'The recovery package contains a non-regular file.');
    }
  }
  return entries;
}

export interface PackagePreflightResult {
  manifest: Record<string, unknown>;
  backupPath: string;
  actualSha256: string;
}

export function validatePackagePreflight(packageDir: string, expectedSha256?: string): PackagePreflightResult {
  const entries = regularEntries(packageDir);
  const names = entries.map((entry) => entry.name).sort();
  if (names.length !== PACKAGE_FILES.length || names.some((name, index) => name !== PACKAGE_FILES[index])) {
    fail('UNEXPECTED_FILE_SET', 'The recovery package does not contain the exact expected file set.');
  }
  const manifest = readJson(path.join(packageDir, MANIFEST_FILE), 'MANIFEST_JSON_INVALID');
  validateOffDeviceManifest(manifest);
  const checksum = parseChecksum(fs.readFileSync(path.join(packageDir, CHECKSUM_FILE), 'utf8'), BACKUP_FILE);
  const backupPath = path.join(packageDir, BACKUP_FILE);
  const stat = fs.statSync(backupPath);
  if (stat.size !== manifest.sizeBytes) fail('SIZE_MISMATCH', 'The database size does not match the manifest.');
  const actualSha256 = sha256File(backupPath);
  if (checksum !== actualSha256) fail('CHECKSUM_MISMATCH', 'The database checksum does not match SHA256SUMS.');
  if (manifest.sha256 !== actualSha256) fail('MANIFEST_HASH_MISMATCH', 'The database checksum does not match the manifest.');
  if (expectedSha256 && expectedSha256 !== actualSha256) fail('TRANSFER_HASH_MISMATCH', 'The consumed artifact differs from the producer evidence.');
  return { manifest, backupPath, actualSha256 };
}

export interface AssistantSelection {
  kind: 'package' | 'standalone';
  backupPath: string;
  backupSize: number;
  checksumMatched: boolean | null;
  manifest: Record<string, unknown> | null;
  manifestFormatVersion: number | null;
  actualSha256: string;
}

export function validateAssistantSelection(selectionPath: string): AssistantSelection {
  const resolved = path.resolve(selectionPath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) fail('UNSAFE_SELECTION', 'The selected copy is a link and cannot be checked safely.');
  if (stat.isFile()) {
    if (path.extname(resolved).toLowerCase() !== '.db') fail('UNSUPPORTED_SELECTION', 'Select a backup folder or a database backup file.');
    return {
      kind: 'standalone',
      backupPath: resolved,
      backupSize: stat.size,
      checksumMatched: null,
      manifest: null,
      manifestFormatVersion: null,
      actualSha256: sha256File(resolved),
    };
  }
  if (!stat.isDirectory()) fail('UNSUPPORTED_SELECTION', 'Select a backup folder or a database backup file.');

  const entries = regularEntries(resolved);
  const names = entries.map((entry) => entry.name);
  if (names.some((name) => !ASSISTANT_ALLOWED_NAMES.has(name))) {
    fail('UNEXPECTED_FILE_SET', 'The selected folder contains a file that does not belong to a backup package.');
  }
  const databaseNames = names.filter((name) => name === 'backup.db' || name === BACKUP_FILE);
  const manifestNames = names.filter((name) => name === MANIFEST_FILE || name === HANDOFF_MANIFEST_FILE);
  if (databaseNames.length !== 1 || manifestNames.length !== 1 || !names.includes(CHECKSUM_FILE)) {
    fail('INCOMPLETE_PACKAGE', 'The selected folder is missing a required backup file.');
  }
  const backupFile = databaseNames[0];
  const manifest = readJson(path.join(resolved, manifestNames[0]), 'MANIFEST_JSON_INVALID');
  validateCommonManifest(manifest, backupFile);
  const backupPath = path.join(resolved, backupFile);
  const backupSize = fs.statSync(backupPath).size;
  if (backupSize !== manifest.sizeBytes) fail('SIZE_MISMATCH', 'The database size does not match the manifest.');
  const actualSha256 = sha256File(backupPath);
  const checksum = parseChecksum(fs.readFileSync(path.join(resolved, CHECKSUM_FILE), 'utf8'), backupFile);
  if (checksum !== actualSha256) fail('CHECKSUM_MISMATCH', 'The database checksum does not match SHA256SUMS.');
  if (manifest.sha256 !== actualSha256) fail('MANIFEST_HASH_MISMATCH', 'The database checksum does not match the manifest.');
  return {
    kind: 'package',
    backupPath,
    backupSize,
    checksumMatched: true,
    manifest,
    manifestFormatVersion: Number(manifest.formatVersion),
    actualSha256,
  };
}

export function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
