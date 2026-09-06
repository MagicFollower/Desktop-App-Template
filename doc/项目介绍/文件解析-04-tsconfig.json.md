# tsconfig.json 深度解析

> **本文档目标**：让新入职同学理解 TypeScript 编译器配置文件的每一个字段含义、为什么这样配置、以及配置错误会导致什么后果。

---

## 一、它是什么

`tsconfig.json` 是 **TypeScript 编译器的配置文件**。

TypeScript 是一种"加了类型系统的 JavaScript"。当你写 `const name: string = "hello"` 时，`string` 就是类型。TypeScript 编译器（`tsc`）会检查这些类型是否正确，然后把 TypeScript 代码**翻译**成纯 JavaScript。

`tsconfig.json` 就是告诉编译器：**怎么翻译、翻译什么、翻译成什么样**。

> **新人小结：为什么需要配置文件？**
>
> TypeScript 编译器有很多选项（目标版本、模块系统、是否严格检查等），如果每个项目都手动输入这些参数，会非常繁琐。配置文件让开发者**写一次，永久生效**。
>
> 就像手机有"默认设置"——你不需要每次开机都设置时区、语言、亮度，手机记住你的偏好就行。`tsconfig.json` 就是 TypeScript 的"默认设置"。

---

## 二、完整内容

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx"]
}
```

---

## 三、逐字段解析

### 3.1 `target`: `"ES2020"`

**含义**：编译后的 JavaScript 代码要兼容哪个版本的 ECMAScript（JavaScript 的标准）。

**生效方式**：
- TypeScript 会把高级语法**降级**为 ES2020 支持的语法
- 例如：`async/await`、`optional chaining (?.)`、`nullish coalescing (??)` 在 ES2020 中原生支持，不需要降级
- 但如果是 `ES2015` 目标，TypeScript 会把 `async/await` 翻译成 `Promise` + `coroutine` 函数

**为什么选 ES2020**：
- Electron 33 基于 Chromium 120，支持 ES2020 的所有特性
- 太低的 target（如 ES5）会导致生成的代码又长又慢
- 太高的 target（如 ES2024）可能在旧版浏览器/系统上跑不了

> **新人小结：target 不是"目标平台"，是"目标语法版本"**
>
> 很多新人以为 `target: "ES2020"` 意思是"目标是 ES2020 版本的电脑"。实际上它是说"编译后的代码使用 ES2020 语法"。
>
> 实际兼容性取决于**运行环境**：
> - Electron 窗口 → Chromium 120 → 支持 ES2020 ✅
> - 浏览器 → 看浏览器的版本 → 大部分现代浏览器支持 ES2020 ✅
> - 老版 IE → 不支持 ES2020 → 需要 Babel 降级（本项目不需要，因为 Electron 应用没有 IE 用户）

### 3.2 `useDefineForClassFields`: `true`

**含义**：控制类的字段（field）是用 `this.field = value` 定义，还是用 `class { field = value }` 定义。

**背景**：JavaScript 类字段（class field）是一个相对新的特性。不同实现方式生成的代码不同：
- `useDefineForClassFields: true` → 使用 `Object.defineProperty`（ES2022 风格）
- `useDefineForClassFields: false` → 在构造函数中赋值（传统风格）

**为什么设为 true**：这是 React 18 推荐的做法，确保 React 内部对类组件的处理方式一致。

> **新人小结：这个字段你基本不需要改**
>
> 这是框架级别的配置，跟着 React/Vite 的推荐值设置就行。改它通常不会带来好处，反而可能引入兼容性问题。

### 3.3 `lib`: `["ES2020", "DOM", "DOM.Iterable"]`

**含义**：告诉编译器"你的代码可以用哪些 API"。

| 库 | 包含的 API | 本项目中哪里用到 |
|---|-----------|----------------|
| `ES2020` | JavaScript 核心 API（`Array`、`Object`、`Promise`、`Map` 等） | 所有代码都会用到 |
| `DOM` | 浏览器 DOM API（`document`、`window`、`element` 等） | React 渲染到页面上需要 DOM API |
| `DOM.Iterable` | DOM 的迭代器接口（`querySelectorAll` 返回的 NodeList 可以 `for...of` 遍历） | 偶尔在 DOM 操作中用到 |

**如果不加 `DOM` 会怎样**：
```typescript
// 没有 DOM lib 时，以下代码会报错：
const div = document.createElement('div');  // ❌ 'document' 不存在
window.alert('hello');                      // ❌ 'window' 不存在
```

> **新人小结：lib 决定了"类型检查的边界"**
>
> TypeScript 的类型检查不是无限的——它只检查你在 `lib` 中声明的 API 的类型。如果你写了 `document.getElementById()` 但没有在 `lib` 中加入 `DOM`，TypeScript 会告诉你"'document' 不存在"。
>
> 主进程的 `tsconfig.main.json` 中没有 `DOM`，因为主进程运行在 Node.js 中，没有 `document` 和 `window`（DOM 概念）。

### 3.4 `module`: `"ESNext"`

**含义**：编译后的代码使用什么模块系统。

| 值 | 模块系统 | 生成代码示例 |
|---|---------|------------|
| `"ESNext"` | ES Module（`import`/`export`） | `import React from 'react';` |
| `"commonjs"` | CommonJS（`require`/`module.exports`） | `const React = require('react');` |
| `"umd"` | UMD（兼容多种环境） | 自动判断环境 |

**本项目用 ESNext 的原因**：
- Vite 开发服务器原生支持 ES Module
- 现代浏览器都支持 `import`/`export`
- 代码更简洁，没有 `require()` 的同步加载限制

> **新人小结：ES Module vs CommonJS**
>
> 这是 JavaScript 历史上最大的分歧之一：
>
> ```javascript
> // ES Module (现代，推荐)
> import React from 'react';
> export function App() { ... }
>
> // CommonJS (Node.js 传统)
> const React = require('react');
> module.exports = function App() { ... };
> ```
>
> **关键区别**：
> 1. ES Module 是**静态分析**的（编译时就能确定导入哪些模块），CommonJS 是**动态加载**的（运行时才加载模块）
> 2. ES Module 支持**循环导入**的更好处理
> 3. ES Module 可以被浏览器原生加载（`<script type="module">`），CommonJS 不行
>
> 本项目中：渲染进程用 ES Module（`ESNext`），主进程用 CommonJS（`tsconfig.main.json` 中 `module: "commonjs"`）。

### 3.5 `skipLibCheck`: `true`

**含义**：跳过 `.d.ts` 类型定义文件的检查。

**背景**：`node_modules/@types/react/index.d.ts` 是一个类型定义文件，里面有成百上千行的类型声明。这些文件通常由库的维护者编写，质量很高。

**设为 true 的原因**：
- 类型定义文件已经过严格检查，不需要再检查一遍
- 跳过可以**大幅加快编译速度**（特别是依赖多的项目）
- 如果类型定义文件有错误，通常是库的问题，不是你的问题

> **新人小结：什么时候应该设为 false？**
>
> 只有当你**自己编写** `.d.ts` 文件，或者怀疑某个第三方库的类型定义有误时，才需要设为 `false` 来查看详细错误。日常开发保持 `true`。

### 3.6 `moduleResolution`: `"bundler"`

**含义**：告诉 TypeScript 如何解析 `import` 语句中的模块路径。

**可选值**：
| 值 | 解析方式 | 适用场景 |
|---|---------|---------|
| `"node"` | 按 Node.js 规则解析（`node_modules/`、`package.json` 的 `main` 字段） | 传统 Node.js 项目 |
| `"bundler"` | 按打包工具（Webpack/Vite）规则解析 | Vite/Webpack 项目 |
| `"node16"` / `"nodenext"` | Node.js 16+ 的 ESM 规则 | 纯 Node.js ESM 项目 |

**本项目用 `bundler` 的原因**：
- Vite 的模块解析规则和 Node.js 不同（比如支持 `.ts` 文件直接 import，不需要 `.js` 后缀）
- `bundler` 模式让 TypeScript 的类型检查和 Vite 的实际行为保持一致

> **新人小结：moduleResolution 和 module 的关系**
>
> - `module` 决定**生成**什么格式的模块代码
> - `moduleResolution` 决定**解析**（找到）导入的模块用什么规则
>
> 简单类比：
> - `module` = 你写信用什么语言写（中文/英文）
> - `moduleResolution` = 邮局用什么规则送信（国内快递/国际快递）

### 3.7 `allowImportingTsExtensions`: `true`

**含义**：允许在 `import` 语句中直接写 `.ts` 或 `.tsx` 后缀，不需要写 `.js`。

**对比**：

```typescript
// 不允许时（需要手动写 .js 后缀）
import App from './App.js';        // TypeScript 会报错，因为文件实际是 .tsx

// 允许时（直接写 .tsx）
import App from './App';           // TypeScript 自动找到 App.tsx
import App from './App.tsx';      // 明确写 .tsx 也可以
```

**为什么需要**：Vite 和现代打包工具支持直接 import `.ts`/`.tsx` 文件，不需要像传统方式那样 import `.js`。

> **新人小结：这是 Vite 项目的标准配置**
>
> 如果你用 Webpack，可能不需要这个选项（Webpack 默认就能解析 `.ts`）。但 Vite 需要明确告诉 TypeScript"允许直接 import ts 文件"。

### 3.8 `resolveJsonModule`: `true`

**含义**：允许在 `import` 中直接导入 JSON 文件。

```typescript
// 设为 true 后，以下代码合法：
import config from './config.json';
console.log(config.version);  // TypeScript 知道 config 有 version 属性

// 设为 false（默认），以下代码会报错：
// Error: Cannot find module './config.json' or its corresponding type declarations.
```

### 3.9 `isolatedModules`: `true`

**含义**：[每个文件独立编译，不依赖其他文件的信息](文件解析-04.01-tsconfig.main.json（isolatedModules）.md)。

**为什么需要**：Vite 使用 **esbuild**（Rust 编写的极速编译器）来做实际的代码转换。esbuild 是逐文件编译的，不知道其他文件的信息。如果 TypeScript 配置允许跨文件分析（如类型推断），esbuild 编译出来的代码可能和 TypeScript 类型检查的结果不一致。

设为 `true` 后，TypeScript 会避免需要跨文件信息的检查，确保和 esbuild 的行为一致。

> **新人小结：这是 Vite + TypeScript 项目的必配项**
>
> 如果你用 Vite 但不设 `isolatedModules: true`，可能会出现"TypeScript 不报错，但运行时出错"的情况。因为 Vite 的编译器（esbuild）和 TypeScript 的检查器（tsc）做了不同的事情。

### 3.10 `noEmit`: `true`

**含义**：TypeScript 编译器**不输出**任何文件。只做类型检查，不生成 JavaScript。

**为什么**：在这个项目中，渲染进程的代码**不是**由 `tsc` 编译的，而是由 **Vite** 编译的。`tsc` 只用来做**类型检查**（在 IDE 中提供智能提示和错误高亮），不实际生成代码。

```
你的 .tsx 文件
      │
      ├──▶ tsc (noEmit: true)  →  只做类型检查，不输出文件  →  IDE 显示错误/警告
      │
      └──▶ Vite (esbuild + swc) →  实际编译成 JavaScript  →  输出到 dist/renderer/
```

> **新人小结：noEmit 是"只检查不编译"的模式**
>
> 想象你在检查作业：
> - `noEmit: true` = 老师只批改（指出错误），不重写答案
> - `noEmit: false` = 老师不仅批改，还帮你把答案重写一遍
>
> 本项目中，Vite 是"帮你重写答案"的人，`tsc` 是"只批改"的老师。

### 3.11 `jsx`: `"react-jsx"`

**含义**：告诉 TypeScript 如何处理 JSX 语法（`<div className="xxx">`）。

**可选值**：

| 值 | 处理方式 | 需要手动 import React 吗 |
|---|---------|----------------------|
| `"react"` | 使用 `React.createElement()` | 需要 `import React from 'react'` |
| `"react-jsx"` | 使用自动注入的 `jsx()` 函数 | **不需要** |
| `"react-native"` | React Native 专用 | 需要 |

**为什么选 `react-jsx`**：这是 React 17+ 推荐的方式。不需要在每文件顶部写 `import React from 'react'`，因为 JSX 编译器会自动注入 `jsx` 函数。

```typescript
// react-jsx 模式下，以下代码不需要 import React：
function App() {
  return <div>Hello</div>;  // ✅ 自动注入 jsx 函数
}

// react 模式下，必须 import React：
import React from 'react';  // ❌ 不 import 会报错
function App() {
  return <div>Hello</div>;
}
```

> **新人小结：为什么 React 17 之后不需要 import React 了？**
>
> 在 React 16 及以前，写 `<div>` 会被翻译成 `React.createElement('div')`，所以必须 import React。
>
> React 17 引入了**新的 JSX 编译方式**，把 `<div>` 翻译成 `jsx('div', null)`，这个 `jsx` 函数由 Vite/Babel 自动注入，不再需要手动 import React。
>
> 这看起来是个小变化，但实际上减少了每个文件顶部的 boilerplate 代码。

### 3.12 `strict`: `true`

**含义**：开启所有严格类型检查。

**包含的检查**：
- `strictNullChecks`：`null` 和 `undefined` 是独立的类型，不能随意赋值
- `strictFunctionTypes`：函数参数类型严格检查
- `strictBindCallApply`：`bind`/`call`/`apply` 的类型检查
- `strictPropertyInitialization`：类属性必须在构造函数中初始化
- `noImplicitAny`：不能隐式使用 `any` 类型
- `noImplicitThis`：`this` 的类型必须明确

> **新人小结：strict: true 是"对自己狠一点"**
>
> 很多老项目为了快速上线，设 `strict: false`，结果积累了大量 `any` 类型，代码越来越难维护。
>
> 新项目建议直接 `strict: true`。刚开始可能会遇到很多报错，但修完这些报错后，代码的质量会大幅提升。
>
> **类比**：就像学开车，先学严格的安全规范（系安全带、看后视镜），养成习惯后即使不刻意遵守，安全也会成为本能。

### 3.13 `noUnusedLocals`: `true`

**含义**：如果定义了变量但没使用，TypeScript 会报错。

```typescript
const unusedVariable = 123;  // ❌ Error: 'unusedVariable' is declared but its value is never read.
const usedVariable = 456;    // ✅ OK
```

### 3.14 `noUnusedParameters`: `true`

**含义**：如果函数参数定义了但没使用，TypeScript 会报错。

```typescript
function greet(name: string, age: number) {  // ❌ 'age' is declared but its value is never read.
  console.log(`Hello, ${name}`);
}

function greet(name: string, _age: number) { // ✅ OK（用 _ 前缀表示"故意不用"）
  console.log(`Hello, ${name}`);
}
```

> **新人小结：这两个选项是"代码洁癖"的体现**
>
>  unused 的变量和参数说明代码有冗余，可能是：
> 1. 复制粘贴遗留的
> 2. 暂时注释掉的代码
> 3. 逻辑错误（以为用了其实没用到）
>
> 开启这两个检查可以强制清理这些冗余代码。

### 3.15 `noFallthroughCasesInSwitch`: `true`

**含义**：`switch` 语句中每个 `case` 必须有 `break`，否则报错。

```typescript
switch (value) {
  case 1:
    console.log('one');
    // 缺少 break → ❌ Error: This clause can't follow this one.
  case 2:
    console.log('two');
    break;
}
```

### 3.16 `baseUrl`: `"."`

**含义**：TypeScript 解析路径别名的**基准目录**。`"."` 表示项目根目录。

### 3.17 `paths`: `{"@/*": ["src/renderer/*"]}`

**含义**：定义**路径别名**，让 import 语句可以用简短的路径。

**使用方式**：

```typescript
// 不用别名（需要写相对路径，层级深时很长）
import Sidebar from '../../../components/Sidebar';

// 用别名（简洁清晰）
import Sidebar from '@/components/Sidebar';
```

**生效流程**：

```
import Sidebar from '@/components/Sidebar'
                    │
                    ▼
TypeScript 读取 paths 配置: "@/*" → "src/renderer/*"
                    │
                    ▼
实际解析为: import Sidebar from 'src/renderer/components/Sidebar'
                    │
                    ▼
找到文件: src/renderer/components/Sidebar.tsx ✅
```

> **新人小结：路径别名是"代码的快捷方式"**
>
> 想象你的公司大楼有很多层，每次去 5 楼都要走"1楼→2楼→3楼→4楼→5楼"。路径别名就像电梯——直接按"5"就到。
>
> `@` 通常代表"项目源码根目录"（在 Vite 中也是默认别名）。其他常见别名：
> - `@/` → 源码根目录
> - `@components/` → 组件目录
> - `@utils/` → 工具函数目录
> - `@types/` → 类型定义目录

### 3.18 `include`: `["src/renderer/**/*.ts", "src/renderer/**/*.tsx"]`

**含义**：告诉 TypeScript 编译器**只检查这些文件**。

```
src/renderer/
├── main.tsx          ← ✅ 会被检查（匹配 *.tsx）
├── App.tsx           ← ✅ 会被检查
├── index.css         ← ❌ 不会被检查（不是 .ts/.tsx）
├── components/
│   ├── Sidebar.tsx   ← ✅ 会被检查
│   └── Sidebar.css   ← ❌ 不会被检查
└── ...
```

**为什么只包含 `src/renderer/`**：因为主进程代码（`src/main/`）有独立的 tsconfig（`tsconfig.main.json`），不需要在这个配置中重复检查。

> **新人小结：include 和 exclude 是互补的**
>
> - `include` = "只检查这些文件"（白名单）
> - `exclude` = "不检查这些文件"（黑名单）
> - 如果只写了 `include`，只有匹配的文件会被检查
> - 如果只写了 `exclude`，除了排除的文件，其他所有文件都会被检查
>
> 本项目用了 `include`（白名单模式），更精确。

---

## 四、完整生效流程图

```
开发者在 VS Code 中编写代码
        │
        ▼
VS Code 调用 tsc 进行类型检查（后台，不输出文件）
        │
        ▼
读取 tsconfig.json
        │
        ├── target: ES2020        → 生成 ES2020 兼容的 JS（实际不生成，只检查）
        ├── lib: ES2020 + DOM     → 允许使用 document/window 等 API
        ├── module: ESNext        → 支持 import/export 语法
        ├── jsx: react-jsx        → 支持 <div>  JSX 语法
        ├── strict: true          → 严格类型检查
        ├── noUnusedLocals: true  → 检查未使用的变量
        ├── paths: @/*            → 解析 @ 路径别名
        ├── include: src/renderer/**  → 只检查渲染进程文件
        └── noEmit: true          → 不输出文件，只做检查
        │
        ▼
TypeScript 检查通过 → VS Code 不显示错误（绿色对勾）
TypeScript 检查失败 → VS Code 显示红色波浪线和错误提示
```

---

## 五、常见配置错误

| 错误配置 | 后果 | 修复 |
|---------|------|------|
| 忘记加 `DOM` 到 `lib` | `document`、`window` 报类型错误 | 添加 `"DOM"` 到 lib 数组 |
| `strict: false` | 大量 `any` 类型，失去类型检查意义 | 改为 `true`，逐个修复报错 |
| `noEmit: false` | tsc 会生成 JS 文件覆盖 Vite 的输出 | 保持 `true`，让 Vite 负责编译 |
| 忘记配 `paths` | `@/` 别名无法解析，IDE 报红 | 添加 `baseUrl` 和 `paths` |
| `include` 范围太大 | 检查主进程文件导致类型冲突（main 中有 Node.js API） | 只包含 `src/renderer/` |

---

## 六、与 tsconfig.main.json 的对比

本项目有**两个** TypeScript 配置文件，它们的差异反映了主进程和渲染进程的不同需求：

| 配置项 | tsconfig.json（渲染进程） | tsconfig.main.json（主进程） | 差异原因 |
|--------|------------------------|---------------------------|---------|
| `target` | ES2020 | ES2020 | 相同，都兼容现代环境 |
| `lib` | ES2020 + DOM + DOM.Iterable | 仅 ES2020 | 渲染进程需要 DOM API，主进程不需要 |
| `module` | ESNext | commonjs | 渲染进程用 Vite（ESM），主进程用 Node.js（CJS） |
| `jsx` | react-jsx | 不设置 | 只有渲染进程有 JSX |
| `noEmit` | true | false（默认） | 渲染进程由 Vite 编译，主进程由 tsc 编译 |
| `outDir` | 不设置 | dist/main | 主进程需要指定输出目录 |
| `rootDir` | 不设置 | src/main | 主进程需要指定源码根目录 |
| `declaration` | 不设置 | true | 主进程生成类型声明文件 |
| `include` | src/renderer/** | src/main/** | 各自只检查自己的文件 |

> **新人小结：为什么需要两个 tsconfig？**
>
> 因为主进程和渲染进程的**运行环境完全不同**：
> - 渲染进程 = 浏览器环境 → 需要 DOM、ES Module、JSX
> - 主进程 = Node.js 环境 → 需要 CommonJS、Node.js API、不需要 DOM
>
> 如果共用一个 tsconfig，要么渲染进程缺少 DOM 类型，要么主进程多了不必要的 DOM 类型（可能导致误用浏览器 API）。

---

## 七、总结

`tsconfig.json` 是 TypeScript 项目的**编译器说明书**。理解它的关键是记住三个核心概念：

1. **`target` + `lib`** = 代码能用什么语法和 API
2. **`module` + `moduleResolution`** = 代码怎么组织模块、怎么找模块
3. **`include` + `paths`** = 检查哪些文件、怎么简化路径

> **给新人的建议**：遇到 TypeScript 报错时，第一反应是检查 `tsconfig.json` 的配置是否正确。很多"莫名其妙"的报错其实是配置问题，不是代码问题。
