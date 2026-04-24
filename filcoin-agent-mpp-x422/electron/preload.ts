const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: 'electron',
  ai: {
    sendMessage: (provider: string, config: object, messages: object[]) =>
      ipcRenderer.invoke('ai:send-message', provider, config, messages),
    testConnection: (provider: string, config: object) =>
      ipcRenderer.invoke('ai:test-connection', provider, config),
    listModels: (provider: string, config: object) =>
      ipcRenderer.invoke('ai:list-models', provider, config),
  },
  window: {
    osPlatform: process.platform,
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (callback: (isMaximized: boolean) => void) => {
      const handler = (_: unknown, v: boolean) => callback(v);
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    },
  },
});
