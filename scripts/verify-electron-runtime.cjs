'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REMEDIATION = [
  "Do NOT run 'spctl --master-disable' or otherwise disable Gatekeeper system-wide to work around this.",
  'Approved remediation: remove node_modules/electron and run npm install again.',
  'If a clean reinstall still fails, this is a real problem with the electron package - open an issue',
  "instead of bypassing Gatekeeper. See CONTRIBUTING.md's 'macOS Gatekeeper & the Electron dev binary' section.",
];

function verificationError(message) {
  const error = new Error(message);
  error.name = 'ElectronRuntimeVerificationError';
  return error;
}

function findElectronApp(electronDir, fsModule = fs) {
  const distDir = path.join(electronDir, 'dist');
  let entries;

  try {
    entries = fsModule.readdirSync(distDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  return app ? path.join(distDir, app.name) : null;
}

function verifyElectronRuntime(options = {}) {
  const platform = options.platform ?? process.platform;
  const fsModule = options.fsModule ?? fs;
  const runSync = options.runSync ?? spawnSync;
  const electronDir = options.electronDir ?? path.resolve('node_modules', 'electron');

  if (platform !== 'darwin' || !fsModule.existsSync(electronDir)) {
    return { skipped: true };
  }

  const app = findElectronApp(electronDir, fsModule);
  if (!app) {
    throw verificationError(
      `${electronDir} is installed but no dist/*.app bundle was found - the download is incomplete or corrupted.`,
    );
  }

  const quarantine = runSync('xattr', ['-p', 'com.apple.quarantine', app], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const quarantineValue = quarantine.status === 0 ? quarantine.stdout.trim() : '';
  if (quarantineValue) {
    throw verificationError(
      `${app} is marked com.apple.quarantine (${quarantineValue}). A plain npm install should not set this; something in the download path tagged it.`,
    );
  }

  const signature = runSync('codesign', ['-dv', app], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (signature.error || signature.status !== 0) {
    throw verificationError(
      `${app} has no code signature at all (expected an ad-hoc dev signature) - the binary is likely corrupted.`,
    );
  }

  return { skipped: false, app };
}

function main() {
  try {
    const result = verifyElectronRuntime();
    if (!result.skipped) {
      console.log(`verify-electron-runtime: ${result.app} present, unquarantined, ad-hoc signed as expected.`);
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    console.error('');
    for (const line of REMEDIATION) {
      console.error(line);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  findElectronApp,
  verifyElectronRuntime,
};
