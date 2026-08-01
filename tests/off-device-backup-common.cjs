'use strict';

const path = require('node:path');
const {
  BACKUP_FILE,
  CHECKSUM_FILE,
  DATASET_ID,
  EVIDENCE_LEVEL,
  INSTRUCTIONS_FILE,
  MANIFEST_FILE,
  PACKAGE_FILES,
  PackageValidationError,
  fail,
  isWithin,
  sha256File,
  validatePackagePreflight,
} = require('../main/backup-package-validation');

const CURRENT_SCHEMA_VERSION = 38;
const RESULT_PREFIX = 'OFF_DEVICE_RESULT=';

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
