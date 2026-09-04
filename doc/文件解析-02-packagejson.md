# package.json 深度解析

> **本文档目标**：让新入职同学理解这个 JSON 文件是整个项目的"身份证 + 采购清单 + 操作手册"，每个字段在干什么、怎么生效、以及修改后会发生什么。（`你是谁？你能做什么？你有什么？`）

---

## 一、它是什么

`package.json` 是 **Node.js 生态项目的核心配置文件**，所有基于 npm/yarn/pnpm 的项目都有这个文件。

它承担三个角色：

| 角色 | 类比 | 说明 |
|------|------|------|
| **身份证** | 护照 | 项目名称、版本号、描述信息 |
| **采购清单** | 购物清单 | 项目需要哪些依赖库（dependencies）和开发工具（devDependencies） |
| **操作手册** | 快捷键菜单 | 定义了可以执行哪些命令（scripts），如 `npm run dev` |

此外，本项目还用它来配置 **electron-builder**（打包工具）的参数。

---

## 二、完整内容逐段解析

### 2.1 基本信息

```json
{
  "name": "desktop-app-template",
  "version": "1.0.0",
  "description": "Dark-themed Windows desktop app template (Electron + React + TypeScript)"
}
```

| 字段 | 值 | 解释 |
|------|---|------|
| `name` | `"desktop-app-template"` | 项目名称。在 npm  registry 中是唯一的标识符。在本项目中，它主要用于 `npm install` 时识别当前项目。 |
| `version` | `"1.0.0"` | 语义化版本号（Semantic Versioning）。格式为 `major.minor.patch`：`1.0.0` 表示主版本 1，还没有做过功能更新（minor）或 bug 修复（patch）。 |
| `description` | `"Dark-themed Windows desktop app template..."` | 项目描述，显示在 npm 官网和 IDE 的项目列表中，帮助其他人快速了解项目用途。 |

> **新人小结：语义化版本号（SemVer）是什么？**
>
> SemVer 规定版本号由三部分组成：`MAJOR.MINOR.PATCH`
>
> ```
> 1.0.0  ── 初始发布
> 1.1.0  ── 新增功能（minor 加 1），向后兼容
> 1.1.1  ── 修复 bug（patch 加 1），向后兼容
> 2.0.0  ── 重大变更（major 加 1），可能不向后兼容
> ```
>
> **为什么重要**：当你的项目依赖了 `react: "^18.3.1"` 时，`^` 表示"允许 patch 和 minor 级别的升级，但不允许 major 级别"。所以 `^18.3.1` 可以安装 `18.3.2`、`18.4.0`，但不能安装 `19.0.0`。这防止了大版本升级带来的 breaking changes。

### 2.2 入口文件

```json
"main": "dist/main/main.js"
```

这是整个项目**最关键的一行配置**，没有之一。

**它告诉 Electron**：当用户运行 `electron .` 时，从哪个文件开始执行。

**生效流程**：

```
用户执行: electron .
        │
        ▼
Electron 读取 package.json 中的 "main" 字段
        │
        ▼
找到入口文件: dist/main/main.js
        │
        ▼
执行 main.js 中的代码
        │
        ▼
创建浏览器窗口 → 加载网页 → 应用启动
```

**为什么是 `dist/main/main.js` 而不是 `src/main/main.ts`？**

因为 `src/main/main.ts` 是 TypeScript 源码，Node.js 看不懂 TypeScript。必须先用 `tsc` 编译成 JavaScript（`dist/main/main.js`），Electron 才能执行。

> **新人小结：为什么不能直接指向 .ts 文件？**
>
> Electron 底层是 Chromium + Node.js。Node.js 只认识 JavaScript，不认识 TypeScript。就像你不能用中文写合同然后直接交给外国律师——需要先翻译成英文。
>
> `tsc -p tsconfig.main.json` 就是那个"翻译器"，把 `src/main/main.ts` 翻译成 `dist/main/main.js`。

### 2.3 脚本命令（Scripts）

```json
"scripts": {
  "dev": "vite",
  "build": "npm run build:main && npm run build:renderer",
  "build:main": "tsc -p tsconfig.main.json",
  "build:renderer": "vite build --config vite.renderer.config.ts",
  "start": "electron .",
  "package": "npm run build && electron-builder"
}
```

这是项目的**操作手册**，定义了 6 个可以执行的命令。

#### 2.3.1 `npm run dev` — 开发模式

```bash
npm run dev  →  执行 vite
```

**Vite 做了什么**：
1. 启动一个开发服务器（默认端口 5173）
2. 监听 `src/renderer/` 下的文件变更
3. 当文件变更时，自动重新编译变更的部分（HMR = Hot Module Replacement，热模块替换）
4. 把编译结果提供给 Electron 加载

**Electron 做了什么**：
1. 读取 `package.json` 的 `main` 字段，找到 `dist/main/main.js`
2. 执行主进程代码，创建浏览器窗口
3. 窗口加载 `http://localhost:5173`（Vite 开发服务器地址）
4. 自动打开开发者工具（DevTools）

> **新人小结：开发模式 vs 生产模式的区别**
>
> | 对比项 | 开发模式 (`npm run dev`) | 生产模式 (`npm run build`) |
> |--------|------------------------|--------------------------|
> | 速度 | 快（只编译改动的文件） | 慢（全量编译） |
> | 代码 | TypeScript 源码（Vite 实时编译） | 纯 JavaScript（已编译） |
> | 调试 | 有 Source Map，可以调试原始 TS 代码 | 有 Source Map，可以追溯到原始代码 |
> | 性能 | 一般（有开发工具开销） | 最优（压缩、优化、树摇） |
> | 适用场景 | 日常开发 | 发布给用户 |

#### 2.3.2 `npm run build` — 构建

```bash
npm run build  →  npm run build:main && npm run build:renderer
```

这是一个**组合命令**，按顺序执行两步：

**第一步：`npm run build:main`**
```bash
tsc -p tsconfig.main.json
```
- 使用 TypeScript 编译器（`tsc`）编译主进程代码
- 读取 `tsconfig.main.json` 配置
- 输出到 `dist/main/` 目录

**第二步：`npm run build:renderer`**
```bash
vite build --config vite.renderer.config.ts
```
- 使用 Vite 构建渲染进程代码
- 读取 `vite.renderer.config.ts` 配置
- 输出到 `dist/renderer/` 目录

**为什么分两步？** 因为主进程和渲染进程使用不同的技术栈和编译工具：
- 主进程：TypeScript → JavaScript（用 `tsc`）
- 渲染进程：TypeScript + React JSX → JavaScript（用 Vite，它内部做了 JSX 转换、CSS 处理、代码压缩等）

#### 2.3.3 `npm run start` — 启动已构建的应用

```bash
npm run start  →  electron .
```

启动**已经构建好的**应用。此时加载的是 `dist/renderer/index.html`（而不是开发服务器的 `http://localhost:5173`）。

> **新人小结：什么时候用 `npm run start`？**
>
> - `npm run dev`：日常开发时使用，修改代码后自动刷新
> - `npm run start`：构建完成后测试生产环境效果，或者在没有开发服务器的环境下运行

#### 2.3.4 `npm run package` — 打包分发

```bash
npm run package  →  npm run build && electron-builder
```

这是一个**组合命令**，先构建再打包：

1. `npm run build`：生成 `dist/main/` 和 `dist/renderer/`
2. `electron-builder`：读取 `package.json` 中的 `build` 字段配置，把两个目录打包成 Windows 安装程序（`.exe`）

最终产物在 `dist/electron/` 目录下，是一个可以直接分发给用户的安装包。

### 2.4 打包配置（Build）

```json
"build": {
  "appId": "com.template.desktop-app",
  "productName": "Desktop App",
  "directories": {
    "output": "dist/electron"
  },
  "files": [
    "dist/main/**/*",
    "dist/renderer/**/*",
    "package.json"
  ],
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

这是 **electron-builder** 的配置，定义了如何把应用打包成安装程序。

| 字段 | 值 | 解释 |
|------|---|------|
| `appId` | `"com.template.desktop-app"` | 应用的唯一标识符，类似安卓的包名 `com.example.app`。用于 Windows 注册表、macOS 代码签名等。格式通常是反向域名：`com.公司.项目`。 |
| `productName` | `"Desktop App"` | 用户在安装程序、开始菜单、设置中看到的**应用名称**。 |
| `directories.output` | `"dist/electron"` | 打包产物的输出目录。 |
| `files` | `["dist/main/**/*", "dist/renderer/**/*", "package.json"]` | 需要打包进安装程序的文件。**注意**：这里只打包了编译后的文件，没有打包源代码（`src/`）。用户不需要看到你的源代码。 |
| `win.target` | `"nsis"` | Windows 打包格式。`nsis` 是 National Software Installation System，Windows 上最常见的安装程序格式，支持自定义安装目录、卸载程序、快捷方式等。 |
| `win.icon` | `"assets/icon.ico"` | 应用图标文件（`.ico` 格式）。Windows 安装程序和桌面快捷方式都会使用这个图标。 |
| `nsis.oneClick` | `false` | 安装过程不是"一键安装"，而是有多步向导（选择安装目录、选择开始菜单文件夹等）。 |
| `nsis.allowToChangeInstallationDirectory` | `true` | 允许用户自定义安装路径（默认是 `C:\Program Files\`）。 |

> **新人小结：为什么打包时不包含 src/ 目录？**
>
> 安装程序是给**最终用户**用的，他们只需要运行应用，不需要看源代码。不包含源代码可以：
> 1. **减小安装包体积**：源代码通常比编译后的代码大 2-3 倍
> 2. **保护知识产权**：防止别人直接看你的代码
> 3. **减少混淆**：用户不需要理解你的项目结构
>
> 当然，如果你做的是开源项目，可以选择包含源代码（设置 `publish: { publish: null }`）。

### 2.5 生产依赖（Dependencies）

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "recharts": "^2.12.7",
  "ws": "^8.18.0"
}
```

**dependencies** 是应用**运行时**需要的库。打包时会把这些库一起打进安装程序。

| 包名 | 版本 | 用途 | 为什么需要它 |
|------|------|------|-------------|
| `react` | `^18.3.1` | UI 框架 | 构建用户界面的核心库。没有它，你就不能用 `<div>hello</div>` 这种声明式方式写 UI。 |
| `react-dom` | `^18.3.1` | React 的 DOM 渲染器 | React 本身只定义组件逻辑，`react-dom` 负责把组件渲染到浏览器 DOM 上。在 Web 应用中必须同时安装 `react` 和 `react-dom`。 |
| `recharts` | `^2.12.7` | 图表库 | 基于 React 的图表组件库，用于绘制实时更新的面积图、折线图等。 |
| `ws` | `^8.18.0` | WebSocket 库 | 用于建立 WebSocket 连接，实现实时双向通信。主进程用这个库模拟 WebSocket 服务器。 |

> **新人小结：`^` 符号是什么意思？**
>
> `^18.3.1` 中的 `^` 是**范围操作符**，表示"允许minor和patch级别的升级，但不允许major级别的升级"。
>
> ```
> ^18.3.1  →  可以安装 18.3.2, 18.4.0, 18.9.9（但不能 19.0.0）
> ~18.3.1  →  只能安装 18.3.x（不能 18.4.0）
> 18.3.1   →  只能安装精确的 18.3.1
> ```
>
> **为什么用 `^` 而不是精确版本？** 因为 minor 和 patch 升级通常是向后兼容的（加新功能、修 bug），不需要你手动检查。而 major 升级可能有 breaking changes，需要你手动确认。

### 2.6 开发依赖（devDependencies）

```json
"devDependencies": {
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1",
  "@types/ws": "^8.5.12",
  "electron": "^33.2.0",
  "electron-builder": "^25.0.12",
  "typescript": "^5.6.3",
  "vite": "^6.0.3",
  "@vitejs/plugin-react": "^4.3.4"
}
```

**devDependencies** 是**开发时**需要的工具，打包时**不会**打进安装程序。

| 包名 | 版本 | 用途 | 为什么是 devDependency 而不是 dependency |
|------|------|------|----------------------------------------|
| `@types/react` | `^18.3.12` | React 的类型定义文件 | 只在写代码时提供类型提示，运行时不需要 |
| `@types/react-dom` | `^18.3.1` | react-dom 的类型定义 | 同上 |
| `@types/ws` | `^8.5.12` | WebSocket 库的类型定义 | 同上 |
| `electron` | `^33.2.0` | Electron 框架 | 开发时需要它来启动应用，但打包时 electron-builder 会自带 Electron 运行时 |
| `electron-builder` | `^25.0.12` | 打包工具 | 只在打包时使用，用户不需要 |
| `typescript` | `^5.6.3` | TypeScript 编译器 | 只在编译时使用，用户不需要 |
| `vite` | `^6.0.3` | 构建工具 | 只在开发和生产构建时使用 |
| `@vitejs/plugin-react` | `^4.3.4` | Vite 的 React 插件 | 只在 Vite 构建时使用 |

> **新人小结：dependencies vs devDependencies 的区别**
>
> ```
> dependencies（运行时依赖）
>   ├── react          ← 用户打开应用时需要
>   ├── react-dom      ← 用户打开应用时需要
>   ├── recharts       ← 用户看到图表时需要
>   └── ws             ← 应用运行时建立连接时需要
>
> devDependencies（开发时依赖）
>   ├── typescript     ← 你写代码时需要编译
>   ├── vite           ← 你开发时需要构建
>   ├── electron       ← 你开发时需要启动
>   └── @types/*       ← 你写代码时需要类型提示
> ```
>
> **打包时**：只有 `dependencies` 中的包会被打进安装程序。`devDependencies` 中的包只在你开发者的电脑上存在。

---

## 三、完整生效流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    开发者执行命令                            │
│                    npm run dev                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. npm 读取 package.json                                   │
│     - 解析 scripts.dev = "vite"                             │
│     - 解析 dependencies + devDependencies                   │
│     - 检查 node_modules 中是否已安装                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     node_modules 已存在？         node_modules 不存在？
              │                           │
              ▼                           ▼
     直接执行 vite              执行 npm install
              │                   - 下载 dependencies
              │                   - 下载 devDependencies
              │                   - 生成 package-lock.json
              ▼                           │
┌─────────────────────────────────────────┴─────────────────┐
│  2. Vite 启动开发服务器（端口 5173）                        │
│     - 读取 vite.renderer.config.ts                        │
│     - 编译 src/renderer/ 下的代码                          │
│     - 监听文件变更，自动热更新                              │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Electron 启动                                            │
│     - 读取 package.json 的 main 字段 → dist/main/main.js    │
│     - 执行主进程代码                                          │
│     - 创建浏览器窗口                                          │
│     - 窗口加载 http://localhost:5173（Vite 服务器）           │
│     - 用户看到应用界面                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、常见操作与对应的 package.json 变化

| 操作 | 命令 | package.json 的变化 |
|------|------|-------------------|
| 安装新依赖 | `npm install recharts` | `dependencies` 中新增 `recharts` 条目，`package-lock.json` 更新 |
| 安装开发依赖 | `npm install -D typescript` | `devDependencies` 中新增 `typescript` 条目 |
| 卸载依赖 | `npm uninstall ws` | `dependencies` 中移除 `ws` 条目 |
| 更新版本号 | 手动修改 `version` 字段 | 无自动变化，需要手动改 |
| 添加新命令 | 在 `scripts` 中添加新键 | 可以直接 `npm run 新命令名` |

---

## 五、新手常见问题

**Q1：`package-lock.json` 是什么？需要提交到 Git 吗？**

A：`package-lock.json` 是 npm 自动生成的锁文件，记录了每个依赖的精确版本和下载链接。**应该提交到 Git**。原因：
- 确保团队成员安装完全相同的依赖版本
- 避免"在我电脑上能跑，在你电脑上跑不了"的问题
- 生产构建时依赖精确版本，保证构建结果一致

**Q2：`node_modules` 占了我 2GB 空间，能不能删了重装？**

A：可以。删除 `node_modules` 和 `package-lock.json` 后，执行 `npm install` 会重新下载。但 `package-lock.json` 应该保留（它记录了精确版本），只删 `node_modules` 文件夹。

**Q3：能不能把 `electron` 从 devDependencies 移到 dependencies？**

A：不建议。`electron` 是开发时用来启动应用的框架，打包时 `electron-builder` 会自带 Electron 运行时。如果移到 `dependencies`，安装程序会多打包一个 Electron（约 150MB），但实际运行时用的是 `electron-builder` 自带的，造成重复。

**Q4：`main` 字段指向 `dist/main/main.js`，但开发时这个文件不存在，会不会报错？**

A：不会。因为 `npm run dev` 时，Electron 加载的是 `http://localhost:5173`（Vite 开发服务器），而不是 `dist/main/main.js`。`main` 字段只在 `npm run start` 或 `electron .`（生产模式）时才被使用。

---

## 六、总结

`package.json` 是整个项目的**中枢神经**，所有命令、依赖、配置都从这里出发。理解它的关键是记住三个核心概念：

1. **`main` 字段** = 应用的入口点（Electron 从这里开始执行）
2. **`scripts` 字段** = 项目的操作命令（`npm run xxx` 执行的都是这里定义的）
3. **`dependencies` vs `devDependencies`** = 运行时需要的 vs 开发时需要的

> **给新人的建议**：以后看到任何新项目的 `package.json`，先读 `scripts` 部分，就知道这个项目能做什么操作；再读 `dependencies` 部分，就知道项目用了哪些库。这两部分就能让你快速了解一个项目的全貌。
