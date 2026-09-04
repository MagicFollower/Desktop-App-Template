import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(width * 0.85, 1600),
    height: Math.min(height * 0.85, 1000),
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hidden',
    frame: false,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Mock WebSocket data simulation
const mockDataInterval = setInterval(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const data = {
      timestamp: Date.now(),
      commandsPerSec: Math.floor(Math.random() * 2) + 1,
      connectedClients: Math.floor(Math.random() * 3) + 1,
      memoryUsage: Math.floor(Math.random() * 100) + 150,
      networkInput: Math.floor(Math.random() * 15),
      networkOutput: Math.floor(Math.random() * 5),
    };
    mainWindow.webContents.send('mock-data', data);
  }
}, 1000);

// IPC handlers for window controls
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});
