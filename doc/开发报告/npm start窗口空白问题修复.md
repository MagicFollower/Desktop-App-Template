# npm start 窗口空白问题修复

## 问题描述

执行 `npm start` 后：
- Electron 进程启动但窗口内容为空白
- 没有自定义标题栏（缩小/关闭按钮缺失）
- 开发者工具未打开
- 无任何错误提示

## 根本原因

### 1. 环境变量缺失

`../../package.json` 中的 `start` 脚本直接运行 `electron .`，未设置 `NODE_ENV` 环境变量：

```json
"start": "electron ."  // ❌ NODE_ENV 未定义
```

导致主进程中的条件判断失效：

```typescript
if (process.env.NODE_ENV === 'development') {
  mainWindow.loadURL('http://localhost:5173');  // 开发模式
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'));  // 生产模式
}
```

由于 `NODE_ENV` 为 `undefined`，走了生产模式分支，尝试加载编译后的 HTML 文件。

### 2. Vite Dev Server 未启动

即使加载了 `dist/renderer/index.html`，该文件只是空的 HTML shell，实际的 React 应用需要通过 Vite dev server (`http://localhost:5173`) 提供 JavaScript bundle。由于 `npm start` 只启动了 Electron，没有同时启动 Vite，导致页面空白。

### 3. 缺少并发执行工具

需要同时运行两个进程：
- **Vite dev server**（前端热更新服务器）
- **Electron**（桌面应用容器）

## 解决方案

### 步骤 1：安装并发执行工具

```bash
npm install --save-dev concurrently cross-env
```

- **concurrently**: 跨平台并发运行多个命令
- **cross-env**: 跨平台设置环境变量（兼容 Windows CMD/PowerShell 和 Unix shell）

### 步骤 2：更新 package.json scripts

```json
{
  "scripts": {
    "dev": "vite --config vite.renderer.config.ts",
    "electron:dev": "npm run build:main && cross-env NODE_ENV=development electron .",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "tsc -p tsconfig.main.json",
    "build:renderer": "vite build --config vite.renderer.config.ts",
    "start": "concurrently \"npm run dev\" \"npm run electron:dev\"",
    "postinstall": "electron-builder install-app-deps",
    "rebuild": "electron-rebuild",
    "package": "npm run build && electron-builder"
  }
}
```

**关键改动：**
- `electron:dev`: 先编译 TypeScript (`build:main`)，再设置 `NODE_ENV=development` 启动 Electron
- `start`: 使用 `concurrently` 同时运行 Vite 和 Electron

### 步骤 3：增强主进程错误处理

在 `../../src/main/main.ts` 的 `createWindow()` 中添加错误捕获：

```typescript
if (process.env.NODE_ENV === 'development') {
  const devUrl = 'http://localhost:5173';
  console.log(`[Main] Loading dev server: ${devUrl}`);
  mainWindow.loadURL(devUrl).catch((err) => {
    console.error('[Main] Failed to load dev server:', err);
    console.error('[Main] Make sure Vite dev server is running (npm run dev)');
  });
  mainWindow.webContents.openDevTools();
} else {
  const htmlPath = join(__dirname, '../renderer/index.html');
  console.log(`[Main] Loading production build: ${htmlPath}`);
  mainWindow.loadFile(htmlPath).catch((err) => {
    console.error('[Main] Failed to load HTML:', err);
  });
}
```

## 验证结果

执行 `npm start` 后的正确输出：

```
[0] > desktop-app-template@1.0.0 dev
[0] > vite --config vite.renderer.config.ts
[0] 
[0]   VITE v6.4.3  ready in 318 ms
[0]   ➜  Local:   http://localhost:5173/

[1] > desktop-app-template@1.0.0 electron:dev
[1] > npm run build:main && cross-env NODE_ENV=development electron .
[1] 
[1] [Main] Initializing database...
[1] [DB] Database opened successfully
[1] [Main] Database initialized successfully
[1] [Main] IPC channels registered
[1] [Main] Loading dev server: http://localhost:5173
[1] [Menu IPC] Loaded 9 menus from database
```

**预期行为：**
- ✅ Vite dev server 在 5173 端口启动
- ✅ Electron 窗口显示完整 UI（包括标题栏、Tab 栏、菜单）
- ✅ 开发者工具自动打开
- ✅ 数据库正常加载，IPC 通道可用
- ✅ 热更新生效（修改代码后自动刷新）

## 开发流程对比

| 操作 | 修复前 | 修复后 |
|------|--------|--------|
| 启动命令 | `npm start` | `npm start` |
| 启动内容 | 仅 Electron | Vite + Electron |
| 窗口状态 | 空白 | 完整 UI |
| 热更新 | ❌ 不可用 | ✅ 自动刷新 |
| 调试工具 | ❌ 未打开 | ✅ 自动开启 |
| 数据库 | ❌ 未初始化 | ✅ 正常加载 |

## 注意事项

1. **首次启动较慢**：`electron:dev` 会先执行 `build:main` 编译 TypeScript，约需 2-3 秒
2. **端口占用**：确保 5173 端口未被其他进程占用
3. **停止服务**：按 `Ctrl+C` 会同时终止 Vite 和 Electron 进程

## 相关资源

- [concurrently NPM](https://www.npmjs.com/package/concurrently)
- [cross-env NPM](https://www.npmjs.com/package/cross-env)
- [Electron Development Workflow](https://www.electronjs.org/docs/latest/tutorial/quick-start)
