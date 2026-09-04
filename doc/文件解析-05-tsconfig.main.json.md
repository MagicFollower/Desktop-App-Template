# tsconfig.main.json 深度解析

> **本文档目标**：让新入职同学理解主进程的 TypeScript 配置与渲染进程配置的区别，以及为什么 Electron 主进程必须使用 CommonJS 模块系统。

---

## 一、它是什么

`tsconfig.main.json` 是 **Electron 主进程的 TypeScript 配置文件**。

本项目有两个 TypeScript 配置文件：
- `tsconfig.json` → 渲染进程（React 代码，运行在浏览器中）
- `tsconfig.main.json` → 主进程（Node.js 代码，运行在 Electron 后台）

它们各自管理不同环境的代码，因为**两个进程的运行环境完全不同**。

> **新人小结：为什么需要两个 tsconfig？**
>
> 打个比方：你家里有两个房间，客厅和卧室。
> - 客厅的规矩是"可以穿拖鞋、可以大声说话"（浏览器环境，宽松）
> - 卧室的规矩是"必须穿袜子、要保持安静"（Node.js 环境，严格）
>
> 你不能把客厅的规矩用到卧室，也不能把卧室的规矩用到客厅。`tsconfig.main.json` 就是"卧室的规矩"。

---

## 二、完整内容

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist/main",
    "rootDir": "src/main",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/main/**/*.ts"]
}
```

---

## 三、逐字段解析

### 3.1 `target`: `"ES2020"`

与 `tsconfig.json` 相同。主进程运行在 Node.js 中，Node.js 18+ 完全支持 ES2020 语法。

**不设置 `DOM` 到 lib 的原因**：主进程运行在 Node.js 环境中，没有浏览器 DOM。如果加了 `DOM`，TypeScript 会允许你在主进程中写 `document.createElement()`，这在 Node.js 中会报错。

> **新人小结：主进程能访问 DOM 吗？**
>
> **不能**。主进程运行在 Node.js 中，只有渲染进程（浏览器窗口）才能访问 DOM。
>
> 如果你想操作 DOM（比如获取窗口的宽度），必须通过 IPC 让渲染进程返回数据给主进程，或者通过 `webContents.executeJavaScript()` 在窗口中执行代码。

### 3.2 `module`: `"commonjs"`

**这是与 `tsconfig.json` 最关键的差异。**

`tsconfig.json`（渲染进程）使用 `"ESNext"`（ES Module），而 `tsconfig.main.json`（主进程）使用 `"commonjs"`。

**原因**：Electron 的主进程传统上使用 CommonJS 模块系统。

```typescript
// CommonJS 写法（主进程使用）
const { app, BrowserWindow } = require('electron');  // 用 require 导入

module.exports = {
  createWindow: () => { ... }
};  // 用 module.exports 导出
```

```typescript
// ES Module 写法（渲染进程使用）
import { app, BrowserWindow } from 'electron';  // 用 import 导入

export function createWindow() { ... }  // 用 export 导出
```

**为什么主进程不用 ES Module**：

| 原因 | 说明 |
|------|------|
| Electron 官方推荐 | Electron 文档中的所有示例都使用 CommonJS |
| 生态兼容 | 很多 Node.js 库只发布 CommonJS 版本，ES Module 可能无法直接使用 |
| 动态导入 | 主进程经常需要动态加载模块（`require('./some-module')`），CommonJS 原生支持 |
| 历史原因 | Electron 从 1.0 开始就基于 CommonJS，切换到 ESM 需要大量改造 |

> **新人小结：CommonJS vs ES Module 的核心区别**
>
> ```javascript
> // CommonJS: 运行时加载（动态）
> const fs = require('fs');           // 代码执行到这一行时才加载 fs 模块
> const data = fs.readFileSync('file'); // 可以条件加载
> if (condition) {
>   const other = require('other');   // 条件加载，完全合法
> }
>
> // ES Module: 编译时加载（静态）
> import fs from 'fs';                 // 编译时就知道要加载 fs
> import other from 'other';          // 所有 import 在文件顶部
> // 不能条件加载：if (condition) import other from 'other';  ❌ 语法错误
> ```
>
> 主进程经常需要条件加载模块（比如只在特定平台上加载特定模块），CommonJS 的动态加载特性更合适。

### 3.3 `lib`: `["ES2020"]`

只包含 ES2020 核心库，**没有 DOM**。

对比 `tsconfig.json` 的 `lib`: `["ES2020", "DOM", "DOM.Iterable"]`

| 库 | 渲染进程 | 主进程 | 原因 |
|---|---------|--------|------|
| `ES2020` | ✅ | ✅ | 两者都需要 JavaScript 核心 API |
| `DOM` | ✅ | ❌ | 主进程没有浏览器 DOM |
| `DOM.Iterable` | ✅ | ❌ | 主进程没有 DOM 迭代器 |

### 3.4 `outDir`: `"dist/main"`

**含义**：编译后的 JavaScript 文件输出到 `dist/main/` 目录。

**生效流程**：

```
src/main/main.ts  ──tsc 编译──▶  dist/main/main.js
src/main/preload.ts  ──tsc 编译──▶  dist/main/preload.js
```

**为什么需要指定 `outDir`**：`tsconfig.json`（渲染进程）没有指定 `outDir`，因为渲染进程由 Vite 编译，输出到 `dist/renderer/`。主进程由 `tsc` 编译，需要明确指定输出目录。

> **新人小结：outDir 和 rootDir 的关系**
>
> ```
> rootDir: src/main        ← "我的源码在这里"
> outDir:  dist/main       ← "编译后的代码放在这里"
>
> 映射关系:
> src/main/main.ts  →  dist/main/main.js
> src/main/preload.ts  →  dist/main/preload.js
> ```
>
> `rootDir` 和 `outDir` 的结构应该保持一致（子目录对应子目录），否则 `tsc` 会报错。

### 3.5 `rootDir`: `"src/main"`

**含义**：TypeScript 编译器的**源码根目录**。所有被 `include` 匹配的文件，其相对路径会基于这个目录计算。

**为什么需要**：`include` 匹配的是 `src/main/**/*.ts`，如果 `rootDir` 不设为 `src/main`，编译后的文件路径会多一层 `src/main/`：

```
没有 rootDir:  dist/main/src/main/main.js   ← 多了一层，不对！
有 rootDir:    dist/main/main.js            ← 正确！
```

> **新人小结：rootDir 是"相对路径的起点"**
>
> 想象你在地图上看路线：
> - `rootDir` = 你的出发点（起点）
> - `outDir` = 你的目的地（终点）
> - 编译器计算从起点到终点的路线，生成对应路径的文件
>
> 如果起点设错了，目的地也会错。

### 3.6 `strict`: `true`

与 `tsconfig.json` 相同，开启严格类型检查。主进程代码同样需要类型安全。

### 3.7 `esModuleInterop`: `true`

**含义**：允许在 CommonJS 模块中使用 ES Module 的 `import` 语法风格。

**背景**：有些第三方库（如 `ws`）发布的是 ES Module 格式，但在 CommonJS 环境中需要使用。`esModuleInterop` 让 TypeScript 自动处理这种混合导入：

```typescript
// 没有 esModuleInterop 时，导入 ES Module 库需要这样写：
import * as WebSocket from 'ws';
const wss = new WebSocket.WebSocketServer({ port: 8080 });

// 有 esModuleInterop 时，可以像 ES Module 一样写：
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8080 });
```

> **新人小结：为什么主进程也需要这个？**
>
> 虽然主进程用 CommonJS，但很多现代 npm 包同时发布 ESM 和 CJS 两种格式。`esModuleInterop` 让 TypeScript 能正确处理这些混合格式的包。

### 3.8 `forceConsistentCasingInFileNames`: `true`

**含义**：文件名的大小写必须与 import 语句中写的一致。

```typescript
// 文件实际名: Sidebar.tsx
import Sidebar from './sidebar';  // ❌ 报错！'sidebar' 和 'Sidebar' 大小写不一致
import Sidebar from './Sidebar';  // ✅ 正确
```

**为什么需要**：Windows 和 macOS 的文件系统**不区分大小写**（`Sidebar.tsx` 和 `sidebar.tsx` 是同一个文件），但 Linux 文件系统**区分大小写**。如果代码在 Windows 上能跑但在 Linux 上跑不了，就是因为大小写不一致。

> **新人小结：这是一个"跨平台"的防御性配置**
>
> 你的代码可能在 Windows 上开发，但部署到 Linux 服务器。如果文件名大小写不一致，在 Windows 上没问题，在 Linux 上就找不到文件了。这个配置在开发阶段就捕获这个问题。

### 3.9 `resolveJsonModule`: `true`

与 `tsconfig.json` 相同，允许 import JSON 文件。

### 3.10 `declaration`: `true`

**含义**：为每个 `.ts` 文件生成对应的 `.d.ts` 类型声明文件。

```
src/main/main.ts  ──tsc 编译──▶  dist/main/main.js
                              ──tsc 编译──▶  dist/main/main.d.ts  ← 类型声明文件
```

**为什么主进程需要生成声明文件**：
- 主进程的代码会被 `preload.ts` 引用（通过 IPC 通信）
- 生成 `.d.ts` 可以让其他文件获得类型提示
- 生产打包时 `.d.ts` 不会被包含（electron-builder 只打包 `.js`）

### 3.11 `declarationMap`: `true`

**含义**：生成类型声明文件的 Source Map（`.d.ts.map`）。

作用：当你在 IDE 中"跳转到定义"（Go to Definition）时，能准确跳转到原始的 `.ts` 文件，而不是 `.d.ts` 文件。

### 3.12 `sourceMap`: `true`

**含义**：生成 JavaScript 文件的 Source Map（`.js.map`）。

作用：在调试时，错误信息显示的是原始 TypeScript 代码的行号，而不是编译后的 JavaScript 行号。

```
// 编译后 JS 第 50 行报错
// 有 Source Map → 显示: src/main/main.ts 第 23 行
// 没有 Source Map → 显示: dist/main/main.js 第 50 行（很难定位）
```

> **新人小结：Source Map 是调试的"时光机"**
>
> 想象你穿了一件外套（TypeScript），里面穿了一件衬衫（JavaScript）。外套脱掉了，但衬衫还在。Source Map 就像一张地图，告诉你"衬衫的第 50 行对应外套的第 23 行"。
>
> 调试时，你看到的是外套（TypeScript）的代码，而不是衬衫（JavaScript）的代码。这让你能直接定位到原始代码的位置。

### 3.13 `include`: `["src/main/**/*.ts"]`

只检查主进程目录下的 `.ts` 文件，不包括 `.tsx`（主进程没有 JSX）。

对比 `tsconfig.json` 的 `include`: `["src/renderer/**/*.ts", "src/renderer/**/*.tsx"]`

| 配置 | 检查文件 | 原因 |
|------|---------|------|
| `tsconfig.main.json` | `src/main/**/*.ts` | 主进程只有 `.ts` 文件，没有 JSX |
| `tsconfig.json` | `src/renderer/**/*.ts` + `**.tsx` | 渲染进程有 `.ts` 和 `.tsx` 文件 |

---

## 四、与 tsconfig.json 的完整对比

| 配置项 | tsconfig.json（渲染进程） | tsconfig.main.json（主进程） | 差异原因 |
|--------|------------------------|---------------------------|---------|
| **target** | ES2020 | ES2020 | 相同 |
| **lib** | ES2020 + DOM + DOM.Iterable | 仅 ES2020 | 主进程无 DOM |
| **module** | ESNext | commonjs | 渲染用 Vite(ESM)，主进程用 Node(CJS) |
| **jsx** | react-jsx | 不设置 | 主进程无 JSX |
| **noEmit** | true | false（默认） | 渲染由 Vite 编译，主进程由 tsc 编译 |
| **outDir** | 不设置 | dist/main | 主进程需指定输出目录 |
| **rootDir** | 不设置 | src/main | 主进程需指定源码根目录 |
| **esModuleInterop** | 不设置 | true | 主进程需兼容 ESM 格式的包 |
| **declaration** | 不设置 | true | 主进程生成类型声明 |
| **declarationMap** | 不设置 | true | 主进程需要类型声明的 Source Map |
| **sourceMap** | 不设置 | true | 主进程需要调试 Source Map |
| **forceConsistentCasing** | 不设置 | true | 主进程需要跨平台兼容 |
| **include** | src/renderer/**.ts + **.tsx | src/main/**.ts | 各自只检查自己的文件 |

---

## 五、主进程编译完整流程

```
开发者编写: src/main/main.ts
            src/main/preload.ts
                    │
                    ▼
执行命令: tsc -p tsconfig.main.json
                    │
                    ▼
TypeScript 编译器读取配置:
  ├── target: ES2020        → 生成 ES2020 兼容的 JS
  ├── module: commonjs      → 使用 require/module.exports
  ├── lib: ES2020           → 允许使用 Node.js 核心 API
  ├── rootDir: src/main     → 源码根目录
  ├── outDir: dist/main     → 输出目录
  ├── sourceMap: true       → 生成 .js.map
  ├── declaration: true     → 生成 .d.ts
  └── include: src/main/**  → 只编译主进程文件
                    │
                    ▼
生成产物:
  dist/main/main.js          ← 主进程入口（Electron 从这里启动）
  dist/main/main.js.map      ← Source Map（调试用）
  dist/main/main.d.ts        ← 类型声明
  dist/main/preload.js       ← 预加载脚本（安全桥接）
  dist/main/preload.js.map   ← Source Map
  dist/main/preload.d.ts     ← 类型声明
                    │
                    ▼
package.json 的 "main" 字段指向: dist/main/main.js
                    │
                    ▼
electron .  →  加载 dist/main/main.js  →  应用启动 ✅
```

---

## 六、常见错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Cannot find module 'electron'` | `node_modules` 未安装或路径错误 | 执行 `npm install` |
| `'app' 不存在` | `lib` 中没有包含 Node.js 类型 | 安装 `@types/node`：`npm install -D @types/node` |
| 编译后文件路径多了一层 | `rootDir` 和 `outDir` 不匹配 | 确保 `rootDir: src/main`，`outDir: dist/main` |
| 大小写不敏感报错 | Windows 开发，Linux 部署 | 保持 `forceConsistentCasingInFileNames: true` |
| `.d.ts` 文件出现在打包结果中 | electron-builder 配置问题 | 在 `build.files` 中排除 `*.d.ts` |

---

## 七、总结

`tsconfig.main.json` 的核心设计原则是：**为主进程（Node.js 环境）提供精确的编译配置**。

与 `tsconfig.json`（渲染进程）相比，主要差异：

1. **模块系统不同**：CommonJS（主进程）vs ESNext（渲染进程）
2. **API 环境不同**：无 DOM（主进程）vs 有 DOM（渲染进程）
3. **编译方式不同**：tsc 直接编译（主进程）vs Vite 编译（渲染进程）
4. **输出需求不同**：需要生成 `.d.ts` 和 `.map`（主进程）vs 不需要（渲染进程由 Vite 处理）

> **给新人的建议**：以后如果要在主进程中添加新的 Node.js 功能（如操作文件系统、启动子进程），确保你的代码在 `tsconfig.main.json` 的配置下能通过类型检查。如果报错"'xxx' 不存在"，检查是不是忘了安装对应的类型包（如 `@types/node`）。
