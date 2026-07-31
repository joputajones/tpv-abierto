'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getNpmInvocation, runCommand, signalExitCode } = require('../scripts/process-runner.cjs');
const { TEST_SCRIPTS, runTestScripts } = require('./run-tests.cjs');

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

  assert.equal(TEST_SCRIPTS.length, 68);
  assert.equal(TEST_SCRIPTS[0], 'test:smoke');
  assert.equal(TEST_SCRIPTS.at(-2), 'test:dev-tooling');
  assert.equal(TEST_SCRIPTS.at(-1), 'test:cross-platform-scripts');

  const verifier = path.resolve(__dirname, '..', 'scripts', 'verify-electron-runtime.cjs');
  const noBashPath = path.dirname(process.execPath);
  const verifierResult = await runCommand(process.execPath, [verifier], {
    env: { ...process.env, PATH: noBashPath, Path: noBashPath },
    stdio: 'ignore',
  });
  assert.equal(verifierResult.exitCode, 0);

  console.log('Cross-platform script tests passed.');
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
