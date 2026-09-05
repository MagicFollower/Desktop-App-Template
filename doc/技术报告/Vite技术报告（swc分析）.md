创建时间：2026年9月5日10:33:37

---

# SWC 技术报告

> **文档类型**：内部技术参考文档
> **读者定位**：前端开发团队成员（含零基础新人）
> **编写视角**：资深前端工程师
> **涉及项目**：desktop-app-template（Electron + React + TypeScript + Vite）


## 目录

- [一、设计背景](#一设计背景)
- [二、设计目的](#二设计目的)
- [三、完整技术设计架构](#三完整技术设计架构)
- [四、设计细节](#四设计细节)
- [五、工作原理](#五工作原理)
- [六、工作流程](#六工作流程)
- [七、发展历程](#七发展历程)


# 一、设计背景

要理解 SWC（Speedy Web Compiler）为何成为 Vite 生态中 Babel 的重要替代方案，需要回到前端编译工具链在 2017-2020 年间面临的根本性矛盾。

## 1.1 Babel 时代的成就与局限

Babel 是 JavaScript 生态中**最成功**的编译器之一。它让开发者可以超前使用最新的 JavaScript 语法，通过插件系统将现代代码转换为浏览器兼容的旧版本。

**Babel 的核心价值**：
- 丰富的插件生态（数百个插件、预设）
- 高度可配置，几乎可以覆盖任何转换需求
- 庞大的社区支持和文档积累

**Babel 的固有局限**：

Babel 本身是用 **JavaScript** 编写的，运行在 Node.js 环境中。这带来了三方面的性能瓶颈：

| 瓶颈 | 具体表现 |
|------|---------|
| **解释执行开销** | JavaScript 是解释型语言，即使 V8 引擎有 JIT 优化，编译器本身仍需经历解析、解释、优化的预热过程 |
| **单线程限制** | Node.js 基于单线程事件循环，无法充分利用多核 CPU 的并行计算能力 |
| **垃圾回收压力** | 频繁创建和销毁 AST 节点会触发 GC（垃圾回收），导致不可预测的停顿 |

这些瓶颈在大型项目中尤为突出。以 Next.js 8+ 为例，Webpack + Babel 的构建时间随着代码库增长而急剧膨胀，成为团队日常开发效率的严重制约。

> **💡 认知桥接**
>
> 可以把 Babel 想象成**一位手工精湛的匠人**——他能把任何设计图纸（现代 JS 语法）翻译成施工蓝图（兼容 JS），手艺无可挑剔，但活干得慢。因为他要用"工具"（JavaScript 解释器）先理解"如何使用工具"，然后才能动手。而 SWC 则是一位**自带全套专用机械的工程师**——工具已经提前造好（Rust 原生编译），上手就能干活，还能多人并行施工。

## 1.2 系统编程语言编译器的崛起

2017-2018 年间，Rust 编译器生态逐渐成熟。Deno 等项目已经证明 Rust 能够编写工业级的编译器工具。

与此同时，前端社区开始意识到一个关键趋势：**用系统编程语言（Rust、Go）重写 JavaScript 工具链，可以带来数量级的性能提升**。

- **esbuild**（Go 语言）证明了打包速度可以提升 10-100 倍
- **SWC**（Rust 语言）瞄准的是编译转换（transpilation）环节，即 Babel 的核心领地

## 1.3 SWC 的诞生

2017 年 12 月，韩国开发者 **Donny/강동윤（kdy1）** 在 NAVER 体系下启动了 SWC 项目，定位为"spdy web compiler"。

**SWC 的诞生背景**：
- Babel 的速度瓶颈已成为业界共识
- Rust 语言提供了"零成本抽象"的能力——高级语言特性在编译后不会引入额外的运行时开销
- 前端工具链需要一种新的实现方案，在保持灵活性的同时突破性能天花板

**SWC 的核心设计哲学**，在项目的 AGENTS.md 中被明确写为：**"Write performant code. Always prefer performance over other things."**

## 1.4 SWC 要解决的行业痛点

| 痛点 | Babel 的表现 | SWC 的解法 |
|------|-------------|-----------|
| **编译速度慢** | 大型项目编译需要数十秒甚至数分钟 | Rust 原生编译 + 并行处理，快 20-70 倍 |
| **无法充分利用多核** | Node.js 单线程 | Rust 原生并发，多文件并行编译 |
| **启动延迟** | JIT 预热需要时间 | 预编译二进制，即时启动 |
| **内存占用高** | GC 导致内存波动 | Rust 所有权模型，编译时确定生命周期，无 GC |
| **工具链碎片化** | 需要 Babel + Terser + 各种插件 | 一体化编译 + 压缩 + 打包能力 |


# 二、设计目的

## 2.1 极速的 JavaScript/TypeScript 编译

**目标**：将编译速度提升到 Babel 的 20-70 倍。

**实现方式**：Rust 语言实现 + 多核并行处理 + 优化的解析和代码生成算法。

**核心价值**：开发者的 edit-compile-refresh 循环从"等待"变为"即时"。

## 2.2 一体化的编译能力

**目标**：一个工具覆盖编译、压缩、打包等多个环节。

**实现方式**：统一的 AST 表示，所有转换共享同一份语法树。

**核心价值**：消除工具链碎片化，降低配置和维护成本。

## 2.3 可扩展的插件系统

**目标**：在保持性能的同时，提供类似 Babel 的扩展能力。

**实现方式**：**WASM 插件系统** + 零拷贝序列化（rkyv）。

**核心价值**：将"速度"与"可扩展性"这两个对立面统一起来——插件用 WASM 编写，性能损失可控。

## 2.4 与主流框架的深度集成

**目标**：成为 Next.js、Vite、Parcel、Deno 等工具的默认编译器。

**实现方式**：提供标准化的 JavaScript API（`@swc/core`），被上层工具直接调用。

**核心价值**：开发者无需额外配置，即可享受 SWC 的性能优势。

## 2.5 面向未来的语言特性支持

**目标**：支持最新的 ECMAScript 和 TypeScript 特性。

**实现方式**：持续跟踪 TC39 提案和 TypeScript 版本更新。

**核心价值**：开发者可以放心使用最新的语言特性，无需担心兼容性问题。

## 2.6 开发者体验优先

**目标**：提供清晰、准确的错误信息和调试体验。

**实现方式**：在 Vite 插件中实现特殊错误处理，提取行号和列号信息，在终端中精确定位。

**核心价值**：减少因编译错误导致的调试时间浪费。


# 三、完整技术设计架构

## 3.1 整体架构图

SWC 的架构可分为四层：

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户层（User Layer）                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  @swc/core   │  │  @swc/cli    │  │  @swc/wasm   │         │
│  │  (JS API)    │  │  (命令行)    │  │  (WASM 打包) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          ▼                                     │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Node.js 绑定层（Binding Layer）               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  napi-rs（Node.js 原生模块接口）                         │  │
│  │  - 将 Rust 函数暴露为 JavaScript API                    │  │
│  │  - 处理 JS ↔ Rust 的数据序列化                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Rust 核心层（Core Layer）                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  解析器（Parser）                                        │  │
│  │  - 支持 TypeScript / JSX / 最新 ECMAScript 语法         │  │
│  │  - 生成 AST（抽象语法树）                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  转换器（Transformer）                                   │  │
│  │  - 语法降级（ES2022 → ES5）                            │  │
│  │  - JSX 转换 → React.createElement                       │  │
│  │  - TypeScript 类型擦除                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  压缩器（Minifier）                                      │  │
│  │  - 代码压缩、死代码消除                                  │  │
│  │  - 名称混淆                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  打包器（Bundler）【开发中】                             │  │
│  │  - 依赖解析、模块打包                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Rust 语言运行时                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  - 零成本抽象（Zero-cost abstractions）                 │  │
│  │  - 所有权模型（无 GC，编译时确定生命周期）              │  │
│  │  - 原生并发（多核并行处理）                             │  │
│  │  - LLVM 后端优化（生成高度优化的机器码）                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 核心设计理念

### 3.2.1 Rust 语言的选择

SWC 选择 Rust 而非 Go（esbuild 的选择），有其深层的技术考量：

| 维度 | Rust | Go |
|------|------|-----|
| **内存管理** | 所有权模型，无 GC，编译时确定生命周期 | 垃圾回收，有停顿 |
| **零成本抽象** | 高级语言特性编译后无额外开销 | 有运行时开销 |
| **并发模型** | 无数据竞争的线程安全 | goroutine 轻量并发 |
| **生态系统** | 编译器工具链成熟（rustc、deno 已验证） | 适合网络服务 |
| **适用场景** | 编译器、解析器等底层工具 | CLI 工具、微服务 |

> **💡 认知桥接**
>
> 如果把编译器比作**精密机械**，Rust 就像**数控机床**——精度高、效率高、维护成本低，但需要更专业的设计和制造（学习曲线陡峭）。Go 则像**标准化流水线**——上手快、产出稳定，但在极致精度和效率上略逊一筹。

### 3.2.2 "Scan → Transform → Print" 三阶段

SWC 的编译流程遵循经典的三阶段设计：

| 阶段 | 工作内容 | 特点 |
|------|---------|------|
| **Scan（扫描/解析）** | 源码 → AST | 支持 TS/JSX/现代 JS 语法 |
| **Transform（转换）** | AST → AST | 语法降级、类型擦除、JSX 转换 |
| **Print（输出）** | AST → 代码 | 代码生成、压缩、Source Map |

### 3.2.3 WASM 插件系统

SWC 的插件系统是其区别于 esbuild 的关键设计：

- **插件用 WASM 编写**：任何支持 WASM 的语言都可以编写 SWC 插件
- **零拷贝序列化**：使用 `rkyv` 库在 Rust 和 WASM 之间传递数据，避免序列化开销
- **向后兼容**：从 `@swc/core` v1.15.0 开始，WASM 插件可以向前兼容未来版本

## 3.3 Vite 中 SWC 的定位

在 Vite 生态中，SWC 主要通过 `@vitejs/plugin-react-swc` 插件发挥作用：

```
┌─────────────────────────────────────────────────────────────────┐
│                      Vite 开发服务器                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  默认方案（esbuild）                 SWC 方案（插件）            │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │  依赖预构建              │    │  依赖预构建              │    │
│  │  （esbuild）            │    │  （esbuild，保持不变）   │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │  TS/JSX 编译            │    │  TS/JSX 编译            │    │
│  │  （esbuild）            │───▶│  （SWC）                │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │  React Fast Refresh     │    │  React Fast Refresh     │    │
│  │  （自定义实现）          │    │  （SWC + 自定义注入）   │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │  生产构建               │    │  生产构建               │    │
│  │  （Rollup + esbuild）   │    │  （Rollup + SWC/esbuild）│    │
│  └─────────────────────────┘    └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```


# 四、设计细节

## 4.1 为什么 SWC 比 Babel 快？

SWC 的性能优势来自三个层面：

### 4.1.1 语言层面的根本差异

| 特性维度 | SWC（Rust） | Babel（JavaScript） |
|---------|------------|-------------------|
| **类型系统** | 编译时静态类型检查 | 运行时动态类型推断 |
| **内存管理** | 编译时确定生命周期，无 GC | 自动垃圾回收，有停顿 |
| **优化时机** | 编译时完全优化 | 运行时 JIT 分层优化 |
| **并发模型** | 无数据竞争的线程安全 | 单线程事件循环 |
| **启动时间** | 预编译二进制，即时启动 | 需要解析、解释、JIT 预热 |

**实测数据**：SWC 在单线程上比 Babel 快 **20 倍**，在四核环境下达到 **70 倍**的性能提升。

### 4.1.2 并行处理

Babel 基于 Node.js 的单线程事件循环，无法充分利用多核 CPU。SWC 则可以利用 Rust 的原生并发能力，**同时编译多个文件**。

### 4.1.3 优化的算法实现

SWC 使用优化的算法进行解析和代码生成，进一步提升了速度。其内部实现了 **Atom 内联字符串** 等优化技术，减少内存分配和复制。

## 4.2 SWC 与 esbuild 的对比

SWC 和 esbuild 都是"用系统编程语言重写前端工具链"的代表，但定位不同：

| 对比维度 | SWC | esbuild |
|---------|-----|---------|
| **语言** | Rust | Go |
| **核心定位** | 编译器（Transform）| 打包器（Bundler） |
| **插件系统** | ✅ WASM 插件 | ❌ 有限 |
| **TS/JSX 编译** | ✅ 原生支持 | ✅ 原生支持 |
| **代码压缩** | ✅ 内置 | ✅ 内置 |
| **打包能力** | ⚠️ 开发中 | ✅ 成熟 |
| **生态集成** | Next.js/Vite/Parcel/Deno | Vite（依赖预构建） |
| **学习曲线** | 中（Rust 插件需学习） | 低 |

**关键差异**：esbuild 的强项是**打包**（将整个项目打包成最终产物），而 SWC 的强项是**转换**（将 TypeScript/JSX 编译为 JavaScript）。在 Vite 中，两者各司其职。

## 4.3 Vite 插件的 SWC 集成机制

`@vitejs/plugin-react-swc` 插件的集成机制通过 `transformWithOptions` 函数实现：

**集成步骤**：

1. **文件类型检测**：根据文件扩展名（`.tsx`、`.jsx` 等）确定解析器配置
2. **SWC 选项配置**：设置转换选项，包括目标环境
3. **调用转换**：调用 SWC 的 `transform` 函数
4. **后处理**：处理 Source Map，注入 Fast Refresh 代码

**文件扩展名与解析器映射**：

| 文件扩展名 | 解析器语法 | JSX/TSX | 用途 |
|-----------|-----------|---------|------|
| `.tsx` | typescript | true | TypeScript + JSX |
| `.ts`, `.mts` | typescript | false | TypeScript（无 JSX） |
| `.jsx` | ecmascript | true | JavaScript + JSX |
| `.mdx` | ecmascript | true | Markdown + JSX |

## 4.4 开发模式与生产模式的差异

`@vitejs/plugin-react-swc` 在开发和生产环境中表现不同：

| 特性 | 开发模式 | 生产模式 |
|------|---------|---------|
| **Fast Refresh** | ✅ 启用 | ❌ 不适用 |
| **编译目标** | 可配置（`devTarget`，默认 `es2020`） | 始终为 `esnext` |
| **代码优化** | 开发友好 | 生产优化 |
| **SWC 插件** | 支持 | 需要启用 |

## 4.5 配置选项详解

`@vitejs/plugin-react-swc` 提供的配置选项：

| 选项 | 类型 | 默认值 | 用途 |
|------|------|--------|------|
| `jsxImportSource` | string | `"react"` | 控制 JSX factory 的导入来源 |
| `tsDecorators` | boolean | `false` | 启用 TypeScript 装饰器 |
| `plugins` | array | `undefined` | SWC 插件（如 CSS-in-JS） |
| `devTarget` | string | `"es2020"` | 开发环境的编译目标 |
| `parserConfig` | function | `undefined` | 覆盖默认文件处理配置 |
| `useAtYourOwnRisk_mutateSwcOptions` | function | `undefined` | 直接修改 SWC 选项 |

**重要限制**：
- `useDefineForClassFields` 始终启用，符合 ECMAScript 规范
- JSX runtime 始终为 automatic
- 开发模式下，esbuild 配置**无效**
- `tsconfig.json` 不会被解析，行为遵循 TypeScript 默认值

## 4.6 SWC 的局限性

尽管 SWC 性能卓越，但仍有其局限性：

### 4.6.1 插件生态不如 Babel 成熟

Babel 经过多年发展，拥有数百个插件和预设。SWC 的插件生态仍在成长中，部分 Babel 插件没有对应的 SWC 版本。

### 4.6.2 边缘 case 的兼容性

SWC 虽然支持大多数现代 JavaScript 特性，但可能无法覆盖 Babel 处理的所有边缘 case。

### 4.6.3 配置的熟悉度

Babel 的配置方式已被广泛理解，SWC 的配置对习惯 Babel 的开发者可能不够熟悉。

### 4.6.4 Vite 插件的限制

`@vitejs/plugin-react-swc` 的选项有限，以保持良好的性能和与未来工具的兼容性。插件的设计目标是"**保持高性能和与转换工具无关**"。


# 五、工作原理

## 5.1 SWC 的完整编译流水线

```
源代码（.ts/.tsx/.jsx）
        ↓
┌─────────────────────────────────────────────────────────────┐
│  阶段一：解析（Parse）                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - 词法分析：源码 → Token 流                        │  │
│  │  - 语法分析：Token 流 → AST                        │  │
│  │  - 支持 TypeScript 语法、JSX、装饰器等              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│  阶段二：转换（Transform）                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  并行执行多个转换：                                 │  │
│  │  - 类型擦除（TypeScript → JavaScript）              │  │
│  │  - JSX 转换（JSX → React.createElement）            │  │
│  │  - 语法降级（ES2022 → ES5）                        │  │
│  │  - 装饰器转换                                       │  │
│  │  - 模块转换（ESM → CJS 等）                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│  阶段三：输出（Print）                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - 代码生成：AST → 源代码字符串                     │  │
│  │  - 代码压缩（可选）                                 │  │
│  │  - Source Map 生成                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ↓
编译后的 JavaScript 代码
```

## 5.2 Vite 插件中的转换流程

当 Vite 开发服务器接收到对 `.tsx` 文件的请求时：

```
浏览器请求 /src/App.tsx
        ↓
Vite 开发服务器接收请求
        ↓
@vitejs/plugin-react-swc 拦截请求
        ↓
文件类型检测（.tsx → typescript + tsx: true）
        ↓
构建 SWC 配置对象
  - parser: { syntax: "typescript", tsx: true }
  - transform: { react: { runtime: "automatic" } }
  - target: "es2020"（开发模式默认）
        ↓
调用 SWC 的 transform 函数
        ↓
SWC 在 Rust 层执行编译（解析 → 转换 → 输出）
        ↓
后处理：注入 Fast Refresh 代码
        ↓
生成 Source Map
        ↓
返回转换后的 JavaScript 代码给 Vite
        ↓
Vite 将代码返回给浏览器
```

## 5.3 生产构建中的 SWC

当 `plugins` 选项被配置时，SWC 也会参与生产构建：

```
npm run build
        ↓
Vite 调用 Rollup 进行生产打包
        ↓
如果配置了 SWC 插件：
  → Rollup 使用 SWC 进行 TS/JSX 编译
  → 与开发模式使用相同的 SWC 配置
        ↓
如果未配置 SWC 插件：
  → Rollup 使用 esbuild 进行 TS/JSX 编译
        ↓
生成生产产物
```

## 5.4 Fast Refresh 的实现机制

`@vitejs/plugin-react-swc` 实现了 React Fast Refresh：

1. **转换时注入**：SWC 转换代码时，识别 React 组件并注入 Fast Refresh 所需的运行时代码
2. **HMR 边界检测**：插件检测哪些组件可以被热更新，哪些需要完整刷新
3. **状态保留**：组件更新时保留内部状态
4. **类组件支持**：支持 React 类组件的 HMR

## 5.5 错误处理机制

插件实现了特殊的错误处理逻辑，改善开发者体验：

1. SWC 返回错误时，插件尝试从错误信息中提取行号和列号
2. 将精确定位的信息传递给 Vite
3. 终端显示准确的错误位置，方便快速定位


# 六、工作流程

## 6.1 在 Vite 项目中启用 SWC

### 6.1.1 安装

```bash
# 安装 SWC 插件（替代 @vitejs/plugin-react）
npm install -D @vitejs/plugin-react-swc
```

### 6.1.2 配置

```javascript
// vite.config.js 或 vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],  // 替换原有的 @vitejs/plugin-react
});
```

### 6.1.3 从 Babel 插件迁移

从 `@vitejs/plugin-react` 切换到 `@vitejs/plugin-react-swc` 非常直接：

1. 在 `package.json` 中将 `@vitejs/plugin-react` 替换为 `@vitejs/plugin-react-swc`
2. 在 `vite.config.js` 中将导入语句从 `@vitejs/plugin-react` 改为 `@vitejs/plugin-react-swc`
3. 插件名仍为 `react`，无需修改其他代码

## 6.2 配置示例

### 6.2.1 基础配置

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
});
```

### 6.2.2 自定义 JSX Import Source（如 Emotion）

```javascript
react({
  jsxImportSource: '@emotion/react',  // 使用 Emotion 的 JSX runtime
});
```

### 6.2.3 启用 TypeScript 装饰器

```javascript
react({
  tsDecorators: true,  // 需要在 tsconfig.json 中启用 experimentalDecorators
});
```

### 6.2.4 使用 SWC 插件（如 Styled Components）

```javascript
react({
  plugins: [
    ['@swc/plugin-styled-components', {}],  // 生产构建时启用 SWC
  ],
});
```

### 6.2.5 调整开发目标

```javascript
react({
  devTarget: 'es2022',  // 避免降级私有类方法等现代特性
});
```

### 6.2.6 自定义文件处理

```javascript
react({
  parserConfig(id) {
    if (id.endsWith('.res')) {
      return { syntax: 'ecmascript', jsx: true };
    }
    if (id.endsWith('.ts')) {
      return { syntax: 'typescript', tsx: false };
    }
  },
});
```

## 6.3 性能对比

根据实际项目测试数据：

| 场景 | Babel（@vitejs/plugin-react） | SWC（@vitejs/plugin-react-swc） |
|------|------------------------------|--------------------------------|
| 开发服务器启动 | 基准 | **5-10 倍**更快 |
| 热模块替换 | 基准 | **显著更快** |
| TypeScript 编译 | 基准（ts-loader/Babel） | **10-20 倍**更快 |
| 内存占用 | 基准 | **更低** |
| 生产构建 | 基准 | **构建时间减少** |

> **💡 认知桥接**
>
> 如果把 Babel 比作**手动挡汽车**——驾驶体验好、控制精细，但在拥堵路段（大型项目）频繁换挡（编译）会让你疲惫不堪。SWC 则像**自动挡赛车**——你只需要踩油门（写代码），变速箱（编译器）自动以最优方式换挡，让你专注在驾驶本身。

## 6.4 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| **装饰器不生效** | `tsDecorators` 未启用或 tsconfig 未配置 | 启用 `tsDecorators: true` 和 `experimentalDecorators: true` |
| **CSS-in-JS 不工作** | 未配置对应的 SWC 插件 | 添加 `plugins: [['@swc/plugin-emotion', {}]]` |
| **开发构建与生产构建不一致** | 开发和生产使用不同编译器 | 启用 `plugins` 选项，使生产也使用 SWC |
| **JS 文件未被转换** | 插件默认不处理 `.js` 文件 | 使用 `parserConfig` 自定义 |
| **Fast Refresh 不工作** | 组件导出方式不符合要求 | 确保组件是默认导出或有命名的组件导出 |

## 6.5 在 desktop-app-template 中的应用建议

对于 `desktop-app-template` 项目（Electron + React + TypeScript + Vite）：

**推荐使用 `@vitejs/plugin-react-swc`**：

1. **性能提升明显**：Electron 项目通常包含大量 React 组件和 TypeScript 文件，SWC 的 10-20 倍编译加速可以显著改善开发体验
2. **内存占用更低**：Electron 开发环境本身内存占用较高，SWC 的低内存占用有助于整体性能
3. **迁移成本极低**：从 `@vitejs/plugin-react` 切换到 `@vitejs/plugin-react-swc` 只需修改两行代码

**配置示例（针对 desktop-app-template）** ：

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [
    react({
      // Electron 通常使用较新的 Chrome 版本，可以使用更高的 target
      devTarget: 'es2022',
      // 如果项目使用了装饰器
      tsDecorators: false,  // 按需开启
    }),
  ],
  // ... 其他配置
});
```


# 七、发展历程

## 7.1 项目的诞生（2017）

**2017 年 12 月**：韩国开发者 Donny/강동윤（kdy1）在 NAVER 体系下启动 SWC 项目。

**初始定位**："spdy web compiler"——一个用 Rust 编写的极速 JavaScript/TypeScript 编译器。

## 7.2 早期发展阶段（2018-2020）

- 项目逐步完善核心功能：解析、转换、代码生成
- 开始在社区中积累关注度
- 作者 Donny 个人贡献了 **43%** 的 commits

## 7.3 被主流框架采纳（2021-2022）

**关键里程碑**：

| 时间 | 事件 |
|------|------|
| 2021 | Next.js 12 开始集成 SWC |
| 2022 | Next.js 13 默认使用 SWC 编译 `.ts`/`.tsx` 文件 |
| 2022 | Vite 官方推出 `@vitejs/plugin-react-swc` |
| 2022 | Parcel、Deno 等工具开始采用 SWC |

**Next.js 的采用是 SWC 发展的转折点**——Vercel 的背书让 SWC 从一个社区项目跃升为"Babel 之后"的事实标准。

## 7.4 生态扩张期（2023-2025）

**被大型企业采用**：
- Vercel、字节跳动、腾讯、Shopify 等在生产环境中使用 SWC
- Rspack 2.1 通过内置 SWC loader 启用 React Compiler

**技术演进**：
- WASM 插件系统成熟，支持向后兼容
- `@swc/core` 持续迭代，v1.15.0 引入 Wasm 插件向后兼容

## 7.5 当前状态（2026）

SWC 已成为前端工具链的**核心基础设施**：

- **GitHub**：33,615+ stars，11,919+ commits
- **采用者**：Next.js、Vite、Parcel、Deno、Rspack 等
- **企业用户**：Vercel、字节跳动、腾讯、Shopify 等
- **治理模式**：个人 OSS + 公司背书的混合治理

## 7.6 SWC vs Oxc：Rust 工具链的未来

Oxc 是另一个用 Rust 编写的 JavaScript 工具链，专注于**极致的 linting 和解析性能**。

| 对比维度 | SWC | Oxc |
|---------|-----|-----|
| **核心定位** | JavaScript/TypeScript 编译器 | JavaScript 解析器 + Linter |
| **成熟度** | 生产级，广泛采用 | 快速发展中 |
| **插件系统** | WASM 插件 | 开发中 |
| **适用场景** | 需要稳定的 JS/TS 转换 | 需要极速的 linting 和解析 |

**选择建议**：
- 当你的框架已经依赖 SWC 时，使用 SWC
- 当你需要稳定的 JavaScript/TypeScript 转换时，使用 SWC
- 当你需要自定义 SWC/WASM 插件时，使用 SWC

## 7.7 Vite 的未来方向

Vite 官方明确表示：**"Vite 的未来是 Oxc"**。这意味着：

- Vite 未来可能将底层编译器从 esbuild + SWC 统一迁移到 Oxc
- 但 SWC 仍将在 Next.js、Rspack 等工具链中持续发挥重要作用
- `@vitejs/plugin-react-swc` 的 `useAtYourOwnRisk_mutateSwcOptions` 选项的设计，已经暗示了这种过渡


## 总结

SWC 的核心贡献可以概括为三点：

1. **重新定义了 JavaScript 编译的速度标杆**：通过 Rust 语言 + 多核并行 + 优化的算法，实现了比 Babel 快 20-70 倍的编译性能

2. **成为前端工具链的核心基础设施**：被 Next.js、Vite、Parcel、Deno、Rspack 等主流工具采纳，成为"Babel 之后"的事实标准

3. **统一了"速度"与"可扩展性"**：通过 WASM 插件系统 + 零拷贝序列化，在保持极致性能的同时提供了扩展能力

对于 `desktop-app-template` 项目，`@vitejs/plugin-react-swc` 是 **@vitejs/plugin-react 的高性能替代方案**：

- 开发服务器启动速度提升 5-10 倍
- TypeScript 编译速度提升 10-20 倍
- 内存占用更低
- 迁移成本极低，只需修改两行代码

理解 SWC 的工作原理，有助于在项目构建性能优化时做出明智的技术选型决策。

> **延伸阅读**：
> - [SWC 官方网站](https://swc.rs/)
> - [SWC GitHub 仓库](https://github.com/swc-project/swc)
> - [@vitejs/plugin-react-swc npm 包](https://www.npmjs.com/package/@vitejs/plugin-react-swc)
> - [Vite 插件 React SWC 文档](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react-swc)









END.