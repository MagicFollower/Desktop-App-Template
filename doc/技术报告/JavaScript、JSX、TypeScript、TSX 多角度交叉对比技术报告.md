创建时间：2026年9月5日10:37:38

---

# JavaScript / JSX / TypeScript / TSX 多角度交叉对比技术报告

> **文档类型**：内部技术参考文档
> **读者定位**：前端开发团队成员（含零基础新人）
> **编写视角**：资深前端工程师
> **涉及项目**：desktop-app-template（Electron + React + TypeScript + Vite）


## 目录

- [一、设计背景](#一设计背景)
- [二、基础概念与定义](#二基础概念与定义)
- [三、两两对比分析](#三两两对比分析)
- [四、多维度交叉对比](#四多维度交叉对比)
- [五、编译与工具链](#五编译与工具链)
- [六、使用场景与选型指南](#六使用场景与选型指南)
- [七、最佳实践](#七最佳实践)


# 一、设计背景

## 1.1 从 JavaScript 到 TypeScript 的演进

JavaScript 由 Brendan Eich 于 1995 年在十天之内创造，最初定位为“让网页动起来的脚本语言”。它凭借**动态类型、灵活性和“write once, run anywhere”**的特性，迅速成为 Web 开发的核心语言。

然而，随着 Web 应用从“页面”进化为“应用”，JavaScript 的固有弱点开始显现：

| 弱点 | 具体表现 |
|------|---------|
| **动态类型** | 变量类型在运行时才能确定，错误只能在运行时被发现 |
| **缺乏编译时检查** | 类型相关的错误无法在开发阶段提前发现 |
| **大型项目维护困难** | 代码重构困难，可维护性差 |

2012 年，微软发布了 **TypeScript**——JavaScript 的超集，通过引入**可选的静态类型系统**来解决 JavaScript 在大型项目中的维护难题。

> **💡 认知桥接**
>
> JavaScript 是一把**万能瑞士军刀**——轻便灵活，什么都能干，但干精细活时容易失误。TypeScript 则是在这把刀上加装了**激光定位系统**——你切东西时能精确知道切在哪里、切多深，失误大幅减少，但刀本身变重了一点，学习使用也需要时间。

## 1.2 从 HTML 模板到 JSX 的演进

在 React 出现之前，前端界面的构建方式主要有两种：
- **纯 HTML + 字符串拼接**：手动拼接 HTML 字符串，极易出错且难以维护
- **模板引擎**（如 Handlebars、Mustache）：将 HTML 与逻辑分离，但表达能力有限

2013 年，React 团队引入了 **JSX**（JavaScript XML）——一种 JavaScript 的语法扩展，允许开发者在 JavaScript 文件中书写类似 HTML 的标签。

JSX 的核心思想是：**UI 的渲染逻辑和视图应该在同一个地方维护**，而不是分离在模板和脚本中。

## 1.3 JSX 与 TypeScript 的交汇

随着 TypeScript 的普及，React 开发者希望同时享受 JSX 的声明式 UI 和 TypeScript 的类型安全。2015 年左右，TypeScript 正式支持 JSX 语法，催生了 **TSX**（TypeScript XML）——TypeScript 与 JSX 的结合体。

**TSX = TypeScript + JSX**：在 TypeScript 的基础上，支持 React 的 JSX 语法。

---

# 二、基础概念与定义

## 2.1 四种文件类型总览

| 文件后缀 | 全称 | 本质 | 核心特征 |
|---------|------|------|---------|
| **.js** | JavaScript | 基础脚本语言 | 动态类型，直接在浏览器/Node.js 运行 |
| **.jsx** | JavaScript XML | JavaScript + React 语法扩展 | 允许在 JS 中写 HTML 标签，需编译 |
| **.ts** | TypeScript | JavaScript 的超集 | 增加静态类型系统，需编译为 JS |
| **.tsx** | TypeScript XML | TypeScript + React 语法扩展 | TS 的基础上支持 JSX 语法 |

## 2.2 四种文件的关系图谱

```
                    ┌─────────────────────────────┐
                    │    JavaScript (.js)         │
                    │    基础脚本语言              │
                    │    动态类型，直接运行        │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   JSX (.jsx)    │  │  TypeScript     │  │   其他扩展      │
    │  JS + React语法 │  │   (.ts)         │  │  (如 .vue)      │
    │  需编译         │  │  JS + 类型系统  │  │                 │
    └────────┬────────┘  │  需编译         │  └─────────────────┘
             │           └────────┬────────┘
             │                    │
             └────────┬───────────┘
                      │
                      ▼
           ┌─────────────────────────┐
           │    TSX (.tsx)           │
           │  TypeScript + React语法 │
           │  类型安全 + 声明式 UI   │
           └─────────────────────────┘
```

**基础关系**：`.js` 是基础 → `.jsx` 是 `.js` 的 React 扩展 → `.ts` 是 `.js` 的类型增强版 → `.tsx` 是 `.ts` 的 React 扩展。

## 2.3 JavaScript (.js) 详解

**定义**：JavaScript 是一种轻量级的、解释型的编程语言，是 Web 开发中最基础的语言之一。

**核心特征**：
- **动态类型**：变量类型在运行时确定
- **解释执行**：无需编译，直接在浏览器或 Node.js 中运行
- **多范式**：支持面向对象、函数式、命令式等多种编程范式
- **通用性最强**：所有 JavaScript 环境都能直接运行

**优点**：
- 学习曲线低，容易入门
- 生态系统成熟，社区支持强大
- 灵活性高，支持多种编程范式
- 无需编译，开发周期短

**缺点**：
- 类型系统不完善，容易出现类型相关的运行时错误
- 大型项目中代码可维护性差
- 没有编译时检查，错误只能在运行时发现
- 代码重构困难

## 2.4 JSX (.jsx) 详解

**定义**：JSX 是 JavaScript 的语法扩展，允许你在 JavaScript 文件中书写类似 HTML 的标签。

**核心特征**：
- **语法扩展**：不是独立的语言，而是 JavaScript 的语法糖
- **声明式 UI**：用类似 HTML 的语法描述界面结构
- **需编译**：JSX 最终被编译为 `React.createElement` 调用
- **与 React 绑定**：主要用于 React 生态

**JSX 的本质**：

```jsx
// 开发者编写的 JSX
const element = <h1 className="greeting">Hello, world!</h1>;

// 编译后变成
const element = React.createElement(
  'h1',
  { className: 'greeting' },
  'Hello, world!'
);
```

JSX 不是模板语言，而是 JavaScript 表达式——编译后成为普通的 JavaScript 函数调用。

> **💡 认知桥接**
>
> JSX 就像是在 JavaScript 里**“画”HTML**。你不是在写字符串模板，而是在用 JavaScript 的数据结构直接描述界面。这就像建筑师用图纸（JSX）描述建筑，施工队（React）根据图纸盖房子，而不是让施工队边听口头描述边盖。

**优点**：
- 提供了声明式的视图层开发方式
- 可以直观地描述 UI 结构
- 与 React 完美集成
- 支持 JavaScript 表达式嵌入
- 有助于防止 XSS 攻击（默认转义）

**缺点**：
- 需要编译转换
- 仍然缺乏类型检查
- 学习曲线比纯 JavaScript 略陡
- 依赖于 React 生态系统

## 2.5 TypeScript (.ts) 详解

**定义**：TypeScript 是 JavaScript 的一个超集，添加了可选的静态类型和基于类的面向对象编程。

**核心特征**：
- **JavaScript 的超集**：所有合法的 JS 代码在 TS 中也合法
- **静态类型系统**：在编译时进行类型检查
- **需编译**：TypeScript 代码需要编译为 JavaScript 才能运行
- **渐进式采用**：可以逐步将 JS 项目迁移到 TS

**TypeScript 与 JavaScript 的核心区别**：

| 维度 | JavaScript | TypeScript |
|------|-----------|------------|
| **类型系统** | 动态类型，运行时确定 | 静态类型，编译时检查 |
| **类型检查时机** | 运行时 | 编译时 |
| **错误发现** | 运行时才能发现 | 开发阶段即可发现 |
| **代码可维护性** | 大型项目较差 | 显著提升 |
| **IDE 支持** | 基础 | 强大的自动补全和错误提示 |

**微软的研究数据**：TypeScript 在编译阶段可以捕获 **15%-38%** 的运行时错误。

## 2.6 TSX (.tsx) 详解

**定义**：TSX 是 TypeScript 的一个扩展，允许在 TypeScript 文件中嵌入 JSX 语法。

**核心特征**：
- **TSX = TypeScript + JSX**：同时拥有类型系统和声明式 UI
- **类型安全的 React 组件**：为 React 组件的 props 和 state 提供类型检查
- **需编译**：TSX 需要编译为 JavaScript 才能运行
- **严格模式**：.ts 文件不支持 `<div>` 这类 HTML 语法，必须使用 .tsx

> **💡 认知桥接**
>
> TSX 可以理解为 JSX 的**“带装甲版”**。JSX 让你能用 HTML 语法写 UI，TSX 在此基础上给每个标签、每个属性、每个变量都装上了**类型装甲**——编辑器能实时告诉你“这个属性拼错了”“这个值类型不对”，让你在写代码时就发现问题，而不是等运行时崩溃。

---

# 三、两两对比分析

## 3.1 JavaScript vs TypeScript

这是四种文件类型中最根本的对比——**动态类型 vs 静态类型**。

| 对比维度 | JavaScript | TypeScript |
|---------|-----------|------------|
| **类型检查** | 运行时 | 编译时 |
| **错误发现** | 运行时 | 开发阶段 |
| **IDE 支持** | 基础 | 强大（自动补全、重构） |
| **学习曲线** | 低 | 中高 |
| **适用项目** | 小型、快速原型 | 中大型、团队协作 |
| **编译步骤** | 无需编译 | 需要编译为 JS |
| **代码量** | 较少 | 略多（需类型定义） |

**代码对比**：

```javascript
// JavaScript - 动态类型，运行时才能发现问题
function greet(user) {
  return `Hello, ${user.name}!`;
}

const result = greet(123);  // 不会报错，但运行时输出 "Hello, undefined!"
```

```typescript
// TypeScript - 静态类型，编译时就能发现问题
interface User {
  name: string;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

const result = greet(123);  // ❌ TypeScript 编译报错：类型“number”不能赋值给类型“User”
```

## 3.2 JavaScript vs JSX

这是“基础语言”与“语法扩展”的对比：

| 对比维度 | JavaScript (.js) | JSX (.jsx) |
|---------|-----------------|------------|
| **语法** | 标准 JS 语法 | JS + XML-like 标签 |
| **HTML 支持** | 需字符串拼接 | 原生支持 HTML 标签 |
| **编译需求** | 无需编译 | 需要编译（Babel/Webpack） |
| **使用场景** | 通用 | React 组件开发 |
| **文件后缀** | .js | .jsx |

**重要说明**：在实际使用中，`.js` 和 `.jsx` 的后缀**可以互换，语法上也完全兼容**。React 团队曾建议统一使用 `.js` 即可，无需特意区分。但业界逐渐形成了用 `.jsx` 明确标识“此文件包含 JSX 语法”的惯例。

## 3.3 TypeScript vs TSX

这是“类型系统”与“类型系统 + UI 语法”的对比：

| 对比维度 | TypeScript (.ts) | TSX (.tsx) |
|---------|------------------|------------|
| **语法** | TypeScript 标准语法 | TS + JSX 语法 |
| **JSX 支持** | ❌ 不支持 | ✅ 支持 |
| **HTML 标签** | ❌ 报错 | ✅ 支持 |
| **IDE 提示** | 基础 TS 提示 | 完整的 React + TS 提示 |
| **使用场景** | 纯逻辑、工具函数、类型定义 | React 组件 |

**核心原则**：
- 辅助函数、API 服务、类型定义等非 UI 逻辑 → 使用 `.ts`
- React 组件 → 必须使用 `.tsx`

## 3.4 JSX vs TSX

这是“无类型 UI”与“有类型 UI”的对比，也是 React 项目中最常见的选型抉择：

| 对比维度 | JSX (.jsx) | TSX (.tsx) |
|---------|-----------|------------|
| **类型安全** | 无类型检查 | 完整的 TypeScript 类型检查 |
| **错误发现** | 运行时 | 编译时 |
| **代码可维护性** | 大型项目难以维护 | 类型注解使代码更清晰 |
| **开发速度** | 快速原型 | 初期略慢，长期更快 |
| **学习曲线** | 低 | 中高 |
| **适用项目** | 小型、原型 | 大型、企业级 |

**代码对比**：

```jsx
// JSX - 无类型检查，错误在运行时才能发现
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}

// 使用时传入错误类型
<Welcome name={123} />  // 不会报错，但渲染出 "Hello, 123"
```

```tsx
// TSX - 有类型检查，错误在编译时就能发现
interface WelcomeProps {
  name: string;
}

const Welcome: React.FC<WelcomeProps> = ({ name }) => {
  return <h1>Hello, {name}</h1>;
};

// 使用时传入错误类型
<Welcome name={123} />  // ❌ TypeScript 编译报错
```

---

# 四、多维度交叉对比

## 4.1 综合对比总表

| 维度 | .js | .jsx | .ts | .tsx |
|------|-----|------|-----|------|
| **本质** | 基础脚本语言 | JS + React 语法 | JS + 类型系统 | TS + React 语法 |
| **类型系统** | 动态 | 动态 | 静态 | 静态 |
| **类型检查** | 运行时 | 运行时 | 编译时 | 编译时 |
| **JSX 支持** | ❌ | ✅ | ❌ | ✅ |
| **直接运行** | ✅ | ❌ | ❌ | ❌ |
| **需编译** | ❌ | ✅（Babel/Webpack） | ✅（tsc） | ✅（tsc + Babel） |
| **学习曲线** | 低 | 中 | 中高 | 高 |
| **IDE 支持** | 基础 | 基础 | 强大 | 强大 |
| **代码可维护性** | 差（大型项目） | 差 | 好 | 好 |
| **适用场景** | 通用 | React 组件 | 逻辑/工具/类型 | React 组件 |

## 4.2 技术栈维度对比

| 技术栈 | 推荐文件类型 | 原因 |
|--------|------------|------|
| **纯 JavaScript 项目** | .js | 无需额外工具，直接运行 |
| **React + JavaScript** | .jsx | 明确标识包含 JSX 语法 |
| **纯 TypeScript 项目** | .ts | 类型安全，无 UI 逻辑 |
| **React + TypeScript** | .tsx | 类型安全 + JSX 支持 |
| **Node.js + TypeScript** | .ts | 服务端通常不需要 JSX |
| **Vue + TypeScript** | .ts / .vue | Vue 使用 SFC 模板，较少用 TSX |

## 4.3 编译工具链维度对比

| 文件类型 | 常用编译器 | 编译速度 | 生态成熟度 |
|---------|-----------|---------|-----------|
| **.js** | 无需编译（或 Babel） | 最快 | 最成熟 |
| **.jsx** | Babel、esbuild、SWC | 快 | 非常成熟 |
| **.ts** | tsc、esbuild、SWC | 中-快 | 成熟 |
| **.tsx** | tsc、esbuild、SWC | 中-快 | 成熟 |

**编译速度对比**（基于社区基准测试）：

| 工具 | 相对速度 | 适用文件 |
|------|---------|---------|
| **esbuild** | 最快 | .js/.jsx/.ts/.tsx |
| **SWC** | 非常快 | .js/.jsx/.ts/.tsx |
| **tsc**（仅转译） | 较慢 | .ts/.tsx |
| **Babel** | 最慢 | .js/.jsx |

> **💡 认知桥接**
>
> 如果把代码编译比作**做菜**：Babel 是**手工切菜**（精细但慢），tsc 是**用菜刀切**（中等），SWC 是**用专业切片机**（快很多），esbuild 是**工业级食品加工线**（极快）。esbuild 和 SWC 比 Babel 快 **50-100 倍**。

## 4.4 项目规模维度对比

| 项目规模 | 推荐方案 | 理由 |
|---------|---------|------|
| **小型项目/原型** | .js / .jsx | 快速开发，避免 TS 学习成本 |
| **中型 React 项目** | .jsx 或 .tsx | 根据团队 TS 经验决定 |
| **大型/企业级项目** | .tsx | 类型安全提升可维护性 |
| **团队协作项目** | .tsx | 类型一致性降低沟通成本 |
| **长期维护项目** | .tsx | 类型注解使重构更安全 |

---

# 五、编译与工具链

## 5.1 JSX 的编译原理

JSX 本质上是一种**语法糖**——它最终会被编译为普通的 JavaScript 函数调用。

**编译前**（JSX）：
```jsx
const element = <h1 className="greeting">Hello, world!</h1>;
```

**编译后**（JavaScript）：
```javascript
const element = React.createElement(
  'h1',
  { className: 'greeting' },
  'Hello, world!'
);
```

不同的 JSX 转换模式：

| 模式 | 配置值 | 输出 |
|------|--------|------|
| **Classic**（React 16 及之前） | `"react"` | `React.createElement` |
| **Automatic**（React 17+） | `"react-jsx"` | `import { jsx } from 'react/jsx-runtime'` |
| **Preserve** | `"preserve"` | 保留 JSX，由后续工具处理 |

## 5.2 TypeScript 中的 JSX 配置

在 TypeScript 项目中使用 JSX/TSX，需要在 `tsconfig.json` 中配置 `jsx` 选项：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",        // React 17+ 自动 runtime
    "jsxImportSource": "react" // JSX 工厂的导入源
  }
}
```

**jsx 选项的五个值**：
- `"preserve"`：保留 JSX 语法，由后续工具处理
- `"react"`：转换为 `React.createElement`（React 16 风格）
- `"react-jsx"`：使用新的 JSX transform（React 17+ 风格）
- `"react-jsxdev"`：开发模式下的新 JSX transform
- `"react-native"`：保留 JSX，用于 React Native

## 5.3 现代构建工具中的 JSX/TSX 处理

| 构建工具 | JSX/TSX 处理方式 | 特点 |
|---------|-----------------|------|
| **Vite** | esbuild（开发）+ Rollup（生产） | 极速 HMR |
| **Next.js** | SWC（默认） | 集成度高 |
| **Webpack** | babel-loader / ts-loader | 生态最丰富 |
| **esbuild** | 原生支持 | 速度最快 |
| **SWC** | 原生支持 | 速度快，可扩展 |

## 5.4 Bun 中的文件类型处理

Bun 对四种文件类型有明确的默认加载器：

| 文件后缀 | Bun 加载器 | 处理方式 |
|---------|-----------|---------|
| `.cjs` / `.mjs` | `js` | 标准 JavaScript |
| `.js` / `.jsx` | `jsx` | JavaScript + JSX 支持 |
| `.tsx` | `tsx` | TypeScript + JSX 转译 |

---

# 六、使用场景与选型指南

## 6.1 选型决策树

```
开始
  │
  ├─ 项目是否需要类型安全？
  │    ├─ 否 → 使用 .js / .jsx
  │    └─ 是 → 使用 .ts / .tsx
  │
  ├─ 项目是否使用 React（或需要 JSX）？
  │    ├─ 否 → 使用 .js / .ts
  │    └─ 是 → 使用 .jsx / .tsx
  │
  ├─ 项目规模和团队情况？
  │    ├─ 小型项目 / 快速原型 → .jsx
  │    ├─ 中型项目 → .jsx 或 .tsx
  │    └─ 大型项目 / 团队协作 → .tsx
  │
  └─ 文件具体用途？
       ├─ React 组件 → .jsx 或 .tsx
       └─ 工具函数 / API / 类型定义 → .js 或 .ts
```

## 6.2 具体场景推荐

### 场景一：快速原型 / 个人项目
**推荐**：`.js` 或 `.jsx`
**理由**：快速迭代，无需额外编译配置，学习成本最低

### 场景二：中型 React 项目（团队熟悉 JS）
**推荐**：`.jsx`
**理由**：享受 JSX 的声明式 UI，避免 TypeScript 的学习成本

### 场景三：大型 React 项目 / 企业级应用
**推荐**：`.tsx`
**理由**：类型安全减少运行时错误，提升代码可维护性

### 场景四：React + TypeScript 项目
**推荐**：`.tsx`（组件）+ `.ts`（逻辑/工具）
**理由**：组件用 TSX 享受类型安全的 UI 开发，纯逻辑用 TS 保持简洁

### 场景五：纯工具库 / API 服务
**推荐**：`.ts`（如果用 TS）或 `.js`（如果用 JS）
**理由**：无 UI 逻辑，不需要 JSX 支持

## 6.3 针对 desktop-app-template 的建议

基于项目特征（Electron + React + TypeScript + Vite）：

**强烈推荐使用 `.tsx` 作为组件文件格式**：

1. **类型安全**：Electron 应用涉及主进程与渲染进程通信，类型安全能显著减少 IPC 相关的错误
2. **团队协作**：类型注解使组件接口清晰，降低沟通成本
3. **长期维护**：Electron 应用通常是长期项目，TSX 的可维护性优势明显
4. **Vite 原生支持**：Vite + esbuild 对 TSX 的编译速度极快

**文件组织规范**：

```
src/
├── components/
│   └── Button/
│       ├── index.tsx        ← React 组件（TSX）
│       └── types.ts         ← 组件类型定义（TS）
├── hooks/
│   └── useWindow.ts         ← 自定义 Hook（TS）
├── utils/
│   └── format.ts            ← 工具函数（TS）
├── types/
│   └── global.d.ts          ← 全局类型声明（TS）
└── App.tsx                  ← 根组件（TSX）
```

---

# 七、最佳实践

## 7.1 文件后缀选择规范

| 文件用途 | 推荐后缀 | 说明 |
|---------|---------|------|
| React 组件（含 JSX） | `.tsx` 或 `.jsx` | 明确标识包含 UI 语法 |
| 自定义 Hook | `.ts` 或 `.js` | Hook 本质是函数，不含 JSX |
| 工具函数 | `.ts` 或 `.js` | 纯逻辑 |
| API 服务 | `.ts` 或 `.js` | 纯逻辑 |
| 类型定义 | `.ts`（`.d.ts`） | 类型声明文件 |
| 配置文件 | `.ts` 或 `.js` | 通常不含 JSX |

## 7.2 迁移路径：从 JS 到 TS

如果项目当前使用 `.js`/`.jsx`，希望迁移到 `.ts`/`.tsx`：

```
阶段一：启用 TypeScript
  ├─ 安装 TypeScript：npm install typescript --save-dev
  ├─ 创建 tsconfig.json（允许 JS：allowJs: true）
  └─ 逐步将 .js 重命名为 .ts（暂不修改内容）
        ↓
阶段二：添加类型
  ├─ 为工具函数添加类型注解
  ├─ 为组件 props 定义 interface
  └─ 运行 tsc --noEmit 检查类型错误
        ↓
阶段三：完全迁移
  ├─ 将所有 .jsx 重命名为 .tsx
  ├─ 移除 allowJs: true
  └─ 享受完整的类型安全
```

## 7.3 常见陷阱与注意事项

| 陷阱 | 说明 | 解决方案 |
|------|------|---------|
| **.ts 中使用 JSX** | .ts 文件不支持 `<div>` 语法 | React 组件必须使用 `.tsx` |
| **类型定义缺失** | 第三方库可能没有类型定义 | 安装 `@types/` 包或自己声明 |
| **过度类型化** | 为简单值添加过于复杂的类型 | 利用 TypeScript 的类型推断 |
| **编译与类型检查分离** | Vite 用 esbuild 编译，tsc 做类型检查 | 配置 `isolatedModules: true` |

## 7.4 团队协作规范

1. **统一文件后缀规范**：团队达成一致，组件用 `.tsx`，逻辑用 `.ts`
2. **启用严格模式**：`tsconfig.json` 中设置 `"strict": true`
3. **CI 中强制类型检查**：在 CI 流水线中运行 `tsc --noEmit`
4. **代码审查关注类型**：确保 props 和 state 有完整的类型定义


## 总结

四种文件类型（`.js`、`.jsx`、`.ts`、`.tsx`）构成了现代前端开发的**技术光谱**，从“最灵活”到“最安全”依次排列：

| 文件类型 | 定位 | 核心价值 |
|---------|------|---------|
| **.js** | 基础语言 | 通用性最强，零编译，直接运行 |
| **.jsx** | React UI 语法 | 声明式 UI，直观描述界面结构 |
| **.ts** | 类型安全逻辑 | 静态类型检查，提升代码质量 |
| **.tsx** | 类型安全 UI | 类型安全 + 声明式 UI 的完美结合 |

**核心选型原则**：

1. **React 组件必须用 `.jsx` 或 `.tsx`**：`.js` 和 `.ts` 不支持 JSX 语法
2. **大型项目优先 `.tsx`**：类型安全带来的长期收益远超初期学习成本
3. **纯逻辑用 `.ts` 或 `.js`**：不含 UI 逻辑的文件无需 JSX 支持
4. **团队共识比技术选型更重要**：统一规范比“最优方案”更有价值

对于 `desktop-app-template` 项目，**`.tsx` 是 React 组件的最佳选择**，配合 Vite + esbuild 的极速编译，可以在享受类型安全的同时保持高效的开发体验。














END.