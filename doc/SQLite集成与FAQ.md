# SQLite 本地存储集成指南

## 数据库文件位置

### Electron 模式（生产环境）

数据库文件存储在 **Electron 用户数据目录**：

```
Windows: C:\Users\<用户名>\AppData\Roaming\<应用名>\app-data.db
macOS:   ~/Library/Application Support/<应用名>/app-data.db
Linux:   ~/.config/<应用名>/app-data.db
```

具体路径由 `app.getPath('userData')` 决定，当前项目为：
```typescript
const DB_PATH = join(app.getPath('userData'), 'app-data.db');
```

### 浏览器开发模式

在 `npm run dev` 下运行时，由于没有主进程，数据回退到 **localStorage**：
- Key: `sqlite-menus-fallback`、`sqlite-users-fallback`、`sqlite-profiles-fallback`、`sqlite-passwords-fallback`
- 位置：浏览器的 localStorage（可通过 F12 → Application → Local Storage 查看）

---

## 重新构建后数据会清空吗？

### 不会清空的情况

- **`npm run build` / `npm run package`**：只编译代码，不影响已安装的 Electron 应用及其数据
- **重新启动应用**：数据库文件持久化在磁盘上，重启后数据完好
- **更新应用版本**：只要不手动删除用户数据目录，升级后数据保留

### 会清空的情况

- **手动删除数据库文件**：删除 `app-data.db` 及其关联的 WAL 文件（`app-data.db-wal`、`app-data.db-shm`）
- **卸载并清理用户数据**：某些卸载程序会询问是否删除用户数据
- **切换运行模式**：从 Electron 模式切换到浏览器开发模式时，浏览器读不到 SQLite 数据，会显示默认菜单（但 SQLite 数据本身还在）
- **清除 localStorage**：在浏览器模式下执行 `localStorage.clear()` 会丢失开发数据

---

## 架构设计

### 双环境适配层

项目采用 **主进程 SQLite + 渲染进程 IPC + 浏览器 localStorage 回退** 的三层架构：

```
┌─────────────────────────────────────────┐
│         渲染进程 (Renderer)              │
│  ┌───────────────────────────────────┐  │
│  │   services/sqlite.ts              │  │
│  │   - loadMenusFromDb()             │  │
│  │   - saveMenuToDb()                │  │
│  │   - reorderMenusInDb()            │  │
│  │   - isElectron() 检测环境          │  │
│  └──────────┬────────────────────────┘  │
│             │                            │
│    Electron │  Browser                   │
│       ↓     │     ↓                      │
│  window.    │  localStorage              │
│  electronAPI│                            │
└──────┬──────┴────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│         主进程 (Main)                    │
│  ┌───────────────────────────────────┐  │
│  │   main/database.ts                │  │
│  │   - better-sqlite3 同步 API        │  │
│  │   - WAL 日志模式                   │  │
│  │   - 默认数据种子                   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   main/ipc/menu.ts                │  │
│  │   - menu:list                     │  │
│  │   - menu:upsert                   │  │
│  │   - menu:batch-update (事务)       │  │
│  │   - menu:delete                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 关键特性

1. **WAL 日志模式**：`db.pragma('journal_mode = WAL')` 提升并发读写性能
2. **事务批量更新**：拖拽排序使用 `db.transaction()` 保证原子性，失败整体回滚
3. **循环引用检测**：写入前预演父级关系并检测环，防止菜单树丢失节点
4. **系统菜单保护**：`is_system = 1` 的菜单不允许删除，`menu:upsert` 刻意不更新此字段
5. **自动迁移**：启动时检查 `menus` 表是否有 `is_system` 列，缺失则 `ALTER TABLE ADD COLUMN`

---

## 数据库表结构

### menus（菜单表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 菜单唯一标识 |
| parent_id | TEXT | 父级菜单 ID，NULL 表示顶级 |
| label | TEXT NOT NULL | 菜单名称 |
| icon | TEXT | 图标名称（Ant Design Icons） |
| path | TEXT | 路由地址，NULL 表示目录节点 |
| sort_order | INTEGER DEFAULT 0 | 同级排序号 |
| is_system | INTEGER DEFAULT 0 | 是否系统内置（1=不可删除） |

### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 用户 ID |
| username | TEXT UNIQUE NOT NULL | 用户名 |
| email | TEXT NOT NULL | 邮箱 |
| phone | TEXT | 手机号 |
| avatar | TEXT | 头像 URL |
| nickname | TEXT | 昵称 |
| role | TEXT NOT NULL DEFAULT 'user' | 角色：admin/user/manager |
| status | TEXT NOT NULL DEFAULT 'active' | 状态：active/disabled |
| created_at | TEXT NOT NULL | 创建时间 |

### user_profiles（个人资料表）

| 字段 | 类型 | 说明 |
|------|------|------|
| username | TEXT PRIMARY KEY | 关联用户名 |
| nickname | TEXT | 昵称 |
| email | TEXT | 邮箱 |
| phone | TEXT | 手机号 |
| avatar | TEXT | 头像 URL |

### passwords（密码哈希表）

| 字段 | 类型 | 说明 |
|------|------|------|
| username | TEXT PRIMARY KEY | 用户名 |
| hash | TEXT NOT NULL | bcrypt 哈希值 |

---

## IPC 通道

### 菜单管理

| 通道 | 方向 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| `menu:list` | Renderer → Main | 无 | `MenuItem[]` | 获取所有菜单（扁平列表） |
| `menu:upsert` | Renderer → Main | `MenuItem` | `{ success: boolean }` | 新增或更新菜单 |
| `menu:batch-update` | Renderer → Main | `MenuReorderEntry[]` | `{ success: boolean }` | 批量更新层级与排序（事务） |
| `menu:delete` | Renderer → Main | `id: string` | `{ success: boolean }` | 删除菜单及直接子菜单 |

### MenuReorderEntry 结构

```typescript
interface MenuReorderEntry {
  id: string;
  parentId: string | null;
  sortOrder: number;
}
```

---

## 常见问题（FAQ）

### Q1: 为什么我在浏览器开发模式下看不到之前创建的菜单？

**A**: 浏览器模式使用 localStorage 作为回退存储，和 Electron 模式的 SQLite 是两套独立的数据源。解决方案：
- 在 Electron 环境下测试（`npm start`）
- 或在浏览器模式下手动创建菜单，数据会保存在 localStorage

### Q2: 打包后的应用如何备份/恢复数据？

**A**: 
- **备份**：复制 `<userData>/app-data.db` 及其 WAL 文件（`app-data.db-wal`、`app-data.db-shm`）
- **恢复**：将备份文件覆盖到相同位置，重启应用即可

### Q3: 拖拽排序后刷新页面顺序乱了怎么办？

**A**: 确认以下几点：
1. 拖拽成功提示是否出现（绿色 Toast）
2. 控制台是否有 `[MenuManagement] Failed to reorder menus` 错误
3. 浏览器模式下检查 localStorage 中 `sqlite-menus-fallback` 的 `sortOrder` 字段是否更新
4. Electron 模式下可用 SQLite 客户端工具打开 `app-data.db` 查询 `SELECT * FROM menus ORDER BY sort_order`

### Q4: 如何重置为默认菜单？

**A**: 
- **Electron 模式**：删除 `app-data.db`，重启应用会自动重建并插入默认数据
- **浏览器模式**：执行 `localStorage.removeItem('sqlite-menus-fallback')`，刷新页面

### Q5: 系统菜单为什么不能删除？

**A**: `is_system = 1` 的菜单在主进程 `menu:delete` 中被拦截，抛出 `'系统内置菜单不允许删除'` 错误。这是为了防止误删核心功能入口。如需修改系统菜单，只能通过 `menu:upsert` 编辑其名称/图标/路由。

### Q6: 拖拽时出现"菜单层级出现循环引用"错误怎么办？

**A**: 主进程的 `menu:batch-update` 会在写入前预演父级关系并检测环。如果出现此错误：
1. 操作被安全拒绝，数据未损坏
2. 检查是否尝试将父菜单拖到自己的子菜单下
3. 刷新页面重新加载正确的树形结构

### Q7: better-sqlite3 和 sql.js 有什么区别？为什么选它？

**A**: 
- **better-sqlite3**：基于 Node.js C++ binding，同步 API，性能极高，适合 Electron 主进程
- **sql.js**：纯 JavaScript 实现，可在浏览器运行，但性能较差
- 选择理由：Electron 主进程有完整 Node.js 环境，用 better-sqlite3 可获得最佳性能和最简单的 API

> **现状修正（重要）**：当年因缺少 VS C++ 工具链 + Electron Node ABI 不匹配，better-sqlite3 加载即崩溃，实际采用的是 **sql.js**（全内存、需 `db.persist()` 手动落盘，见 Q11）。现已引入**驱动抽象层 `SqlDriver`**：默认仍 sql.js，可用环境变量 `DB_DRIVER=better` 一键试用 better-sqlite3，失败自动回退。详见 Q12 与 `doc/SQLite数据库路径配置与Native Module问题.md` 的「驱动抽象层」一节。

### Q8: WAL 模式是什么？有什么优势？

**A**: Write-Ahead Logging（预写式日志）是 SQLite 的一种日志模式：
- **默认模式（DELETE）**：写操作先改主数据库文件，提交后再删除日志
- **WAL 模式**：写操作先追加到 `-wal` 文件，读操作可同时读取主文件和 WAL 文件
- **优势**：读写不互斥，并发性能提升显著；崩溃恢复更快
- **注意**：会产生额外的 `-wal` 和 `-shm` 文件，备份时需一并复制

### Q9: 如何在其他页面实时感知菜单变化？

**A**: 菜单管理页面在保存/删除/拖拽后会触发全局事件：
```typescript
window.dispatchEvent(new CustomEvent('menu-updated'));
```
Sidebar 组件监听此事件并重新加载菜单：
```typescript
window.addEventListener('menu-updated', handleMenuUpdate);
```

### Q10: 数据库文件可以自定义路径吗？打包后存在哪里？

**A**: 可以。修改 `src/main/database.ts` 中的 `DB_PATH`。**当前已按打包状态自动择路（推荐做法）**：
```typescript
// 开发态→项目根目录（便于 IDE 查看）；打包后→userData（用户可写、升级保留）
const DB_DIR = app.isPackaged ? app.getPath('userData') : app.getAppPath();
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = join(DB_DIR, 'app-data.db');
```
- **打包后真实位置**（Windows）：`%APPDATA%\desktop-app-template\app-data.db`，**不在安装目录**。
- 为什么不能用安装目录 / `app.getAppPath()`：打包资源在只读 asar 内写不进去，且 Program Files 需管理员权限——这正是“打包后新增数据重启即丢”的根因（详见 Q11 与 `doc/SQLite数据库路径配置与Native Module问题.md`）。
- 如需固定路径，仍须选在用户可写目录（如 `app.getPath('userData')` 下子目录）。

### Q11: 新增/修改后能立即查到，但重启服务后数据丢失（未落盘）

**症状**：人员、菜单等写操作后界面立刻能查到，但重启 `npm run start` 后新数据消失，仿佛没写进数据库。

**根因**：本项目实际用的是 **sql.js**（WASM 版 SQLite，见 `src/main/database.ts`），它是「全内存」数据库：`INSERT/UPDATE/DELETE` 只修改内存中的数据库镜像，**不会自动写入磁盘上的 `app-data.db`**。此前只有两处会落盘：
1. 初始化 `getDatabase()` 结束（插入默认种子数据后）；
2. Electron `before-quit → closeDatabase()`。

开发环境用 `concurrently` 启动，Ctrl+C 重启会直接杀掉 Electron 子进程，`before-quit` 往往来不及触发，于是本次会话未落盘的改动全部丢失——重启后 `getDatabase()` 从旧磁盘文件重新加载，新数据自然不见了。（菜单数据因每次启动会从默认种子 `INSERT OR IGNORE`，所以看起来“只剩默认菜单”。）

**修复**：把「每次写操作后整体落盘」作为强制约定：
- `src/main/database.ts` 导出 `saveDatabase()`（内部 `db.export()` → `fs.writeFileSync(DB_PATH)`）。
- `src/main/service.ts`（IPC 与 Dev API server 共用的唯一写入层）中**每一个写函数**——userCreate/userUpdate/userDelete、profileUpdate、passwordChange、menuUpsert、menuBatchUpdate（事务 COMMIT 后）、menuDelete——完成后立即 `saveDatabase()`。`closeDatabase()` 保留为兜底。

**要点**：sql.js 没有常驻的磁盘连接，“写完即持久化”必须自己显式导出快照；不能只依赖优雅退出。数据量大时可对 `saveDatabase()` 做防抖/批量，但正确性前提是“崩溃/强杀也不能丢”。

> 同类但针对打包的坑（**已修复**）：`DB_PATH = join(app.getAppPath(), 'app-data.db')` 在打包为 asar 后位于只读归档内，写盘会报错（仅被 catch 日志），导致“打包后新增/上传数据重启即全丢”。现已改为 `app.isPackaged ? app.getPath('userData') : app.getAppPath()`（见 Q10）。

### Q12: sql.js 与 better-sqlite3 如何在两者之间切换？

**A**: 主进程已引入驱动抽象层 `SqlDriver`（`src/main/db/`），service 层只依赖该接口，不感知具体驱动：

- **`src/main/database.ts`** 作为驱动选择器，读 `process.env.DB_DRIVER` 决定实例化哪个驱动；
- 默认（不设或设为非 `better`）走 **sql.js**，行为与之前完全一致；
- 设 `DB_DRIVER=better` 且原生模块已正确编译（ABI 匹配）时走 **better-sqlite3**；若加载失败会打印告警并**自动回退 sql.js**，应用照常启动。

启用 better-sqlite3（PowerShell）：
```powershell
$env:DB_DRIVER="better"; npm run start
```

落盘约定由旧的 `saveDatabase()` 统一为 **`db.persist()`**，语义随驱动自适应（sql.js 真正导出写盘；better-sqlite3 为空操作，因原生实时写盘）。完整的契约、目录结构与启用步骤见 `doc/SQLite数据库路径配置与Native Module问题.md` 的「驱动抽象层」一节。

---

## 相关代码文件

| 文件 | 职责 |
|------|------|
| `src/main/database.ts` | **驱动选择器**：读 `DB_DRIVER` 选 sql.js / better-sqlite3，失败回退；对外 `getDatabase()/closeDatabase()` |
| `src/main/db/types.ts` | `SqlDriver` 统一契约（all/get/run/exec/transaction/persist/close） |
| `src/main/db/schema.ts` | 驱动无关的建表 + 默认数据种子 `applySchemaAndSeed()` |
| `src/main/db/sqljs-driver.ts` | 默认驱动：WASM 初始化 + 内存导出落盘 |
| `src/main/db/better-sqlite3-driver.ts` | 可选驱动：懒加载原生模块，实时写盘（persist 空操作） |
| `src/main/service.ts` | IPC 与 Dev API server 共用的唯一读写层，只依赖 `SqlDriver`，每个写函数末尾 `db.persist()` |
| `src/main/ipc/menu.ts` | 菜单 IPC 通道（list/upsert/batch-update/delete） |
| `src/main/preload.ts` | 暴露 `window.electronAPI` 给渲染进程 |
| `src/renderer/types/electron.d.ts` | ElectronAPI 类型声明 |
| `src/renderer/services/sqlite.ts` | 双环境适配层（Electron IPC + localStorage 回退） |
| `src/renderer/pages/System/MenuManagement.tsx` | 菜单管理页面（CRUD + 拖拽排序） |

---

## 参考资料

- [better-sqlite3 官方文档](https://github.com/WiseLibs/better-sqlite3)
- [SQLite WAL 模式详解](https://www.sqlite.org/wal.html)
- [Electron app.getPath() API](https://www.electronjs.org/docs/latest/api/app#appgetpathname)
