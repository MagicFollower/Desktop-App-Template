> 基于《Vite技术报告》的同视角技术分析，文末有DS学习到的写作格式

创建时间：2026年9月1日20:34:53

---

# React 技术报告

> **文档类型**：内部技术参考文档
> **读者定位**：前端开发团队成员（含零基础新人）
> **编写视角**：资深前端工程师
> **涉及项目**：desktop-app-template（Electron + React + TypeScript）
> **React 版本**：以 19.0 为基准，兼顾历史版本对比

---

## 目录

- [一、设计背景](#一设计背景)
- [二、设计目的](#二设计目的)
- [三、完整技术设计架构](#三完整技术设计架构)
- [四、设计细节](#四设计细节)
- [五、工作原理](#五工作原理)
- [六、工作流程](#六工作流程)
- [七、发展历程](#七发展历程)

---

# 一、设计背景

要理解 React 为什么成为今天的样子，必须先回到它诞生前的世界。前端开发在 React 出现之前，经历了多个阶段，每个阶段都有其典型的痛点。

## 1.1 前端开发在 React 之前的演进

### 1.1.1 静态页面时代（1990s-2000s）

最早的网页是完全静态的：服务器存储 HTML 文件，浏览器请求什么就返回什么。页面切换意味着整页刷新。

**核心特征**：
- HTML 写死所有内容
- JavaScript 主要用于表单验证和简单交互
- 没有"应用"的概念，只有"页面"

### 1.1.2 jQuery 时代（2006-2015）

jQuery 让"操作 DOM"变得简单，但它本质上是**命令式**的——你告诉浏览器"做什么"，每一步都要手动描述。

```javascript
// jQuery 命令式风格
$('#button').click(function() {
  $('#container').html('<p>新内容</p>');
  $('#container').addClass('active');
});
```

**痛点**：
- 数据变化和 UI 更新完全手动同步
- 状态散落在 DOM 中，难以追踪
- 随着交互复杂度上升，代码迅速膨胀为"面条代码"

### 1.1.3 早期 SPA 框架（2010-2013）

Backbone.js、Angular 1 等框架出现，提出了 **MVC/MVVM** 模式。

**Angular 1 的"双向绑定"**：
```html
<!-- 模板 -->
<input ng-model="name">
<p>Hello {{name}}</p>
```

```javascript
// 控制器
$scope.name = 'World';
```

看起来美好，但双向绑定在大规模应用下暴露了性能问题和调试困难——你很难追踪"是谁改了数据"。

**核心问题**：这些框架仍然没有解决"**如何高效地根据数据渲染 UI**"这个根本问题。

## 1.2 Facebook 的内部痛点

2011-2013 年间，Facebook 的 Web 应用面临着严峻的挑战：

**1. 复杂的交互逻辑**
- Facebook 的消息通知、聊天、动态墙等模块交互密集
- 每个模块都有复杂的"数据 → UI"映射关系

**2. 团队协作困难**
- 数十名工程师在同一个代码库中工作
- 传统 DOM 操作方式导致代码耦合度高、冲突频繁

**3. 性能瓶颈**
- 频繁的 DOM 操作导致页面卡顿
- 尤其在低端设备上，体验糟糕

**4. 代码可维护性**
- 随着产品迭代，UI 逻辑和数据逻辑混合在一起
- 修改一处功能，常常牵动全局

> **新人小结**
>
> 你可以把 Facebook 的困境想象成这样：你有一块巨大的黑板（DOM），每次数据变化你都要用粉笔擦掉旧内容、写上新内容（手动 DOM 操作）。当数据频繁变化时，你来回擦写，筋疲力尽，而且容易擦错地方。Facebook 需要的是：**数据变了，黑板自动更新正确的内容**——这就是 React 要解决的问题。

## 1.3 React 的诞生：Jordan Walke 的尝试

2011 年，Facebook 工程师 **Jordan Walke** 受到了 **XHP**（Facebook 内部的一种 PHP 扩展，允许在 PHP 中嵌入 XML 语法）的启发，开始探索一种新的前端开发模式。

**关键洞察**：
> "每次数据变化都重新渲染整个界面，然后只把变化的部分应用到 DOM 上。"

这个想法在当时是反直觉的——"全部重绘"听起来是低效的，但 Jordan 的设想是：可以用一种**高效的算法**来比较两次渲染之间的差异，只更新必要的 DOM。

2011 年，React 的原型诞生，被用于 Facebook 的广告管理系统（Ads Manager）。2012 年，Instagram 被 Facebook 收购后，React 也被用于 Instagram 的 Web 端开发。

## 1.4 虚拟 DOM 概念的提出

虚拟 DOM 是 React 最核心的概念创新。

**问题**：直接操作 DOM 很慢（浏览器需要重新计算样式、布局、绘制），而且手动 DOM 操作容易出错。

**解决方案**：
1. 在内存中维护一棵"虚拟 DOM 树"（用 JavaScript 对象描述 UI）
2. 数据变化时，重新生成虚拟 DOM 树
3. 比较新旧虚拟 DOM 树，找出差异（**Diffing**）
4. 把差异批量应用到真实 DOM（**Reconciliation**）

```javascript
// 虚拟 DOM 的本质：用 JS 对象描述 UI
const vdom = {
  type: 'div',
  props: { className: 'container' },
  children: [
    { type: 'h1', props: {}, children: ['Hello'] }
  ]
};
```

这个设计的精妙之处在于：**"全部重绘"是在 JavaScript 内存中完成的，只有最终的差异才触及真实的 DOM**。

> **新人小结**
>
> 虚拟 DOM 就像一个"草稿本"。你每次修改都在草稿本上涂改（内存操作，极快），确定最终版本后，才把变化誊写到正式作业本上（DOM 操作，相对慢）。这比每次都在正式作业本上擦写高效得多。

## 1.5 单向数据流的提出

在 React 之前，前端框架的数据流五花八门：

| 框架 | 数据流方向 | 特点 |
|------|----------|------|
| Backbone | 双向（通过事件） | 状态分散在 Model 中 |
| Angular 1 | 双向绑定 | 视图和模型自动同步，但难以追踪 |
| Ember | 双向（通过计算属性） | 复杂的绑定关系 |

React 选择了**单向数据流**（One-way Data Flow）：

```
数据（State）→ 视图（UI）→ 用户操作 → 数据更新 → 视图更新
```

数据总是**从上到下流动**（从父组件到子组件），这使得：
- 数据变化可预测
- 调试更容易（你知道数据从哪来、到哪去）
- 组件之间松耦合

## 1.6 声明式编程范式的引入

React 最大的思想贡献是**声明式编程**在 UI 开发中的普及。

**命令式**（jQuery 风格）：
```javascript
// 告诉浏览器"怎么做"——每一步操作
$('#user').text(user.name);
$('#user').addClass('active');
if (user.isAdmin) {
  $('#admin-panel').show();
}
```

**声明式**（React 风格）：
```jsx
// 告诉浏览器"显示什么"——UI 是数据的函数
<div className={user.isAdmin ? 'active' : ''}>
  {user.name}
  {user.isAdmin && <AdminPanel />}
</div>
```

声明式的核心思想：**UI = f(state)**——界面是状态的函数。给定同样的状态，永远渲染出同样的界面。

这让 UI 开发从"操作指令"变成了"状态描述"，大大降低了认知负担。

## 1.7 JSX 的设计选择

React 选择了一种在当时颇具争议的语法——**JSX**（JavaScript XML）：

```jsx
const element = <h1 className="greeting">Hello, world!</h1>;
```

**为什么不用模板？**
- 模板语言（如 Handlebars、Mustache）表达能力有限
- 在模板中实现复杂逻辑很痛苦

**为什么不用纯 JS？**
- 纯 JS 构建 UI 的代码冗长（`React.createElement` 嵌套）
- 不够直观，难以阅读

**JSX 的折中方案**：
- 语法接近 HTML，设计师和新人容易上手
- 本质上是 JavaScript，拥有 JS 的全部表达能力
- 在构建时被编译成 `React.createElement` 调用

> **新人小结**
>
> JSX 不是"在 JS 里写 HTML"，而是"用类似 HTML 的语法来描述 UI 结构"。它最终会被编译成普通的 JavaScript。你可以把 JSX 理解为一种"语法糖"，让 UI 描述更直观。

## 1.8 组件化思想的演进

组件化并不是 React 发明的，但 React 把它推向了极致。

**React 的组件定义**：
```jsx
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}
```

**核心理念**：
1. **可组合**：小组件拼成大组件
2. **可复用**：一个组件可以在多处使用
3. **封装**：组件内部逻辑对外不可见
4. **独立**：组件之间通过 props 通信，松耦合

组件化让前端开发从"页面开发"变成了"组件开发"，这是 React 对工程化最重要的贡献。

## 1.9 与同时代框架的对比（2013-2015）

React 在 2013 年开源时，市场已有多个成熟框架：

| 框架 | 数据绑定 | DOM 更新 | 学习曲线 | 核心思想 |
|------|---------|---------|---------|---------|
| Angular 1 | 双向绑定 | 脏检查 | 陡峭 | MVC 扩展 |
| Backbone | 手动绑定 | 手动更新 | 平缓 | Model-View |
| Ember | 双向绑定 | 计算属性 | 陡峭 | 约定优于配置 |
| **React** | **单向数据流** | **虚拟 DOM** | **平缓-中等** | **组件化 + 声明式** |

React 的核心差异化优势：
1. 虚拟 DOM 提供了一种"不用关心性能的默认高性能"
2. 单向数据流让大型应用的状态可控
3. 组件化让代码复用和组织变得自然

---

# 二、设计目的

理解了背景，我们来看 React 的设计目的——它想解决什么问题，达成什么目标。

## 2.1 声明式 UI 开发

**目标**：让开发者用"描述 UI 应该长什么样"的方式编程，而不是"描述如何操作 DOM 来达到这个效果"。

**实现方式**：
- 使用 JSX 描述 UI 结构
- 组件是纯函数，输入 props，输出 UI
- 状态变化时，React 自动处理 UI 更新

**核心价值**：降低 UI 开发的认知负担，让开发者专注于"什么"，而不是"怎么做"。

## 2.2 组件化架构

**目标**：让 UI 开发像搭积木一样，由独立、可复用、可组合的组件构成。

**实现方式**：
- 组件是应用的基本单元
- 组件可以嵌套、组合、复用
- 组件有自己的状态和生命周期

**核心价值**：提升代码的可维护性和团队协作效率。

## 2.3 高效 DOM 更新（虚拟 DOM）

**目标**：在保证开发者用"全部重绘"的抽象方式编程的同时，保持高效的 DOM 更新。

**实现方式**：
- 内存中维护虚拟 DOM 树
- 状态变化时重新渲染虚拟 DOM
- 通过 Diffing 算法找出最小变更
- 批量应用到真实 DOM

**核心价值**：让开发者不需要手动优化 DOM 操作，框架自动处理性能问题。

## 2.4 单向数据流

**目标**：让数据变化可追踪、可预测。

**实现方式**：
- 数据从父组件流向子组件（props）
- 子组件通过回调函数向父组件发送事件
- 状态提升（Lifting State Up）统一管理

**核心价值**：简化调试，减少数据流混乱导致的问题。

> **新人小结**
>
> 单向数据流就像一个**单向管道**——数据从顶部流到底部。如果底部想改变数据，只能通过"向上喊话"（触发回调），由顶部决定是否改变。这比"双向管道"更容易追踪"谁改了数据"。

## 2.5 跨平台渲染能力

**目标**：让 React 不局限于 Web 平台，能渲染到任何目标。

**实现方式**：
- React Core 与渲染器（Renderer）分离
- React DOM 渲染到浏览器 DOM
- React Native 渲染到移动端原生组件
- React Canvas / React VR 等渲染到其他平台

**核心价值**："Learn once, write anywhere"——一次学习，多端编写。

## 2.6 强大的开发者工具生态

**目标**：提供一流的开发调试体验。

**实现方式**：
- React DevTools（浏览器扩展）
- 组件树可视化
- props/state 实时检查
- 性能分析（Profiler）

**核心价值**：大幅提升调试效率。

## 2.7 渐进式采用能力

**目标**：不需要重写整个应用就能引入 React。

**实现方式**：
- React 可以只负责页面中的一部分
- 可以逐组件迁移
- 与传统技术栈并存

**核心价值**：降低技术迁移风险，允许渐进式升级。

## 2.8 大规模应用的状态管理

**目标**：为大型应用提供可扩展的状态管理方案。

**实现方式**：
- 内置的组件状态（useState）
- 应用级状态 Context（useContext）
- 配合第三方状态管理库（Redux、Zustand、MobX）

**核心价值**：让 React 应用从小型项目到大型项目都能良好运作。

## 2.9 开发者体验优先

**目标**：让开发 React 应用的体验尽可能流畅。

**实现方式**：
- 清晰的错误提示（如"相邻 JSX 元素必须被包裹"）
- 严格模式（StrictMode）帮助发现潜在问题
- 丰富的官方文档和示例
- HMR（热模块替换）的良好支持

**核心价值**：降低学习门槛，提升开发效率。

## 2.10 持续演进的能力

**目标**：React 自身能够持续演进，同时保持向后兼容。

**实现方式**：
- 渐进式发布（如 Hooks 不破坏类组件）
- 明确的 RFC 流程
- 长期支持版本（LTS）

**核心价值**：让社区有信心长期使用 React。

---

# 三、完整技术设计架构

这一章深入 React 的技术架构，从整体到局部，拆解它的每一个组成部分。

## 3.1 整体架构图

React 的整体架构可以分为四层：

```
┌─────────────────────────────────────────────────┐
│              用户层（User Layer）                  │
│   JSX / 组件 / Hooks / 状态 / 事件处理            │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            协调层（Reconciliation Layer）          │
│  ┌──────────────────────────────────────────┐    │
│  │       Fiber Reconciler（协调器）          │    │
│  │   - 虚拟 DOM Diffing                      │    │
│  │   - 任务调度（Scheduler）                 │    │
│  │   - 中断/恢复渲染                        │    │
│  └──────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┘
│              渲染层（Renderer Layer）              │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ React DOM    │  │ React Native │             │
│  │ (Web 渲染)   │  │ (移动端渲染)  │             │
│  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ React Test   │  │ 其他渲染器    │             │
│  │ (测试渲染)    │  │              │             │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

- **用户层**：开发者编写的 React 代码
- **协调层**：React 的核心算法，管理更新、调度、Diffing
- **渲染层**：将 React 组件渲染到不同平台

## 3.2 React Core 与 Renderer 的分离设计

React 最重要的架构设计之一是**核心与渲染器分离**：

**React Core（react 包）**：
- 定义组件 API（Component、createElement）
- Hooks 基础 API
- 虚拟 DOM 数据结构
- 协调器（Reconciler）逻辑

**Renderer（react-dom / react-native 等）**：
- 特定平台的渲染逻辑
- DOM 操作 / 原生组件操作
- 事件系统（不同平台的事件处理）

**通信机制**：Reconciler 通过"宿主配置"（Host Config）与 Renderer 通信，Renderer 实现具体的"挂载"、"更新"、"卸载"等操作。

这种设计让 React 的架构非常干净——核心算法可以在不同平台复用。

## 3.3 Fiber 架构的设计

### 3.3.1 为什么需要 Fiber？

在 Fiber 之前，React 的协调过程是**同步递归**的：

```javascript
// 旧架构：递归调用，不可中断
function reconcile(children) {
  for (let child of children) {
    // 处理 child
    reconcile(child.children);
  }
}
```

问题：一旦开始协调，必须完成整棵树才能响应其他任务（如用户输入、动画）。对于大型应用，这会导致掉帧和卡顿。

### 3.3.2 Fiber 的核心思想

Fiber 的核心是**可中断的渲染**——把渲染工作拆分成小单元，在浏览器空闲时执行。

**Fiber Node 结构**（简化）：
```javascript
const fiber = {
  // 组件信息
  type: 'div',          // 组件类型
  key: 'item-1',        // 用于列表协调
  stateNode: domElement,// 关联的 DOM 节点
  
  // 树结构
  child: fiber1,        // 第一个子节点
  sibling: fiber2,      // 下一个兄弟节点
  return: parentFiber,  // 父节点
  
  // 工作进度
  pendingProps: {},     // 等待处理的 props
  memoizedProps: {},    // 已处理的 props
  memoizedState: {},    // 已处理的 state
  
  // 优先级
  lanes: 1,             // 任务的优先级
  
  // 副作用链表（Effect List）
  nextEffect: null,     // 下一个副作用
};
```

### 3.3.3 Fiber 的"双缓冲"机制

Fiber 维护两棵树：
- **Current Tree**：当前屏幕上显示的内容
- **Work-in-Progress Tree**：正在构建的新树

```
Current Tree           Work-in-Progress Tree
    (展示中)                 (构建中)
       |                        |
  Root Fiber ←──────────→ Root Fiber
    |                        |
  App Fiber ←──────────→ App Fiber
    |                        |
  div Fiber ←──────────→ div Fiber
    |                        |
  ...                      ...
```

两棵树通过 `alternate` 指针互相引用。构建完成后，两棵树交换角色（"提交"阶段），新的 Current Tree 展示到屏幕上。

这种设计让 React 能在内存中"预览"渲染结果，准备好后再一次性更新 DOM。

> **新人小结**
>
> 双缓冲机制好比**电影放映**：幕后工作人员在准备下一帧（Work-in-Progress Tree），同时当前帧正在放映（Current Tree）。准备完成后，瞬间切换。观众（用户）感觉不到切换过程，只看到画面连续。

## 3.4 渲染流水线

React 的渲染过程分为三个阶段：

### 阶段一：调度（Schedule）

用户操作触发更新 → React 创建一个更新任务，分配优先级：
- **同步优先级**：用户输入
- **普通优先级**：数据更新
- **低优先级**：后台加载

### 阶段二：协调（Reconcile）

从根组件开始，递归遍历组件树：
1. 调用组件函数（函数组件）或 render 方法（类组件）
2. 生成新的虚拟 DOM 树
3. 比较新旧虚拟 DOM 树，标记差异（"副作用"）

### 阶段三：提交（Commit）

将阶段二标记的副作用应用到真实 DOM：
1. 执行 DOM 插入、更新、删除
2. 执行 `useLayoutEffect` 的清理和设置
3. 执行 `useEffect` 的调度（异步执行）

## 3.5 React 的更新调度机制

React 的调度器（Scheduler）负责管理更新任务的执行顺序。

**调度模型**：
```
事件触发 → 创建更新 → 加入调度队列
                           ↓
                    调度器按优先级排序
                           ↓
                    执行高优先级任务
                    可中断低优先级任务
                           ↓
                    Concurrent Mode 下可并发渲染
```

**优先级级别**：

| 优先级 | 示例场景 | 处理方式 |
|--------|---------|---------|
| 立即（Immediate） | 用户点击 | 同步执行 |
| 用户阻塞（User-blocking） | 输入框打字 | 高优先级 |
| 普通（Normal） | 数据加载完成 | 默认优先级 |
| 低（Low） | 后台分析 | 可延迟 |
| 空闲（Idle） | 非关键更新 | 浏览器空闲时执行 |

> **新人小结**
>
> 调度器就像一个**智能餐厅前台**：VIP 客户（用户输入）插队优先服务，普通客户（数据更新）正常排队，不着急的客户（后台分析）等人少时再服务。这样保证最重要的交互（如点击、打字）永远不卡顿。

## 3.6 Hook 系统的实现机制

### 3.6.1 Hook 的数据结构

在 Fiber 节点上，Hooks 被存储为一个链表：

```javascript
// 简化版 Hook 结构
const hook = {
  memoizedState: null,      // 当前值（useState 的值 / useEffect 的依赖数组）
  baseState: null,          // 基础状态
  baseQueue: null,          // 基础更新队列
  queue: null,              // 待处理的更新队列
  next: null,               // 下一个 Hook
};
```

### 3.6.2 Hook 的"魔法"：为什么 Hooks 必须在顶层调用？

```jsx
function Component() {
  const [count, setCount] = useState(0); // Hook 1
  const [name, setName] = useState('');  // Hook 2
  // 条件语句中不能调用 Hook！
  if (count > 5) {
    const [extra, setExtra] = useState(0); // ❌ 运行时顺序会变化！
  }
}
```

**原因**：Hooks 通过**调用顺序**来识别状态。React 在每次渲染时按相同顺序调用 Hooks，并依赖这个顺序来关联状态。

```
第一次渲染：useState(0) → useState('') → useState(0)
              ↑ Hook1      ↑ Hook2      ↑ Hook3

第二次渲染（如果条件成立）：useState(0) → useState('') → useState(0)
                              ↑ Hook1      ↑ Hook2      ↑ Hook3 ✅

第二次渲染（如果条件不成立）：useState(0) → useState('')
                              ↑ Hook1      ↑ Hook2 ❌ 顺序变了！
```

如果顺序变了，React 会把 Hook2 的状态当成 Hook3 来用，导致 bug。

## 3.7 事件系统设计

React 有自己的**合成事件**（Synthetic Event）系统：

**设计目的**：
1. **跨浏览器一致性**：抹平不同浏览器的事件差异
2. **性能优化**：事件委托（Event Delegation），所有事件都冒泡到根节点处理
3. **与 React 调度集成**：事件处理可以和更新调度联动

**事件委托机制**：

```
传统方式：每个元素绑定自己的事件监听器
<div onClick={handler1}> → 直接绑定到 div
<button onClick={handler2}> → 直接绑定到 button

React 方式：所有事件委托到根节点
<div onClick={handler1}> → 将 handler 记录到 fiber
<button onClick={handler2}> → 将 handler 记录到 fiber
                 ↓
   所有事件由根节点统一处理 → 根据事件目标查找对应的 handler
```

## 3.8 并发模式（Concurrent Mode）设计

Concurrent Mode 是 React 18+ 的核心能力。

**本质**：让渲染过程可以被中断和恢复，从而实现：
- 多任务优先级调度
- 渲染可在后台进行
- 用户交互不被阻塞

**实现机制**：
1. **时间切片**（Time Slicing）：每个 Fiber 工作单元执行后，检查是否还有剩余时间，没有则让出控制权
2. **中断检查**：在每次循环开始时检查是否有更高优先级的任务
3. **状态保存**：中断时保存当前进度，恢复时从断点继续

```javascript
// 简化的时间切片逻辑
function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  // 如果还有工作，请求下一帧继续
  if (nextUnitOfWork) {
    requestIdleCallback(workLoop);
  }
}
```

## 3.9 服务器端渲染（SSR）架构

React 的 SSR 分为两种模式：

**传统 SSR**：
1. 在服务器端执行 `renderToString`
2. 生成完整的 HTML 字符串
3. 发送给客户端
4. 客户端进行"水合"（Hydration）

**流式 SSR**（React 18+）：
1. 使用 `renderToPipeableStream`
2. 分块传输 HTML（边渲染边发送）
3. Suspense 边界可以独立流式传输
4. 客户端逐步水合

```
传统 SSR：   等待全部渲染 → 一次性发送 → 一次性水合
流式 SSR：   边渲染边发送 → 分块渲染 → 逐步水合
            （首屏更快）    （Suspense 边界独立）
```

## 3.10 错误边界（Error Boundary）设计

React 提供了优雅的错误处理机制——错误边界。

**设计理念**：UI 的一部分错误不应该破坏整个应用。

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 可以上报错误到监控系统
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>出错了，请刷新页面。</h1>;
    }
    return this.props.children;
  }
}
```

**注意**：错误边界只能捕获**渲染过程中**的错误，不能捕获：
- 事件处理器中的错误
- 异步代码中的错误
- 服务端渲染中的错误

---

# 四、设计细节

这一章深入 React 的具体设计细节，解析那些"魔鬼藏在细节里"的部分。

## 4.1 虚拟 DOM 的 Diffing 算法详解

React 的 Diffing 算法基于两个假设：
1. 不同类型的元素会产生不同的树
2. 开发人员可以通过 `key` 来暗示子元素的稳定性

**三种比较策略**：

### 策略一：不同类型元素 → 直接替换

```jsx
// 旧树
<div>Hello</div>

// 新树
<span>Hello</span>
```

React 直接销毁旧节点，创建新节点（并重新挂载所有子节点）。

### 策略二：同类型 DOM 元素 → 更新属性

```jsx
// 旧树
<div className="old">Hello</div>

// 新树
<div className="new">Hello</div>
```

React 只更新变化的属性（`className`），不重新创建 DOM。

### 策略三：同类型组件 → 更新 props

```jsx
// 旧树
<MyComponent name="Alice" />

// 新树
<MyComponent name="Bob" />
```

React 更新组件的 props，调用 `componentDidUpdate`（类组件）或重新执行函数组件。

### 列表 Diff 与 key 的重要性

```jsx
// 没有 key（或使用 index 作 key）的列表
{items.map((item, index) => <Item {...item} />)}

// 使用唯一 key 的列表
{items.map(item => <Item key={item.id} {...item} />)}
```

**为什么 key 重要**：
- 当列表顺序变化时，key 帮助 React 识别哪些元素是同一个
- 用 index 作 key 的问题：添加/删除元素时，所有后续元素的 index 都变了，导致不必要的重渲染

**Diff 过程**（以 key 为锚点）：
1. 遍历新旧列表，通过 key 匹配元素
2. 匹配上的元素：更新 props，递归比较子节点
3. 新列表中有、旧列表中没有：创建新元素
4. 旧列表中有、新列表中没有：删除旧元素
5. 顺序变化：移动元素而非重新创建

## 4.2 React 18 的自动批处理（Automatic Batching）

在 React 17 及以前，只有事件处理器中的更新会被批处理：

```jsx
// React 17：只有 handleClick 中的更新被批处理
function handleClick() {
  setCount(1);  // → 触发一次渲染
  setName('A'); // → 触发一次渲染
  // 两次更新 → 一次渲染（批处理）
}

// React 17：setTimeout 中的更新不会被批处理
setTimeout(() => {
  setCount(1);  // → 触发一次渲染
  setName('A'); // → 触发一次渲染
  // 两次更新 → 两次渲染
}, 1000);
```

React 18 实现了**自动批处理**，所有更新（无论来源）都会被批处理：

```jsx
// React 18：以下场景都会批处理
// - 事件处理器 ✅
// - setTimeout ✅
// - Promise.then ✅
// - 原生事件监听器 ✅
// - requestAnimationFrame ✅

setTimeout(() => {
  setCount(1);  // → 不会立即渲染
  setName('A'); // → 不会立即渲染
  // 两次更新 → 一次渲染（批处理）
}, 1000);
```

## 4.3 状态更新的"快照"机制

React 的 `useState` 更新是异步的，且基于**快照**（Snapshot）机制：

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  
  function handleClick() {
    setCount(count + 1);
    setCount(count + 1);
    // 两次调用，但 count 的值都是 0，所以最终是 1
  }
}
```

**原理**：每次渲染中，状态值是固定的（"快照"）。`setCount` 并不是"修改 count 变量"，而是"通知 React 下一次渲染用新值"。

**正确做法**（函数式更新）：
```jsx
function handleClick() {
  setCount(prev => prev + 1);
  setCount(prev => prev + 1);
  // 最终：count 增加 2
}
```

> **新人小结**
>
> 可以把 `useState` 的"快照"机制理解为：每次渲染时，状态值就像一张**拍好的照片**，不会改变。你在处理点击事件时，读到的 `count` 是当前"照片"上的数字，而不是"实时数字"。`setCount` 不是修改这张照片，而是拍一张新照片（新渲染）用新数字。

## 4.4 useEffect 的执行时机与依赖数组

`useEffect` 的执行时机是 React 中常见的困惑点。

**执行流程**：
1. 组件渲染完成
2. React 更新 DOM
3. **浏览器绘制**（屏幕更新）
4. `useEffect` 在绘制**之后**执行（异步）

**useEffect vs useLayoutEffect**：

| | useEffect | useLayoutEffect |
|--|----------|-----------------|
| 执行时机 | 浏览器绘制后 | 浏览器绘制前 |
| 是否阻塞渲染 | 否（异步） | 是（同步） |
| 使用场景 | 副作用（数据请求、事件监听） | DOM 测量、同步更新 |
| 对用户可见性 | 用户可能看到闪烁 | 用户看不到闪烁 |

**依赖数组的深入理解**：

```jsx
useEffect(() => {
  // 每次渲染后都执行（没有依赖数组）
});

useEffect(() => {
  // 只在挂载时执行一次（空依赖数组）
}, []);

useEffect(() => {
  // 每次 count 变化时执行
}, [count]);

useEffect(() => {
  // 当依赖是对象/数组时要注意引用相等
}, [obj]); // ⚠️ 每次渲染 obj 都是新引用，会导致频繁执行
```

## 4.5 受控组件与非受控组件

React 表单处理的两种模式。

**受控组件**：
```jsx
function Form() {
  const [value, setValue] = useState('');
  
  return (
    <input 
      value={value} 
      onChange={(e) => setValue(e.target.value)} 
    />
  );
}
```
- 值由 React 状态控制
- 数据流：用户输入 → onChange → setState → 重新渲染 → 新值

**非受控组件**：
```jsx
function Form() {
  const inputRef = useRef(null);
  
  function handleSubmit() {
    console.log(inputRef.current.value);
  }
  
  return <input ref={inputRef} defaultValue="" />;
}
```
- 值由 DOM 自身控制
- 使用 `ref` 读取值

**选择指南**：
- 受控组件：需要验证、条件禁用、格式化输入时使用
- 非受控组件：简单表单、文件上传时使用

## 4.6 Context 的传播机制

React Context 通过**组件树向下传递**，绕过中间组件的 props 传递。

**实现原理**：
1. 每个 Context 对象维护一个"当前值"
2. Provider 组件更新值时，会通知所有消费该 Context 的组件
3. 消费组件（`useContext` 或 `Context.Consumer`）订阅该 Context
4. 值变化时，所有订阅组件重新渲染

**性能问题**：Context 值变化会导致所有消费组件重新渲染，即使它们只使用了部分值。

**解决方案**：
```jsx
// ❌ 整个对象变化，所有消费者都重新渲染
<MyContext.Provider value={{ user, theme }}>
  {children}
</MyContext.Provider>

// ✅ 分离不同 Context
<ThemeContext.Provider value={theme}>
  <UserContext.Provider value={user}>
    {children}
  </UserContext.Provider>
</ThemeContext.Provider>
```

## 4.7 Refs 的多种用法

React 提供了多种 ref 使用方式：

**1. `useRef`（函数组件）**：
```jsx
const ref = useRef(null);
ref.current = 'some value'; // 可以存储任意值
```

**2. `createRef`（类组件）**：
```jsx
class Component extends React.Component {
  ref = React.createRef();
}
```

**3. 回调 Refs**：
```jsx
<input ref={(el) => this.inputEl = el} />
```

**4. `forwardRef`（转发 Ref）**：
```jsx
const Child = React.forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});

// 父组件
const ref = useRef(null);
<Child ref={ref} />
```

**5. `useImperativeHandle`（自定义暴露给父组件的方法）**：
```jsx
const Child = React.forwardRef((props, ref) => {
  useImperativeHandle(ref, () => ({
    focus: () => { inputRef.current.focus(); },
    reset: () => { ... }
  }));
  return <input ref={inputRef} />;
});
```

## 4.8 高阶组件（HOC）设计模式

高阶组件是 React 的一种**高级复用模式**，它是一个函数，接收一个组件，返回一个新组件。

```jsx
function withLogging(WrappedComponent) {
  return function WithLogging(props) {
    useEffect(() => {
      console.log('组件已挂载');
      return () => console.log('组件将卸载');
    }, []);
    
    return <WrappedComponent {...props} />;
  };
}

// 使用
const EnhancedComponent = withLogging(MyComponent);
```

**常见的 HOC 用途**：
- 注入 props（如 Redux 的 `connect`）
- 条件渲染（如鉴权 HOC）
- 性能监控
- 日志记录

**HOC 的注意事项**：
- 避免在 render 函数中使用 HOC（会丢失状态）
- 使用 `displayName` 方便调试
- 静态方法需要手动复制

## 4.9 Render Props 设计模式

Render Props 是另一种组件复用模式——通过一个函数 prop 来共享代码。

```jsx
function MouseTracker({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handler = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  
  return render(position);
}

// 使用
<MouseTracker render={({ x, y }) => (
  <p>鼠标位置：{x}, {y}</p>
)} />
```

## 4.10 性能优化工具链

React 提供的性能优化 API：

| API | 用途 | 使用场景 |
|-----|------|---------|
| `React.memo` | 组件浅比较 props，避免不必要的重渲染 | 纯组件 |
| `useMemo` | 缓存计算结果 | 昂贵的计算 |
| `useCallback` | 缓存函数引用 | 传递给子组件的回调 |
| `useTransition` | 标记低优先级更新 | 非紧急 UI 更新 |
| `useDeferredValue` | 延迟更新值 | 输入框过滤等 |
| `React.lazy` + `Suspense` | 代码分割 | 路由级懒加载 |

**优化原则**：
1. 先测量，再优化（使用 React DevTools Profiler）
2. 优先优化真正慢的部分
3. 不要过早优化（useMemo/useCallback 本身也有开销）

---

# 五、工作原理

这一章从"执行流程"的角度，解析 React 在运行时到底做了什么。

## 5.1 JSX 的编译过程

JSX 在构建时被编译成 `React.createElement` 调用（或新的 JSX Transform）。

**编译前**：
```jsx
const element = <h1 className="greeting">Hello, world!</h1>;
```

**编译后**（旧版 JSX Transform）：
```javascript
const element = React.createElement(
  'h1',
  { className: 'greeting' },
  'Hello, world!'
);
```

**编译后**（新版 JSX Transform，React 17+）：
```javascript
import { jsx as _jsx } from 'react/jsx-runtime';

const element = _jsx('h1', {
  className: 'greeting',
  children: 'Hello, world!'
});
```

**`React.createElement` 的返回值**：
```javascript
{
  type: 'h1',
  props: {
    className: 'greeting',
    children: 'Hello, world!'
  },
  key: null,
  ref: null,
  $$typeof: Symbol.for('react.element')
}
```

## 5.2 首次渲染的完整流程

**React DOM 首次渲染**：

```
ReactDOM.createRoot(root).render(<App />)
    ↓
1. 创建 Root Fiber 节点
    ↓
2. 开始调度更新
    ↓
3. 进入协调阶段（Reconciliation）：
   a. 调用 App() 或 App.render()
   b. 递归遍历组件树
   c. 为每个组件创建 Fiber 节点
   d. 创建虚拟 DOM 树
    ↓
4. 进入提交阶段（Commit）：
   a. 根据 Fiber 树创建真实的 DOM 节点
   b. 插入到 root 容器中
    ↓
5. 执行 componentDidMount / useEffect
    ↓
6. 屏幕显示
```

## 5.3 更新渲染的完整流程

**状态更新触发的渲染**：

```
setCount(1) 被调用
    ↓
1. 创建更新对象（Update），加入更新队列
    ↓
2. 调度器（Scheduler）判断优先级，安排任务
    ↓
3. 协调阶段（可中断）：
   a. 从 Root Fiber 开始遍历
   b. 遇到组件：调用函数 / render 方法，对比新旧虚拟 DOM
   c. 标记需要更新的 Fiber（"副作用"）
   d. 构建新的 Work-in-Progress Tree
   e. 如果时间用完，暂停，下次继续
    ↓
4. 提交阶段（不可中断）：
   a. 遍历副作用链表
   b. 执行 DOM 更新
   c. 执行 useLayoutEffect 清理和设置
   d. 将 Work-in-Progress Tree 设为 Current Tree
    ↓
5. 异步执行 useEffect（在浏览器绘制后）
```

## 5.4 并发渲染的工作机制

并发渲染是 React 18 最复杂也最强大的特性。

**核心原理**：
```
用户点击按钮
    ↓
调度器创建更新任务（优先级：User-blocking）
    ↓
检查是否有正在进行的低优先级渲染
    ↓
如果有 → 中断低优先级任务
    ↓
开始执行高优先级任务
    ↓
任务完成 → 提交渲染
    ↓
恢复低优先级任务（从断点继续）
```

**为什么能"中断"**：
- Fiber 架构将渲染工作拆分成小单元
- 每个单元执行后检查是否有更高优先级的任务
- 有则暂停当前工作，保存进度

**useTransition 的体验优化**：
```jsx
function App() {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState([]);
  
  function loadData() {
    startTransition(() => {
      // 这个更新被标记为"过渡"，低优先级
      setData(heavyData);
    });
  }
  
  return (
    <div>
      {isPending && <Spinner />}
      <DataView data={data} />
    </div>
  );
}
```
- 用户点击时，UI 立即响应（`isPending` 变为 true）
- 数据加载在后台进行，不阻塞用户交互
- 加载完成后，UI 自动更新

## 5.5 批处理机制详解

React 18 的自动批处理改变了更新行为。

**之前（React 17）**：
```javascript
// 事件处理中：批处理
handleClick() {
  setA(1); // 不渲染
  setB(2); // 不渲染
  // 函数结束 → 一次渲染
}

// Promise 中：不批处理
fetchData().then(() => {
  setA(1); // 立即渲染
  setB(2); // 立即渲染（两次渲染）
});
```

**之后（React 18）**：
```javascript
// 所有场景：批处理
fetchData().then(() => {
  setA(1); // 不渲染
  setB(2); // 不渲染
  // 微任务结束 → 一次渲染
});
```

**原理**：React 18 使用 **`flushSync`** 作为"退出批处理"的逃生舱，默认所有更新都批处理。

## 5.6 Fiber 树的遍历算法

React 使用**深度优先遍历**（DFS）来处理 Fiber 树。

```javascript
// 简化的 Fiber 遍历
function performUnitOfWork(fiber) {
  // 处理当前 fiber（调用组件、计算更新）
  beginWork(fiber);
  
  // 如果有子节点，返回子节点继续
  if (fiber.child) {
    return fiber.child;
  }
  
  // 没有子节点，向兄弟节点或父节点回溯
  let nextFiber = fiber;
  while (nextFiber) {
    // 完成当前节点的工作
    completeWork(nextFiber);
    
    // 如果有兄弟节点，返回兄弟节点
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    
    // 否则回到父节点
    nextFiber = nextFiber.return;
  }
  
  return null; // 遍历完成
}
```

**遍历顺序**：
```
     Root
     /  \
    A    B
   / \    \
  C   D    E

遍历顺序：Root → A → C → D → B → E
（深度优先，先子后兄）
```

## 5.7 React 合成事件系统

React 的事件系统有独特的设计：

**1. 事件注册**：
- 在 Root 节点（或根容器）上注册所有事件
- 使用事件委托，不需要为每个元素绑定

**2. 事件分发**：
```
用户点击 button
    ↓
事件冒泡到根节点
    ↓
React 获取事件目标（button）
    ↓
通过 Fiber 树查找 button 对应的 Fiber
    ↓
从 Fiber 中提取 onClick 处理器
    ↓
调用处理器（包装在合成事件中）
    ↓
执行 setState 等操作
```

**3. 合成事件对象**：
```javascript
// React 的合成事件
function handleClick(e) {
  e.preventDefault();  // 跨浏览器一致
  e.stopPropagation(); // 跨浏览器一致
  console.log(e.nativeEvent); // 原始 DOM 事件
}
```

## 5.8 水合（Hydration）过程

SSR 时，React 在客户端需要进行"水合"。

**水合过程**：
```
1. 服务器发送 HTML（含 React 组件结构）
    ↓
2. 浏览器解析并展示 HTML（静态内容可见）
    ↓
3. React 加载后，开始水合：
   a. 遍历 DOM 树，创建 Fiber 树
   b. 匹配 DOM 节点和 Fiber 节点
   c. 将事件监听器绑定到 DOM 节点
   d. 如果 DOM 内容与虚拟 DOM 不匹配，发出警告
    ↓
4. 水合完成，应用变为可交互
```

**水合失败的常见原因**：
- 服务器端和客户端的渲染结果不一致
- 使用了 `useEffect` 中才生成的内容
- 日期/时间在不同环境不同

## 5.9 Suspense 的工作原理

Suspense 让组件可以"等待"某些异步操作（如数据加载）完成后再渲染。

```jsx
<Suspense fallback={<Loading />}>
  <Profile />
</Suspense>
```

**工作流程**：
1. Profile 组件尝试读取异步数据
2. React 检测到"挂起"（pending），抛出 Promise
3. 最近的 Suspense 边界捕获这个 Promise
4. React 展示 fallback 内容
5. Promise 完成后，React 重新尝试渲染 Profile
6. 数据就绪，正常渲染

**实现原理**：
```javascript
// 简化的 Suspense 机制
function fetchUser(id) {
  let status = 'pending';
  let result;
  let suspender = fetch(`/api/user/${id}`)
    .then(res => res.json())
    .then(
      data => { status = 'success'; result = data; },
      error => { status = 'error'; result = error; }
    );
  
  return {
    read() {
      if (status === 'pending') throw suspender; // 抛出 Promise
      if (status === 'error') throw result;
      return result;
    }
  };
}
```

## 5.10 React 编译器（React Compiler）原理

React 19 引入了 React Compiler（原 React Forget），这是一个**自动记忆化**编译器。

**问题**：开发者需要手动使用 `useMemo`、`useCallback`、`React.memo` 来优化性能。

**解决方案**：React Compiler 自动分析组件，在必要的地方插入记忆化代码。

```jsx
// 开发者的代码
function Component({ data }) {
  const filtered = data.filter(item => item.active);
  return <List items={filtered} />;
}

// 编译后（简化的概念）
function Component({ data }) {
  const filtered = useMemo(() => data.filter(item => item.active), [data]);
  return <List items={filtered} memo={true} />;
}
```

**工作原理**：
1. 静态分析组件代码
2. 识别哪些值与依赖有关
3. 在编译时自动插入记忆化逻辑
4. 减少运行时的性能开销

---

# 六、工作流程

这一章从"开发者日常操作"的角度，梳理各种典型工作流的完整步骤。

## 6.1 项目初始化的完整流程

使用 React 脚手架创建一个新项目：

**方式一：Vite（推荐，我们项目使用）**
```
1. 执行命令
   npm create vite@latest my-app -- --template react-ts
        ↓
2. 进入目录，安装依赖
   cd my-app && npm install
        ↓
3. 启动开发服务器
   npm run dev
        ↓
4. 浏览器访问
   http://localhost:5173
```

**方式二：Create React App（CRA）**
```
1. npx create-react-app my-app --template typescript
2. cd my-app
3. npm start
```

## 6.2 组件开发的典型流程

一个典型的 React 组件开发循环：

```
1. 创建组件文件
   src/components/MyComponent.tsx
        ↓
2. 编写组件逻辑
   - 定义 Props 类型
   - 使用 Hooks（useState, useEffect, etc.）
   - 返回 JSX
        ↓
3. 在父组件中使用
   import MyComponent from './components/MyComponent'
        ↓
4. 浏览器自动更新（HMR）
   - Vite 的热更新会立即反映变化
   - 组件状态在开发中保留
        ↓
5. 调试与迭代
   - 使用 React DevTools 检查 props/state
   - 修改代码，浏览器自动更新
```

## 6.3 调试与排查流程

遇到问题时的排查步骤：

**问题 1："Cannot read property of undefined"**
```
1. 检查数据是否已加载（loading 状态）
2. 使用可选链：data?.user?.name
3. 检查 props 是否正确传递
4. 在组件中打印 props 或使用 DevTools
```

**问题 2：组件不更新**
```
1. 检查 state 是否真的变化了（使用 DevTools）
2. 检查是否有 shouldComponentUpdate / React.memo 阻止更新
3. 检查是否修改了 state 对象本身（不可变更新）
   // ❌ 错误
   state.items.push(newItem)
   setState(state)
   // ✅ 正确
   setState({ ...state, items: [...state.items, newItem] })
4. 检查 useEffect 依赖数组是否正确
```

**问题 3：HMR 不生效**
```
1. 确认 Vite 配置中 HMR 未禁用
2. 检查是否有循环依赖
3. 清理缓存：rm -rf node_modules/.vite
4. 重启开发服务器
```

## 6.4 状态管理的演进流程

随着项目规模增长，状态管理方案的演进路径：

```
小型项目（1-3 人）
  → useState + props 传递
  → useContext 避免 prop drilling
        ↓
中型项目（3-10 人）
  → Zustand 或 Jotai（轻量级）
  → 或 Redux Toolkit（成熟方案）
        ↓
大型项目（10+ 人）
  → Redux Toolkit + RTK Query
  → 或 Recoil / MobX
  → 服务端状态：TanStack Query (React Query)
```

## 6.5 性能分析与优化流程

```
1. 使用 React DevTools Profiler 记录渲染
   - 查看哪些组件渲染次数多
   - 查看每次渲染的耗时
        ↓
2. 识别性能瓶颈
   - 大列表？→ 使用虚拟滚动（react-window）
   - 复杂计算？→ 使用 useMemo
   - 频繁更新的回调？→ 使用 useCallback
        ↓
3. 应用优化
   - React.memo 包裹纯组件
   - 代码分割：React.lazy + Suspense
   - 列表使用稳定 key
        ↓
4. 验证优化效果
   - 再次录制 Profiler
   - 对比优化前后的渲染次数和耗时
```

## 6.6 服务端渲染（SSR）流程

如果项目需要 SSR（如 Next.js）：

```
1. 选择 SSR 框架
   - Next.js（React 官方推荐）
   - Remix
   - 自建：Vite + express + renderToString
        ↓
2. 配置路由
   - 文件系统路由（Next.js 风格）或配置式路由
        ↓
3. 处理数据获取
   - getServerSideProps（Next.js）
   - 在组件中使用 Suspense
        ↓
4. 部署
   - Vercel / Netlify 自动处理 SSR
   - 自建服务器需要 Node.js 环境
```

## 6.7 测试工作流

React 应用的典型测试策略：

```
1. 单元测试（Jest + Testing Library）
   - 测试组件渲染
   - 测试用户交互
   - 测试工具函数
        ↓
2. 集成测试
   - 测试组件之间的交互
   - 测试 API 调用
   - 测试路由
        ↓
3. E2E 测试（Cypress / Playwright）
   - 测试完整的用户流程
   - 测试关键业务场景
        ↓
4. CI 集成
   - 每次 PR 自动运行测试
   - 测试失败阻止合并
```

```jsx
// 组件测试示例
import { render, screen, fireEvent } from '@testing-library/react';
import Counter from './Counter';

test('点击按钮增加计数', () => {
  render(<Counter />);
  const button = screen.getByRole('button', { name: /increment/i });
  fireEvent.click(button);
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

## 6.8 从类组件迁移到函数组件的流程

对于旧代码中的类组件：

```
1. 将 class 改为函数
   class MyComponent extends Component → function MyComponent()
        ↓
2. 移除 render 方法，直接返回 JSX
   render() { return ... } → return ...
        ↓
3. 将 state 改为 useState
   this.state = { count: 0 } → const [count, setCount] = useState(0)
   this.setState({ count: 1 }) → setCount(1)
        ↓
4. 将生命周期改为 useEffect
   componentDidMount → useEffect(() => { ... }, [])
   componentDidUpdate → useEffect(() => { ... }, [deps])
   componentWillUnmount → useEffect(() => { return () => { ... } }, [])
        ↓
5. 将 this.props 改为直接使用 props
   this.props.name → props.name
        ↓
6. 移除 this 绑定
   onClick={this.handleClick.bind(this)} → onClick={handleClick}
```

## 6.9 从其他框架迁移到 React 的流程

```
1. 评估迁移策略
   - 全量重写 vs 渐进式迁移
   - 时间线和团队资源
        ↓
2. 建立新 React 项目（Vite + React + TypeScript）
        ↓
3. 逐页面迁移
   - 先迁移独立页面
   - 再迁移共享组件
   - 最后迁移核心功能
        ↓
4. 保持并行运行（新旧并存）
   - 通过路由区分
   - 使用微前端方案（qiankun, Module Federation）
        ↓
5. 完全切换
   - 确认所有功能正常
   - 下线旧代码
```

## 6.10 自定义 Hooks 开发流程

自定义 Hook 是 React 代码复用的主要方式：

```
1. 识别可复用逻辑
   - 多个组件使用相同的状态逻辑
   - 如：表单处理、数据获取、本地存储、防抖
        ↓
2. 创建 Hook 文件
   useCustomHook.ts
        ↓
3. 实现 Hook
   function useCustomHook(param) {
     // 使用 React 内置 Hooks
     const [data, setData] = useState(null);
     useEffect(() => { ... }, [param]);
     return data;
   }
        ↓
4. 编写测试
   test('useCustomHook does something', () => { ... })
        ↓
5. 在组件中使用
   const data = useCustomHook(param)
        ↓
6. 可选：发布到 npm（公司内部或社区）
```

---

# 七、发展历程

这一章回顾 React 从诞生到现在的演进历程。

## 7.1 React 的诞生（2011-2013）

**2011 年**：Jordan Walke 创建 React 原型，用于 Facebook Ads Manager。

**2012 年**：React 被用于 Instagram 的 Web 端。

**2013 年 5 月**：React 在 JSConf US 上正式开源。当时的口号是：
> "Rethinking best practices"（重新思考最佳实践）

## 7.2 React 0.x 时代（2013-2015）

**React 0.3（2013）**：首次公开版本，支持 JSX 和虚拟 DOM。

**React 0.8（2013）**：添加了对 IE8 的支持。

**React 0.10（2014）**：引入 React Native 概念。

**React 0.13（2015）**：支持 ES6 类组件（`class MyComponent extends React.Component`）。

**React 0.14（2015）**：
- 将 `react` 和 `react-dom` 分离
- 引入无状态函数组件

这个阶段的关键变化是**从无到有，建立基础**。

## 7.3 React 15 时代（2016-2017）

**React 15（2016 年 4 月）**：
- 使用 `React.createElement` 替代旧的 `React.DOM` API
- 支持 SVG 元素

**React 15.3（2016）**：
- 引入 `React.PureComponent`
- 引入 `React.createRef`

**React 15.4（2016）**：
- 引入 `React.forwardRef`

**React 15.5（2017）**：
- 将 `React.PropTypes` 移入独立包 `prop-types`

React 15 的核心改进是**API 稳定化和性能优化**。

## 7.4 React 16 时代（2017-2018）

这是 React 历史上最重要的版本之一。

**React 16（2017 年 9 月，代号 "Fiber"）**：
- **Fiber 架构**：完全重写的核心协调器
- **错误边界**（Error Boundaries）
- **支持返回数组和字符串**（不强制包裹 div）
- **React.Portal**：支持将子节点渲染到 DOM 不同位置
- **更好的 SSR**（流式渲染）

**React 16.3（2018）**：
- **Context API 正式版**（`React.createContext`）
- **`React.createRef`**
- **`React.forwardRef`**

**React 16.6（2018）**：
- **`React.lazy`** 和 **`Suspense`**（代码分割）
- `React.memo`

**React 16.7（2018）**：
- **Hooks 提案**（Alpha 版本）

**React 16.8（2019 年 2 月）**：
- **Hooks 正式发布**：`useState`、`useEffect`、`useContext` 等

> **新人小结**
>
> React 16.8 的 Hooks 发布是 React 自诞生以来**最大的 API 变革**。它改变了我们写 React 的方式——从"类组件 + 生命周期"到"函数组件 + Hooks"。今天我们用 React，几乎都在用 Hooks。

## 7.5 React 17 时代（2020）

React 17 是一个"过渡版本"，没有新特性，主要做内部改造。

**React 17（2020 年 10 月）**：
- **没有破坏性变更**
- **新的 JSX Transform**：不依赖 `React.createElement`
- **事件委托变更**：从 `document` 改为 root 节点
- **`useEffect` 清理函数改为异步执行**

这个版本的定位是"为 React 18 铺路"。

## 7.6 React 18 时代（2022）

React 18 带来了最重大的功能更新——**并发渲染**。

**React 18（2022 年 3 月）**：
- **`createRoot` API**：替代 `ReactDOM.render`
- **并发渲染**：可中断、可恢复的渲染
- **自动批处理**
- **`useTransition`**：标记低优先级更新
- **`useDeferredValue`**：延迟值更新
- **新的 Suspense SSR**：`renderToPipeableStream`
- **`useId`**：生成唯一 ID（用于无障碍属性）
- **`useSyncExternalStore`**：外部状态库的 API

## 7.7 React 19 时代（2024-2025）

React 19 继续完善并发渲染生态。

**React 19（2024 年底）**：
- **React Compiler**（原 React Forget）：自动记忆化
- **Actions API**：简化表单处理
- **`useOptimistic`**：乐观更新
- **`useFormStatus`**：表单状态跟踪
- **`use`** Hook：在组件中直接使用 Promise
- **更好的 Suspense 支持**

## 7.8 核心团队的演进

React 的核心团队发展：

- **创始人**：Jordan Walke
- **早期核心**：Sebastian Markbåge（现 Vercel CTO）、Dan Abramov（现 BlueSky）、Andrew Clark
- **治理模式**：Facebook/Meta 主导，但社区参与度高
- **RFC 流程**：所有重大变更通过 RFC 讨论

## 7.9 生态发展

React 的生态是其成功的关键因素之一：

**状态管理**：
- Redux / Redux Toolkit
- Zustand / Jotai / Recoil
- MobX
- TanStack Query（服务端状态）

**路由**：
- React Router（最流行）
- TanStack Router
- Next.js Router（内置）

**UI 组件库**：
- Ant Design
- Material-UI
- Chakra UI
- shadcn/ui

**元框架**：
- Next.js（Vercel）
- Remix（React Router 团队）
- Gatsby
- Astro（支持 React）

**测试**：
- Testing Library
- Jest
- Vitest
- React Native Testing Library

## 7.10 未来展望

React 的未来方向：

**1. 编译器优化**：
React Compiler 将减少手动性能优化的需要。

**2. 更好的并发模式**：
进一步降低开发者使用并发特性的门槛。

**3. 服务器组件（Server Components）**：
React 正在探索"在服务器上运行组件"的模式，这将是架构级的变革。

**4. 与框架的融合**：
React 越来越与 Next.js 等"元框架"深度绑定，孤立的"裸 React"项目可能越来越少。

**5. 性能持续提升**：
Rust/Go 工具链（如 Rolldown、Turbopack）将为 React 开发提供更快的构建体验。

---

## 总结

React 的出现，彻底改变了前端开发的范式。它的核心贡献可以概括为三点：

1. **声明式 UI 开发**：让 UI 成为状态的函数，大幅降低了 UI 开发的认知负担
2. **组件化架构**：让前端开发从"页面开发"走向"组件开发"，提升了代码的复用性和可维护性
3. **虚拟 DOM + 协调器**：在提供声明式抽象的同时，保证了高效的 DOM 更新

对于我们的项目（desktop-app-template），React 是**渲染进程**的核心框架——它负责将桌面应用的用户界面以组件化的方式构建、渲染和交互。理解 React 的工作原理，能帮你在开发功能时写出更高效、更可维护的代码。

> **延伸阅读**（项目内文档）：
> - [前端入职指南.md](../前端入职指南.md)：第二章关于 React 基础的新手讲解




---



# 一、对《Vite 技术报告》的解析

在动笔写 React 技术报告之前，我先仔细拆解这篇 Vite 报告的写法，提炼出可复用的结构和技巧。

## 1.1 整体组织架构

这篇文章采用了**由外到内、由史及今、层层递进**的七章结构：

| 章节 | 定位 | 作用 |
|------|------|------|
| 一、设计背景 | **历史溯源** | 从宏观演进讲起，解释"为什么需要 Vite" |
| 二、设计目的 | **目标宣言** | 明确工具要解决什么问题、达成什么目标 |
| 三、完整技术设计架构 | **鸟瞰全景** | 给出整体架构图，建立心智模型 |
| 四、设计细节 | **深入肌理** | 拆解关键模块的具体实现原理 |
| 五、工作原理 | **流程驱动** | 从"执行流程"角度解析各个阶段 |
| 六、工作流程 | **用户视角** | 从开发者日常操作角度梳理典型场景 |
| 七、发展历程 | **历史演进** | 回顾版本迭代，展望未来趋势 |

**关键洞察**：这七章形成了一个完整的认知闭环——

```
为什么（背景）→ 是什么（目的）→ 长什么样（架构）→ 
怎么做的（细节）→ 怎么运转的（原理）→ 怎么用的（流程）→ 
从哪来到哪去（历程）
```

这种结构特别适合**技术文档/新人培训材料**，因为它尊重人类认知的天然顺序：先理解动机，再理解机制，最后才是操作。

## 1.2 写作视角的细节

### 视角定位

文章开篇就明确了三个视角维度：

| 维度 | 设定 | 影响 |
|------|------|------|
| 文档类型 | 内部技术参考文档 | 允许一定深度，不必过度口语化 |
| 读者定位 | 前端开发团队（含零基础新人） | 需要解释术语、加"新人小结" |
| 编写视角 | 资深前端工程师 | 有历史纵深感，能"讲清楚来龙去脉" |

这个定位决定了全文的**叙事语调**：既不是教科书式的枯燥，也不是营销文式的浮夸，而是一位有经验的工程师在给团队做内部培训——亲切、有深度、重逻辑。

### "新人小结"的设计

每章的关键概念后都配有"新人小结"，用日常类比降低理解门槛。这些类比非常用心：

| 概念 | 类比 |
|------|------|
| 构建工具 | 餐厅的中央厨房 |
| Webpack | 全能但复杂的瑞士军刀 |
| Webpack vs Vite | 中央厨房先做菜 vs 接到订单才做菜 |
| Vite 双引擎 | 承认开发和生产诉求不同，用不同工具 |

新人小结的本质是**翻译**——把抽象的技术概念翻译成新人已有的生活经验。这是一篇优秀技术文档的重要特征。

### 技术深度与可读性的平衡

文章在技术细节上并不浅薄：

- 包含具体的代码示例和命令行操作
- 解释了 HMR 的完整周期（文件变化 → chokidar → 模块图谱 → WebSocket → 浏览器更新）
- 对比了 esbuild 和 Rollup 的优劣
- 列出了不同版本的具体变化

但通过**表格、代码块、流程图**等方式，把复杂信息结构化，降低了阅读负担。

### 表格的巧妙使用

全文使用了大量表格，这是一种高效的"信息压缩"手段。比如：

| 痛点 | 具体表现 | 对开发者的影响 |
|------|---------|---------------|
| 启动慢 | 冷启动 30 秒到几分钟 | 每次开机都要等 |

这种**三列表格**（现象 → 细节 → 影响）是技术文档的黄金结构，强迫作者从多个维度描述一个问题。

## 1.3 我学到的写作方法

基于以上分析，我总结出这篇报告的核心写作方法：

1. **历史叙事开场**：不从"什么是 React"开始，而从"React 出现之前的世界是什么样"开始——让读者理解动机
2. **每章一个明确的问题**：每章标题都暗示了要回答的问题（"为什么"、"是什么"、"怎么做"）
3. **新人小结穿插**：在复杂概念后用类比"翻译"，确保零基础读者不掉队
4. **表格结构化**：用表格呈现对比信息、分类信息、演进信息
5. **代码示例精准**：不堆砌代码，只在需要说明概念时给出最小示例
6. **流程优先于原理**：先让读者理解"怎么运转"，再深入"为什么这样运转"
7. **结尾有延伸指引**：指向项目内其他相关文档，形成知识网络

接下来，我将以同样的方法论，为 React 撰写一篇同等规格的技术报告。

