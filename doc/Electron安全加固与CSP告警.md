# Electron 安全加固：Content-Security-Policy 告警

## 症状

Electron 开发模式启动后，控制台出现：

```
Electron Security Warning (Insecure Content-Security-Policy)
This renderer process has either no Content Security Policy set
or a policy with "unsafe-eval" enabled. This exposes users of
this app to unnecessary security risks.
...
This warning will not show up once the app is packaged.
```

## 这是什么

`Content-Security-Policy`（CSP）是浏览器/Chromium 的纵深防御机制，用一份「资源白名单」限制页面能加载并执行哪些脚本、样式、图片、网络请求，是抵御 **XSS / 代码注入** 的关键一层。

Electron 在**开发模式**下内置了一组安全检查（`securityWarnings`）。其中 CSP 检查的触发条件是二者之一：

1. 渲染进程**完全没有**设置 CSP（响应头或 `<meta>`），或
2. CSP 里 `script-src` / `default-src` 含 `'unsafe-eval'`。

本项目此前 index.html 与主进程都**没有任何 CSP**，命中条件 1，于是每次启动都刷这条告警。

## 根因定位

- `index.html` 无 CSP `<meta>`；
- `main.ts` 的 `webPreferences` 只有 `contextIsolation: true` / `nodeIntegration: false`（这两项本身是**正确且已满足**的安全基线，与本告警无关），也未通过 `session.webRequest.onHeadersReceived` 注入 CSP 响应头。
- 结论：纯粹是「缺 CSP」，不是配置错。

## 修复

在 `index.html` 的 `<head>` 中、尽量靠前处加入一条 CSP `<meta>`（**刻意不含 `unsafe-eval`**，从而消除告警）：

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self' 'unsafe-inline';
           style-src 'self' 'unsafe-inline';
           img-src 'self' data: blob:;
           font-src 'self' data:;
           connect-src 'self' ws://localhost:5173 http://localhost:5173 http://localhost:5174 http://127.0.0.1:5174;"
/>
```

### 逐条指令的理由（为什么要为 Vite 开这些口子）

| 指令 | 取值 | 为什么 |
|------|------|--------|
| `default-src` | `'self'` | 兜底：仅允许同源资源。 |
| `script-src` | `'self' 'unsafe-inline'` | `@vitejs/plugin-react` 在 dev 注入 **Fast Refresh 内联前置脚本**，不放行内联会导致 React 起不来。注意：`'unsafe-inline'` **不会**触发本告警（只有 `unsafe-eval` 会）。 |
| `style-src` | `'self' 'unsafe-inline'` | React 组件的内联 `style={{}}` 属性 + Vite 错误浮层样式都是内联样式。 |
| `img-src` | `'self' data: blob:` | 头像/图标可能走 `data:`、`blob:`。 |
| `font-src` | `'self' data:` | 内联字体。 |
| `connect-src` | `'self' ws://localhost:5173 http://localhost:5173 http://localhost:5174 http://127.0.0.1:5174` | Vite **HMR WebSocket**(5173) + 浏览器开发模式下访问 **Dev API**(5174)。注意 `sqlite.ts` 的 `DEV_API_BASE` 用的是 `http://127.0.0.1:5174`，**CSP 按主机名精确匹配，`127.0.0.1` 与 `localhost` 是两个不同主机**，故两者都要列。 |

### 为什么这样就安全且够用

- 告警只针对「无 CSP / `unsafe-eval`」，本策略两者都不满足 → 告警消失，且资源加载确实被同源策略约束。
- 应用是**本地离线**桌面程序：`nodeIntegration: false` + `contextIsolation: true` 已隔离 Node 能力，不加载任何远程内容，XSS 注入面极小，`'unsafe-inline'` 带来的额外风险可接受。

## 验证

- `npm run build:renderer` 通过；确认 CSP `<meta>` 已被 Vite 原样带进 `dist/renderer/index.html`。
- 重启 `npm run start`，DevTools Console 不再出现该 CSP 安全告警。
- 回归确认 HMR 热更新、React 组件渲染、内联样式均正常（'unsafe-inline' 生效）。

## 最终方案（已定稿）

本告警相关的安全加固收敛为两处改动，均随 `build:renderer` 验证进产物：

1. **`index.html` 加 CSP `<meta>`**（见上文「修复」）——消除告警，且不破坏 Vite dev 的 HMR / React Fast Refresh。
2. **`vite.renderer.config.ts` 设 `base: './'`**——让打包后的 `dist/renderer/index.html` 以**相对路径**引用资源（已验证产物为 `./assets/xxx.js`、`./vite.svg`）。这样 `file://` 下资源能正确加载，CSP 的 `default-src 'self'` 也能匹配同源资源。dev 模式不受 base 影响。

### 为什么 CSP 是「最终版」而不再追求 nonce

曾考虑用主进程 `onHeadersReceived` 下发带 `nonce-` 的 CSP 响应头来移除 `script-src 'unsafe-inline'`。**最终不采用**，原因：

- 生产经 `file://` 加载，而 `onHeadersReceived` **对 `file://` 协议不触发**，无法下发自带 nonce 的响应头；
- `<meta>` 标签本身**不支持 nonce**；
- 要真正用上 nonce，须把页面改为自定义 `app://` 协议 + 头部注入，属于较大重构，对**本地离线、无远程内容、`nodeIntegration:false` + `contextIsolation:true`** 的应用收益不成比例。

因此保留 `script-src 'self' 'unsafe-inline'` 是经过权衡的**定稿**：既消除告警、覆盖 Vite 开发体验，又契合本地桌面应用的威胁模型。

## 可选的进一步加固（超出本告警范围，未做）

1. **其它 Electron 安全检查项**：生产环境禁用 `openDevTools`、`webContents.setWindowOpenHandler` 拒绝新窗口、`will-navigate` 阻止外链导航等。这些与 CSP 告警无关，按需再加。
2. **代码分包**：`build:renderer` 提示单包 >500KB，可用动态 `import()` 或 `manualChunks` 优化（性能项，非安全项）。

## 扩展：接入本地 MySQL / 远程 HTTP 时 CSP 怎么处理

### 一句话结论
CSP 只约束**渲染进程文档内**发起的资源加载与 fetch / XHR / WebSocket；**对主进程（Node）的任何网络/数据库调用完全无效**。因此：
- 本地 MySQL、以及放在主进程做的远程 HTTP —— **不用改 CSP**；
- 只有「在渲染进程里直接 `fetch` 远程地址」时，才需要把该 origin 精确加进 `connect-src`。

### 为什么
- 本项目数据访问层 `sqlite.ts` 在 **Electron 模式走 IPC**（`window.electronAPI.*`）到主进程；只有浏览器模式才 `fetch` 本地 Dev API。IPC 不是 HTTP，不受 CSP 管辖。
- 主进程用 Node 的 `net/http/https/tls` 或数据库驱动（`mysql2`、`ioredis`、`basic-ftp`）发起的连接发生在**文档之外**，Chromium 的 CSP 引擎看不到，`connect-src` 对它们没有任何作用。
- 推论：将来 Redis / FTP 接 `ioredis` / `basic-ftp` 同理——在主进程跑，**也不受 CSP 影响**。

### 场景一：本地 MySQL
- **不能**在渲染进程直连：MySQL 是 3306 端口的原生 TCP 协议，浏览器/Chromium 无法用 fetch/WebSocket 说 MySQL 协议（是能力限制，与 CSP 无关）。
- 正确做法（与 SQLite 完全一致的架构）：**主进程**用 `mysql2`（或 Prisma/Knex/Sequelize）连接，通过**新增 IPC 通道 + service 层函数**暴露给渲染进程；连接串/口令只留在主进程。
- **CSP：无需任何改动。**

### 场景二：向远程服务器发 HTTP 取数据

**方案 A（推荐）——走主进程转发**
- 在主进程用 `fetch`/`axios`/`http` 调远程 API，结果经 IPC 返回。
- 主进程请求**不受 CSP，也不受 CORS 约束**；token/密钥留在主进程；渲染 CSP 保持 `'self'` 收紧，**CSP 不用改**。
- 契合本项目「数据访问集中在主进程 service 层」的现状。

**方案 B——渲染进程直接 fetch 远程**
- 此时才需要改 CSP：把远程 origin **精确**加入 `connect-src`：
  ```
  connect-src 'self' https://api.example.com wss://api.example.com;
  ```
- 若还加载远程图片/字体：`img-src 'self' https://cdn.example.com;`、`font-src 'self' https://fonts.gstatic.com;`。
- 远程服务端仍必须返回正确的 **CORS** 头（渲染进程是 Chromium，CSP 之外还有 CORS 这一关）。
- 原则：**逐主机白名单**，不要用 `*` 或整段 `https:`。

### 决策速查表

| 需求 | 在哪发起 | 受 CSP 管吗 | 要不要改 CSP | 备注 |
|------|---------|-----------|------------|------|
| 本地 MySQL | 主进程 `mysql2` | 否 | **不用** | 经 IPC 暴露；渲染无法直连 TCP |
| 远程 HTTP | 主进程 `fetch`/`axios` | 否（也无 CORS） | **不用** | 推荐；密钥留主进程 |
| 远程 HTTP | 渲染进程 `fetch` | 是 | 要，加 `connect-src` | 仍需服务端 CORS |
| 远程 WebSocket | 渲染进程 `new WebSocket` | 是 | 要，加 `wss://origin` | |
| 远程图片/字体 | 渲染 `<img>`/CSS | 是 | 要，加 `img-src`/`font-src` | |
| Redis / FTP | 主进程 `ioredis`/`basic-ftp` | 否 | **不用** | 原生 TCP，同 MySQL |

### 反面清单（别这么做）
- ❌ 为图省事把 `connect-src` 写成 `*` 或 `https:` —— 等于废掉 CSP。
- ❌ 以为「主进程连不上/被拦」而去改 CSP —— 主进程与 CSP 无关，要查防火墙/驱动/地址/凭据。
- ❌ 把 DB 口令、第三方 API Key 塞进渲染进程 —— 应留在主进程。

---

## 相关代码文件

| 文件 | 变更 |
|------|------|
| `index.html` | `<head>` 新增 CSP `<meta>`（无 `unsafe-eval`，为 Vite dev 放行 inline 脚本/样式与本地 WS/HTTP） |
| `vite.renderer.config.ts` | 设 `base: './'`，使打包产物以相对路径引用资源，`file://` 可正常加载且匹配 CSP `'self'` |
