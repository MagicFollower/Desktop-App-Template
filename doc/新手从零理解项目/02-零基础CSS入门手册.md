# 零基础 CSS 入门手册

> 上一篇我们理解了登录逻辑，但页面上的按钮、颜色、布局是怎么来的？
> 这篇手册以项目中的 `index.css` 和 `App.css` 为起点，从零开始学习 CSS。
> 每个概念先一句话解释，再给实际代码示例——学完就能看懂项目里的样式文件。

---

# 第一部分：CSS 基础概念（从零开始）

---

## 1. 什么是 CSS

**CSS（Cascading Style Sheets，层叠样式表）** 是用来控制网页外观的语言。

如果把网页比作一个人：
- **HTML** 是骨架（结构：这里有标题、那里有按钮）
- **CSS** 是衣服（样式：标题多大、按钮什么颜色）
- **JavaScript** 是动作（交互：点击按钮后发生什么）

### CSS 文件是怎么被加载的？

在这个 Electron 项目中，CSS 的加载链路是：

```
index.html
  └─► <script src="/src/renderer/main.tsx">
        └─► import './index.css'        ← 全局样式
        └─► import './pages/pages.css'
        └─► <App />
              └─► import './App.css'    ← 应用外壳样式
```

打开 `src/renderer/main.tsx`：

```tsx
import './index.css';         // ← 引入全局样式（CSS 变量、重置、基础样式）
import './pages/pages.css';   // ← 引入页面通用样式

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

打开 `src/renderer/App.tsx`：

```tsx
import './App.css';  // ← 引入应用外壳样式
```

> 新手笔记：CSS 文件通过 `import` 语句引入后，里面的样式会自动生效。不需要像 JavaScript 那样"调用"——引入即生效。

---

## 2. CSS 规则的基本结构

一条 CSS 规则由 **选择器** 和 **声明块** 组成：

```css
选择器 {
  属性: 值;
  属性: 值;
}
```

来看 `index.css` 中的实际例子：

```css
body {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  overflow: hidden;
}
```

**拆解：**
- `body` —— **选择器**，表示"选中 `<body>` 元素"
- `{ ... }` —— **声明块**，包含一组样式声明
- `background: var(--color-bg-primary);` —— 一条声明：`background` 是属性，`var(--color-bg-primary)` 是值
- 每条声明以 **分号 `;`** 结尾

> 一句话总结：选择器告诉 CSS "对谁生效"，声明告诉它"改成什么样"。

---

## 3. 选择器入门

选择器是 CSS 最基础也最重要的部分——选不中元素，样式就无处生效。

### 3.1 元素选择器

直接用标签名选中所有该类型的元素：

```css
/* 选中所有 <body> 元素 */
body { ... }

/* 选中所有 <button> 元素 */
button { font-family: inherit; }

/* 选中所有 <input> 元素 */
input { font-family: inherit; }
```

> 来源：`index.css` 第 199-206 行

### 3.2 类选择器

用 `.类名` 选中带有特定 `class` 属性的元素：

```css
/* 选中 class="app-shell" 的元素 */
.app-shell { display: flex; }

/* 选中 class="app-shell-body" 的元素 */
.app-shell-body { display: flex; }
```

> 来源：`App.css` 第 5-22 行

HTML 中对应的写法：

```tsx
<div className="app-shell">      {/* 被 .app-shell 选中 */}
  <div className="app-shell-body"> {/* 被 .app-shell-body 选中 */}
```

### 3.3 ID 选择器

用 `#id名` 选中带有特定 `id` 属性的元素（全页面唯一）：

```css
/* 选中 id="root" 的元素（整个 React 应用的挂载点） */
#root {
  width: 100vw;
  height: 100vh;
}
```

> 来源：`index.css` 第 113-118 行

### 3.4 伪类选择器

伪类表示元素的 **特殊状态**，用 `:伪类` 表示：

```css
/* 选中正在被键盘聚焦的元素（Tab 键切到它时） */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

> 来源：`index.css` 第 193-196 行

### 3.5 伪元素选择器

伪元素表示元素的 **一部分**，用 `::伪元素` 表示：

```css
/* 选中文本被鼠标拖选时的状态 */
::selection {
  background: var(--color-accent);
  color: #fff;
}

/* 选中滚动条（WebKit 浏览器特有） */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--color-bg-primary); }
::-webkit-scrollbar-thumb { background: var(--color-border); }
```

> 来源：`index.css` 第 168-190 行

### 3.6 属性选择器

用 `[属性=值]` 选中带有特定属性值的元素：

```css
/* 选中 data-theme="light" 的元素（通常是 <html>） */
[data-theme="light"] {
  --color-bg-primary: #ffffff;
  --color-text-primary: #333333;
}
```

> 来源：`index.css` 第 30-49 行

这就是主题切换的核心——JavaScript 修改 `<html>` 的 `data-theme` 属性，CSS 自动切换变量值。

### 3.7 组合选择器

多个选择器可以组合使用，表示更精确的匹配：

```css
/* 选中 <html> 上同时有 is-electron 类时的 .app-shell 后代 */
html.is-electron .app-shell {
  background: var(--color-bg-primary);
  border-radius: 10px;
  border: 1px solid var(--color-border);
}

/* 最大化时取消圆角 */
html.is-electron.is-maximized .app-shell {
  border-radius: 0;
  border: none;
}
```

> 来源：`index.css` 第 125-144 行

**拆解 `html.is-electron .app-shell`：**
- `html` —— 元素选择器
- `.is-electron` —— 类选择器（紧跟在 html 后，无空格，表示"同一个元素同时满足"）
- `.app-shell` —— 类选择器（前面有空格，表示"后代元素"）
- 整体含义：当 `<html>` 带有 `is-electron` 类时，其内部所有 `.app-shell` 元素

---

## 4. 盒模型（Box Model）

**每个 HTML 元素都是一个"盒子"**，由内到外四层：

```
┌──────────────────────────────────────┐
│              margin（外边距）          │
│  ┌────────────────────────────────┐  │
│  │         border（边框）          │  │
│  │  ┌────────────────────────┐    │  │
│  │  │     padding（内边距）    │    │  │
│  │  │  ┌────────────────┐    │    │  │
│  │  │  │   content       │    │    │  │
│  │  │  │  （内容区域）    │    │    │  │
│  │  │  └────────────────┘    │    │  │
│  │  └────────────────────────┘    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- **content**：元素的实际内容（文字、图片等）
- **padding**：内容与边框之间的空间
- **border**：边框线
- **margin**：元素与其他元素之间的空间

### box-sizing: border-box

默认情况下，`width` 和 `height` 只包含 content，padding 和 border 会额外增加尺寸。这很反直觉。

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

> 来源：`index.css` 第 95-99 行

`box-sizing: border-box` 让 `width`/`height` **包含** padding 和 border——设了 `width: 200px` 就是 200px，不用自己算 padding 占了多少。

> 新手笔记：`*` 是通配选择器，选中页面上的所有元素。这条规则几乎是所有现代项目的标配。

---

# 第二部分：核心样式属性详解

---

## 5. 颜色与背景

### color —— 文字颜色

```css
body {
  color: var(--color-text-primary);
}
```

### background —— 背景

```css
body {
  background: var(--color-bg-primary);
}
```

### 颜色值的格式

```css
/* 十六进制（最常用） */
color: #0f0f1a;      /* 深灰近黑 */
color: #4a9eff;      /* 蓝色 */
color: #fff;         /* 白色（#ffffff 的简写） */

/* rgba() —— 带透明度 */
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
/*                     红  绿  蓝  透明度(0=全透明, 1=不透明) */
```

> 来源：`index.css` 第 20-22 行的阴影变量

---

## 6. 字体与文本

### font-family —— 字体族

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
    'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', sans-serif;
}
```

> 来源：`index.css` 第 102-104 行

**这是什么？** 这叫"系统字体栈"——用逗号分隔多个字体名，浏览器从左到右找，用第一个找到的。

- `-apple-system`：macOS/iOS 系统字体（San Francisco）
- `BlinkMacSystemFont`：macOS Chrome 专用
- `'Segoe UI'`：Windows 系统字体
- `'Roboto'`：Android 系统字体
- `sans-serif`：兜底——以上都找不到就用系统默认的无衬线字体

> 效果：在每个平台上都使用原生系统字体，看起来像"本地应用"。

### 字体平滑

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

> 来源：`index.css` 第 105-106 行

这两个属性让字体在高分屏上更细腻——去掉亚像素渲染的彩边，文字看起来更清晰。

---

## 7. 尺寸与单位

### 常用单位

```css
#root {
  width: 100vw;    /* vw = 视口宽度的百分比，100vw = 占满整个窗口宽度 */
  height: 100vh;   /* vh = 视口高度的百分比，100vh = 占满整个窗口高度 */
}
```

> 来源：`index.css` 第 114-115 行

| 单位 | 含义 | 示例 |
|------|------|------|
| `px` | 像素（固定大小） | `border-radius: 10px` |
| `vw` | 视口宽度的 1% | `width: 100vw`（= 100% 视口宽度） |
| `vh` | 视口高度的 1% | `height: 100vh`（= 100% 视口高度） |
| `%` | 父元素的百分比 | `width: 50%`（= 父元素宽度的一半） |
| `em` | 当前元素字体大小的倍数 | `padding: 1.5em` |
| `rem` | 根元素字体大小的倍数 | `font-size: 1.2rem` |

> 新手笔记：在这个项目里，`vw` 和 `vh` 用得最多——因为桌面应用需要占满整个窗口。

---

# 第三部分：复杂样式系统深入分析

---

## 8. CSS 变量与主题系统

这是 `index.css` 最核心的设计——用 CSS 变量实现多主题切换。

### 8.1 CSS 变量的基础语法

```css
/* 定义变量 */
:root {
  --my-color: #4a9eff;
}

/* 使用变量 */
body {
  color: var(--my-color);  /* 文字变成蓝色 */
}
```

- 变量名必须以 `--` 开头
- 用 `var(--变量名)` 引用
- 变量有作用域——定义在 `:root` 里的全局可用

### 8.2 `:root` 伪类

`:root` 选中 HTML 文档的根元素（`<html>`），在这里定义的变量全局可见：

```css
:root {
  --color-bg-primary: #0f0f1a;
  --color-text-primary: #e0e0e0;
  /* ... 更多变量 */
}
```

> 来源：`index.css` 第 3-28 行

> 为什么不用 `html`？`:root` 和 `html` 选中同一个元素，但 `:root` 的选择器优先级更高。

### 8.3 主题切换机制

四个主题通过属性选择器覆盖同一组变量：

```css
/* 默认暗色主题 */
:root {
  --color-bg-primary: #0f0f1a;
}

/* 亮色主题 */
[data-theme="light"] {
  --color-bg-primary: #ffffff;
}

/* 蓝色主题 */
[data-theme="blue"] {
  --color-bg-primary: #0a1929;
}

/* 绿色主题 */
[data-theme="green"] {
  --color-bg-primary: #0d1f0d;
}
```

**切换原理：**
1. JavaScript 修改 `<html>` 的 `data-theme` 属性（如 `document.documentElement.setAttribute('data-theme', 'light')`）
2. CSS 属性选择器匹配到新值，覆盖变量
3. 所有使用 `var(--color-bg-primary)` 的地方自动变色

> 这就是"一处定义、全局生效"的威力——不需要逐个元素改颜色，只改变量值。

### 8.4 Design Tokens 体系

项目定义了一整套"设计令牌"（Design Tokens），分为五类：

**颜色变量：**

```css
:root {
  /* 背景色（三级层次） */
  --color-bg-primary: #0f0f1a;      /* 主背景（最深） */
  --color-bg-secondary: #1a1a2e;    /* 次背景（侧边栏等） */
  --color-bg-tertiary: #252540;     /* 第三级背景（卡片等） */

  /* 边框色 */
  --color-border: #2a2a3e;          /* 普通边框 */
  --color-border-light: #3a3a4e;    /* 浅边框（hover 等） */

  /* 文字色（三级层次） */
  --color-text-primary: #e0e0e0;    /* 主文字（最亮） */
  --color-text-secondary: #c0c0c0;  /* 次文字 */
  --color-text-muted: #888888;      /* 弱化文字（提示、占位） */

  /* 强调色 */
  --color-accent: #4a9eff;          /* 主强调色（按钮、链接） */
  --color-accent-hover: #3a8eef;    /* 强调色 hover 状态 */

  /* 语义色 */
  --color-success: #2ecc71;         /* 成功（绿色） */
  --color-warning: #f5a623;         /* 警告（橙色） */
  --color-danger: #ff5f57;          /* 危险/错误（红色） */
  --color-purple: #9b59b6;          /* 紫色（装饰） */
  --color-pink: #ff6b9d;            /* 粉色（装饰） */
}
```

**阴影变量：**

```css
:root {
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);   /* 小阴影（按钮等） */
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);   /* 中阴影（卡片等） */
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);  /* 大阴影（弹窗等） */
}
```

**圆角变量：**

```css
:root {
  --radius-sm: 4px;    /* 小圆角（按钮、输入框） */
  --radius-md: 6px;    /* 中圆角（卡片） */
  --radius-lg: 8px;    /* 大圆角（大容器） */
}
```

**过渡变量：**

```css
:root {
  --transition-fast: 0.15s ease;     /* 快速过渡（hover） */
  --transition-normal: 0.25s ease;   /* 常规过渡（主题切换） */
}
```

### 8.5 四个主题的设计思路

| 主题 | 背景色基调 | 适用场景 |
|------|-----------|---------|
| dark（默认） | 深紫黑 `#0f0f1a` | 日常使用，护眼 |
| light | 纯白 `#ffffff` | 明亮环境 |
| blue | 深海蓝 `#0a1929` | 科技感 |
| green | 深森绿 `#0d1f0d` | 自然护眼 |

每个主题都完整定义了全部变量，确保切换后所有颜色协调一致。

### 8.6 主题系统的优势

1. **一处定义，全局复用**：改一个变量值，所有引用的地方自动更新
2. **切换简单**：只需修改 `<html>` 的一个属性
3. **易于扩展**：新增主题只需加一组变量覆盖
4. **代码可读性**：`var(--color-danger)` 比 `#ff5f57` 含义更清晰

---

## 9. Flexbox 弹性布局

`App.css` 和 `index.css` 大量使用 Flexbox——这是现代 CSS 布局的核心。

### 9.1 Flex 容器与项目

当一个元素设置 `display: flex`，它就变成了 **Flex 容器**，它的直接子元素自动成为 **Flex 项目**。

```
┌─────────── Flex 容器 ───────────┐
│  ┌─────┐  ┌─────┐  ┌─────┐     │
│  │项目1│  │项目2│  │项目3│     │
│  └─────┘  └─────┘  └─────┘     │
└─────────────────────────────────┘
```

### 9.2 `display: flex` 的效果

默认情况下，块级元素（如 `div`）从上到下排列，宽度占满。设置 `display: flex` 后：
- 子元素默认 **横向排列**（从左到右）
- 子元素的宽度由内容决定（不再自动占满）

### 9.3 `flex-direction: column`

改变排列方向为纵向（从上到下）：

```css
.app-shell {
  display: flex;
  flex-direction: column;  /* 子元素纵向排列 */
}
```

> 来源：`App.css` 第 6-7 行

```
┌─────── Flex 容器 (column) ───────┐
│  ┌─────────────────────────┐     │
│  │      项目1（标题栏）      │     │
│  └─────────────────────────┘     │
│  ┌─────────────────────────┐     │
│  │      项目2（内容区）      │     │
│  └─────────────────────────┘     │
└──────────────────────────────────┘
```

### 9.4 `flex: 1` 的含义

`flex: 1` 是三个属性的简写：

```css
flex: 1;
/* 等价于 */
flex-grow: 1;      /* 允许增长，占满剩余空间 */
flex-shrink: 1;    /* 允许收缩 */
flex-basis: 0%;    /* 初始大小为 0 */
```

**通俗理解：** `flex: 1` 表示"有多余空间就平均分"。

```css
.app-shell-body {
  flex: 1;  /* 占满标题栏之外的所有剩余空间 */
}
```

> 来源：`App.css` 第 19 行

### 9.5 `min-height: 0` 的陷阱

这是一个经典的 Flexbox 坑：

```css
.app-shell {
  flex: 1;
  min-height: 0;   /* ← 为什么需要这个？ */
  overflow: hidden;
}
```

> 来源：`App.css` 第 10 行

**问题：** Flex 子项的 `min-height` 默认是 `auto`（= 内容高度），而不是 `0`。这意味着如果子元素内容很多，它会撑开容器而不是出现滚动条。

**解决：** 显式设置 `min-height: 0`，告诉浏览器"允许缩小到比内容更小"，配合 `overflow: hidden` 裁切溢出内容。

> 新手笔记：如果 flex 布局中子元素"关不住"、总是被内容撑开，加 `min-height: 0` 试试。

### 9.6 `overflow: hidden` 与 flex 的配合

```css
.app-shell {
  overflow: hidden;  /* 裁切超出容器的内容 */
}
```

在 flex 布局中，`overflow: hidden` 有两个作用：
1. 防止子元素溢出（配合 `min-height: 0`）
2. 创建新的块级格式化上下文（BFC），避免外边距折叠等问题

### 9.7 嵌套 Flex 层级结构

项目的布局是一个嵌套 flex 结构：

```
#root (flex, column, 100vh)
  └─► .app-shell (flex, column, flex:1)
        ├─► <TitleBar />        ← 固定高度
        └─► .app-shell-body (flex, column, flex:1)
              └─► .app-layout (flex, row, flex:1)
                    ├─► <Sidebar />    ← 固定宽度
                    └─► .app-main (flex:1)
                          ├─► <Header />
                          ├─► <TabBar />
                          └─► <main>   ← 内容区
```

每一层都是 flex 容器，子元素通过 `flex: 1` 或固定尺寸分配空间。

---

## 10. Electron 窗口样式系统

这是桌面应用特有的样式需求——普通网页不需要考虑这些。

### 10.1 无边框窗口

主进程配置了 `frame: false`，去掉了系统标题栏：

```ts
// src/main/main.ts
mainWindow = new BrowserWindow({
  frame: false,      // ← 去掉系统标题栏
  titleBarStyle: 'hidden',
});
```

没有系统标题栏，就需要用 HTML/CSS 自己画一个——这就是 `TitleBar` 组件。

### 10.2 透明窗口与 CSS 配合

```ts
mainWindow = new BrowserWindow({
  transparent: true,  // ← 窗口背景透明
});
```

`transparent: true` 让窗口背景透明，这样 CSS 的圆角才能"切掉"四角，透出桌面。如果窗口不透明，圆角外面会填满方角背景。

### 10.3 `html.is-electron` 条件样式

```css
/* 仅在 Electron 环境生效 */
html.is-electron,
html.is-electron body,
html.is-electron #root {
  background: transparent;
}
```

> 来源：`index.css` 第 125-129 行

**为什么需要条件？** 同一个前端代码在浏览器里也能跑（开发调试用）。浏览器里不需要圆角和透明背景，所以这些样式只在 Electron 环境生效。

`is-electron` 类由 `App.tsx` 在检测到 `window.electronAPI` 后添加到 `<html>` 上。

### 10.4 圆角外壳实现

```css
html.is-electron .app-shell {
  background: var(--color-bg-primary);  /* 外壳承担背景色 */
  border-radius: 10px;                  /* 圆角 */
  border: 1px solid var(--color-border); /* 1px 描边 */
}
```

> 来源：`index.css` 第 133-138 行

**原理：**
1. `html/body/#root` 都透明
2. `.app-shell` 作为最外层"外壳"承担背景色
3. `border-radius: 10px` 裁切四角为圆角
4. `border` 让圆角边缘在深色主题下更清晰

### 10.5 最大化状态处理

```css
html.is-electron.is-maximized .app-shell {
  border-radius: 0;   /* 最大化时直角 */
  border: none;       /* 取消描边 */
}
```

> 来源：`index.css` 第 141-144 行

最大化时窗口占满屏幕，不需要圆角和描边——贴合系统行为。

`is-maximized` 类由 `App.tsx` 监听主进程的最大化事件动态切换。

### 10.6 为什么需要链式透明声明

```css
html.is-electron,
html.is-electron body,
html.is-electron #root {
  background: transparent;
}
```

三个选择器分别设置透明——因为每一层默认都有自己的背景色。必须从外到内全部透明，圆角之外才能透出桌面而非被某层的背景填满。

---

# 第四部分：高级特性

---

## 11. CSS Reset（全局重置）

### 为什么需要 reset？

不同浏览器对 HTML 元素有不同的默认样式。比如：
- `<body>` 默认有 8px 的 margin
- `<h1>` 到 `<h6>` 有默认字号和 margin
- `<button>` 在不同系统上长得不一样

Reset 把这些默认样式统一清零，保证跨浏览器一致性。

### 通配重置

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

> 来源：`index.css` 第 95-99 行

- `*` 选中所有元素
- `margin: 0` 去掉外边距
- `padding: 0` 去掉内边距
- `box-sizing: border-box` 统一盒模型计算方式

### 继承重置

```css
button { font-family: inherit; }
input { font-family: inherit; }
```

> 来源：`index.css` 第 199-206 行

`button` 和 `input` 默认不继承父元素的字体。`font-family: inherit` 强制继承，保证全局字体一致。

---

## 12. 伪元素与自定义滚动条

### 文本选中样式

```css
::selection {
  background: var(--color-accent);  /* 选中背景色 = 强调色 */
  color: #fff;                       /* 选中文字 = 白色 */
}
```

> 来源：`index.css` 第 187-190 行

浏览器默认的选中文本是蓝底白字。这里改成与主题一致的强调色。

### 自定义滚动条

```css
/* 滚动条整体 */
::-webkit-scrollbar {
  width: 8px;     /* 竖向滚动条宽度 */
  height: 8px;    /* 横向滚动条高度 */
}

/* 滚动条轨道 */
::-webkit-scrollbar-track {
  background: var(--color-bg-primary);
}

/* 滚动条滑块 */
::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-sm);
}

/* 滑块 hover 状态 */
::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-light);
}
```

> 来源：`index.css` 第 168-184 行

浏览器默认滚动条又粗又丑。这里自定义了 8px 窄滚动条，颜色跟随主题。

> 注意：`::-webkit-scrollbar` 只在 Chrome/Safari/Edge 等 WebKit 浏览器生效。

### 键盘焦点样式

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

> 来源：`index.css` 第 193-196 行

`:focus-visible` 只在 **键盘导航**（Tab 键）时显示焦点环，鼠标点击不显示——兼顾可访问性和美观。

---

## 13. 过渡与动画

### transition 属性

```css
body {
  transition: background var(--transition-normal),
              color var(--transition-normal);
}
```

> 来源：`index.css` 第 110 行

`transition` 让属性变化时有平滑过渡效果，而不是瞬间切换。

**拆解：**
- `background` —— 要过渡的属性
- `var(--transition-normal)` —— 过渡时长（0.25s）+ 缓动函数（ease）

**效果：** 切换主题时，背景色和文字颜色在 0.25 秒内平滑渐变，而不是突然跳变。

---

# 第五部分：重新审视两份样式文件

---

## 14. 回顾 index.css 的整体架构

现在重新看 `index.css`，它的组织结构清晰明了：

```
index.css（207 行）
│
├─ 第 1-91 行：CSS Variables（Design Tokens）
│   ├─ :root              → 暗色主题（默认）
│   ├─ [data-theme=light] → 亮色主题
│   ├─ [data-theme=blue]  → 蓝色主题
│   └─ [data-theme=green] → 绿色主题
│
├─ 第 93-99 行：Global Reset
│   └─ * { margin/padding/box-sizing }
│
├─ 第 101-118 行：Base Styles
│   ├─ body    → 字体、背景、文字颜色
│   └─ #root   → 视口尺寸、flex 容器
│
├─ 第 120-158 行：Electron 窗口样式
│   ├─ html.is-electron        → 透明背景
│   ├─ html.is-electron .app-shell → 圆角外壳
│   ├─ .is-maximized           → 取消圆角
│   ├─ .app / .app-body        → 遗留布局类
│   └─ .main-content           → 遗留布局类
│
├─ 第 167-184 行：滚动条样式
│   └─ ::-webkit-scrollbar 系列
│
├─ 第 186-196 行：选中 & 焦点样式
│   ├─ ::selection
│   └─ :focus-visible
│
└─ 第 198-207 行：表单元素重置
    ├─ button { font-family: inherit }
    └─ input { font-family: inherit }
```

**设计决策总结：**
1. **变量先行**：文件开头 91 行全是变量定义——所有颜色、阴影、圆角、过渡都在这里
2. **重置优先**：变量之后立即 reset，确保后续样式在一致的基础上构建
3. **条件样式隔离**：Electron 特有样式用 `.is-electron` 类守护，不影响浏览器调试
4. **渐进增强**：基础样式 → 平台特化 → 交互细节

---

## 15. 回顾 App.css 的设计思路

`App.css` 只有 23 行——为什么这么少？

```css
/* App.css */
.app-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.app-shell-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

**原因：职责分离。**

- `index.css` 负责全局基础（变量、重置、平台特化）
- `App.css` 只负责应用外壳的布局骨架
- 具体组件（标题栏、侧边栏、登录页等）各自有自己的 CSS 文件

`.app-shell` 和 `.app-shell-body` 是两个纯布局容器：

```
.app-shell（纵向 flex）
  ├─ TitleBar（固定高度，由 TitleBar.css 控制）
  └─ .app-shell-body（纵向 flex，flex:1 撑满剩余空间）
        └─ 路由内容（由各自的 CSS 控制）
```

它们不关心内容长什么样——只负责"标题栏在上、内容撑满"这个骨架。

---

## 16. 样式系统的整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                    CSS 变量系统                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Dark    │ │  Light   │ │  Blue    │ │  Green   │   │
│  │ (默认)   │ │          │ │          │ │          │   │
│  │ :root    │ │ [light]  │ │ [blue]   │ │ [green]  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       └────────────┴────────────┴────────────┘          │
│                        │                                 │
│              var(--color-*)  引用                        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    布局系统（Flexbox）                    │
│                                                          │
│  #root (flex, column, 100vh)                            │
│    └─ .app-shell (flex, column, flex:1)    ← App.css    │
│         ├─ TitleBar                        ← TitleBar.css│
│         └─ .app-shell-body (flex, column)  ← App.css    │
│              └─ .app-layout (flex, row)    ← AppLayout  │
│                   ├─ Sidebar               ← Sidebar.css │
│                   └─ .app-main             ← AppLayout   │
│                         ├─ Header          ← Header.css  │
│                         ├─ TabBar          ← TabBar.css  │
│                         └─ <Outlet />      ← 各页面 CSS  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 Electron 窗口样式系统                      │
│                                                          │
│  html.is-electron → 透明背景                              │
│    └─ .app-shell → 背景色 + 圆角 + 描边                   │
│         └─ html.is-electron.is-maximized → 去圆角去描边    │
│                                                          │
│  条件类：is-electron（App.tsx 检测 electronAPI 后添加）    │
│          is-maximized（监听主进程事件动态切换）              │
└──────────────────────────────────────────────────────────┘
```

---

## 速查表：本项目 CSS 中出现的属性

| 属性 | 作用 | 出现位置 |
|------|------|---------|
| `display: flex` | 启用弹性布局 | 多处 |
| `flex-direction: column` | 纵向排列子元素 | `.app-shell` 等 |
| `flex: 1` | 占满剩余空间 | `.app-shell-body` 等 |
| `min-height: 0` | 允许 flex 子项缩小 | `.app-shell` 等 |
| `overflow: hidden` | 裁切溢出内容 | `.app-shell` 等 |
| `background` | 背景色 | `body` 等 |
| `color` | 文字颜色 | `body` 等 |
| `border-radius` | 圆角 | `.app-shell`、滚动条等 |
| `border` | 边框 | `.app-shell` 等 |
| `transition` | 过渡动画 | `body` |
| `box-sizing` | 盒模型计算方式 | `*` |
| `var(--*)` | 引用 CSS 变量 | 全局 |
| `font-family` | 字体 | `body`、`button`、`input` |

---

---

# 第六部分：Flexbox 从零到精通

> 前面第 9 章介绍了 Flexbox 的基本概念。这一部分将系统地、由浅入深地讲解 Flexbox 的每个知识点。
> 每个概念都配有**最小可验证示例**——你可以直接复制 HTML + CSS 代码到浏览器中查看效果。

---

## 17. Level 1：基础排列

### 17.1 `display: flex`——一切从这里开始

**一句话：** 给父元素设置 `display: flex`，子元素就从"上下堆叠"变成"左右横排"。

**最小可验证示例：**

```html
<!-- 把这段代码保存为 .html 文件，用浏览器打开即可看到效果 -->
<div class="container">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<style>
.container {
  display: flex;         /* ← 就这一行，子元素就横排了 */
  gap: 10px;             /* 子元素之间的间距 */
  background: #eee;
  padding: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 20px 30px;
  border-radius: 4px;
}
</style>
```

**效果：** 三个方块 A B C 横向排列，间距 10px。

**不使用 flex 时：** 三个 div 默认是块级元素，会从上到下堆叠。加了 `display: flex` 后，它们变成横向排列。

**使用场景：**
- 导航栏（logo + 菜单项 + 用户头像）
- 按钮组（确定 + 取消）
- 任何需要"一排元素"的场景

### 17.2 `flex-direction`——改变排列方向

**一句话：** `flex-direction` 控制子元素的排列方向。

**最小可验证示例：**

```html
<div class="row">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<div class="column">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<style>
.row {
  display: flex;
  flex-direction: row;       /* 默认值：从左到右横排 */
  gap: 10px;
  margin-bottom: 20px;
  background: #eee;
  padding: 10px;
}
.column {
  display: flex;
  flex-direction: column;    /* 从上到下竖排 */
  gap: 10px;
  background: #eee;
  padding: 10px;
  width: 200px;              /* 给个固定宽度方便看效果 */
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
</style>
```

**效果：**
- `.row`：A B C 从左到右横排
- `.column`：A B C 从上到下竖排

| 值 | 效果 | 使用场景 |
|---|---|---|
| `row`（默认） | 从左到右横排 | 导航栏、按钮组 |
| `row-reverse` | 从右到左横排 | 右对齐的按钮组 |
| `column` | 从上到下竖排 | 侧边栏、表单字段 |
| `column-reverse` | 从下到上竖排 | 聊天消息（新消息在底部） |

---

## 18. Level 2：对齐控制

### 18.1 `justify-content`——主轴对齐

**一句话：** `justify-content` 控制子元素在**主轴方向**上的分布方式。

> 主轴 = flex-direction 的方向。`row` 时主轴是水平的，`column` 时主轴是垂直的。

**最小可验证示例：**

```html
<!-- 依次查看每种效果：把 justify-content 的值换一下就行 -->
<div class="demo">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<style>
.demo {
  display: flex;
  justify-content: space-between;  /* ← 换这个值看效果 */
  background: #eee;
  padding: 10px;
  margin-bottom: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
</style>
```

**6 个值逐一说明：**

| 值 | 效果 | 示意图 |
|---|---|---|
| `flex-start`（默认） | 全部靠左 | `[A B C          ]` |
| `flex-end` | 全部靠右 | `[          A B C]` |
| `center` | 整体居中 | `[   A B C   ]` |
| `space-between` | 首尾贴边，中间等距 | `[A    B    C]` |
| `space-around` | 每个元素两侧等距 | `[  A   B   C  ]` |
| `space-evenly` | 所有间距完全相等 | `[ A  B  C ]` |

**使用场景：**
- `center`：居中弹窗、居中按钮
- `space-between`：导航栏（logo 靠左、菜单靠右）
- `space-evenly`：底部 Tab 栏等分

### 18.2 `align-items`——交叉轴对齐

**一句话：** `align-items` 控制子元素在**交叉轴方向**（与主轴垂直）上的对齐方式。

**最小可验证示例：**

```html
<div class="demo">
  <div class="item small">A</div>
  <div class="item large">B</div>
  <div class="item small">C</div>
</div>

<style>
.demo {
  display: flex;
  align-items: center;    /* ← 换这个值看效果 */
  height: 150px;           /* 给个高度才能看出对齐差异 */
  background: #eee;
  padding: 10px;
  gap: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
.small { height: 30px; }
.large { height: 60px; }
</style>
```

**4 个值逐一说明：**

| 值 | 效果 | 示意图（侧视） |
|---|---|---|
| `stretch`（默认） | 拉伸填满容器高度 | 所有方块等高 |
| `flex-start` | 顶部对齐 | 顶部齐平，底部参差不齐 |
| `center` | 垂直居中 | 中线对齐 |
| `flex-end` | 底部对齐 | 底部齐平，顶部参差不齐 |

**使用场景：**
- `center` + `justify-content: center` = **完美居中**（最经典的居中方案）
- `stretch`：让不等高的卡片统一高度
- `flex-start`：表单标签与输入框顶部对齐

**完美居中公式（必记）：**

```css
.center-everything {
  display: flex;
  justify-content: center;   /* 水平居中 */
  align-items: center;       /* 垂直居中 */
}
```

---

## 19. Level 3：间距分配

### 19.1 `gap`——现代间距方案

**一句话：** `gap` 直接设置子元素之间的间距，不需要给子元素加 margin。

**最小可验证示例：**

```html
<!-- 用 gap -->
<div class="with-gap">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<!-- 用 margin（旧方案） -->
<div class="with-margin">
  <div class="item">A</div>
  <div class="item" style="margin-left: 10px;">B</div>
  <div class="item" style="margin-left: 10px;">C</div>
</div>

<style>
.with-gap {
  display: flex;
  gap: 10px;          /* ← 一行搞定所有间距 */
  background: #eee;
  padding: 10px;
  margin-bottom: 10px;
}
.with-margin {
  display: flex;
  background: #eee;
  padding: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
</style>
```

**gap vs margin 对比：**

| 维度 | `gap` | `margin` |
|------|-------|----------|
| 代码量 | 一行 `gap: 10px` | 每个子元素都要加 margin |
| 首尾多余间距 | 无（只在子元素之间有间距） | 有（第一个元素左边也有） |
| 可读性 | 高（意图明确） | 低（需要算哪个元素加哪边） |

**使用场景：**
- 卡片网格（`gap: 20px` 统一间距）
- 按钮组（`gap: 8px`）
- 表单字段（`gap: 16px`）

### 19.2 `space-between` vs `gap` 的区别

**关键区别：**

- `gap: 10px`：子元素之间 10px，**首尾没有额外间距**
- `justify-content: space-between`：首元素贴左、末元素贴右，**中间等距分配剩余空间**

```html
<!-- gap：子元素之间固定 20px，首尾不贴边 -->
<div class="gap-demo">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<!-- space-between：首尾贴边，中间自动分配 -->
<div class="between-demo">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>

<style>
.gap-demo {
  display: flex;
  gap: 20px;
  background: #eee;
  padding: 10px;
  margin-bottom: 10px;
}
.between-demo {
  display: flex;
  justify-content: space-between;
  background: #eee;
  padding: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
</style>
```

**效果差异：**
- `gap: 20px` → `[|A--B--C|]`（间距固定 20px，首尾有 padding 的间距）
- `space-between` → `[A------B------C]`（A 贴左，C 贴右，间距自动填满）

---

## 20. Level 4：弹性伸缩

### 20.1 `flex-grow`——分配剩余空间

**一句话：** `flex-grow` 决定子元素如何**瓜分容器中的剩余空间**。

**最小可验证示例：**

```html
<div class="demo">
  <div class="item grow-0">grow:0</div>
  <div class="item grow-1">grow:1</div>
  <div class="item grow-2">grow:2</div>
</div>

<style>
.demo {
  display: flex;
  gap: 10px;
  background: #eee;
  padding: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
}
.grow-0 { flex-grow: 0; }   /* 不增长，保持内容宽度 */
.grow-1 { flex-grow: 1; }   /* 占 1 份剩余空间 */
.grow-2 { flex-grow: 2; }   /* 占 2 份剩余空间（宽度是 grow:1 的两倍） */
</style>
```

**效果：**
- `grow:0` 的方块保持文字内容的宽度
- `grow:1` 和 `grow:2` 瓜分剩余空间，`grow:2` 分到的宽度是 `grow:1` 的两倍

### 20.2 `flex-shrink`——空间不足时收缩

**一句话：** `flex-shrink` 决定空间不够时，子元素**收缩的比例**。

```css
.item-no-shrink {
  flex-shrink: 0;   /* 不收缩！即使空间不够也保持原始宽度 */
}
```

**使用场景：** 侧边栏设置 `flex-shrink: 0`，保证内容区压缩时侧边栏不被压扁。

### 20.3 `flex-basis`——初始主轴尺寸

**一句话：** `flex-basis` 设置子元素在分配剩余空间**之前**的初始大小。

```css
.item {
  flex-basis: 200px;   /* 初始宽度 200px，之后 flex-grow 在此基础上分配剩余 */
}
```

### 20.4 `flex: 1` 完整拆解

```css
flex: 1;
/* 等价于 */
flex-grow: 1;       /* 允许增长 */
flex-shrink: 1;     /* 允许收缩 */
flex-basis: 0%;     /* 初始尺寸为 0，所有空间都是"剩余空间" */
```

**通俗理解：** `flex: 1` = "我不坚持任何初始大小，所有空间都按比例分"。

**最小可验证示例——经典侧边栏布局：**

```html
<div class="layout">
  <div class="sidebar">侧边栏（固定 200px）</div>
  <div class="content">内容区（flex:1，占满剩余空间）</div>
</div>

<style>
.layout {
  display: flex;
  height: 300px;
  background: #eee;
}
.sidebar {
  width: 200px;          /* 固定宽度 */
  flex-shrink: 0;        /* 不收缩 */
  background: #333;
  color: white;
  padding: 20px;
}
.content {
  flex: 1;               /* 占满剩余空间 */
  min-width: 0;          /* 防止内容撑开 */
  background: white;
  padding: 20px;
}
</style>
```

**使用场景：**
- 侧边栏固定 + 内容自适应
- 表单中 label 固定宽度 + input 自适应
- 任何"一部分固定、一部分弹性"的布局

---

## 21. Level 5：换行与多行

### 21.1 `flex-wrap`——允许换行

**一句话：** 默认 flex 子元素不会换行（挤在一行）。`flex-wrap: wrap` 让它们装不下就换行。

**最小可验证示例：**

```html
<div class="demo">
  <div class="item">卡片 1</div>
  <div class="item">卡片 2</div>
  <div class="item">卡片 3</div>
  <div class="item">卡片 4</div>
  <div class="item">卡片 5</div>
  <div class="item">卡片 6</div>
</div>

<style>
.demo {
  display: flex;
  flex-wrap: wrap;       /* 装不下就换行 */
  gap: 10px;
  background: #eee;
  padding: 10px;
  /* 缩小窗口试试——卡片会自动换行 */
}
.item {
  flex-basis: 150px;     /* 每个卡片至少 150px 宽 */
  flex-grow: 1;          /* 多余空间平分 */
  background: #4a9eff;
  color: white;
  padding: 20px;
  border-radius: 4px;
  text-align: center;
}
</style>
```

**效果：** 窗口宽时一行放 4-5 个卡片，窗口窄时自动换行变成 2-3 个——这就是**响应式卡片网格**。

### 21.2 `align-content`——多行对齐

**一句话：** 当 flex 容器有多行内容时，`align-content` 控制这些行在交叉轴上的分布。

| 值 | 效果 |
|---|---|
| `stretch`（默认） | 各行拉伸填满容器 |
| `flex-start` | 所有行靠上 |
| `flex-end` | 所有行靠下 |
| `center` | 所有行居中 |
| `space-between` | 首行贴顶、末行贴底，中间等距 |

**使用场景：** 标签云、多行卡片列表。

---

## 22. Level 6：顺序控制

### 22.1 `order`——改变视觉顺序

**一句话：** `order` 改变子元素的**视觉排列顺序**，不需要改 HTML 结构。

**最小可验证示例：**

```html
<div class="demo">
  <div class="item first">第1个 DOM</div>
  <div class="item second">第2个 DOM</div>
  <div class="item third">第3个 DOM</div>
</div>

<style>
.demo {
  display: flex;
  gap: 10px;
  background: #eee;
  padding: 10px;
}
.item {
  background: #4a9eff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
.first  { order: 3; }   /* DOM 第1个，但视觉上排第3 */
.second { order: 1; }   /* DOM 第2个，视觉上排第1 */
.third  { order: 2; }   /* DOM 第3个，视觉上排第2 */
</style>
```

**效果：** 视觉顺序变成 "第2个 DOM → 第3个 DOM → 第1个 DOM"。

**使用场景：**
- 移动端重排（PC 端侧边栏在右，移动端侧边栏在上）
- 不修改 HTML 结构调整排列顺序
- SEO 优化（重要内容放 HTML 前面，视觉上可以调到后面）

> 注意：默认 `order: 0`，数值越小越靠前。

---

---

# 第七部分：Flexbox 实战——不规则数据布局

> 学了上面的知识，现在来做一个实战练习。
> 需求：8 行数据，每行的数据条数和对齐方式都不同。

## 23. 需求说明

| 行号 | 数据条数 | 对齐方式 |
|------|---------|----------|
| 第 1 行 | 5 条 | 间距一致，左右贴边 |
| 第 2 行 | 3 条 | 左、中、右 |
| 第 3 行 | 2 条 | 左、中 |
| 第 4 行 | 1 条 | 左 |
| 第 5 行 | 2 条 | 中、右 |
| 第 6 行 | 1 条 | 右 |
| 第 7 行 | 1 条 | 居中 |
| 第 8 行 | 2 条 | 左、右 |

---

## 24. 方案一：Flexbox 实现

### 完整代码

```html
<div class="flex-layout">
  <!-- 第1行：5条，间距一致，左右贴边 -->
  <div class="row row-1">
    <div class="cell">1-1</div>
    <div class="cell">1-2</div>
    <div class="cell">1-3</div>
    <div class="cell">1-4</div>
    <div class="cell">1-5</div>
  </div>

  <!-- 第2行：3条，左中右 -->
  <div class="row row-2">
    <div class="cell">2-1</div>
    <div class="cell">2-2</div>
    <div class="cell">2-3</div>
  </div>

  <!-- 第3行：2条，左中 -->
  <div class="row row-3">
    <div class="cell">3-1</div>
    <div class="cell">3-2</div>
  </div>

  <!-- 第4行：1条，左 -->
  <div class="row row-4">
    <div class="cell">4-1</div>
  </div>

  <!-- 第5行：2条，中右 -->
  <div class="row row-5">
    <div class="cell">5-1</div>
    <div class="cell">5-2</div>
  </div>

  <!-- 第6行：1条，右 -->
  <div class="row row-6">
    <div class="cell">6-1</div>
  </div>

  <!-- 第7行：1条，居中 -->
  <div class="row row-7">
    <div class="cell">7-1</div>
  </div>

  <!-- 第8行：2条，左右 -->
  <div class="row row-8">
    <div class="cell">8-1</div>
    <div class="cell">8-2</div>
  </div>
</div>

<style>
.flex-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.row {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.cell {
  background: #4a9eff;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  min-width: 60px;
  text-align: center;
}

/* 第1行：5条，间距一致，左右贴边 */
.row-1 { justify-content: space-between; }

/* 第2行：3条，左中右 */
.row-2 { justify-content: space-between; }

/* 第3行：2条，左中 */
.row-3 { justify-content: flex-start; }

/* 第4行：1条，左 */
.row-4 { justify-content: flex-start; }

/* 第5行：2条，中右 */
.row-5 { justify-content: flex-end; }

/* 第6行：1条，右 */
.row-6 { justify-content: flex-end; }

/* 第7行：1条，居中 */
.row-7 { justify-content: center; }

/* 第8行：2条，左右 */
.row-8 { justify-content: space-between; }
</style>
```

### 每行实现思路解析

| 行号 | 需求 | Flexbox 方案 | 思路 |
|------|------|-------------|------|
| 第1行 | 5条，间距一致，左右贴边 | `justify-content: space-between` | 首尾贴边，中间自动等距 |
| 第2行 | 3条，左中右 | `justify-content: space-between` | 同上，3个元素时正好左中右 |
| 第3行 | 2条，左中 | `justify-content: flex-start` | 全部靠左，用 gap 控制间距 |
| 第4行 | 1条，左 | `justify-content: flex-start` | 默认就是靠左 |
| 第5行 | 2条，中右 | `justify-content: flex-end` | 全部靠右，用 gap 控制间距 |
| 第6行 | 1条，右 | `justify-content: flex-end` | 默认就是靠右 |
| 第7行 | 1条，居中 | `justify-content: center` | 整体居中 |
| 第8行 | 2条，左右 | `justify-content: space-between` | 首尾贴边 |

> 核心发现：这个需求几乎只用了一个属性 `justify-content` 就搞定了！这就是 Flexbox 的强大之处。

---

# 第八部分：Table 实现同一布局

## 25. 方案二：Table 实现（无边框版）

### 完整代码

```html
<table class="table-layout borderless">
  <!-- 第1行：5条，间距一致，左右贴边 -->
  <tr>
    <td>1-1</td><td>1-2</td><td>1-3</td><td>1-4</td><td>1-5</td>
  </tr>
  <!-- 第2行：3条，左中右 -->
  <tr>
    <td>2-1</td><td></td><td>2-2</td><td></td><td>2-3</td>
  </tr>
  <!-- 第3行：2条，左中 -->
  <tr>
    <td>3-1</td><td></td><td>3-2</td><td></td><td></td>
  </tr>
  <!-- 第4行：1条，左 -->
  <tr>
    <td>4-1</td><td></td><td></td><td></td><td></td>
  </tr>
  <!-- 第5行：2条，中右 -->
  <tr>
    <td></td><td></td><td>5-1</td><td></td><td>5-2</td>
  </tr>
  <!-- 第6行：1条，右 -->
  <tr>
    <td></td><td></td><td></td><td></td><td>6-1</td>
  </tr>
  <!-- 第7行：1条，居中 -->
  <tr>
    <td></td><td></td>
    <td style="text-align:center;">7-1</td>
    <td></td><td></td>
  </tr>
  <!-- 第8行：2条，左右 -->
  <tr>
    <td>8-1</td><td></td><td></td><td></td><td>8-2</td>
  </tr>
</table>

<style>
.table-layout {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.table-layout td {
  padding: 8px 16px;
  vertical-align: middle;
}
.table-layout tr {
  background: white;
}
.table-layout tr + tr {
  border-top: 8px solid #f5f5f5;  /* 行间距 */
}

/* 无边框版本 */
.borderless td {
  border: none;
}

/* 单元格内容样式 */
.table-layout td:not(:empty) {
  background: #4a9eff;
  color: white;
  border-radius: 4px;
  text-align: center;
  min-width: 60px;
}
</style>
```

### Table 实现的思路

1. 固定 5 列（因为最多的一行有 5 条数据）
2. 用空 `<td>` 占位，控制数据出现在哪一列
3. 用 `text-align` 控制单元格内容的对齐
4. 用 `tr + tr` 的 `border-top` 模拟行间距

> 难点：第 7 行（居中）在 table 里很难实现——因为只有 1 个数据但要占中间列，需要手动计算列位置。

---

## 26. 方案二补充：Table 实现（有边框版）

```html
<table class="table-layout bordered">
  <!-- 内容同上，只是样式不同 -->
  <tr>
    <td>1-1</td><td>1-2</td><td>1-3</td><td>1-4</td><td>1-5</td>
  </tr>
  <!-- ... 其余行同上 ... -->
</table>

<style>
/* 有边框版本 */
.bordered,
.bordered td {
  border: 1px solid #ccc;
}
.bordered td {
  padding: 8px 16px;
  text-align: center;
  background: white;
}
.bordered tr:nth-child(even) {
  background: #f9f9f9;   /* 斑马纹 */
}
</style>
```

---

# 第九部分：Flexbox vs Table 对比分析

## 27. 全面对比

| 维度 | Flexbox | Table |
|------|---------|-------|
| **语义** | 布局工具，与内容语义无关 | 数据表格，天然表示行列数据 |
| **代码复杂度** | 每行一个 div + justify-content，清晰直观 | 需要空 td 占位、手动计算列位置 |
| **对齐灵活性** | 极高：一个属性切换 6 种对齐 | 有限：只能 text-align + 空单元格占位 |
| **响应式** | 天然支持：窗口缩小自动适应 | 困难：表格列宽固定，窄屏会溢出 |
| **动态数据** | 友好：数据增减自动调整布局 | 不友好：需要重新计算占位 |
| **可访问性** | 一般：屏幕阅读器不知道是"数据表" | 好：天然语义化，屏幕阅读器能正确解读 |
| **浏览器兼容** | IE11+（现代浏览器全支持） | 全兼容（包括 IE6） |
| **打印友好** | 一般 | 好：表格打印时保持结构 |

## 28. 各自适用场景

### Flexbox 适用场景

- **UI 布局**：导航栏、侧边栏、卡片、按钮组
- **不规则对齐**：每行元素数量和对齐方式不同
- **响应式布局**：需要适配不同屏幕尺寸
- **动态数据**：数据条数不固定，需要自动调整
- **移动端优先**：需要灵活的重排能力

### Table 适用场景

- **结构化数据展示**：财务报表、数据对比表、统计结果
- **严格的行列对齐**：每一列的数据类型相同，需要严格对齐
- **可访问性要求高**：屏幕阅读器需要正确解读数据关系
- **打印输出**：需要打印成纸质报告
- **固定结构**：数据行列数固定，不需要动态调整

## 29. 本需求的最优方案推荐

**结论：本需求用 Flexbox。**

**理由：**

1. **不规则对齐**：每行数据条数不同（1-5条），对齐方式也不同——这正是 Flexbox 的强项，`justify-content` 一个属性就能切换
2. **代码简洁**：Flexbox 实现只需设置每行的 `justify-content`，不需要空单元格占位
3. **动态适应**：如果未来需求变化（比如某行多加一个数据），Flexbox 自动适应，Table 需要重新计算列位置
4. **响应式友好**：Flexbox 布局在窄屏上可以自然适应，Table 会溢出

**Table 更好的场景（本需求不适用，但值得了解）：**

如果需求是"展示一个 8 行 5 列的数据矩阵，每个单元格都有数据，需要严格对齐"，那 Table 更合适——因为数据本身就是结构化的行列关系，用 Table 语义更准确，代码也更直观。

---

> 下一篇预告：理解组件级样式——从 TitleBar、Sidebar、LoginPage 的 CSS 文件深入组件样式设计。
