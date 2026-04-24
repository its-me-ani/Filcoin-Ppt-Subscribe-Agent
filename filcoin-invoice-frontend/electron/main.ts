import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerAiHandlers } from './ipc-handlers/index.js';

let mainWindow: BrowserWindow | null = null;

const ZOOM_STEP = 0.5;
const ZOOM_MIN = -3;   // ~50%
const ZOOM_MAX = 3;   // ~400%

function setupZoom(win: BrowserWindow) {
  win.webContents.on('before-input-event', (_event, input) => {
    const ctrl = input.control || input.meta; // meta = Cmd on macOS
    if (!ctrl || input.type !== 'keyDown') return;

    const wc = win.webContents;

    // Zoom in: Ctrl+= or Ctrl++ (Ctrl+Shift+=)
    if (input.key === '=' || input.key === '+') {
      wc.setZoomLevel(Math.min(wc.getZoomLevel() + ZOOM_STEP, ZOOM_MAX));
      return;
    }
    // Zoom out: Ctrl+-
    if (input.key === '-') {
      wc.setZoomLevel(Math.max(wc.getZoomLevel() - ZOOM_STEP, ZOOM_MIN));
      return;
    }
    // Reset zoom: Ctrl+0
    if (input.key === '0') {
      wc.setZoomLevel(0);
    }
  });
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'EdgeBilling',
    autoHideMenuBar: true,
    // Custom title bar: hidden on macOS (keeps traffic lights), frameless on Windows/Linux
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 12, y: 10 } }
      : { frame: false }),
  });

  setupZoom(mainWindow);

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));

  // In development, load the Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

app.whenReady().then(() => {
  registerAiHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
