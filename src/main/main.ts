import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { getDatabase, closeDatabase } from './database';
import { registerUserIpc } from './ipc/user';
import { registerMenuIpc } from './ipc/menu';
import { registerDocIpc } from './ipc/doc';
import { registerFileIpc } from './ipc/file';
import { startApiServer, stopApiServer, getApiPort } from './api-server';
import { logger } from './logger';

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
    // 透明窗口 + 渲染层 CSS border-radius 实现跨 Win10/Win11 的圆角；
    // 因此不能设置不透明的 backgroundColor（会把四角填满方角背景）。
    // 圆角样式与最大化时的去圆角逻辑由渲染进程的 is-electron / is-maximized 类控制。
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // 开发模式：加载 Vite dev server
    const devUrl = 'http://localhost:5173';
    logger.info(`[Main] Loading dev server: ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      logger.error('[Main] Failed to load dev server:', err);
      logger.error('[Main] Make sure Vite dev server is running (npm run dev)');
    });
    // DevTools 默认在开发模式自动打开；如需关闭设环境变量 OPEN_DEVTOOLS=false。
    if (process.env.OPEN_DEVTOOLS !== 'false') {
      mainWindow.webContents.openDevTools();
    }
    // 手动切换：窗口内按 F12 开/关 DevTools（frameless 无菜单栏时也能用，无需重启服务）。
    // 另外 Ctrl+Shift+I 由 Electron 默认菜单同样可切换。
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown' || input.key !== 'F12') return;
      const wc = mainWindow?.webContents;
      if (!wc) return;
      if (wc.isDevToolsOpened()) wc.closeDevTools();
      else wc.openDevTools();
    });
  } else {
    // 生产模式：加载编译后的 HTML
    const htmlPath = join(__dirname, '../renderer/index.html');
    logger.info(`[Main] Loading production build: ${htmlPath}`);
    mainWindow.loadFile(htmlPath).catch((err) => {
      logger.error('[Main] Failed to load HTML:', err);
    });
  }

  // 广播真实最大化状态，让渲染进程的标题栏图标与窗口实际状态同步
  // （双击标题栏、Win+↑ 等系统操作不会经过渲染进程，必须靠事件驱动）
  const sendMaximizeState = () => {
    mainWindow?.webContents.send('window:maximized-changed', mainWindow.isMaximized());
  };
  mainWindow.on('maximize', sendMaximizeState);
  mainWindow.on('unmaximize', sendMaximizeState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // 初始化数据库和 IPC
  let dbInitialized = false;
  try {
    logger.info('[Main] Initializing database...');
    await getDatabase();
    logger.info('[Main] Database initialized successfully');
    dbInitialized = true;
  } catch (err) {
    logger.error('[Main] Failed to initialize database:', err);
    logger.error('[Main] Application will continue without database support.');
    logger.error('[Main] To enable database, install Visual Studio C++ build tools.');
  }
  
  if (dbInitialized) {
    await registerUserIpc();
    await registerMenuIpc();
    await registerDocIpc();
    await registerFileIpc();
    logger.info('[Main] IPC channels registered');
  }

  // 开发模式下启动 HTTP API 服务器，让浏览器 dev 界面也能访问同一个 SQLite。
  // S1：已加 Origin/Host 双白名单准入校验（拦截恶意网页与 DNS rebinding）；
  // 不需要浏览器调试通道时可设 DEV_API=0 显式关闭。
  if (process.env.NODE_ENV === 'development' && dbInitialized && process.env.DEV_API !== '0') {
    try {
      await startApiServer();
      logger.info(`[Main] Dev API server started on port ${getApiPort()}`);
    } catch (err) {
      logger.error('[Main] Failed to start API server:', err);
    }
  }
  
  createWindow();
});

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

app.on('before-quit', () => {
  stopApiServer();
  closeDatabase();
});

// Mock WebSocket data simulation
// （历史注释块已随 D4 清理删除）

// 渲染层日志通道（A7）：打包后渲染进程的 console 无处可看，
// ErrorBoundary 等关键异常经 IPC 转发到主进程 electron-log 落盘
ipcMain.handle('log:renderer', (_event, { level, message }) => {
  const text = String(message ?? '');
  if (level === 'warn') logger.warn(`[Renderer] ${text}`);
  else if (level === 'error') logger.error(`[Renderer] ${text}`);
  else logger.info(`[Renderer] ${text}`);
  return { success: true };
});

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

ipcMain.handle('window:is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});
