# Desktop App Template — 通用桌面端应用开发模板

> **文档更新日期：2026-09-08**
> **定位：全功能参考底座**（保留全部演示功能作为参考实现，新项目按需裁剪）
> 本文档由一次完整的架构师评审产生：第 7 章为分级问题清单与整改方案（归档），第 9 章为模板复用/裁剪指南。

---

## 1. 项目定位

基于 **Electron + React + TypeScript + SQLite** 的 Windows 桌面应用通用开发模板：

- **开箱即用**：登录鉴权、动态菜单、标签页系统、人员/菜单管理、个人资料（头像上传裁剪与预览）、通用查询页范式、本地 SQLite 持久化。
- **参考底座**：内置 Tools（文件/Redis/FTP）等占位页，演示"如何接入一个新业务模块"；起新项目时按第 9 章裁剪。
- **Windows 优先**：打包目标为 NSIS x64；`transparent + frame:false` 圆角窗口方案在 Linux 上兼容性差，跨平台需另行评估（见 8.6）。

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33（contextIsolation: true, nodeIntegration: false） |
| UI | React 18 + React Router 7（HashRouter）+ Ant Design Icons |
| 状态管理 | Zustand 5（auth / menu / tab / theme 四个 store） |
| 构建 | Vite 6（渲染进程）+ tsc（主进程），electron-builder 25 打包 |
| 持久化 | SQLite，双驱动：sql.js（默认，纯 WASM）/ better-sqlite3（可选，`DB_DRIVER=better`） |
| 密码 | bcryptjs（主进程） |
| 日志 | electron-log（打包后落 userData/logs/main.log） |
| 质量 | ESLint 10 + Prettier + Vitest（`tests/`，18 例） |

## 3. 架构总览

```
┌─────────────────────────── 渲染进程 (src/renderer) ───────────────────────────┐
│  pages/            业务页面（Login / Dashboard / System / Tools）              │
│  components/       通用组件（Layout、QueryForm、QueryTableLayout、Modal、AvatarCropModal、…）│
│  hooks/            useQueryTable（拉取→过滤→分页 统一范式）、useClickOutside   │
│  stores/           zustand：useAuthStore / useMenuStore / useTabStore / theme │
│  services/         adapter.ts（IpcAdapter/HttpAdapter 工厂）+ sqlite.ts 薄门面    │
└──────────────┬─────────────────────────────────┬──────────────────────────────┘
        contextBridge (preload.ts)         fetch http://127.0.0.1:5174
               │ IPC invoke                        │ HTTP (仅开发模式)
┌──────────────▼───────────────────────────▼────────────────────────────────────┐
│                              主进程 (src/main)                                 │
│  ipc/              IPC handler 薄壳（user.ts / menu.ts，只做转发）             │
│  api-server.ts     开发模式 HTTP 服务器（与 IPC 共享同一 service 层）           │
│  service.ts        共享业务逻辑（用户/资料/认证/菜单 + 菜单环检测、事务）        │
│  database.ts       驱动选择（DB_DRIVER）+ 单例管理 + userData/appPath 路径策略  │
│  db/               SqlDriver 抽象接口 + sqljs-driver / better-sqlite3-driver   │
│                   schema.ts（建表 + 种子 + 手写迁移）                          │
└──────────────────────────────┬────────────────────────────────────────────────┘
                               ▼
                     app-data.db（开发态在项目根；打包后在 %APPDATA%\<应用名>）
```

### 3.1 值得保留的设计决策（评审认可项）

1. **驱动抽象层（`db/types.ts`）**：service 层只依赖 `SqlDriver` 接口，sql.js 与 better-sqlite3 可切换且失败自动回退，这是模板最有复用价值的部分之一。
2. **共享 service 层**：IPC 与 HTTP API 两个入口共用同一业务逻辑，保证 Electron 窗口与浏览器 dev 界面数据一致。
3. **`useQueryTable` + `QueryTableLayout` 范式**：所有列表页统一"拉取→过滤→分页"心智模型，并解决了 StrictMode 双调用、页码越界收敛等易错点。
4. **安全基线达标**：`contextIsolation: true` + `nodeIntegration: false` + preload 白名单式 API 暴露 + meta CSP（不含 unsafe-eval）。
5. **数据路径策略**：打包后落 `userData`、开发态落项目根，符合桌面端持久化惯例。
6. **HashRouter**：规避 file:// 下 BrowserRouter 的磁盘路径匹配问题。

## 4. 快速开始

| 命令 | 说明 |
|---|---|
| `npm install` | 安装依赖（postinstall 自动执行 electron-builder install-app-deps） |
| `npm run start` | 完整开发态：Vite(5173) + Electron + Dev API Server(5174) 同时启动 |
| `npm run dev` | 仅渲染进程（纯浏览器模式，数据降级为内置默认值，写操作不落库） |
| `npm run build` | 编译主进程 + 构建渲染进程到 `dist/` |
| `npm run package` | 生产构建 + electron-builder 打 NSIS 安装包（输出 `dist/electron/`） |
| `npm run package:cn` | 同上，走国内镜像 |
| `DB_DRIVER=better npm run start` | 切换 better-sqlite3 原生驱动（缺失时自动回退 sql.js） |
| `npm run test` | Vitest 单元测试（menu-tree / useQueryTable 纯逻辑层） |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化全部代码 |

默认账号：`admin / admin123`、`user / user123`（安全影响见 7.2-S2）。

## 5. 目录结构与裁剪标注

```
src/
├── main/                       # 【必留】主进程
│   ├── main.ts                 #   窗口创建、生命周期、窗口控制 IPC
│   ├── preload.ts              #   contextBridge 白名单 API
│   ├── service.ts              #   【必留】共享业务逻辑层
│   ├── database.ts             #   【必留】驱动选择与单例
│   ├── api-server.ts           #   【dev 专用】浏览器调试后门（见 7.2-S1）
│   ├── ipc/                    #   IPC 薄壳注册
│   └── db/                     #   驱动抽象 + schema + 两种实现
└── renderer/                   # 【必留】渲染进程
    ├── services/               #   数据访问层（A1 重构后）
    │   ├── adapter.ts          #     DataAdapter 接口 + Ipc/Http 双实现 + 工厂
    │   ├── sqlite.ts           #     薄门面（页面统一入口，re-export 公共类型）
    │   ├── menu-tree.ts        #     buildMenuTree 纯函数
    │   └── dev-fallback.ts     #     【纯 dev】浏览器演示数据（动态 import，不进主 bundle）
    ├── app-config.ts         #   应用展示名单点配置（D7，起新项目改这里）
    ├── stores/                 #   zustand 状态
    ├── hooks/                  #   useQueryTable（列表页范式，必留）
    ├── components/             #   通用组件（Layout/QueryForm/Modal/Toast/AvatarCropModal/…）
    ├── pages/
    │   ├── Login/  Dashboard/  #   【必留】
    │   ├── System/             #   人员/菜单/个人资料管理（含头像裁剪，参考实现）
    │   └── Tools/              #   【可整体删除】Redis/FTP/FileManager 占位页
    └── types/  utils/
```

---

## 6. 架构评审总评

**整体结论：架构骨架优秀，细节债务集中在"数据契约"与"鉴权完整性"两处。**

- 分层清晰：渲染（pages→hooks/stores→services）与主进程（ipc→service→driver）职责边界正确，无越层调用。
- 主要短板：
  1. **类型契约断裂**——service / preload / electron.d.ts 三层 `any` 泛滥，TypeScript 的价值被抵消约一半（7.3-A2）。
  2. **鉴权是"演示级"**——角色存了但没用、token 是假的、登录信息硬编码（7.1-B1、7.3-A3）。
  3. **数据契约不一致**——snake_case 与 camelCase 混用，靠渲染层 `?? ''` 兜底（7.3-A5）。
  4. **工程化缺位**——无 lint、无测试、无错误边界、无日志库（7.3-A7）。

---

## 7. 问题清单与整改方案（评审归档）

> 分级：**B = 功能缺陷（Bug）**、**S = 安全风险**、**A = 架构与设计**、**D = 代码异味与死代码**。
> 优先级：P0（数据正确性/安全）→ P1（架构债）→ P2（体验/卫生）。

### 7.1 功能缺陷（Bug）

#### B1（P0）登录后角色与 ID 硬编码，数据库 role 字段被无视 ✅ 已修复（2026-09-06）
- **位置**：`src/renderer/pages/Login/LoginPage.tsx:43-52`
- **问题**：`id: username === 'admin' ? '1' : '2'`、`role: username === 'admin' ? 'admin' : 'user'`。数据库中 `zhangsan` 的 role 是 `manager`，但登录后前端拿到的永远是 `user`；新注册用户 id 永远是 `2`。
- **影响**：任何基于 role 的权限控制（当前缺失，见 A3）在源头就不可信；个人资料页展示的 id/email 与库不符。
- **方案**：主进程 service 新增 `authLogin(username, password)`，验证通过后 `SELECT * FROM users WHERE username=?` 返回完整 `UserInfo`，渲染层直接使用；查不到用户记录时才走兜底默认值。`authVerify` 保留给纯校验场景。

#### B2（P0）删除用户后刷新，被删用户“复活” ✅ 已修复（2026-09-06）
- **位置**：`src/renderer/services/sqlite.ts:90-95`（`mergeWithDefaults`）+ `UserManagement.tsx:114`
- **问题**：每次加载列表都会把 `mock/users.json` 中不存在于数据库的记录合并回来。用户在界面上删除 `zhangsan` → `reload()` → mock 里的 `zhangsan` 又被 append，界面显示"删除成功"但数据永远删不干净。
- **影响**：删除功能对种子数据用户完全失效；且 mock 数据被卷入生产路径。
- **方案**：兜底合并只在「数据库为空（首次启动、表刚建好）」时执行一次；或彻底移除 `mergeWithDefaults`，让 mock 数据仅存在于 schema.ts 的种子逻辑中（主进程已灌种子，渲染端 mock 本就冗余）。

#### B3（P0）菜单删除只清理一层子级，深层子菜单成孤儿 ✅ 已修复（2026-09-06）
- **位置**：`src/main/service.ts:217`（`DELETE FROM menus WHERE id=? OR parent_id=?`）+ `schema.ts:35`（外键声明）
- **问题**：SQLite 的 `FOREIGN KEY ... ON DELETE CASCADE` 需要 `PRAGMA foreign_keys=ON` 才生效，两种驱动初始化时都**没有开启**该 PRAGMA，因此外键级联是摆设；手动 `OR parent_id=?` 只删一层。删除拥有"子→孙"两层后代菜单的节点时，孙级成为孤儿——`parentId` 指向不存在的节点，恰好被 `buildMenuTree` 的兜底逻辑（父级不存在则提升为根）掩盖，表现为**被删菜单的孙辈凭空出现在侧边栏根部**。
- **方案**（二选一）：
  1. 驱动初始化后执行 `PRAGMA foreign_keys=ON`，删除改为 `DELETE FROM menus WHERE id=?`，让真正的级联生效（推荐，同时让 schema 的外键声明产生实际约束力）；
  2. 保留手动删除，但改为递归 CTE：`WITH RECURSIVE ... DELETE`。

#### B4（P1）用户改名/删除与 passwords、user_profiles 无联动 ✅ 已修复（2026-09-06）
- **位置**：`src/main/service.ts:47-72`；`schema.ts:40-55`（两表以 `username` 为主键/外键）
- **问题**：`users` 与 `passwords`/`user_profiles` 通过 `username` 弱关联（且外键未启用，见 B3）。在人员管理里修改用户名 → 该账号密码与资料全部失联，**改完名就无法登录**；删除用户 → passwords/user_profiles 残留孤儿数据。
- **方案**：将 `passwords`/`user_profiles` 的键改为 `user_id` 并加真实外键（配合 B3 的 PRAGMA）；过渡期最低成本方案是在 `userUpdate`/`userDelete` 中同步维护两张子表。

#### B5（P1）纯浏览器降级分支的写操作静默失败
- **位置**：`src/renderer/services/sqlite.ts:121-123` 等多处 `catch { /* ignore */ }`
- **问题**：`npm run dev`（无 Electron、API 不可达）时，保存/删除全部静默吞掉。用户在纯浏览器模式修改了数据，界面无任何提示，重启后全部丢失。
- **方案**：降级模式下首次检测到 API 不可达时全局 Toast 提示"浏览器演示模式：修改不会持久化"；写函数降级时返回 `{ persisted: false }` 供调用方提示。

### 7.2 安全风险

#### S1（P0）Dev API Server 零鉴权 + CORS 通配 ✅ 已修复（2026-09-06）
- **位置**：`src/main/api-server.ts:29-31`（`Access-Control-Allow-Origin: *`），仅开发模式启动
- **问题**：开发期间本机 5174 端口对**任意来源**开放读写（增删用户、改密码哈希、改菜单）。任何你在浏览器里打开的第三方网页，其 JS 都可以 `fetch('http://127.0.0.1:5174/api/users', {method:'DELETE', ...})` 操作你的数据库。localhost 端口上的“仅本机”并不等于“仅你自己”。
- **方案**（组合使用）：
  1. 启动时生成一次性随机 token，通过 Vite `define` 注入渲染端，API 校验 `X-Dev-Token` 请求头；
  2. 校验 `Host`/`Origin` 头，拒绝非 `localhost:5173` 来源（同时防 DNS rebinding）；
  3. 增加环境变量开关 `DEV_API=1` 显式启用，默认关闭——多数时候只需要 `npm run start` 的 IPC 通道。
- **实际实施（2026-09-06）**：采用方案 2+3 组合（token 方案因 Vite 与主进程并发启动存在竞态而舍弃）：`checkRequestOrigin()` 做 Origin/Host 双白名单准入校验，未命中直接 403 不进路由；CORS 从通配 `*` 改为仅对白名单 Origin 精确回显；`main.ts` 支持 `DEV_API=0` 显式关闭（默认保留浏览器 dev 特性）。冒烟验证：恶意 Origin 403、rebinding Host 403、白名单 Origin 200+精确回显、本地 curl 200，4/4 PASS。

#### S2（P1）默认账号密码公开
- **位置**：`schema.ts:79-82`（bcrypt 种子）、`LoginPage.tsx:104`（登录页明文提示）
- **问题**：模板阶段可接受，但任何基于此模板交付的产品若忘记处理，等于后门。
- **方案**：保留在模板中（开发便利），但在第 9 章"产品化 checklist"中列为必删项；可选增强：首次启动强制修改 admin 密码。

#### S3（P1）密码哈希在渲染进程执行 ✅ 已修复（2026-09-06）
- **位置**：`src/renderer/utils/crypto.ts`（bcryptjs 被打进渲染 bundle）；调用链 `Profile → passwordChange(username, hash)`
- **问题**：密码学责任错位——渲染进程被 XSS 攻击时可直接拿到哈希前的明文与哈希逻辑；同时 bcryptjs（约 40KB）无谓地增大渲染 bundle。IPC 是本地进程间通道，传明文密码给主进程并不比在渲染端先哈希更不安全。
- **方案**：主进程新增 `auth:change-password`（接收 username + 明文 newPassword + 旧密码验证），哈希统一在 service 层完成；删除渲染端 `utils/crypto.ts`。
- **实际实施（2026-09-06）**：service 层 `passwordChangeSecure(username, current, next)` 一次调用完成旧密码验证 + bcrypt 哈希 + 写库（旧密码错误抛错）；通道复用 `password:change`（参数改为三个明文字段）；删除渲染端 `utils/crypto.ts`，渲染 bundle 缩减约 20KB；顺带删除已无调用方的 `authVerify` 全链路（service/IPC/preload/HTTP API），避免死代码。

#### S4（P2）认证无防爆破、token 无意义
- **位置**：`service.ts:104-109`（无限次尝试）；`LoginPage.tsx:43`（`mock-token-` + 时间戳）；`useAuthStore.ts`（localStorage 持久化）
- **问题**：本地单机应用威胁模型下风险有限，但 `token` 既不校验也不承载信息，`isAuthenticated` 只是 UI 开关，容易让后续开发者误以为存在真实会话机制。
- **方案**：模板定位下**记录取舍即可**（第 8 章已声明"演示级鉴权"）；接真实后端时将 `verifyPassword`/`login` 替换为服务端签发的 JWT 并加过期校验；防爆破可加简单的失败计数 + 延迟。

### 7.3 架构与设计

#### A1（P1）三端数据源切换逻辑贯穿所有函数，dev 便利污染生产路径 ✅ 已修复（2026-09-06）
- **位置**：`src/renderer/services/sqlite.ts` 全文件
- **问题**：每个数据函数都是 `if (isElectron()) {...} else {...}` 双分支 + 降级兜底，13 个函数 × 3 种环境 = 大量重复样板；新增一个接口要写两遍；测试无法注入。
- **方案**：抽象 `DataAdapter` 接口，启动时工厂一次性选择实现：
  ```ts
  interface DataAdapter {
    userList(): Promise<UserInfo[]>;
    userSave(input: UserInput, isEdit: boolean): Promise<void>;
    // …
  }
  const adapter: DataAdapter = isElectron() ? new IpcAdapter() : new HttpAdapter(DEV_API_BASE);
  ```
  浏览器降级 mock 数据移入 dev-only 模块（动态 import），生产 bundle 不含默认菜单/账号硬编码。
- **实际实施（2026-09-06）**：拆分为三层——`services/adapter.ts`（`DataAdapter` 接口 + `IpcAdapter` / `HttpAdapter` 两个实现 + `createAdapter()` 工厂）；`services/dev-fallback.ts`（纯浏览器演示数据与 BROWSER_DEV_ACCOUNTS，动态 import 不进主 bundle）；`services/sqlite.ts` 重写为薄门面（仅持有 adapter 实例 + re-export 公共类型，页面零改动成本）。顺带：`buildMenuTree` 移入 `services/menu-tree.ts`（纯函数可独立测试）；mock/ 目录整体删除。

#### A2（P1）类型契约断裂：any 贯穿 service / preload / electron.d.ts ✅ 已修复（2026-09-06）
- **位置**：`service.ts`（`userCreate(user: any)` 等）、`preload.ts`（`(user: any)`）、`electron.d.ts`（`Promise<any[]>`）
- **问题**：渲染层精心定义了 `UserInfo`/`MenuItem`，但跨 IPC 边界后全部退化为 `any`——字段改名、漏传字段在编译期全部无感知。对一个 **TypeScript 模板**而言是最刺眼的坏示范。
- **方案**：在 `src/shared/`（或 renderer/types 复用）定义 DTO：`UserInput`、`MenuInput`、`ReorderEntry`；preload 参数与 service 签名引用同一类型（preload 编译到主进程 bundle，类型可跨进程共享，零运行时成本）。
- **实际实施（2026-09-06）**：新建 `src/main/dto.ts` 作为跨进程 DTO 单一类型源（`UserInput`/`MenuInput`/`MenuReorderEntry` 等及 UserInfo/MenuItem 兼容 re-export）。选主进程侧而非 `src/shared/` 的原因：`tsconfig.main.json` 的 `rootDir: src/main` 限制下，shared 目录需改两份构建配置，而渲染端对 dto 的 type-only import 编译后完全擦除、零运行时成本。service 签名 / IPC handler / preload / electron.d.ts / adapter.ts / 页面全部引用同一类型源。

#### A3（P1）权限模型缺失：role 存而不用 ✅ 已修复（2026-09-06）
- **位置**：`routes.tsx`（无路由守卫）、`AppLayout.tsx:18-23`（仅判断 userInfo 存在）、菜单加载无角色过滤
- **问题**：`user` 角色登录后可直接输入 URL 进入 `/system/users` 删除所有用户。菜单管理精心做了 `isSystem` 保护，却没有任何角色维度控制——权限体系只完成了"菜单可见性"一半。
- **方案**：
  1. menus 表增加 `roles TEXT`（逗号分隔或 JSON），`menuList` 按当前用户 role 过滤；
  2. 路由层新增 `<RequireRole roles={['admin']}>` 包裹系统管理路由；
  3. 前置条件：先修复 B1（登录 role 硬编码），否则守卫的输入就是错的。
- **实际实施（2026-09-06）**：迁移 v3 为 menus 增加 `roles` 列（NULL/空 = 所有角色可见，逗号分隔存储；system/system-users/system-menus 种子为 admin 专属）；service 层 `parseRoles/serializeRoles` 出入口映射；渲染层 `filterMenuTreeByRole` 纯函数裁剪菜单树（父级无权限整棵子树隐藏，返回新节点不修改入参，Sidebar 按登录角色过滤）；`components/RequireRole.tsx` 路由守卫包裹 system/users 与 system/menus（403 降级页）；菜单管理表单增「可见角色」复选框组。守卫角色与迁移种子刻意保持一致（'admin'）。dev-fallback 演示数据同步 roles。

#### A4（P2）sql.js 全内存 + 全量 persist 的固有代价
- **位置**：`sqljs-driver.ts:37-44`（每次写操作后 `db.export()` 全量导出写文件）
- **问题**：数据量大时每次写入都全量序列化（性能）；进程崩溃时上次 persist 之后的写入丢失（可靠性窗口）。已在驱动注释中声明，属**已知取舍**而非 bug。
- **方案**：模板阶段维持现状（sql.js 免编译的价值大于代价）；文档建议：数据量预期 > 几 MB 或写频繁的场景切换 `DB_DRIVER=better`。可选增强：persist 防抖 + 窗口关闭/`before-quit` 强制 persist（后者已有）。

#### A5（P2）数据字段命名契约不一致 ✅ 已修复（2026-09-06）
- **位置**：`service.ts:18-22`（userList 原样透传 snake_case，`createdAt: row.created_at` 映射是无效代码）vs `service.ts:132-141`（menuList 做了完整 snake→camel 映射）
- **问题**：同一层两种契约风格，导致渲染层到处 `user.phone || ''`、`as any` 兜底（UserManagement、Profile 均受影响）。无效映射代码还制造了"已做转换"的假象。
- **方案**：统一在 service 层出口做 snake_case → camelCase 映射（建一个 `mapRow` 工具），渲染层类型收敛为 `UserInfo`/`MenuItem`，删除各页面的 `as any`。
- **实际实施（2026-09-06）**：service 层用户出口统一走 `mapUserRow()`（第 1 批引入）与菜单出口统一 `mapMenuRow()`，全链路 camelCase；渲染层各页面 `as any` 与 `?? ''` 兜底已随 A2 的 DTO 贯通一并清除。

#### A6（P2）persist 失败上层无感知
- **位置**：`sqljs-driver.ts:41-43`（失败仅 console.error，service 层返回 `{success:true}`）
- **问题**：磁盘写失败（权限/空间）时，用户看到"保存成功"，重启后数据消失。
- **方案**：`persist()` 返回 `boolean` 或抛错；service 写函数将其纳入返回值，渲染层据此 Toast 报错。

#### A7（P2）工程化缺位：无 lint / 无测试 / 无错误边界 / 无日志 ✅ 已修复（2026-09-06）
- **问题**：作为团队模板，缺少四件基础设施：ESLint+Prettier（约束随人数增长必然劣化）、vitest（service 层与 useQueryTable 是纯逻辑，测试性价比极高）、渲染层 ErrorBoundary（单个页面异常会白屏整个应用）、electron-log（console.log 在打包后无处可看）。
- **方案**：按序引入——`eslint+prettier`（半天）→ `ErrorBoundary + Toast 兑底`（半天）→ `electron-log`（1 小时）→ `vitest 冒烟测试`（service 层菜单环检测、useQueryTable 分页收敛这两个最值得测）。
- **实际实施（2026-09-06）**：四件全部落地：①`eslint.config.js`（flat config：@eslint/js + ts recommended + react-hooks；主进程关闭 no-require-imports 因 require 是原生模块懒加载手段）+ `.prettierrc`；②`components/ErrorBoundary.tsx` 挂在应用根部（异常降级 UI + 重试/刷新，爆炸半径收敛）；③`main/logger.ts` 门面（electron-log 落盘 userData/logs/main.log，纯 Node 冒烟测试下自动降级 console）+ `log:renderer` IPC 通道让渲染层异常转发主进程落盘，主进程全部 console 调用已替换；④`vitest.config.ts` + `tests/`（menu-tree 12 例：建树/排序/孤儿/自引用/roles 过滤/不可变性；useQueryTable 6 例：单次拉取/越界页码收敛/不分页场景），`npm run test` 一键运行。

#### A8（P2）schema 迁移无版本化 ✅ 已修复（2026-09-06，迁移 v1+v2 + 幂等验证）
- **位置**：`schema.ts:57-62`（手写 `PRAGMA table_info` 判断补列）
- **问题**：字段迁移靠 if 补丁累积，三个版本后将不可维护。
- **方案**：使用 SQLite 标准的 `PRAGMA user_version`：维护 `migrations: { version: number, up: (db) => void }[]`，启动时按序执行未应用的迁移。现有 is_system 补列改写为 migration #1。

### 7.4 代码异味与死代码

| 编号 | 位置 | 问题 | 处置 |
|---|---|---|---|
| D1 | `components/Sidebar.tsx`、`components/Sidebar.css`、`components/WindowControls.tsx`、`components/WindowControls.css` | 根级 Sidebar/WindowControls 与 `Layout/` 内同名组件并存，实际零引用（Layout 内组件才是生效实现） | ✅ 已删除（2026-09-07，随第 5 批；删除前 grep 复核零引用） |
| D2 | `components/ThemeSwitcher/` | 空目录 | ✅ 已删除（2026-09-06，随第 3 批） |
| D3 | `mock/menu.json` | 零引用死文件 | ✅ 已删除（2026-09-06，随第 3 批；mock 目录连同 users.json 整体移除，演示数据迁至 `services/dev-fallback.ts`） |
| D4 | `preload.ts` `onMockData`/`removeMockDataListener`、`electron.d.ts` `MockData`、`main.ts:125-138` 注释块 | 主进程 mock 推送已废弃，残留 API 契约 | ✅ 已删除（2026-09-06，随第 3 批 preload 重写） |
| D5 | `LoginPage.tsx:23` | 800ms 人为登录延迟 | ✅ 已删除（2026-09-07，随第 5 批；顺带修正交互顺序：空输入校验前置，loading 状态只在真实请求期间置位） |
| D6 | `LoginPage.tsx:91-96` | "记住我" checkbox 无任何功能 | ✅ 已删除（2026-09-07，随第 5 批；login.css 中对应死样式同步清除） |
| D7 | `LoginPage.tsx:62` | 登录页标题"企业管理后台"与通用模板定位不符 | ✅ 已修复（2026-09-07，随第 5 批；新建 `renderer/app-config.ts` 单点配置，登录页/侧边栏/标题栏三处统一引用，详见 D7 实施说明） |
| D8 | `service.ts:21` | `createdAt: row.created_at` 的无效映射（见 A5） | ✅ 随 A5 一并处理（2026-09-06） |
| D9 | `main.ts` 全局 `mainWindow` 单例 | 多窗口场景下窗口控制 IPC 全部失效 | 模板单窗口可接受；文档标注扩展点（`BrowserWindow.fromWebContents(event.sender)`） |

---

## 8. 已知设计取舍（明示声明，非缺陷）

1. **演示级鉴权**：token 无校验、无会话过期、无防爆破（A3 已补角色维度的菜单/路由控制，但 token 本身仍是 UI 开关）。定位是本地单机模板；接后端时替换 `loginFromDb`/`useAuthStore`。
2. **sql.js 为默认驱动**：换取零编译、跨 Electron 版本稳定；代价见 A4。
3. **CSP 保留 `unsafe-inline`**：Vite Fast Refresh 内联脚本所需；本地离线应用 + contextIsolation 下 XSS 面很小（详见 `doc/开发报告/Electron安全加固与CSP告警.md`）。
4. **写操作后全量 persist**：简单可靠的落盘策略（详见 `doc/开发报告/SQLite集成与FAQ.md`）。
5. **客户端过滤与分页**：`useQueryTable` 默认全量拉取 + 前端过滤，适配本地 SQLite 的小数据量；接后端后需切换服务端分页（接口已预留 `clientPagination`）。
6. **Windows 优先**：`transparent: true` 圆角窗口在 Linux 部分环境异常；跨平台时改为 `frame: false` + 系统原生圆角方案。

---

## 9. 模板使用指南

### 9.1 基于本模板起新项目

1. 复制仓库 → 修改 `package.json` 的 `name`/`author`/`description`。
2. 修改 `electron-builder` 配置：`appId`、`productName`、`win.icon`（图标生成见 `scripts/gen-icon.mjs`）。
3. 修改 `src/renderer/app-config.ts` 中的 `APP_NAME`/`APP_NAME_EN`（登录页、侧边栏、标题栏三处自动统一，D7），并同步 `index.html` `<title>` 与 electron-builder 的 `productName`。
4. 清空或替换 `db/schema.ts` 中的种子数据（保留建表结构作参考）。
5. 按下节裁剪不需要的模块。

### 9.2 裁剪指引

**删除 Tools 模块（Redis/FTP/文件管理占位页）**：
1. 删除 `src/renderer/pages/Tools/` 目录；
2. 删除 `routes.tsx` 中 `tools/files`、`tools/redis`、`tools/ftp` 三条路由及对应 import；
3. 删除 `db/schema.ts` 种子中 `tools`、`tools-*` 四条菜单 INSERT（migration 化后写入 `migrations[]`）；
4. `services/dev-fallback.ts` 中若残留 tools 演示菜单条目一并删除。

**删除仪表盘图表**：`pages/Dashboard/` 保留壳，移除 Recharts 相关代码后可从 devDependencies 移除 `recharts`。

**最小可用底座 = Login + AppLayout(Sidebar/Header/TabBar/TitleBar) + 动态菜单 + SQLite 通路 + QueryTableLayout 范式**。

### 9.3 新增一个业务模块（标准流程）

> 实战案例系列（新手入门推荐依次阅读）：
> - `doc/开发报告/新手实战-单据号规则功能从零到验收.md`——从需求分析到验收的逐步实施（含每步的踩坑与经验），项目中的「单据号规则」功能即按此落地（迁移 v4，可对照源码阅读）；
> - `doc/开发报告/新手实战-文件管理功能从零到验收.md`——首个「二进制数据 + 物理副作用」功能：上传（LOCAL/FTP 可配、可选逻辑目录）、多级目录管理（只删空目录）、下载到指定目录、单删/批删、路径展示与凭据只写不读（迁移 v7，含三轮迭代记录）；
> - `doc/开发报告/头像上传裁剪与预览功能实现.md`——纯 Canvas 圆形裁剪算法（零依赖）、裁剪压缩合一、hover 气泡预览，含 clamp 约束推导与踩坑记录。

1. **主进程**：`db/schema.ts` 建表（migration 化后写入 `migrations[]`）；`service.ts` 增加业务函数（写函数记得 `db.persist()`）；
2. **IPC**：`ipc/` 下新建或追加 handler；`preload.ts` 暴露 API；`electron.d.ts` 补类型（用 DTO，见 A2）；`api-server.ts` 补路由（若需浏览器调试）；
3. **渲染端**：`types/` 定义模型；`routes.tsx` 注册路由；新建页面使用 `QueryTableLayout + QueryForm + useQueryTable + Pagination` 组合（参考 `UserManagement.tsx` 的完整范式）；
4. **菜单**：通过菜单管理页添加，或写入 schema 种子（`isSystem: 1` 防误删）。

### 9.4 产品化 Checklist（交付前必做）

- [ ] 移除默认账号与登录页明文提示（S2）
- [x] 启用 `PRAGMA foreign_keys=ON`（B3，已完成于第 1 批）
- [x] 修复 B1/B2/B4（登录信息来源、删除复活、改名断链，已完成于第 1 批）
- [x] Dev API Server 加固（S1，已完成于第 2 批：Origin/Host 白名单 + 精确 CORS + `DEV_API=0` 可关；产品交付时建议直接关闭）
- [x] DTO 贯通 + 适配器拆分（A1/A2/A5，已完成于第 3 批：`main/dto.ts` 单一类型源 + `services/adapter.ts`；新模块开发直接按 9.3 流程写类型化接口）
- [x] 角色权限（A3，已完成于第 4 批：菜单 roles 过滤 + RequireRole 路由守卫；前置 B1 已于第 1 批修复）
- [x] 工程化四件套（A7，已完成于第 4 批：ESLint/Prettier/ErrorBoundary/electron-log/vitest）
- [ ] 决策鉴权方案：保留本地演示级 or 接后端（S4 剩余：token 语义与防爆破）
- [x] 清理 D1/D5/D6/D7（已完成于第 5 批：根级死组件、假延迟、假"记住我"、标题单点配置化；D2/D3/D4/D8 已随第 3 批完成）

---

## 10. 整改路线图（建议顺序）

| 阶段 | 内容 | 预估 |
|---|---|---|
| 第 1 批（数据正确性）✅ **已完成（2026-09-06）** | B1（authLogin 贯通五层）、B2（删 mergeWithDefaults）、B3（PRAGMA foreign_keys + 级联）、B4（改名/删除联动 + 迁移 v2）、A8（PRAGMA user_version 版本化迁移）；验证：tsc×2、vite build、迁移冒烟脚本 6/6 PASS | 1 天 |
| 第 2 批（安全）✅ **已完成（2026-09-06）** | S1（Origin/Host 双白名单 + 精确 CORS + DEV_API 开关，弃 token 方案因并发竞态）、S3（passwordChangeSecure 主进程哈希，删渲染端 crypto 与 authVerify 死链路）；验证：tsc×2、vite build（bundle -20KB）、安全冒烟脚本 6/6 PASS | 0.5 天 |
| 第 3 批（架构债）✅ **已完成（2026-09-06）** | A1（adapter.ts 工厂拆分 + dev-fallback 动态加载 + sqlite.ts 薄门面）、A2（`main/dto.ts` 单一类型源贯通六层）、A5（service 出口统一 camelCase 映射）；顺带完成 D2/D3/D4/D8（mock 目录、ThemeSwitcher 空目录、onMockData 死链、无效映射）；验证：tsc×2 零错误、vite build、既有迁移/安全冒烟脚本全 PASS | 1 天 |
| 第 4 批（权限与工程化）✅ **已完成（2026-09-06）** | A3（迁移 v3 menus.roles + filterMenuTreeByRole 菜单过滤 + RequireRole 路由守卫 + 表单角色编辑）、A7（ESLint+Prettier / ErrorBoundary / electron-log 主进程日志+渲染层转发通道 / Vitest 18 例）；验证：tsc×2、ESLint 0 错、vitest 18/18、迁移冒烟 7/7（v3+roles 种子）、安全冒烟 6/6、vite build | 1 天 |
| 第 5 批（卫生）✅ **已完成（2026-09-07）** | D1（根级 Sidebar/WindowControls 四个死文件删除，grep 复核零引用）、D5（800ms 假延迟删除 + 空输入校验前置）、D6（假"记住我"及其 CSS 死样式删除）、D7（新建 `renderer/app-config.ts` 单点配置，登录页/侧边栏/标题栏统一引用；顺带新增 `vite-env.d.ts` 支撑 `import.meta.env.DEV` 开发态标题后缀）；验证：tsc×2 零错误、ESLint 0 错、vitest 18/18、迁移冒烟 7/7、安全冒烟 6/6、vite build | 0.5 天 |

> 五批整改全部完成（B 1-5 除 B5 降级提示外全部修复，S 1-4 除 S2 默认账号与 S4 token 语义外全部加固，A 1-8 全部落地，D 1-8 全部清理）。剩余未项均为已声明的设计取舍（第 8 章）或产品化交付前决策项（S2/S4/B5）。

---

## 11. 参考资料

- [Electron 官方文档](https://www.electronjs.org/docs/)
- [React 官方文档](https://react.dev/)
- [Vite 官方文档](https://vitejs.dev/)
- [Zustand](https://github.com/pmndrs/zustand)
- 项目内深度文档见 `doc/` 目录：
  - `doc/开发报告/头像上传裁剪与预览功能实现.md`——头像功能全链路（上传→校验→Canvas 圆形裁剪→压缩→保存→hover 预览→移除），含裁剪算法数学推导与 4 个 bug 修复记录
  - `doc/开发报告/自定义标题栏性能最优方案.md`——TitleBar 提升到 App 根层级的架构决策
  - `doc/开发报告/Zustand 技术报告.md`——状态管理深度分析
  - `doc/开发报告/通用查询组件架构设计与实现.md`——useQueryTable + QueryTableLayout 范式详解
  - `doc/开发报告/Electron安全加固与CSP告警.md`、`SQLite集成与FAQ.md`、`打包体积优化.md` 等

## 许可证

MIT License
