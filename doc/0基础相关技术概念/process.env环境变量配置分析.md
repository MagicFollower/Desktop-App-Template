# process.env 环境变量配置分析报告

## 一、问题背景

在 `../../src/main/database.ts` 中有如下代码：

```typescript
function resolveRequestedDriver(): SqlDriverKind {
  const raw = (process.env.DB_DRIVER || 'sqljs').trim().toLowerCase();
  return raw === 'better' || raw === 'better-sqlite3' ? 'better' : 'sqljs';
}
```

这里的 `process.env.DB_DRIVER` 是一个**环境变量**（Environment Variable）。环境变量是操作系统级别或进程级别的键值对配置，广泛用于在不同运行环境（开发/测试/生产）之间切换行为，而无需修改代码。

---

## 二、本项目使用的环境变量全景

通过代码检索，本项目共使用以下环境变量：

| 变量名 | 使用位置 | 作用 | 默认值 |
|--------|----------|------|--------|
| `DB_DRIVER` | `../../src/main/database.ts` | 选择 SQLite 驱动（`sqljs` 或 `better-sqlite3`） | `sqljs` |
| `NODE_ENV` | `../../src/main/main.ts` | 区分开发模式与生产模式 | 无（由启动脚本设置） |
| `OPEN_DEVTOOLS` | `../../src/main/main.ts` | 控制开发模式是否自动打开 DevTools | 非 `false` 即打开 |
| `DEV_API` | `../../src/main/main.ts` | 控制是否启动开发 HTTP API 服务器 | 非 `0` 即启动 |
| `ELECTRON_MIRROR` | `../../package.json` scripts | Electron 下载镜像地址 | 无 |
| `ELECTRON_BUILDER_BINARIES_MIRROR` | `../../package.json` scripts | electron-builder 二进制文件下载镜像 | 无 |
| `import.meta.env.DEV` | `../../src/renderer/app-config.ts` | Vite 注入的开发模式标志 | Vite 自动注入 |

---

## 三、环境变量的配置方式

### 3.1 方式一：npm scripts 中使用 cross-env（推荐）

这是本项目**最主要**的配置方式，位于 `../../package.json` 的 `scripts` 字段：

```json
{
  "scripts": {
    "electron:dev": "npm run build:main && cross-env NODE_ENV=development electron .",
    "package:cn": "cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/ ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run package"
  }
}
```

**cross-env 的作用**：跨平台设置环境变量。Windows CMD 用 `set`，PowerShell 用 `$env:`，bash 用 `VAR=value`，语法各不相同。`cross-env` 统一了这些差异，让同一套 npm script 在 Windows/macOS/Linux 上都能运行。

**使用示例**：
```bash
# 切换数据库驱动为 better-sqlite3
cross-env DB_DRIVER=better npm run start

# 关闭 DevTools 自动打开
cross-env OPEN_DEVTOOLS=false npm run start

# 关闭开发 API 服务器
cross-env DEV_API=0 npm run start
```

### 3.2 方式二：终端临时设置（当前会话有效）

**PowerShell**：
```powershell
$env:DB_DRIVER = "better"
$env:OPEN_DEVTOOLS = "false"
npm run start
```

**CMD**：
```cmd
set DB_DRIVER=better
set OPEN_DEVTOOLS=false
npm run start
```

**Git Bash / WSL**：
```bash
export DB_DRIVER=better
export OPEN_DEVTOOLS=false
npm run start
```

这种方式设置的环境变量只在当前终端窗口有效，关闭窗口后失效。

### 3.3 方式三：命令前缀临时设置（单次执行有效）

**Linux / macOS / Git Bash**：
```bash
DB_DRIVER=better npm run start
```

**PowerShell**：
```powershell
$env:DB_DRIVER="better"; npm run start; $env:DB_DRIVER=$null
```

### 3.4 方式四：系统环境变量（永久生效）

通过 Windows 系统设置永久配置环境变量：

1. 按 `Win + R`，输入 `sysdm.cpl`，回车
2. 切换到「高级」选项卡，点击「环境变量」
3. 在「用户变量」或「系统变量」中点击「新建」
4. 输入变量名（如 `DB_DRIVER`）和变量值（如 `better`）
5. 确定保存，**重启终端/IDE** 后生效

> **注意**：系统环境变量对所有进程可见，适合设置长期不变的配置（如镜像地址）。不建议在此存放敏感信息。

### 3.5 方式五：.env 文件（需配合 dotenv）

虽然本项目**当前未使用** `.env` 文件，但这是 Node.js 项目中最常见的配置方式之一。

**.env 文件示例**：
```env
# .env.development
DB_DRIVER=better
NODE_ENV=development
OPEN_DEVTOOLS=true
DEV_API=1
```

**集成方式**：
- 使用 `dotenv` 库：`require('dotenv').config()`
- 使用 Vite 内置支持：Vite 会自动加载 `.env` 文件，但只有 `VITE_` 前缀的变量才会暴露给浏览器端
- 使用 `electron-vite` 等工具链时，通常内置了 `.env` 支持

**Vite 的环境变量规则**：
- `VITE_` 前缀的变量会注入到渲染进程（`import.meta.env.VITE_XXX`）
- 无前缀的变量只在主进程（Node.js）可用
- 内置变量：`import.meta.env.DEV`（开发模式）、`import.meta.env.PROD`（生产模式）

---

## 四、环境变量的作用域与进程隔离

### 4.1 Electron 的双进程架构

```
┌─────────────────────────────────────────────────────────┐
│                      Electron 应用                       │
├──────────────────────────┬──────────────────────────────┤
│       主进程 (Main)       │      渲染进程 (Renderer)      │
│  ┌────────────────────┐  │  ┌────────────────────────┐  │
│  │  Node.js 环境       │  │  │  浏览器环境             │  │
│  │  process.env.*     │  │  │  import.meta.env.*     │  │
│  │  可访问系统 API     │  │  │  无法直接访问 env      │  │
│  └────────────────────┘  │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘
```

**关键区别**：
- **主进程**：完整的 Node.js 环境，可通过 `process.env.XXX` 访问所有环境变量
- **渲染进程**：浏览器环境，**无法**直接访问 `process.env`，只能通过 Vite 注入的 `import.meta.env` 获取 `VITE_` 前缀变量

### 4.2 本项目的环境变量分布

| 变量 | 主进程 | 渲染进程 | 说明 |
|------|--------|----------|------|
| `DB_DRIVER` | ✅ `database.ts` | ❌ | 数据库驱动选择，仅主进程关心 |
| `NODE_ENV` | ✅ `main.ts` | ❌ | 通过 Vite 构建自动设置 |
| `OPEN_DEVTOOLS` | ✅ `main.ts` | ❌ | DevTools 控制，仅主进程 |
| `DEV_API` | ✅ `main.ts` | ❌ | API 服务器控制，仅主进程 |
| `import.meta.env.DEV` | ❌ | ✅ `app-config.ts` | Vite 注入，渲染进程使用 |

---

## 五、环境变量优先级与覆盖规则

当同一变量在多处配置时，优先级从高到低：

1. **代码中硬编码赋值**（最高优先级）
2. **npm scripts 中的 cross-env**（会覆盖系统变量）
3. **终端临时设置**（`$env:XXX` 或 `export XXX`）
4. **系统环境变量**（用户变量 > 系统变量）
5. **默认值**（代码中的 `|| 'default'` 兜底）

**示例**：
```typescript
// database.ts 中的默认值兜底
const raw = (process.env.DB_DRIVER || 'sqljs')  // 未设置时默认用 sqljs
```

---

## 六、实战场景

### 场景 1：切换数据库驱动

```bash
# 使用 better-sqlite3（需要编译原生模块）
cross-env DB_DRIVER=better npm run start

# 或
$env:DB_DRIVER="better"; npm run start
```

### 场景 2：国内镜像加速

```bash
# package.json 已内置中国镜像脚本
npm run package:cn

# 等价于
cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/ ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run package
```

### 场景 3：调试时关闭 DevTools

```bash
cross-env OPEN_DEVTOOLS=false npm run start
```

### 场景 4：纯前端调试（不启动 API 服务器）

```bash
cross-env DEV_API=0 npm run start
```

---

## 七、最佳实践建议

### 7.1 推荐做法

1. **开发环境配置**：使用 `cross-env` 写在 npm scripts 中，保证团队一致性
2. **个人临时调试**：使用终端临时设置，不影响他人
3. **敏感信息**：使用 `.env` 文件并加入 `../../.gitignore`，**不要**提交到仓库
4. **默认值兜底**：代码中始终提供合理默认值（如 `|| 'sqljs'`）
5. **文档记录**：在 README 或 doc 中列出所有环境变量及其作用

### 7.2 避免的做法

1. ❌ 在代码中硬编码环境相关的配置
2. ❌ 将密码、Token 等敏感信息提交到 Git
3. ❌ 依赖系统环境变量而不文档说明（新成员无法得知）
4. ❌ 在渲染进程直接访问 `process.env`（Electron 安全最佳实践禁止）

---

## 八、典型代码模式深度解析：main.ts 中的多环境变量组合判断

### 8.1 代码位置与原文

文件 `../../src/main/main.ts` 第 100–110 行：

```typescript
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
```

这段代码在**一个 if 条件中同时读取了两个环境变量**（`NODE_ENV` 和 `DEV_API`），是本项目中最典型的环境变量组合使用模式。

### 8.2 涉及的环境变量

| 变量 | 来源 | 判断逻辑 | 含义 |
|------|------|----------|------|
| `NODE_ENV` | npm scripts 中 `cross-env NODE_ENV=development` 设置 | `=== 'development'` | 仅在开发模式下执行 |
| `DEV_API` | 用户手动设置（终端 / 系统环境变量） | `!== '0'` | 默认开启，显式设 `0` 才关闭 |

### 8.3 条件拆解与执行逻辑

整个 if 条件由三个子条件通过 `&&` 连接，**全部为 true 时才执行**：

```
条件 1: process.env.NODE_ENV === 'development'
  └─ 必须处于开发模式（由 npm run start / npm run electron:dev 设置）
  └─ 打包后的生产版本 NODE_ENV 未设置或为 'production'，条件不成立，直接跳过

条件 2: dbInitialized
  └─ 数据库初始化成功（非环境变量，而是运行时状态标志）
  └─ 数据库初始化失败时不启动 API 服务器，避免暴露无数据的空接口

条件 3: process.env.DEV_API !== '0'
  └─ 用户没有显式关闭 Dev API
  └─ 未设置时 process.env.DEV_API 为 undefined，undefined !== '0' 为 true → 默认开启
  └─ 只有明确设为字符串 '0' 时才关闭
```

### 8.4 设计意图：为什么需要这个 HTTP API 服务器？

Electron 应用有两套前端加载方式：

1. **Electron 窗口**（`npm run start`）：渲染进程通过 IPC 与主进程通信，直接访问 SQLite
2. **浏览器窗口**（`npm run dev`）：渲染进程在普通浏览器中运行，**无法使用 IPC**

为了让浏览器也能访问同一个 SQLite 数据库，主进程额外启动了一个 HTTP API 服务器（端口 5174），渲染进程的适配层（`../../src/renderer/services/adapter.ts`）会自动探测该服务器并切换到 HTTP 通路。

```
                    ┌──────────────────────┐
                    │   主进程 (main.ts)    │
                    │                      │
                    │  SQLite ◄──┐         │
                    │            │         │
                    │  IPC 通路 ─┤         │
                    │            │         │
                    │  HTTP API ─┤ (5174)  │
                    │  服务器    │         │
                    └────────────┼─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼──────┐  ┌───────▼───────┐  ┌──────▼───────┐
     │ Electron 窗口  │  │ 浏览器 dev    │  │ 浏览器 dev   │
     │ (IPC 通路)     │  │ (HTTP 通路)   │  │ (演示兜底)   │
     │ npm run start  │  │ API 在线      │  │ API 离线     │
     └───────────────┘  └───────────────┘  └──────────────┘
```

### 8.5 `DEV_API !== '0'` 的设计细节

这里使用了**否定判断**（`!== '0'`）而非肯定判断（`=== '1'`），体现了「**默认开启，显式关闭**」的设计思路：

| DEV_API 值 | `!== '0'` 结果 | 行为 |
|------------|----------------|------|
| `undefined`（未设置） | `true` | ✅ 启动（默认行为） |
| `'1'` | `true` | ✅ 启动 |
| `'0'` | `false` | ❌ 关闭 |
| `''`（空字符串） | `true` | ✅ 启动 |

这种写法的好处：大多数开发者直接 `npm run start` 即可获得完整的开发体验，只有明确不需要浏览器调试通道时才需要额外设置 `DEV_API=0`。

### 8.6 同文件中 `NODE_ENV` 的其他使用

`main.ts` 中 `NODE_ENV` 共出现 3 处，分别控制不同的开发模式行为：

```typescript
// 第 35 行：决定加载 Vite dev server 还是生产 HTML
if (process.env.NODE_ENV === 'development') {
  mainWindow.loadURL('http://localhost:5173');  // 开发：热更新
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'));  // 生产：静态文件
}

// 第 44 行：控制 DevTools 是否自动打开
if (process.env.OPEN_DEVTOOLS !== 'false') {
  mainWindow.webContents.openDevTools();
}

// 第 103 行：控制 Dev API 服务器（本节分析重点）
if (process.env.NODE_ENV === 'development' && dbInitialized && process.env.DEV_API !== '0') {
  await startApiServer();
}
```

可以看到 `NODE_ENV` 是**开发/生产分流的核心开关**，而 `OPEN_DEVTOOLS` 和 `DEV_API` 是**细粒度的辅助开关**，三者配合实现了灵活的开发环境控制。

### 8.7 安全考量

这段代码的注释提到了「S1：Origin/Host 双白名单准入校验」。HTTP API 服务器虽然只在开发模式启动，但仍然暴露了一个本地端口（5174），因此 `../../src/main/api-server.ts` 中实现了严格的准入机制：

- **Origin 白名单**：只允许 `http://localhost:5173`（Vite dev server）来源的请求
- **Host 白名单**：只允许 `127.0.0.1:5174` 和 `localhost:5174`，防止 DNS rebinding 攻击
- **非白名单请求**：返回 403 Forbidden

这说明环境变量的配置不仅关乎功能开关，也涉及安全边界——开发模式的能力必须在可控范围内暴露。

---

## 九、总结

`process.env.DB_DRIVER` 这类环境变量是**运行时配置**的标准手段，其核心价值在于：

1. **环境隔离**：同一份代码在开发/测试/生产环境表现不同
2. **无需重新编译**：修改配置不需要重新构建
3. **安全性**：敏感信息不进入代码仓库
4. **灵活性**：支持从系统级到会话级的多层配置

本项目的配置方式以 `cross-env` + npm scripts 为主，辅以终端临时设置，覆盖了 Electron 桌面应用开发的主要场景。如需更复杂的配置管理，可考虑引入 `dotenv` 或 `electron-vite` 的内置环境变量支持。
