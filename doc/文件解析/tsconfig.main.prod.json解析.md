创建时间：2026年9月6日22:53:09

---

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
+
{
  "extends": "./tsconfig.main.json",
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false
  }
}
```




以下是对项目中两个 TypeScript 配置文件的逐行解析。它们专门用于编译 Electron **主进程**代码，与渲染进程（由 Vite 处理）的 TypeScript 配置是分开的。

---

# 一、`tsconfig.main.json`（主进程开发/通用编译配置）

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

## 1. `"compilerOptions"` 编译选项

### `"target": "ES2020"`
- **含义**：将 TypeScript 代码编译为 **ECMAScript 2020** 标准的 JavaScript。
- **作用**：决定了输出 JS 的语法特性（如可选链 `?.`、空值合并 `??`、动态 `import()` 等会保留，不会降级为 ES5 的写法）。
- **为什么选 ES2020**：
  - Electron 33 内置的 Chromium 和 Node.js 版本完全支持 ES2020 语法。
  - 保持较新的语法，减少编译产物的体积和 polyfill 需求。
  - 主进程代码不会跑在老旧浏览器中，无需过度降级。

### `"module": "commonjs"`
- **含义**：将模块系统编译为 **CommonJS**（即 `require` / `module.exports`）。
- **作用**：Electron 主进程运行在 Node.js 环境中，Node.js 原生支持 CommonJS。使用 CommonJS 可避免 ESM 在 Node 中的兼容性问题（如 `__dirname`、`__filename` 的使用、动态导入限制等）。
- **注意**：即使源码中使用了 `import` / `export`（ESM 语法），编译器也会转换为 `require`。

### `"lib": ["ES2020"]`
- **含义**：指定编译时可用的**内置类型声明库**。
- **作用**：这里只包含 `ES2020`，表示代码中可以使用 ES2020 标准库提供的全局类型（如 `Promise`、`Map`、`WeakRef` 等），但**不包括 DOM 类型**（如 `window`、`document`）。
- **为什么只有 ES2020**：
  - 主进程运行在 Node.js 环境，没有 DOM API，引入 DOM 类型会导致误用（例如在 Node 中使用 `window` 不会报类型错误，但运行时会出错）。
  - 如果需要 Node.js 类型（如 `process`、`Buffer`），通常通过安装 `@types/node` 并在项目中引用，但这里未列出，说明可能在代码中通过 `/// <reference types="node" />` 或其他方式引入，或者项目依赖了 `@types/node`（会被自动包含，因为 TypeScript 会默认包含所有 `@types` 包）。

### `"outDir": "dist/main"`
- **含义**：指定编译输出目录。
- **作用**：所有 `.ts` 文件编译后生成的 `.js` 文件（以及声明文件等）都会输出到 `dist/main` 目录下，**保持源码目录结构**。
- **与 package.json 的关联**：`main` 字段指向 `dist/main/main.js`，确保编译产物能被 Electron 找到。

### `"rootDir": "src/main"`
- **含义**：指定 TypeScript 源文件的**根目录**。
- **作用**：编译器会根据 `rootDir` 计算输出目录结构。例如源文件 `src/main/index.ts` 会被输出为 `dist/main/index.js`。
- **为什么设置**：避免将 `src` 其他目录（如 `src/renderer`）的文件也编译进来，同时确保输出路径可预测。

### `"strict": true`
- **含义**：启用 TypeScript 的**所有严格类型检查选项**。
- **具体包括**：
  - `noImplicitAny`（禁止隐式 any）
  - `strictNullChecks`（严格空值检查）
  - `strictFunctionTypes`（严格函数类型）
  - `strictBindCallApply`（严格 bind/call/apply）
  - `strictPropertyInitialization`（严格属性初始化）
  - `noImplicitThis`（禁止隐式 this）
  - `alwaysStrict`（始终使用严格模式）
- **作用**：在开发阶段捕获大量潜在类型错误，提高代码健壮性。
- **对新手**：可能会觉得约束多，但有助于养成良好编程习惯。

### `"esModuleInterop": true`
- **含义**：允许**默认导入**那些没有默认导出的 CommonJS 模块。
- **示例**：`import express from 'express'` 即使 `express` 是 CommonJS 模块，也可以这样写，编译器会自动处理 `__importDefault`。
- **作用**：提升与各种 CommonJS 包的兼容性，简化导入语法。
- **最佳实践**：对于 Electron 主进程，经常使用 CommonJS 包，此选项非常有用。

### `"skipLibCheck": true`
- **含义**：跳过**所有声明文件（`.d.ts`）的类型检查**。
- **作用**：加快编译速度，避免因为第三方库类型定义中的小问题导致编译失败。
- **注意**：只跳过类型检查，不影响代码提示和类型推断。
- **风险**：可能掩盖某些类型定义错误，但通常第三方库的类型定义是可信的。

### `"forceConsistentCasingInFileNames": true`
- **含义**：强制文件名大小写一致。
- **作用**：防止在 Windows/macOS（文件系统不区分大小写）上开发时，因引用路径大小写错误而在 Linux（区分大小写）上构建失败的问题。
- **示例**：如果代码中写 `import './MyModule'`，但实际文件是 `myModule.ts`，编译器会报错。

### `"resolveJsonModule": true`
- **含义**：允许在 TypeScript 中**直接导入 `.json` 文件**作为模块。
- **作用**：可以 `import config from './config.json'` 并得到类型推断。
- **常见用途**：读取静态配置文件、数据库 schema 等，无需手动读取文件。

### `"declaration": true`
- **含义**：为每个 `.ts` 文件生成对应的 `.d.ts` **类型声明文件**。
- **作用**：这些声明文件描述了模块的类型信息，可用于其他 TypeScript 项目引用。
- **为什么主进程需要**：虽然主进程代码不会作为库发布，但有时渲染进程或其他模块需要共享类型；或者用于调试时查看类型。
- **产物位置**：输出到 `outDir`（`dist/main`）。

### `"declarationMap": true`
- **含义**：为声明文件生成对应的 `.d.ts.map` **源映射**。
- **作用**：允许 IDE 在跳转到声明文件时，能够映射回原始 `.ts` 源代码位置，提升开发体验。

### `"sourceMap": true`
- **含义**：生成 `.js.map` **源映射文件**。
- **作用**：调试时，可以将编译后的 JavaScript 代码映射回 TypeScript 源码，便于断点调试和错误堆栈追踪。
- **产物位置**：输出到 `outDir`（`dist/main`）。
- **注意**：会泄露源码结构（但主进程代码通常不对外分发，开发环境无碍）。

## 2. `"include": ["src/main/**/*.ts"]`
- **含义**：指定需要编译的**文件范围**。
- **作用**：仅包含 `src/main` 目录下所有 `.ts` 文件（递归子目录），不包含 `.tsx` 或其他目录。
- **为什么只包括 `.ts`**：主进程代码是纯逻辑代码，不涉及 JSX，无需 `.tsx`。
- **与 `rootDir` 配合**：确保编译输入的根目录是 `src/main`。

---

# 二、`tsconfig.main.prod.json`（主进程生产编译配置）

```json
{
  "extends": "./tsconfig.main.json",
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false
  }
}
```

## 1. `"extends": "./tsconfig.main.json"`
- **含义**：**继承**基础配置文件 `tsconfig.main.json` 的所有设置。
- **作用**：避免重复配置，只在基础配置上做必要的覆盖或修改。
- **效果**：生产配置继承了基础配置中的 `target`、`module`、`strict`、`outDir` 等全部选项。

## 2. 覆盖 `compilerOptions`

### `"declaration": false`
- **含义**：**关闭**类型声明文件（`.d.ts`）的生成。
- **理由**：生产构建不需要类型声明，这些文件对最终打包没有用处，还会增加构建时间和产物体积。

### `"declarationMap": false`
- **含义**：关闭声明映射文件的生成。
- **理由**：同上，生产环境无需映射。

### `"sourceMap": false`
- **含义**：**关闭**源映射文件（`.js.map`）的生成。
- **理由**：
  - 生产环境不需要调试映射，源码映射会**泄露源代码逻辑**，增加安全风险。
  - 减小产物体积，加快启动速度（虽然影响很小）。
- **注意**：在 `package.json` 的 `build` 字段中，`files` 数组已经排除了 `**/*.map`，但这里直接从编译阶段就不生成，更加彻底。

---

# 三、两个配置的关系与使用场景

| 配置文件 | 使用命令 | 用途 | 特点 |
|----------|----------|------|------|
| `tsconfig.main.json` | `npm run build:main` | 开发/调试场景下的主进程编译 | 保留 sourceMap 和类型声明，便于调试和类型共享 |
| `tsconfig.main.prod.json` | `npm run build:main:prod` | 生产打包前的主进程编译 | 移除 sourceMap 和类型声明，优化体积和安全 |

### 构建脚本对应关系（来自 `package.json`）
- `"build:main": "tsc -p tsconfig.main.json"`  
  用于普通构建（如 `npm run build`），可能用于快速检查或测试。
- `"build:main:prod": "tsc -p tsconfig.main.prod.json"`  
  用于生产构建（`npm run build:prod`），随后执行 `electron-builder` 打包。

### 设计亮点
- **继承机制**：通过 `extends` 复用基础配置，生产配置只覆盖必要的三个字段，保持了配置的单一数据源原则，维护成本低。
- **安全考量**：生产构建移除 sourceMap，避免发布的应用中附带源码信息，符合安全最佳实践。
- **开发体验**：开发配置保留 sourceMap 和 declaration，方便断点调试与 IDE 类型跳转。

### 对团队新人的建议
- 修改主进程编译设置时，优先修改 `tsconfig.main.json`，除非明确知道某个选项只在生产环境需要覆盖。
- 不要在生产配置中开启 `sourceMap` 或 `declaration`，除非有充分的理由（例如需要远程调试）。
- 如果添加新的主进程源文件，确保它位于 `src/main` 目录下，否则不会被编译。

---

通过以上解析，团队成员可以清晰理解这两个 TypeScript 配置文件各自的作用、差异以及在整个构建流程中的定位。






END.