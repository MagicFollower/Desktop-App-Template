# Desktop App Template

基于 **Electron + React + TypeScript** 的 Windows 桌面应用开发模板，复刻 RedisInsight 风格的深色主题 UI。

## 技术栈

- **Electron** - 桌面应用框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Recharts** - 实时图表
- **CSS Modules** - 样式管理

## 项目结构

```
desktop-app-template/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── main.ts           # 主进程入口
│   │   └── preload.ts        # 预加载脚本 (IPC 桥接)
│   └── renderer/              # React 渲染进程
│       ├── main.tsx          # React 入口
│       ├── App.tsx           # 主应用组件
│       ├── index.css         # 全局样式
│       └── components/       # UI 组件
│           ├── Sidebar.tsx   # 侧边栏导航
│           ├── TabBar.tsx    # 标签页栏
│           ├── Dashboard.tsx # 仪表盘
│           ├── RealtimeChart.tsx # 实时图表
│           └── WindowControls.tsx # 窗口控制按钮
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── vite.renderer.config.ts
├── README.md                     # 项目说明文档
└── doc/                          # 开发文档
    ├── 开发日志.md                # 完整开发过程记录
    └── 前端入职指南.md            # 零基础新人入职指南
```

## 功能特性

- ✅ 深色主题 UI（复刻 RedisInsight 风格）
- ✅ macOS 风格窗口控制按钮（红黄绿圆点）
- ✅ 可折叠侧边栏树形导航
- ✅ 标签页系统（支持添加/关闭标签）
- ✅ 实时数据仪表盘（4 个实时图表）
- ✅ WebSocket 模拟数据推送
- ✅ 响应式布局
- ✅ 自定义滚动条样式

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run dev
```

这将会：
- 启动 Vite 开发服务器（端口 5173）
- 打开 Electron 窗口并加载开发服务器
- 自动打开开发者工具

### 3. 构建生产版本

```bash
npm run build
```

这会：
- 编译 TypeScript 主进程代码到 `dist/main/`
- 使用 Vite 构建 React 渲染进程到 `dist/renderer/`

### 4. 打包分发

```bash
npm run package
```

这会：
- 先执行 `npm run build`
- 使用 electron-builder 打包成 Windows 安装程序

生成的安装包位于 `dist/electron/` 目录。

## 开发指南

### 添加新组件

1. 在 `src/renderer/components/` 下创建新组件文件（`.tsx` + `.css`）
2. 在 `App.tsx` 中引入并使用
3. 样式使用 CSS Modules 或独立 CSS 文件

### 实现 WebSocket 通信

主进程模拟了 WebSocket 数据推送，实际项目中可以：

1. 在 `main/main.ts` 中建立真实的 WebSocket 连接
2. 通过 `ipcMain.handle` 暴露 API
3. 在 `preload.ts` 中定义类型接口
4. 在 React 组件中通过 `window.electronAPI` 调用

示例：

```typescript
// 在 main/main.ts 中
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // 处理客户端消息
    const data = JSON.parse(message.toString());
    mainWindow?.webContents.send('real-time-data', data);
  });
});
```

### 自定义主题

修改以下 CSS 变量或颜色值：

- 背景色：`#0f0f1a`（主背景）、`#1a1a2e`（面板背景）
- 边框色：`#2a2a3e`
- 强调色：`#4a9eff`（蓝色）、`#ff6b9d`（粉色）、`#f5a623`（橙色）
- 文字色：`#e0e0e0`（主要）、`#888`（次要）

## 配置说明

### package.json

- `main`: 主进程入口文件
- `scripts.dev`: 开发模式启动命令
- `scripts.build`: 构建命令
- `scripts.package`: 打包命令
- `build.win.target`: 打包目标格式（nsis 安装程序）

### tsconfig.main.json

- 主进程 TypeScript 配置
- 输出到 `dist/main/`
- 使用 CommonJS 模块系统

### tsconfig.json

- 渲染进程 TypeScript 配置
- 使用 ESNext 模块系统
- 支持 React JSX

### vite.renderer.config.ts

- Vite 渲染进程配置
- 别名 `@` 指向 `src/renderer/`
- 输出到 `dist/renderer/`

## 跨平台支持

当前配置为 Windows 平台（electron-builder 默认）。如需支持 macOS 或 Linux：

```json
{
  "build": {
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

## 性能优化建议

1. **虚拟列表**：当侧边栏树节点很多时，使用虚拟滚动
2. **图表优化**：Recharts 大数据量时使用 `isAnimationActive={false}`
3. **代码分割**：使用 React.lazy 加载非关键组件
4. **内存管理**：及时清理 WebSocket 监听器和定时器

## 许可证

MIT License

## 参考

- [Electron 官方文档](https://www.electronjs.org/docs/)
- [React 官方文档](https://react.dev/)
- [Recharts 官方文档](https://recharts.org/)
- [Vite 官方文档](https://vitejs.dev/)
