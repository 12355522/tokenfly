'use strict';

// Launch script that clears ELECTRON_RUN_AS_NODE before starting Electron.
// Claude Code (and other Electron apps) set ELECTRON_RUN_AS_NODE=1 which
// causes the Electron binary to run as plain Node.js instead of an Electron app.

const { spawn } = require('child_process');
const path = require('path');

const electronBin = require('electron');
const appDir = path.join(__dirname, '..');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, [appDir], {
  stdio: 'inherit',
  windowsHide: false,
  env,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
