const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, 'assets', 'cassette.icns')
    : path.join(__dirname, 'assets', 'cassette.png');

  mainWindow = new BrowserWindow({
    width: 640,
    height: 520,
    minWidth: 540,
    minHeight: 440,
    frame: false, // Custom Win95 title bar
    transparent: false,
    backgroundColor: '#c0c0c0',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile('index.html');

  // Open external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function setupMacMenu() {
  if (process.platform !== 'darwin') return;

  const template = [
    {
      label: 'Cassetto',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Ensure assets directory exists
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

app.whenReady().then(() => {
  setupMacMenu();
  createWindow();

  // Auto-check / create desktop shortcut if allowed on startup
  autoCheckDesktopShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window Control IPC
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// File Saving IPC
ipcMain.handle('dialog:saveWav', async (event, { buffer, defaultName }) => {
  try {
    const desktopPath = app.getPath('desktop');
    const defaultPath = path.join(desktopPath, defaultName || `Recording_${getTimestampStr()}.wav`);

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Audio Recording',
      defaultPath: defaultPath,
      filters: [
        { name: 'WAVE Audio File (*.wav)', extensions: ['wav'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, reason: 'cancelled' };
    }

    const nodeBuffer = Buffer.from(buffer);
    fs.writeFileSync(filePath, nodeBuffer);

    return { success: true, filePath: filePath };
  } catch (err) {
    console.error('Failed to save WAV file:', err);
    return { success: false, error: err.message };
  }
});

// Shell & Shortcut IPC
ipcMain.handle('shortcut:create', async () => {
  return createDesktopShortcut();
});

ipcMain.handle('shortcut:check', async () => {
  return checkDesktopShortcut();
});

ipcMain.handle('shell:showInFolder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

function getShortcutPath() {
  try {
    const desktopDir = app.getPath('desktop');
    return path.join(desktopDir, 'Cassetto.lnk');
  } catch (e) {
    return null;
  }
}

function checkDesktopShortcut() {
  if (process.platform === 'darwin') return true;
  const shortcutPath = getShortcutPath();
  if (!shortcutPath) return false;
  return fs.existsSync(shortcutPath);
}

function createDesktopShortcut() {
  if (process.platform === 'darwin') {
    return { success: true, message: 'macOS Application Bundle (.app)', isMac: true };
  }
  try {
    const shortcutPath = getShortcutPath();
    if (!shortcutPath) return { success: false, message: 'Desktop folder not accessible.' };

    const targetExe = process.execPath;
    const options = {
      target: targetExe,
      args: '',
      description: 'Cassetto',
      icon: targetExe,
      iconIndex: 0
    };

    const success = shell.writeShortcutLink(shortcutPath, options);
    if (success) {
      return { success: true, path: shortcutPath };
    } else {
      return { success: false, message: 'Failed to write shortcut link.' };
    }
  } catch (err) {
    console.error('Shortcut creation error:', err);
    return { success: false, message: err.message };
  }
}

function autoCheckDesktopShortcut() {
  // Silent check on launch
  try {
    if (!checkDesktopShortcut()) {
      // Try to create desktop shortcut automatically if permitted
      createDesktopShortcut();
    }
  } catch (err) {
    // Graceful silent fallback for restricted permissions
  }
}

function getTimestampStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}
