创建时间：2026年9月6日23:39:59

---


# Zustand 技术报告

> **文档类型**：内部技术参考文档
> **读者定位**：前端开发团队成员（含零基础新人）
> **编写视角**：资深前端工程师
> **涉及项目**：desktop-app-template（Electron + React + TypeScript + Vite）
> **Zustand 版本**：以 v5.x 为基准


## 目录

- [一、设计背景](#一设计背景)
- [二、设计目的](#二设计目的)
- [三、完整技术设计架构](#三完整技术设计架构)
- [四、设计细节](#四设计细节)
- [五、工作原理](#五工作原理)
- [六、工作流程](#六工作流程)
- [七、发展历程](#七发展历程)


# 一、设计背景

要理解 Zustand 为何成为 React 生态中增长最快的状态管理库之一，需要回到 React 状态管理在 2019-2021 年间面临的困境与变革。

## 1.1 React 状态管理的演进

React 的状态管理经历了多个阶段，每个阶段都有其典型方案和固有痛点：

| 时代 | 代表方案 | 核心特征 | 痛点 |
|------|---------|---------|------|
| **早期**（2013-2015） | 组件内 `this.state` + 逐层 props 传递 | 状态分散在组件内部 | 跨组件通信困难，Props Drilling 严重 |
| **Context 时代**（2016-2018） | React Context API | 跨层级传递数据 | 更新效率低，消费组件无条件重渲染 |
| **Redux 时代**（2015-2020） | Redux + React-Redux | 单一 Store、不可变更新、中间件生态 | 样板代码多、学习曲线陡峭 |
| **响应式时代**（2018-2021） | MobX | 可观察对象、自动追踪依赖 | 概念较多、与 React 响应式模型有差异 |
| **Hooks 时代**（2019-至今） | 各种 Hooks 状态方案 | 利用 Hooks 能力 | 方案碎片化 |

## 1.2 Redux 的成就与局限

Redux 是 React 生态中最成功、最成熟的状态管理方案之一。它基于三个核心原则：

1. **单一数据源（Single Source of Truth）** ：整个应用的状态存储在一个对象树中
2. **状态是只读的（State is Read-Only）** ：只能通过触发 action 来修改状态
3. **使用纯函数进行修改（Changes are Made with Pure Functions）** ：reducer 必须是纯函数

然而，Redux 在实际使用中也暴露了显著的问题：

- **样板代码过多**：定义 action types、action creators、reducers 需要大量重复代码
- **学习曲线陡峭**：需要理解 action、reducer、dispatch、middleware、thunk 等概念
- **Provider 包裹**：需要用 `<Provider>` 包裹整个应用，增加了一层抽象
- **非 React 环境的访问**：在组件树外访问 store 较为复杂

> **💡 认知桥接**
>
> 可以把 Redux 比作**银行的柜台服务**——有一套严格的流程（填单、排队、叫号、办理），每一步都很规范，但办理一笔业务要填一堆表格（样板代码）。Zustand 则像**手机银行**——想转账？点几下就行，流程极大简化，但核心的安全和记录功能一个不少。

## 1.3 React Hooks 带来的变革

2018 年，React 16.8 正式发布 Hooks，彻底改变了 React 的开发方式。Hooks 让函数组件拥有了状态和副作用能力，也为状态管理库提供了新的实现基础。

Zustand 的创建者正是看到了这一机遇：**能否基于 Hooks 设计一个极简的状态管理库，保留 Redux 的核心优势（不可变状态、单向数据流），同时消除其复杂的样板代码？**

## 1.4 Zustand 的诞生

Zustand 由 **pmndrs**（Poimandres）团队开发，该团队同时也是 React Three Fiber、Jotai、Valtio 等知名库的维护者。

**Zustand** 是德语中“状态”的意思。它的设计哲学非常明确：**“实用主义”和“最小化抽象”**——不是构建一个无所不包的严格体系，而是提供足够简单、直观的 API，让开发者能快速上手并解决 90% 的状态管理问题。

> **💡 认知桥接**
>
> Zustand 的名字（德语“状态”）暗示了它的核心定位：**回归“状态管理”的本质**——就是存数据、取数据、改数据，仅此而已。它不试图成为“架构框架”或“设计模式大全”，而是一个轻量、直接、让你少写代码的工具。


# 二、设计目的

## 2.1 极简的 API

**目标**：用最少的代码完成状态管理。

**实现方式**：只需调用 `create()` 函数创建 store，即可在任何组件中使用。

**核心价值**：将 Redux 的数行样板代码压缩为一行。

```typescript
// Redux 风格的样板代码 vs Zustand 的一行搞定
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

## 2.2 无需 Provider 包裹

**目标**：让 store 在组件树的任何位置都可直接使用。

**实现方式**：Store 是独立于 React 组件树的 JavaScript 模块。

**核心价值**：消除了 `<Provider>` 带来的组件树嵌套，简化了应用结构。

## 2.3 按需渲染（Selective Rendering）

**目标**：只有使用了特定状态的组件才在状态变化时重新渲染。

**实现方式**：通过 selector 函数选择需要的状态片段。

**核心价值**：避免不必要的重渲染，提升大型应用性能。

## 2.4 框架无关的核心层

**目标**：状态管理核心逻辑不依赖 React。

**实现方式**：将核心逻辑封装在 `vanilla.ts` 中，React 适配层单独实现。

**核心价值**：同一套状态管理逻辑可用于 React、Vue 等不同框架。

## 2.5 可扩展的中间件系统

**目标**：在不修改核心代码的前提下扩展功能。

**实现方式**：提供中间件机制，支持持久化、Redux DevTools、Immer 等。

**核心价值**：核心保持精简，功能可按需加载。

## 2.6 TypeScript 优先

**目标**：提供完整的类型推断和类型安全。

**实现方式**：使用 TypeScript 编写，类型定义与实现紧密结合。

**核心价值**：开发时获得完整的类型提示和错误检查。


# 三、完整技术设计架构

## 3.1 整体架构图

Zustand 的架构可分为三层：

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户层（User Layer）                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   create(storeCreator) → useStore Hook                  │  │
│  │   useStore(selector, equalityFn) → selected state       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  React 适配层（React Adapter Layer）             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   useSyncExternalStore / useSyncExternalStoreWithSelector│  │
│  │   - 将外部 store 连接到 React Fiber 渲染周期              │  │
│  │   - 实现 selector 和 equalityFn 的按需更新逻辑           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│               核心层（Core Layer - vanilla.ts）                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   createStore(createState) → StoreApi                   │  │
│  │   ┌──────────────────────────────────────────────────┐  │  │
│  │   │   state（当前状态对象）                          │  │  │
│  │   │   listeners（订阅者 Set）                       │  │  │
│  │   │   setState（更新状态 + 通知订阅者）             │  │  │
│  │   │   getState（获取当前状态）                      │  │  │
│  │   │   subscribe（添加订阅者）                       │  │  │
│  │   │   destroy（清理所有订阅）                       │  │  │
│  │   └──────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    中间件层（Middleware Layer）                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  persist   │  │  devtools  │  │   immer    │  │ combine  │  │
│  │  (持久化)   │  │ (DevTools) │  │ (可变更新) │  │ (组合)   │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 核心文件结构

Zustand 的源码目录结构非常清晰：

```
zustand/
├── src/
│   ├── vanilla.ts          ← 框架无关的核心实现（createStore）
│   ├── react.ts            ← React 适配层（useStore、create）
│   ├── context.ts          ← React Context 支持（多实例）
│   ├── shallow.ts          ← 浅比较工具函数
│   ├── middleware/         ← 官方中间件
│   │   ├── persist.ts      ← 持久化存储
│   │   ├── devtools.ts     ← Redux DevTools 集成
│   │   ├── immer.ts        ← Immer 不可变更新
│   │   ├── combine.ts      ← 状态组合
│   │   ├── redux.ts        ← Redux 风格 reducer
│   │   └── subscribeWithSelector.ts ← 带 selector 的订阅
│   └── traditional.ts      ← 传统 API（v4 兼容）
```

**关键设计决策**：`vanilla.ts` 是纯 JavaScript/TypeScript 实现，不依赖任何框架；`react.ts` 仅负责将 vanilla store 连接到 React。这种分离使得 Zustand 可以在非 React 环境中使用。

## 3.3 发布包结构

Zustand 提供了多个入口点：

```typescript
// 默认入口：React 版本
import { create } from 'zustand';

// Vanilla 版本（非 React）
import { createStore } from 'zustand/vanilla';

// 中间件
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 传统 API（v4 兼容）
import { createWithEqualityFn } from 'zustand/traditional';
```


# 四、设计细节

## 4.1 发布订阅模式的核心实现

Zustand 的核心是一个经典的**发布订阅（Publish-Subscribe）模式**。

### 4.1.1 基础 Store 实现

```typescript
// vanilla.ts 核心实现（简化）
const createStore = (createState) => {
  let state;
  const listeners = new Set();  // 订阅者集合

  const getState = () => state;

  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function' 
      ? partial(state) 
      : partial;
    
    // 只有状态真正变化时才通知
    if (!Object.is(nextState, state)) {
      const prevState = state;
      state = replace ? nextState : Object.assign({}, state, nextState);
      listeners.forEach(listener => listener(state, prevState));
    }
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const destroy = () => listeners.clear();

  const api = { getState, setState, subscribe, destroy };
  
  // 初始化状态
  state = createState(setState, getState, api);
  
  return api;
};
```

### 4.1.2 状态更新的合并策略

`setState` 的第二个参数 `replace` 控制更新行为：

| `replace` 值 | 行为 | 适用场景 |
|-------------|------|---------|
| `false`（默认） | 浅合并（`Object.assign`） | 更新部分状态字段 |
| `true` | 完全替换 | 清空 store、重置状态 |

```typescript
// 默认合并
set({ count: 1 });  // 只更新 count，其他字段保留

// 完全替换
set({}, true);  // 清空整个 store
```

### 4.1.3 函数式更新

`setState` 支持传入函数，基于当前状态计算新状态：

```typescript
set((state) => ({ count: state.count + 1 }));
```

这种模式确保了状态更新的正确性，尤其在异步或批量更新场景中。

## 4.2 React 适配层：useSyncExternalStore

Zustand v5 的核心是使用 React 18 的 `useSyncExternalStore` Hook。

### 4.2.1 为什么使用 useSyncExternalStore？

`useSyncExternalStore` 是 React 官方提供的、用于订阅外部数据源的 Hook。它解决了三个核心问题：

1. **并发渲染兼容性**：确保在 React 并发模式下正确工作
2. **撕裂问题（Tearing）** ：防止 UI 显示不一致的状态
3. **服务端渲染支持**：提供 `getServerSnapshot` 参数

### 4.2.2 核心连接逻辑

```typescript
// react.ts 核心实现（简化）
const useStore = (api, selector, equalityFn) => {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,        // 订阅函数
    api.getState,         // 获取当前快照
    api.getServerState,   // SSR 快照
    selector,             // 选择器
    equalityFn            // 相等性比较函数
  );
  return slice;
};
```

`useSyncExternalStoreWithSelector` 是 `use-sync-external-store` 包提供的增强版本，支持 selector 和自定义相等性比较。

### 4.2.3 按需渲染的实现原理

当 store 状态变化时：

1. `setState` 触发所有 `listeners`
2. 每个 `listener` 调用 `useSyncExternalStore` 内部的通知机制
3. React 重新执行组件函数，调用 `selector`
4. 比较新旧 selector 返回值（使用 `equalityFn`）
5. 只有返回值变化时才触发重渲染

这意味着：**组件只会在其选择的状态片段变化时重新渲染**。

> **💡 认知桥接**
>
> 可以把 Zustand 的按需渲染理解为**订阅杂志**——你只订阅感兴趣的栏目（selector），杂志社（store）出版新刊时，只给你寄你订阅的那几页（按需渲染），而不是把整本杂志都寄给你（全量渲染）。

## 4.3 create 函数的双重职责

Zustand 的 `create` 函数有两层职责：

```typescript
const createImpl = (createState) => {
  // 1. 创建 vanilla store
  const api = createStore(createState);
  
  // 2. 包装为 React Hook
  const useBoundStore = (selector, equalityFn) => 
    useStore(api, selector, equalityFn);
  
  // 3. 将 api 方法合并到 Hook 上
  Object.assign(useBoundStore, api);
  
  return useBoundStore;
};
```

这使得返回的 `useStore` Hook 同时具备：

- **作为 Hook 使用**：`useStore(selector)`
- **作为 Store 对象使用**：`useStore.getState()`、`useStore.setState()`

这种设计让 store 在 React 组件内外都能方便地访问。

## 4.4 中间件系统

Zustand 的中间件系统采用**嵌套包装（Wrapper）**模式。

### 4.4.1 中间件执行顺序

中间件从内向外包装，**最内层的中间件最先执行**：

```
最外层：devtools（Redux DevTools 集成）
  中间层：persist（持久化存储）
  最内层：immer（可变更新转换）
```

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const useStore = create<State>()(
  devtools(
    persist(
      immer((set) => ({
        // immer 让 set 可以"直接修改" state
        count: 0,
        increment: () => set((state) => { state.count += 1; }),
      })),
      { name: 'store-storage' }
    ),
    { name: 'MyStore' }
  )
);
```

**执行顺序说明**：
1. `immer` 最内层：将可变更新转换为不可变更新
2. `persist` 中间层：在状态变化后保存到存储
3. `devtools` 最外层：将状态变化发送到 Redux DevTools

### 4.4.2 官方中间件速览

| 中间件 | 用途 | 关键特性 |
|--------|------|---------|
| **persist** | 状态持久化 | 支持 localStorage、AsyncStorage、IndexedDB |
| **devtools** | Redux DevTools 集成 | 支持时间旅行调试 |
| **immer** | 可变更新语法 | 用 `state.prop = value` 替代不可变更新 |
| **combine** | 状态组合 + 类型推断 | 自动推断类型 |
| **subscribeWithSelector** | 带 selector 的订阅 | 精确监听特定状态片段 |
| **redux** | Redux 风格 reducer | 兼容 Redux 代码迁移 |

## 4.5 性能优化机制

### 4.5.1 Selector 与浅比较

Zustand 的 `useStore` 接受两个参数：

```typescript
const count = useStore((state) => state.count);  // selector
const { count, name } = useStore(
  (state) => ({ count: state.count, name: state.name }),
  shallow  // equalityFn
);
```

默认使用 `Object.is` 进行相等性比较。对于对象类型的 selector 返回值，需要使用 `shallow` 进行浅比较。

### 4.5.2 useCallback 优化 Selector

结合 `useCallback` 可以进一步优化：

```typescript
const fruit = useStore(
  useCallback((state) => state.fruits[id], [id])
);
```

当 `id` 不变时，`useCallback` 返回相同的函数引用，`useStore` 的相等性比较会跳过重渲染。

### 4.5.3 性能数据

Zustand v5 的包体积约 **1.2KB**（压缩后），通过 selector 机制可以减少 **50-90%** 的不必要重渲染。


# 五、工作原理

## 5.1 完整的数据流

```
用户操作（点击按钮）
        ↓
调用 store 中的 action
  → action 内部调用 setState
        ↓
setState 更新状态
  → 使用 Object.is 比较新旧状态
  → 如果状态变化，遍历所有 listeners
        ↓
每个 listener 被调用
  → React 组件中的 useSyncExternalStore 收到通知
  → React 重新执行组件函数
        ↓
组件执行 selector
  → 从 store 中选取需要的状态片段
  → 使用 equalityFn 比较新旧值
        ↓
如果 selector 返回值变化
  → 组件重新渲染
  → UI 更新
```

## 5.2 create 函数的执行流程

```
用户调用 create(createState)
        ↓
createImpl(createState) 被调用
        ↓
createStore(createState) 创建 vanilla store
  → 初始化 state = createState(setState, getState, api)
  → 返回 { getState, setState, subscribe, destroy }
        ↓
useBoundStore = (selector, equalityFn) => useStore(api, selector, equalityFn)
        ↓
Object.assign(useBoundStore, api)
  → useBoundStore.getState = api.getState
  → useBoundStore.setState = api.setState
  → useBoundStore.subscribe = api.subscribe
        ↓
返回 useBoundStore
```

## 5.3 组件中使用 store 的流程

```
组件调用 useStore(selector)
        ↓
useStore 调用 useSyncExternalStoreWithSelector
  → 传入 api.subscribe（订阅函数）
  → 传入 api.getState（获取快照）
  → 传入 selector（选择函数）
  → 传入 equalityFn（比较函数）
        ↓
useSyncExternalStoreWithSelector 内部：
  → 首次渲染：调用 selector(api.getState()) 获取初始值
  → 订阅：将 api.subscribe 注册到 React 的订阅系统
  → 状态变化：api.subscribe 的 listener 被触发
  → React 重新执行 selector，比较新旧值
  → 值变化则触发重渲染
```

## 5.4 持久化中间件的工作流程

```
应用启动
  ↓
persist 中间件读取存储中的数据
  → 如果有存储数据，合并到初始状态
  → 如果没有，使用默认初始状态
        ↓
应用运行
  ↓
每次 setState 被调用
  → persist 中间件拦截状态变化
  → 将新状态序列化并写入存储
        ↓
应用关闭/刷新
  → 状态已保存在存储中
        ↓
下次启动
  → 从存储中恢复状态
```

`persist` 中间件支持同步存储（localStorage）和异步存储（AsyncStorage）。


# 六、工作流程

## 6.1 安装与基础使用

### 6.1.1 安装

```bash
npm install zustand
```

### 6.1.2 创建 Store

```typescript
// stores/counterStore.ts
import { create } from 'zustand';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));

export default useCounterStore;
```

### 6.1.3 在组件中使用

```tsx
// components/Counter.tsx
import useCounterStore from '../stores/counterStore';

function Counter() {
  // 只选择需要的状态，实现按需渲染
  const count = useCounterStore((state) => state.count);
  const increment = useCounterStore((state) => state.increment);
  const decrement = useCounterStore((state) => state.decrement);

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

## 6.2 常见模式与场景

### 6.2.1 多个 Selector 组合

```tsx
// 方式一：分别选择
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);

// 方式二：对象解构 + shallow
import { shallow } from 'zustand/shallow';

const { count, increment } = useCounterStore(
  (state) => ({ count: state.count, increment: state.increment }),
  shallow
);
```

### 6.2.2 异步 Action

```typescript
interface UserState {
  user: User | null;
  loading: boolean;
  fetchUser: (id: string) => Promise<void>;
}

const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  fetchUser: async (id: string) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/users/${id}`);
      const user = await response.json();
      set({ user, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
}));
```

### 6.2.3 Store 分片（Slices）

对于大型应用，可以将 store 按领域拆分为多个切片：

```typescript
// slices/userSlice.ts
export const createUserSlice = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});

// slices/productSlice.ts
export const createProductSlice = (set) => ({
  products: [],
  addProduct: (product) => set((state) => ({ 
    products: [...state.products, product] 
  })),
});

// store/index.ts
import { create } from 'zustand';
import { createUserSlice } from './slices/userSlice';
import { createProductSlice } from './slices/productSlice';

const useStore = create((set) => ({
  ...createUserSlice(set),
  ...createProductSlice(set),
}));
```

### 6.2.4 持久化存储

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'light' ? 'dark' : 'light' 
      })),
    }),
    {
      name: 'app-settings',  // localStorage 的 key
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### 6.2.5 Redux DevTools 集成

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    { name: 'CounterStore' }  // DevTools 中显示的名称
  )
);
```

## 6.3 在 desktop-app-template 中的应用建议

基于项目特征（Electron + React + TypeScript + Vite），建议将 Zustand 用于以下场景：

| 场景 | 说明 | 示例 |
|------|------|------|
| **应用全局配置** | 主题、语言、偏好设置 | 使用 `persist` 中间件持久化 |
| **用户状态** | 登录信息、权限 | 使用 `devtools` 调试 |
| **UI 状态** | 侧边栏展开、弹窗显示 | 使用 selector 精确更新 |
| **数据缓存** | API 响应缓存 | 结合异步 action |

**推荐的目录结构**：

```
src/renderer/
├── stores/
│   ├── index.ts              ← 导出所有 store
│   ├── appStore.ts           ← 应用全局配置（持久化）
│   ├── userStore.ts          ← 用户状态
│   ├── uiStore.ts            ← UI 状态
│   └── slices/
│       ├── themeSlice.ts
│       └── layoutSlice.ts
```

## 6.4 测试策略

Zustand store 的测试非常直接：

```typescript
// stores/__tests__/counterStore.test.ts
import { create } from 'zustand';

describe('counterStore', () => {
  it('should increment count', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));
    
    const { increment } = useStore.getState();
    increment();
    expect(useStore.getState().count).toBe(1);
  });
});
```

对于 React 组件，推荐使用 **React Testing Library** + **Vitest**。

## 6.5 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 组件未更新 | selector 返回值未变化 | 检查 selector 逻辑或使用 `shallow` |
| 状态被意外重置 | `persist` 配置错误 | 检查 storage key 和存储内容 |
| TypeScript 类型错误 | 中间件类型推断问题 | 使用 `create<State>()(...)` 双重括号模式 |
| 不必要的重渲染 | 未使用 selector | 使用 selector 选择具体状态片段 |
| Store 在组件外访问 | 直接使用 `useStore.getState()` | ✅ 这是设计特性，可直接使用 |


# 七、发展历程

## 7.1 诞生与早期发展（2019-2020）

Zustand 由 pmndrs 团队创建，定位为**极简的 React 状态管理库**。

**核心设计**：基于 Hooks + 发布订阅模式，无 Provider 设计。

## 7.2 快速增长期（2021-2022）

2021 年，Zustand 成为 **Star 增长最快的 React 状态管理库**。

**关键里程碑**：
- 被越来越多的生产项目采用
- 中间件生态逐步丰富（persist、devtools、immer）

## 7.3 v4 时代（2022-2024）

稳定迭代，持续完善 TypeScript 支持和中间件系统。

## 7.4 v5 时代（2024-至今）

**v5.0.0 于 2024 年 10 月发布**，引入了破坏性变更：

| 变更 | 说明 |
|------|------|
| **移除默认导出** | 必须使用命名导出 `import { create } from 'zustand'` |
| **React 18 最低要求** | 不再支持 React 17 及以下 |
| **use-sync-external-store 作为 peer 依赖** | 减小包体积 |
| **TypeScript 4.5 最低要求** | 利用更先进的类型特性 |
| **移除 UMD/SystemJS 支持** | 只支持 ESM/CJS |

**v5 的核心改进**：使用 React 原生的 `useSyncExternalStore`，移除了 `use-sync-external-store` 的 shim 包，使包体积大幅减小。

**v5.0.15（2026 年 8 月）** ：修复了 `devtools` 和 `persist` 中间件中的一些问题。

## 7.5 生态对比

| 对比维度 | Zustand | Redux | MobX | Jotai | Valtio |
|---------|---------|-------|------|-------|--------|
| **包体积** | 1.2KB | ~10KB | ~16KB | ~3KB | ~3KB |
| **学习曲线** | 低 | 高 | 中 | 中 | 低 |
| **样板代码** | 极少 | 多 | 少 | 少 | 极少 |
| **Provider 要求** | ❌ | ✅ | ❌ | ✅ | ❌ |
| **中间件生态** | 中 | 丰富 | 中 | 中 | 中 |
| **不可变状态** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **TypeScript 支持** | 优秀 | 优秀 | 良好 | 优秀 | 优秀 |

**核心差异**：
- **Redux**：最成熟，生态最丰富，但样板代码多
- **MobX**：响应式，自动追踪依赖，但概念较多
- **Jotai**：原子化状态，适合细粒度管理
- **Valtio**：可变代理，使用最自由
- **Zustand**：在简洁性和功能性之间取得最佳平衡


## 总结

Zustand 的核心贡献可以概括为三点：

1. **极简的 API 设计**：只需 `create()` 一行代码即可创建 store，无需 Provider 包裹，无需定义 actions/reducers 等概念

2. **按需渲染的性能优化**：通过 selector + `useSyncExternalStore` 实现精准的按需更新，减少 **50-90%** 的不必要重渲染

3. **框架无关的核心 + 灵活的中间件**：`vanilla.ts` 实现核心逻辑，React 适配层独立实现；中间件系统支持按需扩展功能

对于 `desktop-app-template` 项目，Zustand 是**理想的全局状态管理方案**：

- **轻量级**：1.2KB 的体积不会增加 Electron 应用的打包体积
- **无需 Provider**：不与 React 组件树耦合，在 Electron 主进程与渲染进程通信场景中更灵活
- **TypeScript 优先**：完整的类型推断，与项目的 TypeScript 技术栈完美契合
- **持久化支持**：通过 `persist` 中间件可轻松实现用户偏好设置的本地存储
- **DevTools 集成**：通过 `devtools` 中间件可在 Redux DevTools 中调试状态变化

> **延伸阅读**：
> - [Zustand 官方文档](https://docs.pmnd.rs/zustand)
> - [Zustand GitHub 仓库](https://github.com/pmndrs/zustand)
> - [Zustand v5 迁移指南](https://docs.pmnd.rs/zustand/guides/migrating-to-v5)









END.