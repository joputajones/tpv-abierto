'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CURRENT_SCHEMA_VERSION = 38;
const DATASET_ID = 'synthetic-off-device-restore-v1';
const EVIDENCE_LEVEL = 'CI_CROSS_RUNNER';
const BACKUP_FILE = 'flo-backup.db';
const MANIFEST_FILE = 'manifest.json';
const CHECKSUM_FILE = 'SHA256SUMS';
const INSTRUCTIONS_FILE = 'RESTORE-INSTRUCTIONS.md';
const PACKAGE_FILES = Object.freeze([
  BACKUP_FILE,
  CHECKSUM_FILE,
  INSTRUCTIONS_FILE,
  MANIFEST_FILE,
].sort());
const MANIFEST_KEYS = Object.freeze([
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
]);
const RESULT_PREFIX = 'OFF_DEVICE_RESULT=';

class PackageValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PackageValidationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new PackageValidationError(code, message);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const file = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(file);
  }
  return hash.digest('hex');
}

function listPackageEntries(packageDir) {
  let entries;
  try {
    entries = fs.readdirSync(packageDir, { withFileTypes: true });
  } catch {
    fail('PACKAGE_UNREADABLE', 'The recovery package cannot be read.');
  }

  const names = entries.map((entry) => entry.name).sort();
  if (names.length !== PACKAGE_FILES.length || names.some((name, index) => name !== PACKAGE_FILES[index])) {
    fail('UNEXPECTED_FILE_SET', 'The recovery package does not contain the exact expected file set.');
  }
  for (const entry of entries) {
    const fullPath = path.join(packageDir, entry.name);
    const stat = fs.lstatSync(fullPath);
    if (!entry.isFile() || stat.isSymbolicLink()) {
      fail('UNSAFE_PACKAGE_ENTRY', 'The recovery package contains a non-regular file.');
    }
  }
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(code, 'The recovery manifest is not valid JSON.');
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('MANIFEST_INVALID', 'The recovery manifest must be an object.');
  }
  const keys = Object.keys(manifest).sort();
  if (keys.length !== MANIFEST_KEYS.length || keys.some((key, index) => key !== MANIFEST_KEYS[index])) {
    fail('MANIFEST_KEYS_INVALID', 'The recovery manifest has missing or unexpected fields.');
  }
  if (manifest.formatVersion !== 1) fail('FORMAT_VERSION_UNSUPPORTED', 'The recovery package format is unsupported.');
  if (manifest.backupFile !== BACKUP_FILE) fail('BACKUP_FILE_INVALID', 'The recovery manifest names an unexpected database file.');
  if (!Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes <= 0) fail('MANIFEST_SIZE_INVALID', 'The recovery manifest size is invalid.');
  if (!Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion <= 0) fail('MANIFEST_SCHEMA_INVALID', 'The recovery manifest schema version is invalid.');
  if (typeof manifest.appVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.appVersion)) {
    fail('MANIFEST_APP_VERSION_INVALID', 'The recovery manifest app version is invalid.');
  }
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt)) || !manifest.createdAt.endsWith('Z')) {
    fail('MANIFEST_DATE_INVALID', 'The recovery manifest timestamp is invalid.');
  }
  if (manifest.datasetId !== DATASET_ID) fail('DATASET_ID_INVALID', 'The recovery package dataset is unexpected.');
  if (manifest.evidenceLevel !== EVIDENCE_LEVEL) fail('EVIDENCE_LEVEL_INVALID', 'The recovery evidence level is unexpected.');
  if (!['win32', 'linux', 'darwin'].includes(manifest.sourcePlatform)) fail('SOURCE_PLATFORM_INVALID', 'The recovery source platform is invalid.');
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    fail('MANIFEST_HASH_INVALID', 'The recovery manifest checksum is invalid.');
  }
}

function parseChecksum(contents) {
  const match = /^([a-f0-9]{64})  flo-backup\.db\r?\n?$/.exec(contents);
  if (!match) fail('CHECKSUM_FILE_INVALID', 'The checksum file is invalid.');
  return match[1];
}

function validatePackagePreflight(packageDir, expectedSha256) {
  listPackageEntries(packageDir);
  const manifest = readJson(path.join(packageDir, MANIFEST_FILE), 'MANIFEST_JSON_INVALID');
  validateManifest(manifest);
  const checksum = parseChecksum(fs.readFileSync(path.join(packageDir, CHECKSUM_FILE), 'utf8'));
  const backupPath = path.join(packageDir, BACKUP_FILE);
  const stat = fs.statSync(backupPath);
  if (stat.size !== manifest.sizeBytes) fail('SIZE_MISMATCH', 'The database size does not match the manifest.');
  const actualSha256 = sha256File(backupPath);
  if (checksum !== actualSha256) fail('CHECKSUM_MISMATCH', 'The database checksum does not match SHA256SUMS.');
  if (manifest.sha256 !== actualSha256) fail('MANIFEST_HASH_MISMATCH', 'The database checksum does not match the manifest.');
  if (expectedSha256 && expectedSha256 !== actualSha256) fail('TRANSFER_HASH_MISMATCH', 'The consumed artifact differs from the producer evidence.');
  return { manifest, backupPath, actualSha256 };
}

function parseArguments(argv) {
  const result = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (match) result[match[1]] = path.resolve(match[2]);
  }
  return result;
}

function outputResult(result) {
  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`);
}

function sanitizedFailure(error, extra = {}) {
  return {
    ok: false,
    code: error && typeof error.code === 'string' ? error.code : 'UNEXPECTED_FAILURE',
    message: error instanceof PackageValidationError ? error.message : 'The recovery validation failed unexpectedly.',
    ...extra,
  };
}

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

module.exports = {
  BACKUP_FILE,
  CHECKSUM_FILE,
  CURRENT_SCHEMA_VERSION,
  DATASET_ID,
  EVIDENCE_LEVEL,
  INSTRUCTIONS_FILE,
  MANIFEST_FILE,
  PACKAGE_FILES,
  PackageValidationError,
  RESULT_PREFIX,
  fail,
  isWithin,
  outputResult,
  parseArguments,
  sanitizedFailure,
  sha256File,
  validatePackagePreflight,
};
