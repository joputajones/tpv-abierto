'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function signalExitCode(signal) {
  const number = os.constants.signals[signal];
  return typeof number === 'number' ? 128 + number : 1;
}

function getNpmInvocation(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const execPath = options.execPath ?? process.execPath;
  const existsSync = options.existsSync ?? fs.existsSync;
  const npmExecPath = env.npm_execpath;

  if (npmExecPath) {
    if (/\.[cm]?js$/i.test(npmExecPath)) {
      return { command: execPath, argsPrefix: [npmExecPath] };
    }
    return { command: npmExecPath, argsPrefix: [] };
  }

  if (platform === 'win32') {
    const adjacentCli = path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (existsSync(adjacentCli)) {
      return { command: execPath, argsPrefix: [adjacentCli] };
    }
    throw new Error(
      'Unable to locate npm without a command shell. Run this script through npm or reinstall npm next to Node.js.',
    );
  }

  return { command: 'npm', argsPrefix: [] };
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: options.stdio ?? 'inherit',
        windowsHide: true,
        shell: false,
      });
    } catch (error) {
      reject(error);
      return;
    }

    const signalHandlers = new Map();
    const supportedSignals = process.platform === 'win32'
      ? ['SIGINT', 'SIGTERM']
      : ['SIGINT', 'SIGTERM', 'SIGHUP'];

    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) {
        process.removeListener(signal, handler);
      }
    };

    for (const signal of supportedSignals) {
      const handler = () => {
        try {
          child.kill(signal);
        } catch {
          // The child may already have exited between the signal and this handler.
        }
      };
      signalHandlers.set(signal, handler);
      process.once(signal, handler);
    }

    child.once('error', (error) => {
      cleanup();
      reject(error);
    });

    child.once('exit', (code, signal) => {
      cleanup();
      resolve({
        code,
        signal,
        exitCode: code ?? signalExitCode(signal),
      });
    });
  });
}

module.exports = {
  getNpmInvocation,
  runCommand,
  signalExitCode,
};
