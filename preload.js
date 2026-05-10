'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claude', {
  getStats: () => ipcRenderer.invoke('get-stats'),
  onStatsUpdate: (callback) => {
    ipcRenderer.on('stats-update', (_event, data) => callback(data));
  },
  resize: (width, height) => ipcRenderer.send('window-resize', { width, height }),
  close: () => ipcRenderer.send('window-close'),
});
