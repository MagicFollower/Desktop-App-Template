# SQLite 数据库路径配置与 Native Module 问题

## 问题描述

尝试将 SQLite 数据库文件从用户数据目录（`AppData/Roaming`）迁移到应用运行目录（项目根目录），但在启动时发现数据库无法初始化。

## 诊断日志（better-sqlite3 失败）

```
[Main] Initializing database...
[DB] Initializing database...
[DB] Database path: C:\Users\X\Documents\Qoder\2026-09-01\382e4ffe\app-data.db
[DB] process.cwd(): C:\Users\X\Documents\Qoder\2026-09-01\382e4ffe
[DB] app.getAppPath(): C:\Users\X\Documents\Qoder\2026-09-01\382e4ffe
[DB] app.getPath("userData"): C:\Users\X\AppData\Roaming\desktop-app-template
```

**关键发现：** 日志在打印路径后停止，没有出现 "Database opened successfully" 或任何错误信息，说明 `new Database()` 调用时 Electron 主进程崩溃。退出代码 `-36861` (0xFFFF7003) 表示 `STATUS_INVALID_IMAGE_FORMAT`。

## 根本原因

**better-sqlite3 是一个 Native Module（原生模块）**，需要为 Electron 的 Node.js 版本重新编译。当前系统缺少 Visual Studio C++ 编译工具链，导致：

1. better-sqlite3 使用为系统 Node.js (v24.18.0) 编译的二进制文件
2. Electron 使用不同版本的 Node.js (v22.x)
3. 二进制不兼容导致加载时崩溃，且没有错误输出

## 解决方案（已实施）

### 采用 sql.js 替代 better-sqlite3

**sql.js** 是基于 WebAssembly 的纯 JavaScript SQLite 实现，无需编译即可在 Electron 中运行。

#### 实施步骤

1. **替换依赖包**
   ```bash
   npm uninstall better-sqlite3
   npm install sql.js @types/sql.js
   ```

2. **重写数据库层** (`../../src/main/database.ts`)
   - 使用 `initSqlJs()` 异步初始化 WASM
   - 指定 WASM 文件路径：`require.resolve('sql.js/dist/sql-wasm.wasm')`
   - 内存数据库 + 手动保存到文件（`db.export()` → `fs.writeFileSync`）
   - 返回类型改为 `Promise<Database>`

3. **创建辅助层** (`src/main/db-helpers.ts`)
   - 统一查询 API：`queryAll()`, `queryOne()`, `execute()`
   - 模拟 better-sqlite3 的 `.all()`, `.get()`, `.run()` 行为

4. **更新 IPC 处理函数**
   - `menu.ts` 和 `user.ts` 中的所有 handler 改为 async
   - 每个 handler 内部 `await getDatabase()` 获取数据库实例
   - 事务处理改用手动 `BEGIN/COMMIT/ROLLBACK`

5. **更新主进程入口** (`../../src/main/main.ts`)
   - `app.whenReady()` 回调改为 async
   - await 数据库初始化和 IPC 注册

#### 验证结果

```
[DB] Initializing database...
[DB] Database path: C:\Users\X\Documents\Qoder\2026-09-01\382e4ffe\app-data.db
[DB] WASM path: C:\Users\X\...\node_modules\sql.js\dist\sql-wasm.wasm
[DB] Loading existing database file
[DB] Database opened successfully
[DB] Database saved to: C:\Users\X\Documents\Qoder\2026-09-01\382e4ffe\app-data.db
[Main] Database initialized successfully
[Main] IPC channels registered
```

数据库文件：**`app-data.db`** (40KB)，位于项目根目录。

## 方案对比

| 特性 | better-sqlite3 | sql.js |
|------|---------------|--------|
| 性能 | ⭐⭐⭐⭐⭐ (native) | ⭐⭐⭐ (WASM) |
| 安装复杂度 | 需要 VS Build Tools | 无需编译 |
| Electron 兼容性 | 需要 rebuild | 开箱即用 |
| 文件大小 | ~2MB (binary) | ~1.5MB (WASM) |
| 并发性能 | WAL 模式优秀 | 单线程阻塞 |
| 适用场景 | 生产环境、高并发 | 开发环境、轻量应用 |

## 演进：驱动抽象层（sql.js 默认 + better-sqlite3 可选）

> 背景衔接：上文记录了当年放弃 better-sqlite3 的原因（缺 VS C++ 工具链 + Electron 内置 Node 的 ABI 不匹配 → 主进程 `STATUS_INVALID_IMAGE_FORMAT` 崩溃），因此迁到 sql.js。本层是在**完全不改变默认行为（仍用 sql.js）**的前提下，把「切换 / 试用 better-sqlite3」变成一项可配置能力，并让 service 层依赖驱动无关的统一接口。

### 需求
1. 保留 sql.js 为默认，零风险，不影响任何现有启动路径。
2. 提供第二方案 better-sqlite3，代码直接可用；满足条件（已装原生模块 + ABI 匹配）时，用一个环境变量即可启用。
3. 业务代码（service 层）不感知底层驱动——切驱动无需改动任何 CRUD 逻辑。
4. 原生模块加载失败时自动回退 sql.js，绝不因可选依赖导致应用崩溃。

### 设计
新增 `../../src/main/db`，定义统一契约 `SqlDriver`：

| 方法 | 语义 |
|------|------|
| `all<T>(sql, params?)` | 查询多行 |
| `get<T>(sql, params?)` | 查询单行，无则 `null` |
| `run(sql, params?)` | 单条写语句（INSERT/UPDATE/DELETE） |
| `exec(sql)` | 原始脚本（建表等，可多条） |
| `transaction(fn)` | 事务执行 `fn`，抛错整体回滚 |
| `persist()` | 落盘。sql.js 显式导出快照；better-sqlite3 为空操作（写即落盘） |
| `close()` | 关闭；sql.js 先 `persist()` 再 close |

文件划分：
- `db/types.ts` — `SqlDriver` 契约 + `SqlDriverKind`。
- `db/schema.ts` — 驱动无关的建表 + 默认种子 `applySchemaAndSeed(db)`，两驱动共用同一结构与数据。
- `db/sqljs-driver.ts` — 默认驱动，封装 WASM 初始化 + 内存导出落盘。
- `db/better-sqlite3-driver.ts` — 可选驱动，`require('better-sqlite3')` **懒加载**（未启用/未安装时该依赖不会被真正引入）。
- `database.ts` — **驱动选择器**：读 `process.env.DB_DRIVER` 决定驱动；better 加载失败自动回退 sql.js；对外仍只暴露 `getDatabase()/closeDatabase()`，签名不变。

### 落盘约定的演进（与 FAQ Q11 的关系）
旧实现每次写操作后调用 `saveDatabase()`；抽象后统一为 **`db.persist()`**，语义随驱动自适应：
- sql.js：`persist()` = `db.export()` + `fs.writeFileSync`（真正落盘，防重启丢数据）；
- better-sqlite3：`persist()` 为空操作（原生实时写盘 + WAL）。

service 层「每个写函数末尾调用 `db.persist()`」的约定不变，因此对两种驱动都安全；`closeDatabase()`/`close()` 仍作优雅退出兜底。旧的 `db-helpers.ts` 已删除（其 all/get/run 行为内聚进各驱动）。

### 如何启用 better-sqlite3（可选试用）
1. 准备工具链：安装 Visual Studio C++ Build Tools（勾选「使用 C++ 的桌面开发」）。
2. 安装并对齐 Electron ABI：
   ```bash
   npm install better-sqlite3
   npx electron-rebuild -f -w better-sqlite3   # 未安装则先 npm i -D @electron/rebuild
   ```
3. 以原生驱动启动（PowerShell）：
   ```powershell
   $env:DB_DRIVER="better"; npm run start
   ```
   看到 `[DB] Using better-sqlite3 driver` 即生效；若二进制不匹配，会打印 `[DB] better-sqlite3 unavailable ... falling back to sql.js` 并自动回到默认，应用照常启动。
4. 取消该环境变量（`Remove-Item Env:\\DB_DRIVER`）即回到 sql.js。

### 【已修复】打包后新增/上传数据重启即丢失（DB 路径落在只读 asar）

**症状**：exe 安装后运行，人员新增、头像上传当场可见，但退出登录 / 重启 / 重装后数据全部消失，回到初始种子状态。

**根因**：旧代码 `DB_PATH = join(app.getAppPath(), 'app-data.db')`。
- 开发态 `app.getAppPath()` = 项目根目录，写盘正常，所以 dev 从不暴露该问题。
- 打包后 `app.getAppPath()` = `…\resources\app.asar`（**只读归档**）；且 `app-data.db` 不在 `build.files` 白名单内，asar 里根本没有该文件 → 启动时 `fs.existsSync` 为 false 走「新建」，随后 sql.js 的 `persist()` 执行 `fs.writeFileSync('…\app.asar\app-data.db')` **抛错**（仅被 catch 打日志）→ 数据永远停在内存，进程一结束即全丢。
- 头像以 TEXT 列存于同库，故与人员数据同生共死。

**修复**（`../../src/main/database.ts`）：按打包状态择路径，并在模块加载时确保目录存在：
```ts
const DB_DIR = app.isPackaged ? app.getPath('userData') : app.getAppPath();
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = join(DB_DIR, 'app-data.db');
```
- 打包后落在 `%APPDATA%\desktop-app-template\app-data.db`：普通用户**可写**、随应用**升级保留**、**卸载不必然删除**（符合桌面端数据规范）。
- 开发态仍用项目根目录，IDE / SQLite 工具的数据源指向不变。
- better-sqlite3 驱动内部已 `fs.mkdirSync(dirname, {recursive})`，两驱动均适配 userData。

> 经验：桌面端**运行期可写数据绝不能放进安装目录或 asar**。`app.getAppPath()` 只适合只读资源；用户数据一律 `app.getPath('userData')`（临时缓存用 `app.getPath('temp')` / `app.getPath('cache')`）。

---

## 相关资源

- [better-sqlite3 官方文档](https://github.com/WiseLibs/better-sqlite3)
- [sql.js 官方文档](https://sql.js.org/)
- [Electron Native Modules 指南](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [node-gyp 安装要求](https://github.com/nodejs/node-gyp#on-windows)
