'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getNpmInvocation, runCommand, signalExitCode } = require('../scripts/process-runner.cjs');
const { TEST_SCRIPTS, runTestScripts } = require('./run-tests.cjs');
const packageJson = require('../package.json');

async function main() {
  const windowsNpmCli = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
  assert.deepEqual(
    getNpmInvocation({
      platform: 'win32',
      env: { npm_execpath: windowsNpmCli },
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
    }),
    {
      command: 'C:\\Program Files\\nodejs\\node.exe',
      argsPrefix: [windowsNpmCli],
    },
  );

  const exitResult = await runCommand(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'ignore' });
  assert.equal(exitResult.exitCode, 7);
  assert.equal(signalExitCode('SIGTERM') > 128, true);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo scripts with spaces '));
  try {
    const fixture = path.join(tempDir, 'child fixture.cjs');
    fs.writeFileSync(fixture, "process.exit(process.argv[2] === 'argument with spaces' ? 0 : 9);\n");
    const spacedResult = await runCommand(
      process.execPath,
      [fixture, 'argument with spaces'],
      { stdio: 'ignore' },
    );
    assert.equal(spacedResult.exitCode, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const calls = [];
  const aggregateResult = await runTestScripts(['first', 'skip', 'failure', 'never'], {
    invocation: { command: process.execPath, argsPrefix: ['fake-npm-cli.js'] },
    logger: { log() {}, error() {} },
    run: async (_command, args) => {
      const script = args.at(-1);
      calls.push(script);
      const exitCode = script === 'skip' ? 77 : script === 'failure' ? 5 : 0;
      return { code: exitCode, signal: null, exitCode };
    },
  });
  assert.deepEqual(calls, ['first', 'skip', 'failure']);
  assert.deepEqual(aggregateResult, { code: 5, signal: null, failedScript: 'failure' });

  assert.equal(TEST_SCRIPTS.length, 71);
  assert.equal(TEST_SCRIPTS[0], 'test:smoke');
  assert.equal(TEST_SCRIPTS.at(-2), 'test:dev-tooling');
  assert.equal(TEST_SCRIPTS.at(-1), 'test:cross-platform-scripts');
  assert.equal(
    packageJson.scripts['test:full-offline-operation'],
    'node tests/full-offline-operation.test.cjs',
    'the coordinator must run under Node and launch Electron explicitly',
  );

  const recoveryE2eSource = fs.readFileSync(path.join(__dirname, 'recovery-assistant-e2e.test.cjs'), 'utf8');
  const recoveryE2eProbeSource = fs.readFileSync(path.join(__dirname, 'recovery-assistant-e2e-probe.cjs'), 'utf8');
  const fullMatrixSource = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'nightly-release.yml'), 'utf8');
  const packageVerifierSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'verify-recovery-assistant-package.cjs'), 'utf8');
  assert.match(recoveryE2eSource, /process\.platform === 'linux'.*--no-sandbox/);
  assert.match(recoveryE2eProbeSource, /window\.isFocused\(\)/);
  assert.match(recoveryE2eProbeSource, /webContents\.sendInputEvent/);
  assert.match(recoveryE2eProbeSource, /pressKey\(window, 'Space'\)/);
  assert.equal(recoveryE2eProbeSource.includes('document.activeElement.click()'), false);
  assert.equal(recoveryE2eProbeSource.includes('Input.dispatchKeyEvent'), false);
  assert.match(packageVerifierSource, /process\.platform === 'linux'.*--no-sandbox/);
  assert.equal(packageVerifierSource.includes("entry.replace(/^[\\\\/]/, '')"), true);
  assert.equal(packageVerifierSource.includes("path.join(path.dirname(resources), 'MacOS')"), true);
  assert.equal(packageVerifierSource.includes("candidate.includes('.app/Contents/MacOS/')"), false);
  assert.match(fullMatrixSource, /- os: macos-15-intel\s+target: --mac --x64/);
  assert.match(fullMatrixSource, /- os: macos-latest\s+target: --mac --arm64/);
  assert.match(fullMatrixSource, /install -y fakeroot dpkg openbox/);
  assert.match(fullMatrixSource, /openbox.*npm test/);
  const ciSource = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(ciSource, /install -y openbox/);
  assert.match(ciSource, /openbox.*npm test/);

  const verifier = path.resolve(__dirname, '..', 'scripts', 'verify-electron-runtime.cjs');
  const noBashPathEntries = [path.dirname(process.execPath)];
  let nativeToolsDir;

  try {
    if (process.platform === 'darwin') {
      nativeToolsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo native tools '));
      for (const tool of ['codesign', 'xattr']) {
        const systemTool = path.join('/usr/bin', tool);
        assert.equal(fs.existsSync(systemTool), true, `${systemTool} is required on macOS`);
        fs.symlinkSync(systemTool, path.join(nativeToolsDir, tool));
      }
      noBashPathEntries.push(nativeToolsDir);
    }

    const noBashPath = noBashPathEntries.join(path.delimiter);
    const verifierResult = await runCommand(process.execPath, [verifier], {
      env: { ...process.env, PATH: noBashPath, Path: noBashPath },
      stdio: 'ignore',
    });
    assert.equal(verifierResult.exitCode, 0);
  } finally {
    if (nativeToolsDir) {
      fs.rmSync(nativeToolsDir, { recursive: true, force: true });
    }
  }

  console.log('Cross-platform script tests passed.');
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
