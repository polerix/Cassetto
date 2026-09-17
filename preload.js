const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cassettoAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // File operations
  saveWavFile: (buffer, defaultName) => ipcRenderer.invoke('dialog:saveWav', { buffer, defaultName }),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),

  // Shortcut management
  createDesktopShortcut: () => ipcRenderer.invoke('shortcut:create'),
  checkDesktopShortcut: () => ipcRenderer.invoke('shortcut:check')
});
