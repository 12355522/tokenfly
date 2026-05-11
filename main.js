'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 防止未捕捉的錯誤讓 Electron 主程序崩潰
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

let win = null;
let tray = null;
let watcher = null;
let updateTimer = null;

function createWindow() {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 300,
    height: 320,
    x: sw - 320,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);
  tray.setToolTip('Tokenfly - Claude Code 使用統計');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '顯示/隱藏視窗',
      click: () => {
        if (win) {
          win.isVisible() ? win.hide() : win.show();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    { label: '重新整理資料', click: () => sendUpdate() },
    { type: 'separator' },
    { label: '結束', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (win) win.isVisible() ? win.hide() : win.show();
  });
}

async function sendUpdate() {
  if (!win || !win.webContents) return;
  try {
    const { getCurrentSessionStats, getAllStats, getStatsCache } = require('./src/claude-parser');
    const { fetchUsageData } = require('./src/usage-api');
    const session = getCurrentSessionStats();
    const { today, week, month } = getAllStats();
    const cache = getStatsCache();
    const usage = await fetchUsageData();
    win.webContents.send('stats-update', { session, today, week, month, cache, usage });
  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

function startWatcher() {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(claudeDir)) return;

  let chokidar;
  try { chokidar = require('chokidar'); } catch (_) {}

  if (chokidar) {
    watcher = chokidar.watch(`${claudeDir}/**/*.jsonl`, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    const debounce = () => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(sendUpdate, 800);
    };
    watcher.on('change', debounce);
    watcher.on('add', debounce);
  } else {
    setInterval(sendUpdate, 5000);
  }

  setInterval(sendUpdate, 30_000);

  // Refresh API usage data every 3 minutes (cache TTL is 2 min)
  setInterval(() => {
    try {
      const { clearCache } = require('./src/usage-api');
      clearCache();
    } catch (_) {}
    sendUpdate();
  }, 3 * 60 * 1000);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startWatcher();

  if (win) {
    win.webContents.on('did-finish-load', () => {
      setTimeout(sendUpdate, 300);
    });
  }
});

app.on('window-all-closed', () => {
  // Keep alive in tray
});

app.on('activate', () => {
  if (!win) createWindow();
});

app.on('before-quit', () => {
  if (watcher) watcher.close();
});

ipcMain.handle('get-stats', async () => {
  try {
    const { getCurrentSessionStats, getAllStats, getStatsCache } = require('./src/claude-parser');
    const { fetchUsageData } = require('./src/usage-api');
    const session = getCurrentSessionStats();
    const { today, week, month } = getAllStats();
    const cache = getStatsCache();
    const usage = await fetchUsageData();
    return { session, today, week, month, cache, usage };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.on('window-resize', (_event, { width, height }) => {
  if (win) win.setSize(width, height);
});

ipcMain.on('window-close', () => {
  if (win) win.hide();
});
