创建时间：2026年9月6日22:54:16

---

```ts
import { defineConfig } from 'vite';  
import react from '@vitejs/plugin-react';  
import { resolve } from 'path';  
  
export default defineConfig({  
  // 打包为桌面应用后经 file:// 加载，资源必须用相对路径；  
  // 默认的 '/' 会生成 /assets/xxx.js 绝对路径，在 file:// 下无法解析，  
  // 且会让 CSP 的 default-src 'self' 无法匹配同源资源。dev 模式不受 base 影响。  
  base: './',  
  plugins: [react()],  
  resolve: {  
    alias: {  
      '@': resolve(__dirname, 'src/renderer'),  
    },  
  },  
  build: {  
    outDir: 'dist/renderer',  
    emptyOutDir: true,  
  },  
  server: {  
    port: 5173,  
  },  
});
```




以下是对该 Vite 配置文件的逐行解析。它专用于 **Electron 渲染进程**的开发与构建，与主进程的 TypeScript 配置完全分离。理解每一处配置的意图，有助于团队在后续调整构建行为时避免踩坑。

---

## 1. 模块导入部分

```ts
import { defineConfig } from 'vite';
```

- **作用**：导入 Vite 提供的 `defineConfig` 工具函数。
- **用途**：为配置文件提供类型提示和智能补全（当使用 TypeScript 编写配置时）。即使不调用它，Vite 也能读取配置，但使用它可以获得更好的开发体验。
- **注意**：该文件通常是 `vite.renderer.config.ts`（与 `package.json` 中 `--config` 参数对应），因此可以用 TypeScript 编写。

---

```ts
import react from '@vitejs/plugin-react';
```

- **作用**：导入 Vite 官方 React 插件。
- **用途**：
  - 支持 React 的 JSX 转换（使用 esbuild 或 Babel）。
  - 提供开发模式下的 **Fast Refresh**（热更新），使 React 组件修改后无需刷新页面即可更新。
  - 处理 React 特有的 HMR 逻辑。
- **为什么需要**：渲染进程使用 React，必须通过此插件让 Vite 理解 `.tsx` 文件中的 JSX 语法。

---

```ts
import { resolve } from 'path';
```

- **作用**：从 Node.js 内置模块 `path` 中导入 `resolve` 函数。
- **用途**：用于将相对路径拼接为绝对路径。在配置别名时非常实用，确保跨平台路径正确（Windows 和 POSIX 路径分隔符差异由 `path.resolve` 处理）。

---

## 2. 默认导出的配置对象

```ts
export default defineConfig({ ... });
```

- **作用**：导出 Vite 配置对象。Vite 会读取这个默认导出并使用它。

---

### 2.1 `base: './'`

```ts
// 注释解释了为什么必须设置为 './'
base: './',
```

- **含义**：指定构建时资源的**公共基础路径**。
- **默认值**：Vite 默认 `base` 为 `'/'`（绝对路径）。
- **为什么改为 `'./'`**：
  - Electron 渲染进程在生产环境中通过 `file://` 协议加载 `dist/renderer/index.html`，此时资源路径若为 `/assets/xxx.js` 会被解析为 `file:///assets/xxx.js`，即**文件系统根目录**，而非项目目录，导致资源加载失败。
  - 使用 `'./'` 后，生成的 HTML 中资源引用变为 `./assets/xxx.js` 相对路径，能正确相对于当前 HTML 文件定位资源。
  - 同时，CSP 中的 `default-src 'self'` 在 `file://` 下，“self”指当前 HTML 文件所在的源，如果资源被写成绝对路径 `/assets/...`，则其源不是 `self`，会被 CSP 拦截。相对路径 `./assets/...` 会被视为同源，从而放行。
- **开发模式**：注释说明“dev 模式不受 base 影响”，因为开发时由 Vite Dev Server 提供资源，路径以 `/` 开头但由服务器处理，不会涉及 `file://`。不过设置 `base: './'` 不影响开发服务器行为。

---

### 2.2 `plugins: [react()]`

```ts
plugins: [react()],
```

- **作用**：注册 React 插件。
- **解析**：
  - 调用 `react()` 返回一个 Vite 插件实例。
  - 该插件负责 JSX 转换、Fast Refresh 注入等。
- **额外注意**：如果之后需要其他插件（如 `vite-plugin-svgr`），也放在此数组中。

---

### 2.3 `resolve.alias`

```ts
resolve: {
  alias: {
    '@': resolve(__dirname, 'src/renderer'),
  },
},
```

- **作用**：配置模块路径别名。
- **解析**：
  - `'@'` 被映射到绝对路径 `<项目根目录>/src/renderer`。
  - `__dirname` 是当前配置文件所在目录（即项目根目录），因此 `resolve(__dirname, 'src/renderer')` 会得到正确的绝对路径。
  - 之后在渲染进程代码中，`import Button from '@/components/Button'` 会被解析到 `src/renderer/components/Button`，减少冗长的相对路径（`../../`）。
- **对新手**：别名让导入更清晰，但需确保 TypeScript 也能识别（在 `tsconfig` 中添加 `paths`），否则编辑器可能报类型错误。本项目可能通过其他方式处理，但这里只配置了 Vite。

---

### 2.4 `build` 配置

```ts
build: {
  outDir: 'dist/renderer',
  emptyOutDir: true,
},
```

- **`outDir: 'dist/renderer'`**
  - 指定构建产物的输出目录。
  - 与主进程编译输出 `dist/main` 分离，最终打包时两者都会被包含（见 `package.json` 的 `files` 配置）。

- **`emptyOutDir: true`**
  - 构建前清空 `outDir` 目录。
  - 确保旧文件不会残留，避免发布包含过期资源。
  - 默认行为：Vite 会警告如果输出目录不在项目根目录内，但这里设置 `true` 显式声明清空，安全性高。

---

### 2.5 `server` 配置

```ts
server: {
  port: 5173,
},
```

- **作用**：指定开发服务器端口为 `5173`。
- **原因**：
  - Vite 默认端口也是 5173，这里显式声明是为了与 Electron 主进程中加载的 URL 保持一致。
  - 在 `package.json` 的 `start` 脚本中，`npm run dev` 启动此端口，Electron 主进程会加载 `http://localhost:5173`。
  - 另外，`index.html` 的 CSP 中允许了 `ws://localhost:5173` 和 `http://localhost:5173`，与此端口匹配。
- **注意**：如果端口被占用，Vite 会自动尝试下一个端口（5174 等），但 Electron 主进程若硬编码 5173 就会失败。实际开发中可添加 `strictPort: true` 防止端口漂移，但当前配置未设置，需确保 5173 可用。

---

## 3. 整体设计考量与团队建议

- **职责分离**：渲染进程构建完全由 Vite 管理，与主进程的 TypeScript 编译互不干扰，符合 Electron 双进程开发的常见模式。
- **生产路径正确性**：`base: './'` 是 Electron 生产构建的**关键设置**，忽略它会导致白屏或资源加载失败。
- **一致性**：端口、输出目录、CSP 等都紧密配合，修改任何一项都可能影响其他部分。修改配置后应同步检查：
  - `package.json` 中 `build.files` 是否包含新输出目录。
  - `index.html` 的 CSP 是否需要调整。
  - 主进程加载的 URL 或文件路径是否一致。
- **对新人**：理解 Vite 配置中的 `base` 在 Electron 场景下的作用，是排查“构建后页面空白”问题的第一步。

这份配置简洁且必要，体现了作者对 Electron + Vite 集成细节的掌握。后续如需增加更多前端特性（如环境变量、CSS 预处理器），可在此基础上扩展。





END.