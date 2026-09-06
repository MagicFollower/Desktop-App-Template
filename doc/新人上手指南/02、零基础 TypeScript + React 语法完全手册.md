创建时间：2026年9月5日16:00:13

---

> **致正在读这份文档的你：**
> 如果你和我当年一样，看到 `<>` 和 `{}` 混在一起就头皮发麻，看到 `=>` 不知道它和 `=` 有什么区别，看到 `interface` 以为是哪个英文单词的拼写错误——
> **别怕。** 这份手册就是为你准备的。
>
> 下面的每一个章节，都来自 `TabBar.tsx`、`Sidebar.tsx`、`Dashboard.tsx` 这三个文件里**真实出现的语法**。我把它们拆碎到“字”的级别，用当年我最希望有人告诉我的方式，重新讲给你听。

---

## 第一章：变量声明与基础数据类型（"放东西的盒子"）

> **本章解决的核心问题：** 代码里的 `const`、`let`、`string`、`number` 到底是什么？为什么有的变量能改，有的不能改？

### 1.1 `const` 与 `let` —— 可变与不变的盒子

**真实代码来源：** `Sidebar.tsx` 中的 `const [expandedFolders, setExpandedFolders]`、`Dashboard.tsx` 中的 `let` 用法

**语法原型：**
```tsx
const 变量名 = 值;    // 一旦赋值，不能再改
let 变量名 = 值;      // 可以随时重新赋值
```

**真实示例（来自 Dashboard.tsx）：**
```tsx
// 这是真实代码，我把每个符号拆开讲给你听
const [uptime, setUptime] = useState('1天');
// ^^^^^ 这一整行里出现了 const
// const 的意思是：uptime 这个"变量名"永远指向同一个"盒子"，不能换盒子。
// 但注意！盒子里的"内容"可以通过 setUptime 来换，这是 React 的规矩。

let totalKeys = 192569;  // 如果这里用了 let，表示 totalKeys 这个变量可以重新赋值
totalKeys = 200000;      // ✅ 合法，let 允许这样改
// totalKeys 这个盒子里现在装的是 200000
```

**新人拆解：**
- **`const`（constant 的缩写）**：翻译成中文叫"常量"。想象你在墙上钉了一个钉子（变量名），钉子钉死了拔不下来，但你可以在钉子上挂不同的东西（值）——等等不对！在 React 里，`const` 的"盒子"确实不能换，但盒子里的东西可以通过特定方式更新。**你就记住：React 里 90% 的情况都用 `const`，极少用 `let`。**
- **`let`**：就是普通的名字标签，你可以把标签从 A 盒子撕下来，贴到 B 盒子上。

**语法硬核翻译：**
```tsx
// 你可能会看到这样的写法：
const onClick = () => { console.log('点了我'); };
// 翻译：定义了一个"名叫 onClick 的箭头函数"，且这个函数名不能再指向别的函数了。
```

---

### 1.2 `string`、`number`、`boolean` —— 数据的三原色

**真实代码来源：** `TabBar.tsx` 的 `interface Tab` 定义

**语法原型：**
```tsx
string    // 文本，用引号包起来："你好" 或 '你好' 或 `你好`
number    // 数字：1, 2.5, -100
boolean   // 布尔值：true（真）或 false（假）
```

**真实示例（来自 TabBar.tsx）：**
```tsx
interface Tab {
  id: string;      // id 必须是一段文字，比如 "json" 或 "login"
  label: string;   // label 必须是一段文字，比如 "首页" 或 "设置"
  icon: string;    // icon 也是一段文字，比如 "📦" 或 "S"
  // 注意：如果某个属性是可选的，在后面加问号：badge?: number
}
```

**新人拆解：**
- **`string`** = 任何带引号的东西。`"abc"`、`'你好'`、`` `模板字符串` `` 都是 string。
- **`number`** = 数字，不需要引号。`1`、`2.5`、`-3` 都是 number。
- **`boolean`** = 只有两个值：`true`（真/是）和 `false`（假/否）。

**语法硬核翻译：**
```tsx
let name: string = "张三";   // 冒号后的 string 是"类型注解"，告诉编译器：这个变量只能装文字
let age: number = 25;        // 只能装数字
let isActive: boolean = true; // 只能装 true 或 false

// ❌ 如果写错了，编译器会报错：
// name = 123;  // 报错！因为 name 被声明为 string，不能赋值为 number
```

---

### 1.3 模板字符串 —— 拼字游戏的最优解

**真实代码来源：** `TabBar.tsx` 中的 `` `tab ${activeTab === tab.id ? 'active' : ''}` ``

**语法原型：**
```tsx
`文字 ${表达式} 文字`
// 用反引号（键盘左上角，1 键左边的那个）包起来
// ${} 里面可以放任何 JS 表达式，会被计算并拼接到字符串里
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 这是真实代码，我拆给你看：
<div className={`tab ${activeTab === tab.id ? 'active' : ''}`}>
//            ^^^^  ^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//           文字  开始  这是 JS 表达式，会被计算
//                 插入
//
// 假设 activeTab = 'home'，tab.id = 'home'：
// 那么 `${activeTab === tab.id ? 'active' : ''}` 的结果是 'active'
// 整个字符串变成：'tab active'
//
// 假设 activeTab = 'home'，tab.id = 'settings'：
// 那么结果就是 ''（空字符串）
// 整个字符串变成：'tab '
```

**新人拆解：**
- 反引号 `` ` `` 不是单引号 `'`！它在键盘左上角，和 `~` 同一个键。
- 模板字符串里可以**直接换行**，普通字符串不行。
- `${}` 是一个"插槽"，里面可以放任何 JS 代码：变量、运算、三元表达式（`条件 ? 值1 : 值2`）。

**语法硬核翻译：**
```tsx
// 普通字符串拼接（老派写法）：
const message = '你好，' + name + '！今天天气' + weather;

// 模板字符串（新潮写法）：
const message = `你好，${name}！今天天气${weather}`;

// 看到没？区别就是：不需要一堆 + 号，干净多了。
```

---

## 第二章：函数 —— 一切的发动机

> **本章解决的核心问题：** `function` 和 `=>` 到底有什么区别？参数怎么传？`void` 是什么鬼？

### 2.1 函数声明 vs 函数表达式 —— 两种写法，一个意思

**真实代码来源：** `TabBar.tsx` 的 `function TabBar(...)`、`Sidebar.tsx` 的 `function Sidebar(...)`

**语法原型：**
```tsx
// 写法一：函数声明（"命名的独立段落"）
function 函数名(参数) {
  // 要做的事情
}

// 写法二：函数表达式（"赋值给变量的函数"）
const 函数名 = function(参数) {
  // 要做的事情
};
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 这是真实代码 —— 函数声明写法
function TabBar({ tabs, activeTab, onTabChange, onAddTab, onCloseTab }: TabBarProps) {
  // 函数体
  return ( ... );
}

// 如果你看到这样的写法（函数表达式）：
const TabBar = function({ tabs, activeTab }: TabBarProps) {
  return ( ... );
};

// 或者更常见的箭头函数写法：
const TabBar = ({ tabs, activeTab }: TabBarProps) => {
  return ( ... );
};
```

**新人拆解：**
- **函数声明（`function 名字(){}`）**：像是"造了一个机器，给它起了个名字"。这个机器可以在代码的任何地方被调用。
- **函数表达式（`const 名字 = function(){}`）**：像是"造了一个机器，把它塞进一个盒子里，盒子贴了标签"。这个机器只能在盒子被声明之后才能用。
- 在 React 组件中，**三种写法都可以**，项目里统一用 `function` 声明，因为更清晰。

**语法硬核翻译：**
```tsx
// 函数的基本结构：
function 做某事(参数1, 参数2) {
  // 步骤1
  // 步骤2
  return 结果;  // 如果没有 return，默认返回 undefined
}

// 调用函数（执行它）：
做某事('值1', '值2');  // 把 '值1' 传给 参数1，把 '值2' 传给 参数2
```

---

### 2.2 箭头函数 `() => {}` —— 减肥版的函数

**真实代码来源：** `TabBar.tsx` 的 `onClick={() => onTabChange(tab.id)}`、`Sidebar.tsx` 的 `treeData.map(node => renderNode(node))`

**语法原型：**
```tsx
// 完整形式：
(参数) => {
  // 函数体
  return 结果;
}

// 简化形式（只有一行，直接返回）：
(参数) => 结果
// 注意：这个写法自带 return，不需要写 return 关键字
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 场景1：点击事件里包一层箭头函数
<button onClick={() => onTabChange(tab.id)}>点击</button>
// 拆解：
// () => onTabChange(tab.id) 翻译成大白话：
// "造一个没有参数的函数，这个函数的作用是：调用 onTabChange 并传入 tab.id"
// 为什么要包一层？因为如果不包，代码一渲染就立刻执行了，而不是等点击。

// 场景2：map 里的箭头函数
{tabs.map(tab => (
  <div key={tab.id}>{tab.label}</div>
))}
// 拆解：
// tab => (...) 翻译成大白话：
// "对数组里的每个元素（我管它叫 tab），执行后面的操作，操作结果是那个 div"
// 如果写成传统的函数：
// {tabs.map(function(tab) { return <div>{tab.label}</div>; })}
// 箭头函数省掉了 function 和 return，简洁多了。
```

**新人拆解：**
- **`=>` 的读法**：在脑子里替换成 **"变成"** 或 **"执行"**。
  - `tab => <div>{tab.label}</div>` → **"tab 变成这段 div"**
  - `() => onTabChange(tab.id)` → **"执行 onTabChange"**
- **什么时候加 `()`，什么时候不加？**
  - 只有一个参数时，括号可以省略：`tab => ...` ✅
  - 零个或多个参数时，必须加括号：`() => ...`、`(a, b) => ...`
- **什么时候加 `{}`，什么时候不加？**
  - 如果函数体只有一行且直接返回，不加 `{}`，不写 `return`：`(a) => a + 1`
  - 如果函数体有多行，必须加 `{}`，且要写 `return`：

```tsx
const myFunc = (a) => {
  const b = a + 1;
  const c = b * 2;
  return c;
};
```

---

### 2.3 函数参数与返回值 —— 输入输出说明书

**真实代码来源：** `TabBar.tsx` 中的 `onTabChange: (tabId: string) => void`

**语法原型：**
```tsx
// 定义函数时，声明它接收什么参数、返回什么值
function 函数名(参数名: 类型): 返回类型 {
  return 值;  // 值的类型必须匹配"返回类型"
}

// 如果什么都不返回，返回类型写 void
function 只做事不返回值(): void {
  console.log('我干活，但不给回馈');
}
```

**真实示例（来自 TabBar.tsx 的 interface 定义）：**
```tsx
interface TabBarProps {
  // 这是一个函数类型的参数：
  // 它接收一个 string 类型的参数（叫 tabId），并且不返回任何值（void）
  onTabChange: (tabId: string) => void;
  
  // 这是一个不接收参数、不返回值的函数
  onAddTab: () => void;
  
  // 这是一个接收 string 参数、返回值也是 string 的函数
  getLabel: (id: string) => string;
}
```

**新人拆解：**
- **参数的类型写在冒号后面**：`(参数名: 类型)`
- **返回值的类型写在括号后面、大括号前面**：`(参数): 返回类型`
- **`void`** 的意思是"空"，表示这个函数不返回任何东西，只是"做一件事"（比如打印、保存、修改状态）。
- **如果函数返回一个 React 组件（JSX）**，返回类型是 `JSX.Element` 或 `ReactNode`。

**语法硬核翻译：**
```tsx
// 一个完整的函数签名拆解：
function greet(name: string): string {
//      ^^^^^  ^^^^^^^  ^^^^^^  ^^^^^^
//      函数名  参数     参数类型 返回类型
  return `你好，${name}`;  // 返回的值必须是 string
}

// 调用时：
const result = greet('张三');  // result 的类型自动被推断为 string
console.log(result);  // 输出：你好，张三

// 如果写错了返回类型：
function badGreet(name: string): string {
  return 123;  // ❌ 报错！123 是 number，不是 string
}
```

---

## 第三章：数组 —— 数据的货架

> **本章解决的核心问题：** `[]` 是什么意思？`.map()` 怎么用？`...` 三个点是什么鬼？

### 3.1 数组的创建与存取 —— 带编号的储物柜

**真实代码来源：** `TabBar.tsx` 中的 `tabs: Tab[]`、`Sidebar.tsx` 中的 `treeData`

**语法原型：**
```tsx
// 创建数组
const 数组名 = [元素1, 元素2, 元素3];  // 用方括号包起来，逗号分隔

// 读取数组元素（索引从 0 开始）
数组名[0]  // 第一个元素
数组名[1]  // 第二个元素
数组名.length  // 数组长度（元素个数）
```

**真实示例（来自 Sidebar.tsx）：**
```tsx
// 这是一个真实的数组定义（我精简了）
const treeData: TreeNode[] = [
  // [    ^^^^^^      ^^
  //  数组名          数组类型注解：TreeNode[] 表示"里面全是 TreeNode 类型"
  {
    id: 'json',
    label: 'json',
    type: 'folder',
    children: [
      { id: 'string', label: 'string', type: 'folder' },
      { id: 'json5', label: 'json5', type: 'file' }
    ]
  },
  { id: 'login', label: 'login', type: 'folder' }
];

// 访问数组元素：
treeData[0]  // 拿到第一个对象：{ id: 'json', label: 'json', ... }
treeData[0].children  // 拿到第一个对象的 children 数组
treeData[0].children[0]  // 拿到 { id: 'string', label: 'string', type: 'folder' }
treeData.length  // 2（因为树数据里有两个顶层节点）
```

**新人拆解：**
- **数组**就是"一排带编号的柜子"，编号从 0 开始。
- `类型[]` 表示"这是一个数组，里面装的都是这个类型"：
  - `string[]` = 文字数组：`['a', 'b', 'c']`
  - `number[]` = 数字数组：`[1, 2, 3]`
  - `Tab[]` = Tab 对象数组
- 访问数组元素用 **`[索引]`**，索引从 0 开始。

**语法硬核翻译：**
```tsx
const fruits = ['苹果', '香蕉', '橘子'];
// fruits[0] → '苹果'
// fruits[1] → '香蕉'
// fruits[2] → '橘子'
// fruits[3] → undefined（因为没有第 4 个，不报错，返回 undefined）

// 修改数组元素：
fruits[1] = '草莓';  // 现在数组变成 ['苹果', '草莓', '橘子']

// 添加新元素：
fruits.push('西瓜');  // 现在数组变成 ['苹果', '草莓', '橘子', '西瓜']
```

---

### 3.2 `.map()` —— 流水线工人

**真实代码来源：** `TabBar.tsx` 中的 `{tabs.map(tab => (...))}`、`Sidebar.tsx` 中的 `treeData.map(node => renderNode(node))`

**语法原型：**
```tsx
数组.map((当前元素, 索引) => {
  // 对每个元素做点什么
  return 新值;
});
// 返回值：一个"新数组"，长度和原数组一样，但每个元素都被"加工"过了
```

**真实示例（来自 TabBar.tsx）：**
```tsx
{tabs.map(tab => (
//     ^^^  ^^^  ^^
//  数组  遍历  箭头函数
//  名字  操作  把每个 tab "变成" 后面的 div
  <div key={tab.id} className="tab">
    <span className="tab-icon">{tab.icon}</span>
    <span className="tab-label">{tab.label}</span>
  </div>
))}
```

**新人拆解：**
- `.map()` 翻译成大白话：**"遍历这个数组里的每一项，对每一项执行一个操作，把操作结果收集起来形成新数组"**。
- **原数组不会被修改**，`map` 返回一个全新的数组。
- 在 React 中，`map` 几乎只用来做一件事：**把数据数组变成 JSX 元素数组**。

**语法硬核翻译：**
```tsx
// 假设有一个数字数组：
const numbers = [1, 2, 3, 4, 5];

// 用 map 把每个数字翻倍：
const doubled = numbers.map(num => num * 2);
// doubled → [2, 4, 6, 8, 10]
// numbers → [1, 2, 3, 4, 5]（没变！）

// 用 map 把数字变成字符串描述：
const descriptions = numbers.map(num => `这是数字${num}`);
// descriptions → ['这是数字1', '这是数字2', '这是数字3', '这是数字4', '这是数字5']

// 用 map 把对象数组变成 JSX：
const users = [{id: 1, name: '张三'}, {id: 2, name: '李四'}];
const userList = users.map(user => <li key={user.id}>{user.name}</li>);
// userList → [<li>张三</li>, <li>李四</li>]
```

**⚠️ 核心注意：** `map` 必须配合 `key` 使用（见第 7.3 节）。

---

### 3.3 展开运算符 `...` —— 拆包与打包

**真实代码来源：** `Sidebar.tsx` 中的 `const next = new Set(prev);`（其实 Set 的用法也算一种集合操作，但展开运算符在 React 中极其常用）

**语法原型：**
```tsx
// 展开数组（拆开）
const 新数组 = [...旧数组, 新元素];
// 展开对象（合并）
const 新对象 = { ...旧对象, 新属性: 值 };
```

**真实示例（React 中的常见用法）：**
```tsx
// 场景：在 Sidebar 中修改 Set 集合
setExpandedFolders(prev => {
  const next = new Set(prev);  // 复制一份旧的 Set
  next.add(id);                // 添加新元素
  return next;
});

// 如果用数组表示展开操作（常见于 React state 更新）：
const [list, setList] = useState(['a', 'b']);
const addItem = (item) => {
  setList([...list, item]);  // 展开旧数组，追加新元素
  // 结果：['a', 'b', 'c']
};

// 删除某个元素（配合 filter）：
const removeItem = (id) => {
  setList(list.filter(item => item.id !== id));
};
```

**新人拆解：**
- `...` 叫**展开运算符**，作用是把数组或对象"拆开"，把里面的东西"倒出来"。
- 在 React 中，**修改 state 时必须创建新对象/新数组**，不能直接修改旧对象。`...` 是创建新对象/新数组最常用的方式。
- 三个点放在哪里：
  - `[...旧数组, 新元素]` → 把旧数组的所有元素倒出来，再追加新元素
  - `[新元素, ...旧数组]` → 新元素放在最前面
  - `{ ...旧对象, 新属性: 值 }` → 把旧对象的所有属性复制过来，再添加或覆盖新属性

**语法硬核翻译：**
```tsx
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];

// 合并数组：
const combined = [...arr1, ...arr2];
// combined → [1, 2, 3, 4, 5, 6]

// 复制数组（创建新数组，不是引用）：
const copy = [...arr1];
// copy → [1, 2, 3]，但 copy 和 arr1 是两个独立的数组

const obj1 = { name: '张三', age: 25 };
const obj2 = { ...obj1, city: '北京' };
// obj2 → { name: '张三', age: 25, city: '北京' }

// 覆盖属性：
const obj3 = { ...obj1, age: 30 };
// obj3 → { name: '张三', age: 30 }（age 被覆盖了）
```

---

## 第四章：对象 —— 有名字的收藏盒

> **本章解决的核心问题：** `{ }` 在对象和代码块里分别什么意思？怎么访问对象的属性？`?.` 是干什么的？

### 4.1 对象的创建与属性访问 —— 带标签的抽屉

**真实代码来源：** `TabBar.tsx` 的 `interface Tab`、`Sidebar.tsx` 的 `treeData` 数组里的对象

**语法原型：**
```tsx
// 创建对象（用花括号 { }）
const 对象名 = {
  属性名1: 值1,
  属性名2: 值2,
};

// 访问属性（两种方式）：
对象名.属性名        // 点号方式（最常用）
对象名['属性名']     // 方括号方式（属性名是字符串）
```

**真实示例（来自 Sidebar.tsx）：**
```tsx
// 这是一个真实的对象（树节点）
const node = {
  id: 'json',        // 属性名: 属性值
  label: 'json',
  type: 'folder',
  icon: '📦',
  badge: 8,
  children: [        // 属性值可以是一个数组
    { id: 'string', label: 'string', type: 'folder' },
    { id: 'json5', label: 'json5', type: 'file' }
  ]
};

// 访问属性：
node.id        // 'json'
node.type      // 'folder'
node.children  // 一个数组
node.children[0]  // { id: 'string', label: 'string', type: 'folder' }
node.children[0].id  // 'string'

// 如果访问不存在的属性：
node.xxx       // undefined（不报错，返回 undefined）
```

**新人拆解：**
- **对象**就是"一组带名字的抽屉"，每个抽屉都有一个标签（属性名），里面装着东西（属性值）。
- 属性值可以是任何类型：`string`、`number`、`boolean`、`数组`、`对象`、`函数`……
- 访问属性用 **点号 `.`**：`对象.属性名`。如果属性名是动态的，用方括号：`对象['属性名']`

**语法硬核翻译：**
```tsx
const person = {
  name: '张三',
  age: 25,
  isStudent: false,
  address: {
    city: '北京',
    street: '长安街'
  },
  hobbies: ['读书', '跑步']
};

person.name          // '张三'
person.address.city  // '北京'
person.hobbies[0]    // '读书'

// 修改属性：
person.age = 26;     // 把 age 从 25 改成 26

// 添加新属性：
person.phone = '123456789';

// 删除属性（不常用）：
delete person.isStudent;
```

---

### 4.2 对象的解构与简写 —— 懒人取物法

**真实代码来源：** `TabBar.tsx` 中的 `function TabBar({ tabs, activeTab, ... }: TabBarProps)`

**语法原型：**
```tsx
// 解构赋值：从对象里"抽"出属性，变成独立变量
const { 属性名1, 属性名2 } = 对象;

// 属性简写：如果变量名和属性名一样，可以缩写
const name = '张三';
const obj = { name };  // 等同于 { name: name }
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 这是真实代码：
function TabBar({ tabs, activeTab, onTabChange, onAddTab, onCloseTab }: TabBarProps) {
  // 拆解：
  // function TabBar( props ) 这是原本的样子
  // 但 props 是一个对象，里面有 tabs、activeTab、onTabChange 等属性
  // 使用解构 { tabs, activeTab, ... } 直接从 props 里把属性"抽"出来
  // 这样在函数体里就可以直接用 tabs，而不需要写 props.tabs
}

// 如果不用解构，代码会是这样：
function TabBar(props: TabBarProps) {
  // 要用 props.tabs，props.activeTab，写起来很啰嗦
  console.log(props.tabs);
  console.log(props.activeTab);
}

// 用了解构之后：
function TabBar({ tabs, activeTab }: TabBarProps) {
  console.log(tabs);      // 直接用，省掉了 props.
  console.log(activeTab);
}
```

**新人拆解：**
- **解构赋值**的本质是"从盒子里把东西拿出来，贴上自己的标签"。
- 写在函数参数位置的解构，叫**参数解构**，是 React 组件中最常见的写法。
- **属性简写**：当你要创建一个对象，属性名和变量名相同时，可以只写一遍：

```tsx
// 啰嗦写法：
const name = '张三';
const age = 25;
const person = { name: name, age: age };

// 简洁写法（属性简写）：
const person = { name, age };
```

**语法硬核翻译：**
```tsx
const user = { id: 1, name: '李四', age: 30 };

// 基础解构：
const { name, age } = user;
console.log(name);  // '李四'
console.log(age);   // 30

// 重命名解构（把 name 重命名为 userName）：
const { name: userName, age: userAge } = user;
console.log(userName);  // '李四'

// 嵌套对象解构：
const person = { name: '张三', address: { city: '北京', street: '长安街' } };
const { address: { city } } = person;
console.log(city);  // '北京'

// 默认值（如果属性不存在）：
const { phone = '无' } = user;
console.log(phone);  // '无'（因为 user 里没有 phone 属性）
```

---

### 4.3 可选链 `?.` —— 小心翼翼的探险家

**真实代码来源：** `Dashboard.tsx` 中的 `mockData?.connectedClients ?? 2`

**语法原型：**
```tsx
对象?.属性名        // 如果对象存在，才访问属性；否则返回 undefined
对象?.属性名?.属性名  // 可以链式使用
```

**真实示例（来自 Dashboard.tsx）：**
```tsx
// 真实代码：
<div className="stat-value">
  {mockData?.connectedClients || 2}
  {/*  ^^^^^^^^ ^  ^^^^^^^^^^^^^^^^^
      对象     ?. 如果 mockData 存在，才去找 connectedClients
                 如果 mockData 是 null 或 undefined，直接返回 undefined
  */}
</div>

// 不安全的写法（会报错）：
{mockData.connectedClients}
// 如果 mockData 是 null，这行会报错：Cannot read properties of null

// 安全的写法（用了 ?.）：
{mockData?.connectedClients}
// 如果 mockData 是 null，返回 undefined，不会报错

// 加默认值（配合 ?? 使用）：
{mockData?.connectedClients ?? 2}
// undefined ?? 2 → 2
// null ?? 2 → 2
// 5 ?? 2 → 5（有值就用值）
```

**新人拆解：**
- `?.` 翻译成大白话：**"前面这东西存在吗？存在我就继续；不存在我就收手，不报错"**。
- 它防止的是 **`Cannot read property of null/undefined`** 这种经典错误。
- 配合 `??`（空值合并运算符）使用：`前面的值 ?? 默认值`，意思是"前面的值如果是 `null` 或 `undefined`，就用默认值"。

**语法硬核翻译：**
```tsx
const user = { name: '张三', address: { city: '北京' } };
const emptyUser = null;

// 安全访问深层属性：
user?.address?.city      // '北京'
emptyUser?.address?.city // undefined（不报错！）

// 对比不安全写法：
// user.address.city      // '北京'
// emptyUser.address.city // ❌ 报错！

// 可选链也可以用在函数调用上：
const obj = { getName: () => '张三' };
obj.getName?.()     // '张三'

const obj2 = {};
obj2.getName?.()    // undefined（不报错，因为 getName 不存在）

// 数组也可以：
const arr = null;
arr?.[0]            // undefined
```

---

## 第五章：TypeScript 类型系统 —— 代码的"合同"

> **本章解决的核心问题：** `interface` 是干什么的？`: string` 是什么意思？`<>` 尖括号在类型里是什么？

### 5.1 类型注解 —— 给变量贴标签

**真实代码来源：** 所有文件中的 `: string`、`: number`、`: Tab[]` 等

**语法原型：**
```tsx
let 变量名: 类型 = 值;
function 函数名(参数名: 类型): 返回类型 { ... }
```

**真实示例（来自 TabBar.tsx）：**
```tsx
interface TabBarProps {
  tabs: Tab[];              // tabs 的类型是 Tab 数组
  activeTab: string;        // activeTab 的类型是 string
  onTabChange: (tabId: string) => void;  // 函数类型
  //               ^^^^^^                  参数 tabId 是 string
  //                           ^^^^       返回值是 void
}
```

**新人拆解：**
- **类型注解**就是"给变量贴个标签，告诉 TypeScript 这个变量只能装什么类型的东西"。
- 它只在**写代码时**起作用（开发阶段），等代码编译成 JavaScript 后，这些标签就消失了，不影响运行。
- 它的作用是**提前发现错误**：如果你把一个 `number` 赋值给声明为 `string` 的变量，编辑器会立刻画红线提醒你。

**语法硬核翻译：**
```tsx
// 基本类型注解：
let name: string = '张三';     // 只能赋 string
let age: number = 25;          // 只能赋 number
let isActive: boolean = true;  // 只能赋 true 或 false

// 数组类型注解：
let list1: string[] = ['a', 'b'];  // 只能是字符串数组
let list2: number[] = [1, 2, 3];   // 只能是数字数组

// 对象类型注解（用接口定义，见下一节）：
let user: { name: string; age: number } = { name: '张三', age: 25 };

// 联合类型（可以是多种类型之一）：
let id: string | number = 'abc';  // 可以是 string 或 number
id = 123;  // ✅ 合法

// 可选属性（用 ? 标记）：
let config: { url: string; timeout?: number } = { url: 'http://...' };
// timeout 可有可无
```

---

### 5.2 `interface` 接口 —— 合同范本

**真实代码来源：** `TabBar.tsx` 的 `interface Tab`、`interface TabBarProps`、`Sidebar.tsx` 的 `interface TreeNode`

**语法原型：**
```tsx
interface 接口名 {
  属性名: 类型;
  属性名?: 类型;   // ? 表示可选
}
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 定义一个"合同"：任何符合 Tab 接口的对象，必须有这三个属性
interface Tab {
  id: string;
  label: string;
  icon: string;
}

// 使用这个合同：
const myTab: Tab = {
  id: 'home',
  label: '首页',
  icon: '🏠'
  // 如果少了任何一个属性，TypeScript 会报错
};

// 接口里可以包含函数：
interface TabBarProps {
  tabs: Tab[];
  onTabChange: (tabId: string) => void;  // 这是一个函数
  //              ^^^^^^                   参数
  //                         ^^^^          返回值
}
```

**新人拆解：**
- **`interface`** 翻译成大白话：**"一份合同/契约"**。
- 它定义了一个对象**必须长什么样**（有哪些属性，每个属性是什么类型）。
- 如果某个属性是可选的，加 `?`：`badge?: number`。
- 接口可以被**扩展**（`extends`），一个接口可以继承另一个接口的所有属性。
- 在 React 中，每个组件的 Props 都必须定义成接口，这样使用组件时就知道该传哪些参数。

**语法硬核翻译：**
```tsx
// 基础接口：
interface Person {
  name: string;
  age: number;
  phone?: string;  // 可选属性
}

const p1: Person = { name: '张三', age: 25 };          // ✅ 合法
const p2: Person = { name: '李四', age: 30, phone: '123' }; // ✅ 合法
// const p3: Person = { name: '王五' };  // ❌ 报错：缺少 age

// 接口扩展（继承）：
interface Employee extends Person {
  employeeId: string;   // 多了工号
  department: string;   // 多了部门
}

const emp: Employee = {
  name: '赵六',
  age: 28,
  employeeId: 'E001',
  department: '研发部'
};

// 接口也可以描述函数：
interface GreetFunction {
  (name: string): string;  // 这是一个函数类型：接收 string，返回 string
}

const greet: GreetFunction = (name) => `你好，${name}`;
```

---

### 5.3 泛型 `<T>` —— 万能贴纸

**真实代码来源：** `Sidebar.tsx` 的 `useState<Set<string>>(...)`

**语法原型：**
```tsx
// 泛型尖括号 <T> 是一个"类型占位符"
const [state, setState] = useState<T>(初始值);
// 使用时可以指定具体类型：useState<string>('') 或 useState<number>(0)
```

**真实示例（来自 Sidebar.tsx）：**
```tsx
// 真实代码：
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
  new Set(['json', 'string'])
);
// 拆解：
// useState<Set<string>>(...)
//         ^^^^^^^^^^^^ 这是泛型参数
//         告诉 TypeScript：这个 state 装的是 Set 集合，集合里的元素都是 string
// 
// 如果不用泛型，TypeScript 不知道这个 state 是做什么的，可能推断错误

// 另一个例子（你可能会在项目里用到）：
const [user, setUser] = useState<User | null>(null);
// 表示：这个 state 可以是 User 对象，也可以是 null
// 泛型参数是 User | null（联合类型）
```

**新人拆解：**
- **尖括号 `<>`** 在类型系统里表示**泛型参数**，你可以把它理解为"类型的变量"。
- 用生活场景类比：`useState` 是一个"万能盒子"，你往盒子上贴一个标签 `<Set<string>>`，告诉别人"这个盒子里只能装字符串集合"。
- 泛型让**同一个函数可以处理多种类型**，而不需要为每种类型写重复代码。

**语法硬核翻译：**
```tsx
// 场景：一个简单的"盒子"函数
function Box<T>(value: T): T {
  return value;
}

// 使用方式 1：显式指定类型
const result1 = Box<string>('hello');  // result1 的类型是 string

// 使用方式 2：让 TypeScript 自动推断（根据传入的值）
const result2 = Box(123);  // result2 的类型被推断为 number

// 更复杂的例子：泛型数组
function getFirst<T>(arr: T[]): T {
  return arr[0];
}

const firstNum = getFirst<number>([1, 2, 3]);  // firstNum 类型是 number
const firstStr = getFirst<string>(['a', 'b']); // firstStr 类型是 string

// 多个泛型参数：
function swap<T, U>(a: T, b: U): [U, T] {
  return [b, a];
}
const swapped = swap<string, number>('hello', 123);
// swapped 的类型是 [number, string]
```

---

## 第六章：React 组件基础 —— 积木的制造与拼装

> **本章解决的核心问题：** `function Component()` 是什么？`props` 是什么？怎么把组件拼在一起？

### 6.1 函数组件的定义 —— 积木制造机

**真实代码来源：** `TabBar.tsx` 的 `function TabBar(...)`、`Sidebar.tsx` 的 `function Sidebar(...)`

**语法原型：**
```tsx
function 组件名({ 参数解构 }: 组件Props接口): JSX.Element {
  // 逻辑代码
  return (
    // JSX（HTML 标签）
  );
}
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 这是一个完整的组件定义
function TabBar({ tabs, activeTab, onTabChange, onAddTab, onCloseTab }: TabBarProps) {
  //                                           ^^^^^^^^^^^^
  //                                           这就是"积木的接口说明"
  //                                           告诉外面：要使用这个组件，需要给我传这些数据
  
  return (
    <div className="tab-bar">
      {/* 组件内部逻辑 */}
    </div>
  );
}

// 组件名必须大写开头（TabBar ✅，tabBar ❌）
// 这样可以和普通的 HTML 标签区分开
```

**新人拆解：**
- **组件**就是一个**返回 JSX 的函数**。
- 组件名**必须大写开头**（React 规定）。
- 组件接收一个参数 `props`（属性），里面包含了从父组件传过来的所有数据。
- `return` 后面跟的 `()` 里面是 JSX，描述这个组件长什么样。

**语法硬核翻译：**
```tsx
// 最简单的组件：
function Greeting() {
  return <h1>你好，世界</h1>;
}

// 带参数的组件：
function GreetingUser({ name }: { name: string }) {
  return <h1>你好，{name}</h1>;
}

// 使用组件：
function App() {
  return (
    <div>
      <Greeting />                    {/* 不需要传参数 */}
      <GreetingUser name="张三" />    {/* 传 name 参数 */}
    </div>
  );
}
```

---

### 6.2 Props 的使用 —— 快递包裹签收指南

**真实代码来源：** `TabBar.tsx` 中所有从 `props` 里解构出来的变量

**语法原型：**
```tsx
// 父组件传数据：
<Child 属性名1={值1} 属性名2={值2} />

// 子组件接收数据：
function Child({ 属性名1, 属性名2 }: ChildProps) {
  // 可以直接使用 属性名1 和 属性名2
}
```

**真实示例（来自 TabBar.tsx 的使用场景）：**
```tsx
// 父组件（App.tsx）使用 TabBar：
function App() {
  const tabs = [
    { id: 'dashboard', label: '仪表盘', icon: '📊' },
    { id: 'settings', label: '设置', icon: '⚙️' }
  ];
  
  return (
    <TabBar 
      tabs={tabs}                           // 传数组
      activeTab="dashboard"                 // 传字符串
      onTabChange={(id) => console.log(id)} // 传函数
      onAddTab={() => console.log('添加')}   // 传函数
      onCloseTab={(id) => console.log('关闭', id)} // 传函数
    />
  );
}

// 子组件（TabBar）接收：
function TabBar({ tabs, activeTab, onTabChange, onAddTab, onCloseTab }: TabBarProps) {
  // tabs → 是一个数组
  // activeTab → 是字符串 'dashboard'
  // onTabChange → 是一个函数
  // 可以在组件内部任意使用这些变量
}
```

**新人拆解：**
- **Props 的传递方向是单向的**：父 → 子。
- Props **是只读的**，子组件不能修改 Props 的值（如果要修改，需要通过回调函数通知父组件）。
- 在 JSX 中，传给组件的属性名可以**直接用花括号包 JS 表达式**：`activeTab={activeTab}`，也可以**直接传字符串**：`title="标题"`（相当于 `title="标题"` 等价于 `title={'标题'}`）。
- 函数类型 Prop 的命名通常以 `on` 开头：`onClick`、`onChange`、`onSubmit`。

**语法硬核翻译：**
```tsx
// Props 的几种写法：
<Child 
  name="张三"              // 字符串（不需要花括号）
  age={25}                 // 数字（需要花括号）
  isActive={true}          // 布尔值（需要花括号）
  user={{ id: 1, name: '李四' }}  // 对象（双层花括号）
  onClick={() => alert('点击')}   // 函数（花括号里是箭头函数）
/>
```

---

### 6.3 `children` 属性 —— 预留的插槽

**真实代码来源：** 这个项目里虽然没有直接用，但在 `ErrorBoundary` 中会出现

**语法原型：**
```tsx
function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="wrapper">{children}</div>;
}

// 使用时：
<Wrapper>
  <h1>我是被包在里面的内容</h1>
  <p>我也可以是多个元素</p>
</Wrapper>
```

**真实示例（模拟 MainLayout 的 children 用法）：**
```tsx
// 定义布局组件：
function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <header>顶部导航</header>
      <main>{children}</main>  {/* children 在这里被渲染 */}
      <footer>底部版权</footer>
    </div>
  );
}

// 使用布局组件：
function App() {
  return (
    <MainLayout>
      {/* 这个 div 会被渲染到 <main> 标签的位置 */}
      <div className="dashboard-content">
        <h1>仪表盘</h1>
        <p>数据展示区域</p>
      </div>
    </MainLayout>
  );
}
```

**新人拆解：**
- **`children`** 是 React 提供的**特殊 Prop**，它代表"组件标签之间的所有内容"。
- 任何放在组件开始标签和结束标签之间的 JSX，都会自动成为 `children`。
- 你可以把 `children` 放在组件内部的任意位置，决定"插槽"在哪里显示。
- `children` 的类型通常是 `React.ReactNode`，它可以接受任何可渲染的内容。

---

## 第七章：JSX 渲染语法 —— 在 HTML 里写 JavaScript

> **本章解决的核心问题：** `{}` 在 JSX 里干什么？`&&` 是什么？`key` 为什么必须要有？

### 7.1 JSX 中的表达式 —— 花括号里写代码

**真实代码来源：** `TabBar.tsx` 中的 `{tab.icon}`、`{tab.label}`、`{tabs.length > 1 && ...}`

**语法原型：**
```tsx
<div>{JS表达式}</div>   // 花括号里的 JS 表达式会被计算并显示
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 显示变量：
<span className="tab-icon">{tab.icon}</span>
// 花括号里的 tab.icon 会被计算，假设 tab.icon = '📦'，则显示 📦

// 显示 JS 表达式结果：
<span>{1 + 1}</span>  // 显示 2
<span>{'Hello ' + 'World'}</span>  // 显示 Hello World
<span>{activeTab === tab.id ? 'active' : ''}</span>
// 这是一个三元表达式：条件 ? 真值 : 假值
// 如果 activeTab === tab.id 为 true，显示 'active'，否则显示 ''

// 可以执行函数调用：
<span>{formatDate(now)}</span>
```

**新人拆解：**
- 在 JSX 中，**`{}` 里面的任何内容都会被当作 JavaScript 执行**。
- `{}` 里可以放：
  - 变量：`{name}`
  - 运算：`{1 + 2}`
  - 三元表达式：`{condition ? '真' : '假'}`
  - 函数调用：`{getFullName()}`
  - 数组：`{['a', 'b', 'c']}` → 会渲染成 "abc"
- `{}` 里**不能放** `if` 语句、`for` 循环（需要用三元运算符或 `.map()` 代替）。

**语法硬核翻译：**
```tsx
// 常见陷阱：
<div>{if (x > 0) { '正数' }}</div>  // ❌ 错误！if 不能放在花括号里

// 正确做法：用三元运算符
<div>{x > 0 ? '正数' : '非正数'}</div>  // ✅

// 或者用 && 运算符（见下一节）
<div>{x > 0 && '正数'}</div>  // 如果 x > 0 为真，显示 '正数'，否则显示空
```

---

### 7.2 条件渲染 —— 显示还是不显示？

**真实代码来源：** `TabBar.tsx` 中的 `{tabs.length > 1 && ...}`、`{isExpanded && node.children?.map(...)}`

**语法原型：**
```tsx
{条件 && 内容}          // 条件为真时显示内容
{条件 ? 内容1 : 内容2}  // 条件为真显示内容1，否则显示内容2
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 场景1：只有 tab 数量大于 1 时才显示关闭按钮
{tabs.length > 1 && (
  <button className="tab-close" onClick={...}>
    ✕
  </button>
)}
// 翻译：如果 tabs.length > 1 为 true，渲染按钮；否则什么都不渲染

// 场景2（Sidebar 中的类似用法）：
{isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
// 翻译：如果 isExpanded 为 true，才渲染子节点列表
```

**新人拆解：**
- **`&&` 条件渲染**：`{条件 && 元素}` 的意思是"如果条件成立，就显示这个元素"。
- **三元运算符条件渲染**：`{条件 ? 元素1 : 元素2}` 的意思是"条件成立显示元素1，否则显示元素2"。
- 为什么用 `&&` 而不是 `if`？因为在 JSX 的 `{}` 里不能写 `if`，`&&` 是替代方案。
- **注意陷阱**：`{0 && <div>内容</div>}` 会显示 `0`，因为数字 0 在 JS 中会被转为 false，但表达式的结果是 0 本身。

**语法硬核翻译：**
```tsx
// 几种条件渲染方式：

// 方式1：&&（只显示或不显示）
<div>
  {isLoggedIn && <span>欢迎回来</span>}
</div>

// 方式2：三元运算符（二选一）
<div>
  {isLoggedIn ? <span>欢迎回来</span> : <span>请登录</span>}
</div>

// 方式3：变量 + if（在 JSX 外面处理逻辑）
let content;
if (isLoggedIn) {
  content = <span>欢迎回来</span>;
} else {
  content = <span>请登录</span>;
}
return <div>{content}</div>;

// 方式4：函数调用（把条件逻辑封装起来）
const renderContent = () => {
  if (isLoggedIn) return <span>欢迎回来</span>;
  return <span>请登录</span>;
};
return <div>{renderContent()}</div>;
```

---

### 7.3 列表渲染与 `key` —— 批量生产带编号

**真实代码来源：** `TabBar.tsx` 中的 `tabs.map(tab => ...)`、`Sidebar.tsx` 中的 `treeData.map(node => renderNode(node))`

**语法原型：**
```tsx
{数组.map((元素, 索引) => (
  <JSX元素 key={唯一标识} {...}>
    {元素.属性}
  </JSX元素>
))}
```

**真实示例（来自 TabBar.tsx）：**
```tsx
{tabs.map(tab => (
  <div
    key={tab.id}  // ⚠️ 必须！每个元素必须有一个唯一的 key
    //  ^^^^^^^^   key 帮助 React 识别哪些元素变了、加了、删了
    className={`tab ${activeTab === tab.id ? 'active' : ''}`}
    onClick={() => onTabChange(tab.id)}
  >
    <span className="tab-icon">{tab.icon}</span>
    <span className="tab-label">{tab.label}</span>
  </div>
))}
```

**新人拆解：**
- **`key` 是 React 的特殊属性**，它帮助 React 在数组更新时高效地识别哪些元素变化了。
- **`key` 必须是唯一且稳定的**：通常是数据的 `id` 或 `index`（但 `index` 只在数组不变时可靠）。
- 如果数组是静态的（不会增删改），可以用 `index` 作为 key；但如果会变化，用 `id` 更安全。
- 不写 `key`，React 会报 Warning（警告），而且性能会受影响。

**语法硬核翻译：**
```tsx
// 错误的 key 用法：
{tabs.map((tab, index) => (
  <div key={index}>  {/* ❌ 如果数组会变化，用索引做 key 可能导致 Bug */}
    {tab.label}
  </div>
))}

// 正确的 key 用法：
{tabs.map(tab => (
  <div key={tab.id}>  {/* ✅ 使用唯一且稳定的 id */}
    {tab.label}
  </div>
))}

// 如果没有 id，可以用别的唯一字段：
{users.map(user => (
  <div key={user.email}>  {/* 使用 email（假设唯一） */}
    {user.name}
  </div>
))}
```

---

## 第八章：事件处理 —— 交互的核心

> **本章解决的核心问题：** `onClick` 怎么用？`e` 是什么？为什么要 `e.stopPropagation()`？

### 8.1 `onClick` 与事件绑定 —— 等用户动手

**真实代码来源：** `TabBar.tsx` 中的 `onClick={() => onTabChange(tab.id)}`

**语法原型：**
```tsx
<元素 onClick={函数名} />
<元素 onClick={() => { 执行操作 }} />
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 场景1：直接绑定函数（不需要传参数）
<button className="tab-add" onClick={onAddTab}>
  +
</button>
// 点击按钮时，会执行 onAddTab 函数

// 场景2：箭头函数包一层（需要传参数）
<div onClick={() => onTabChange(tab.id)}>
  {tab.label}
</div>
// 点击 div 时，会执行 onTabChange(tab.id)
// 注意：这里必须包一层箭头函数，否则会立即执行！

// 场景3：带事件对象（下一节详说）
<button onClick={(e) => {
  e.stopPropagation();
  onCloseTab(tab.id);
}}>
  ✕
</button>
```

**新人拆解：**
- **`onClick` 的值必须是一个函数**，不能是函数调用结果。
- **正确写法**：`onClick={handleClick}` ✅
- **错误写法**：`onClick={handleClick()}` ❌（这会立即执行，而不是等点击）
- 如果需要传参数给事件处理函数，用箭头函数包一层：`onClick={() => handleClick(id)}` ✅
- 常见的 React 事件：`onClick`、`onChange`、`onSubmit`、`onMouseEnter`、`onFocus`……

**语法硬核翻译：**
```tsx
// 错误示范（点击前就会执行）：
<button onClick={console.log('点击了')}>
  按钮
</button>
// 组件渲染时，console.log 会立刻执行，而不是点击时才执行

// 正确写法1：传递函数引用
const handleClick = () => console.log('点击了');
<button onClick={handleClick}>按钮</button>

// 正确写法2：箭头函数包一层
<button onClick={() => console.log('点击了')}>按钮</button>

// 正确写法3：带参数
const handleClick = (id: string) => console.log(id);
<button onClick={() => handleClick('123')}>按钮</button>
// 注意：这里不能用 onClick={handleClick('123')}，会立刻执行
```

---

### 8.2 事件对象 `e` —— 点击瞬间的快照

**真实代码来源：** `TabBar.tsx` 中关闭按钮的 `(e) => { e.stopPropagation(); ... }`

**语法原型：**
```tsx
<元素 onClick={(e) => {
  // e 是事件对象，包含了点击事件的详细信息
}} />
```

**真实示例（来自 TabBar.tsx）：**
```tsx
<button
  className="tab-close"
  onClick={(e) => {
    // 拆解：
    // e 是"事件对象"，它记录了这次点击的所有信息：
    // - 点击的位置 (clientX, clientY)
    // - 点击的目标元素 (target)
    // - 阻止事件冒泡的方法 (stopPropagation)
    // - 阻止默认行为的方法 (preventDefault)
    e.stopPropagation();  // 阻止点击事件向上传播
    onCloseTab(tab.id);
  }}
>
  ✕
</button>
```

**新人拆解：**
- **事件对象 `e`** 是浏览器自动传递给事件处理函数的参数。
- 即使你不写 `e` 参数，事件对象也存在；但如果你需要用到它（比如阻止冒泡），就必须声明。
- 常见用途：
  - `e.stopPropagation()`：阻止事件"冒泡"到父元素（父元素的点击事件不会被触发）。
  - `e.preventDefault()`：阻止默认行为（比如阻止表单提交、阻止链接跳转）。
  - `e.target`：获取被点击的元素。

**语法硬核翻译：**
```tsx
// 事件对象的常见用法：

// 1. 阻止冒泡（防止父元素的点击事件也被触发）
<div onClick={() => console.log('父元素被点击')}>
  <button onClick={(e) => {
    e.stopPropagation();
    console.log('子按钮被点击');
  }}>
    点我
  </button>
</div>
// 点击按钮时，只会打印 "子按钮被点击"，不会打印 "父元素被点击"

// 2. 阻止默认行为（防止链接跳转）
<a href="https://example.com" onClick={(e) => {
  e.preventDefault();
  console.log('链接被点击，但不跳转');
}}>
  点我
</a>

// 3. 获取点击的元素内容
<button onClick={(e) => {
  console.log(e.target);  // 打印被点击的按钮元素
}}>
  按钮
</button>
```

---

### 8.3 `e.stopPropagation()` —— 阻止连锁反应

**真实代码来源：** `TabBar.tsx` 中的 `e.stopPropagation()` 在关闭按钮中

**语法原型：**
```tsx
e.stopPropagation();
// 阻止事件向父元素传递
```

**真实场景解析（来自 TabBar.tsx）：**
```tsx
// 场景：Tab 标签和关闭按钮是嵌套关系
<div
  className="tab"
  onClick={() => onTabChange(tab.id)}  // 点击整个标签切换到该 Tab
>
  <span>{tab.label}</span>
  <button
    className="tab-close"
    onClick={(e) => {
      e.stopPropagation();  // 阻止冒泡！不触发父 div 的 onClick
      onCloseTab(tab.id);
    }}
  >
    ✕
  </button>
</div>

// 如果不加 e.stopPropagation()：
// 点击关闭按钮 → 触发按钮的 onClick（关闭 Tab）
// → 事件冒泡到父 div → 触发父 div 的 onClick（切换到该 Tab）
// 结果：同时触发了关闭和切换，这不是我们想要的！

// 加了 e.stopPropagation() 之后：
// 点击关闭按钮 → 触发按钮的 onClick（关闭 Tab）
// → stopPropagation 阻止了冒泡 → 父 div 的 onClick 不会被触发
// 结果：只关闭了 Tab，没有切换
```

**新人拆解：**
- **事件冒泡**：点击子元素时，点击事件会"向上传播"到父元素、祖父元素……
- **`e.stopPropagation()`** 就是"切断这个传播链条"。
- 什么时候需要？当子元素和父元素都有 `onClick`，且你希望点击子元素时**只触发子元素的逻辑**，不触发父元素的逻辑。

---

## 第九章：React Hooks（上）—— 组件的"记忆"与"闹钟"

> **本章解决的核心问题：** 组件怎么"记住"东西？怎么在特定时机执行代码？

### 9.1 `useState` —— 组件的记忆体

**真实代码来源：** `Sidebar.tsx` 的 `useState<Set<string>>(...)`、`Dashboard.tsx` 的 `useState('1天')`

**语法原型：**
```tsx
const [状态值, 设置函数] = useState(初始值);
// 状态值：当前存储的数据
// 设置函数：用来更新数据的函数，调用后会触发组件重新渲染
// 初始值：组件第一次渲染时的默认值
```

**真实示例（来自 Sidebar.tsx）：**
```tsx
// 真实代码：
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
  new Set(['json', 'string'])
);
// 拆解：
// expandedFolders → 当前展开的文件夹集合（初始值包含 'json' 和 'string'）
// setExpandedFolders → 用来更新 expandedFolders 的函数
// <Set<string>> → 类型注解，表示这个状态是字符串集合

// 使用 setExpandedFolders 更新状态：
const toggleFolder = (id: string) => {
  setExpandedFolders(prev => {  // prev 是旧的 expandedFolders
    const next = new Set(prev);  // 复制一份旧集合
    if (next.has(id)) {
      next.delete(id);  // 如果 id 在集合里，删除它（收起）
    } else {
      next.add(id);     // 如果 id 不在集合里，添加它（展开）
    }
    return next;  // 返回新集合，组件会重新渲染
  });
};
```

**新人拆解：**
- **`useState`** 让函数组件拥有了"记忆能力"。
- 每次调用 `设置函数`（如 `setExpandedFolders`），组件都会**重新渲染**，展示最新的数据。
- 设置函数的两种用法：
  - **直接传新值**：`setCount(10)` → 直接把 count 设为 10
  - **传函数（函数式更新）**：`setCount(prev => prev + 1)` → 基于旧值计算新值，推荐用于新值依赖旧值的场景
- 状态变化会**触发重新渲染**，整个函数组件会重新执行。

**语法硬核翻译：**
```tsx
// 基础用法：
const [count, setCount] = useState(0);
// count = 0, setCount 是一个函数

// 点击按钮增加 count：
<button onClick={() => setCount(count + 1)}>
  当前计数：{count}
</button>

// 函数式更新（更安全）：
<button onClick={() => setCount(prev => prev + 1)}>
  当前计数：{count}
</button>

// 多个状态：
const [name, setName] = useState('张三');
const [age, setAge] = useState(25);
const [isActive, setIsActive] = useState(true);

// 对象作为状态（更新时需要展开）：
const [user, setUser] = useState({ name: '张三', age: 25 });
// 更新年龄（不能直接修改 user，要创建新对象）：
setUser(prev => ({ ...prev, age: 26 }));
//                              ^^^^^^^^ 覆盖 age 属性
```

---

### 9.2 `useEffect` —— 组件的闹钟

**真实代码来源：** `Dashboard.tsx` 中的 `useEffect(() => { ... }, [])`

**语法原型：**
```tsx
useEffect(() => {
  // 副作用代码：在渲染后执行
  return () => {
    // 清理代码：在组件卸载或依赖变化前执行
  };
}, [依赖项1, 依赖项2]);
```

**真实示例（来自 Dashboard.tsx）：**
```tsx
// 真实代码：
useEffect(() => {
  // 定时器：每秒更新一次数据
  const intervalId = setInterval(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    setUptime('1天');
    setTotalKeys(prev => prev + Math.floor(Math.random() * 10) - 5);
  }, 1000);

  // 清理函数：组件卸载时清除定时器
  return () => clearInterval(intervalId);
}, []);  // 空依赖 → 只在组件挂载时执行一次，卸载时清理一次
```

**新人拆解：**
- **`useEffect`** 让函数组件拥有了"在渲染完成后做事情"的能力。
- **依赖数组**控制 `useEffect` 的触发时机：
  - `[]`（空数组）→ 只在组件**挂载**时执行一次，卸载时清理一次
  - `[count]` → 在组件**挂载**时执行，且**每次 `count` 变化时**重新执行
  - 不传依赖数组 → **每次渲染后**都执行（不推荐，容易死循环）
- **清理函数**（`return () => {}`）→ 在组件**卸载**或**下次执行前**执行，用于清除定时器、取消订阅等。

**语法硬核翻译：**
```tsx
// 示例1：页面标题更新（没有清理函数）
useEffect(() => {
  document.title = `你点击了 ${count} 次`;
}, [count]);  // count 变化时更新标题

// 示例2：定时器（有清理函数）
useEffect(() => {
  const timer = setInterval(() => {
    console.log('每1秒执行一次');
  }, 1000);
  
  return () => clearInterval(timer);  // 组件卸载时清除定时器
}, []);  // 只在挂载时创建一次

// 示例3：数据请求
useEffect(() => {
  fetch('/api/users')
    .then(res => res.json())
    .then(data => setUsers(data));
}, []);  // 只在挂载时请求一次

// 示例4：依赖数组变化时重新执行
useEffect(() => {
  fetch(`/api/users/${userId}`)
    .then(res => res.json())
    .then(data => setUser(data));
}, [userId]);  // userId 变化时重新请求
```

---

### 9.3 依赖项数组 —— 闹钟的触发条件

**真实代码来源：** 所有 `useEffect` 的第二个参数 `[]`

**语法原型：**
```tsx
useEffect(() => { ... }, [依赖项1, 依赖项2, ...]);
// 依赖项变化时，重新执行副作用
```

**新人拆解：**
- 依赖项数组里的**每个值**都会被 React 监听。
- 当任何一个值发生变化时，`useEffect` 会重新执行。
- **空数组 `[]`** 表示"没有依赖"，副作用只执行一次。
- **不传依赖数组**表示"每次渲染都执行"，通常是个错误（会导致无限循环）。

**语法硬核翻译：**
```tsx
// 场景1：只执行一次（常用于数据请求、定时器初始化）
useEffect(() => {
  console.log('组件挂载了');
  // 做一次性的操作
}, []);

// 场景2：依赖某个状态
useEffect(() => {
  console.log(`count 变成了 ${count}`);
  // 每次 count 变化时执行
}, [count]);

// 场景3：依赖多个状态
useEffect(() => {
  console.log(`name 或 age 变化了`);
}, [name, age]);

// 场景4：依赖 props
function UserProfile({ userId }: { userId: string }) {
  useEffect(() => {
    console.log(`用户 ID 变成了 ${userId}，重新请求数据`);
    fetchUser(userId);
  }, [userId]);  // userId 变化时重新请求
}

// ⚠️ 常见错误：空依赖数组里使用了外部变量
const [count, setCount] = useState(0);
useEffect(() => {
  console.log(count);  // 永远打印 0！因为依赖数组是空的，count 不会变化
}, []);  // ❌ 闭包陷阱：count 被"锁"在了初始值

// ✅ 正确的做法：把 count 加入依赖
useEffect(() => {
  console.log(count);
}, [count]);  // count 变化时重新执行，打印最新的值
```

---

## 第十章：React Hooks（下）—— 性能优化

> **本章解决的核心问题：** 为什么有时候组件会"卡"？怎么避免不必要的重新渲染？

### 10.1 `useMemo` —— 计算结果的备忘录

**真实代码来源：** 虽然项目里没用，但这是 React 性能优化的核心 Hook

**语法原型：**
```tsx
const 计算结果 = useMemo(() => {
  // 昂贵的计算
  return 计算结果;
}, [依赖项1, 依赖项2]);
```

**真实示例（模拟 Sidebar 的搜索过滤）：**
```tsx
// 假设 Sidebar 有搜索功能：
function Sidebar({ searchTerm }: { searchTerm: string }) {
  // 1. 昂贵的计算：过滤树数据
  const filteredTree = useMemo(() => {
    // 假设 treeData 有几千个节点
    console.log('🔄 正在过滤树数据...');
    
    if (!searchTerm) return treeData;
    
    // 深度过滤逻辑（递归遍历）
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map(node => {
          const isMatch = node.label.includes(searchTerm);
          const filteredChildren = node.children ? filterNodes(node.children) : [];
          if (isMatch || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean) as TreeNode[];
    };
    return filterNodes(treeData);
  }, [searchTerm]);  // 只有 searchTerm 变化时才重新计算
  
  // 2. 渲染时使用过滤后的数据
  return <div>{filteredTree.map(renderNode)}</div>;
}
```

**新人拆解：**
- **`useMemo`** 是"记忆化"（Memoization）的意思，本质是**缓存计算结果**。
- 只有当依赖项变化时，才会重新执行计算；依赖项没变时，直接返回之前缓存的结果。
- 适合用于**计算量大**的操作（遍历大数组、复杂运算）。
- **不要滥用**：简单计算（如 `a + b`）不需要用 `useMemo`，因为 Hook 本身也有开销。

**语法硬核翻译：**
```tsx
// 场景：没有 useMemo（每次渲染都重新计算）
function Component({ numbers }: { numbers: number[] }) {
  const sum = numbers.reduce((a, b) => a + b, 0);  // 每次渲染都执行
  return <div>{sum}</div>;
}

// 场景：使用 useMemo（只在 numbers 变化时重新计算）
function Component({ numbers }: { numbers: number[] }) {
  const sum = useMemo(() => {
    console.log('计算 sum...');
    return numbers.reduce((a, b) => a + b, 0);
  }, [numbers]);  // numbers 变化时才重新计算
  return <div>{sum}</div>;
}

// 场景：复杂对象（每次渲染都创建新对象会引发子组件重渲染）
const userConfig = useMemo(() => ({
  theme: 'dark',
  fontSize: 14,
  showSidebar: true,
}), []);  // 永远返回同一个对象引用，不会变化
```

---

### 10.2 `useCallback` —— 函数的稳定器

**真实代码来源：** 虽然项目里没用，但常和 `useMemo` 一起出现

**语法原型：**
```tsx
const 稳定函数 = useCallback(() => {
  // 函数逻辑
}, [依赖项1, 依赖项2]);
```

**真实示例（模拟 Sidebar 的事件处理）：**
```tsx
function Sidebar({ onSelect }: SidebarProps) {
  // 1. 使用 useCallback 稳定函数引用
  const handleToggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);  // 空依赖 → 函数引用永远不变
  
  // 2. 如果不加 useCallback：
  // const handleToggleFolder = (id: string) => { ... }
  // 每次 Sidebar 重新渲染，都会创建一个新的 handleToggleFolder
  // 如果它作为 props 传给子组件，子组件会认为 props 变了，导致重新渲染
  
  return (
    <div>
      {treeData.map(node => renderNode(node, handleToggleFolder))}
    </div>
  );
}
```

**新人拆解：**
- **`useCallback`** 是 **`useMemo` 的"函数版"**：缓存函数引用，而不是缓存计算结果。
- 它的作用是**防止函数在不同渲染之间"变脸"**。
- 当一个函数作为 `props` 传给子组件时，如果每次渲染都创建新函数（引用不同），子组件会认为 `props` 变了并重新渲染，即使逻辑完全一样。
- **使用场景**：把函数传给被 `React.memo` 包裹的子组件、作为 `useEffect` 的依赖项。

**语法硬核翻译：**
```tsx
// 场景：没有 useCallback（每次渲染都是新函数）
function Parent() {
  const handleClick = () => console.log('点击');  // 每次渲染都创建新函数
  return <Child onClick={handleClick} />;
}
// Child 每次都会重新渲染，即使 onClick 的逻辑没变

// 场景：使用 useCallback（函数引用稳定）
function Parent() {
  const handleClick = useCallback(() => {
    console.log('点击');
  }, []);  // 永远返回同一个函数引用
  return <Child onClick={handleClick} />;
}
// Child 不会因为 onClick 变化而重新渲染

// 场景：依赖项变化时重新创建函数
function Parent({ userId }: { userId: string }) {
  const handleUserClick = useCallback(() => {
    console.log(`用户 ${userId} 被点击`);
  }, [userId]);  // userId 变化时，重新创建函数
  return <Child onClick={handleUserClick} />;
}
```

---

### 10.3 自定义 Hook —— 逻辑工具箱

**真实代码来源：** 项目里虽然没有，但这是 React 复用逻辑的"终极武器"

**语法原型：**
```tsx
function use自定义名字(参数) {
  // 使用 useState、useEffect 等 React 原生 Hook
  // 封装逻辑
  return 返回值;
}
```

**真实示例（封装 WebSocket 逻辑）：**
```tsx
// 自定义 Hook：useWebSocket
function useWebSocket(url: string) {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    setWs(socket);

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    socket.onmessage = (event) => {
      setData(JSON.parse(event.data));
    };

    return () => socket.close();
  }, [url]);

  const sendMessage = (msg: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  };

  return { data, isConnected, sendMessage };
}

// 在组件中使用：
function Dashboard() {
  const { data, isConnected } = useWebSocket('ws://localhost:8080');
  
  return (
    <div>
      <div>连接状态：{isConnected ? '在线' : '离线'}</div>
      <div>数据：{data?.commandsPerSec ?? 0}</div>
    </div>
  );
}
```

**新人拆解：**
- **自定义 Hook** 本质就是一个普通的函数，但它的名字**必须以 `use` 开头**。
- 自定义 Hook 内部可以调用其他 Hook（`useState`、`useEffect` 等）。
- 它的作用是**把组件逻辑抽离出来复用**，而不是复制粘贴。
- **自定义 Hook 不返回 JSX**，只返回**数据或操作函数**。

---

## 第十一章：模块导入导出 —— 积木的"进货"与"出货"

> **本章解决的核心问题：** `import` 怎么用？`export` 怎么用？路径怎么找到文件？

### 11.1 `export default` 与 `export` —— 出口标签

**真实代码来源：** `TabBar.tsx` 的 `export default TabBar`

**语法原型：**
```tsx
// 默认导出（一个文件只能有一个）
export default 组件名;

// 命名导出（一个文件可以有多个）
export const 函数名 = () => {};
export interface 接口名 {}
```

**真实示例（来自 TabBar.tsx）：**
```tsx
// 文件末尾：
export default TabBar;
// 意思是：这个文件"出口"的主要东西是 TabBar 组件
// 别的文件导入时，可以用任意名字来接收它

// 如果还有别的导出（补充说明）：
export const TAB_TYPES = ['folder', 'file'];  // 命名导出
export interface TabConfig { ... }             // 接口导出
```

**新人拆解：**
- **`export default`** 是"主出口"，一个文件只能有一个。
- **`export`**（没有 default）是"副出口"，一个文件可以有多个。
- 导入时的区别：
  - 默认导出 → `import 任意名字 from './文件'`
  - 命名导出 → `import { 精确名字 } from './文件'`

---

### 11.2 `import` —— 进货清单

**真实代码来源：** 所有文件的顶部

**语法原型：**
```tsx
import 默认名字 from '路径';
import { 命名导出1, 命名导出2 } from '路径';
import 默认名字, { 命名导出 } from '路径';
import * as 全部 from '路径';
```

**真实示例（来自 TabBar.tsx）：**
```tsx
import './TabBar.css';  // 导入样式（不赋值）
// 翻译：把 TabBar.css 文件里的样式应用到当前组件

import { useState } from 'react';
// 翻译：从 react 这个包里，只拿 useState 这一个东西

import React from 'react';
// 翻译：从 react 这个包里，拿所有内容，命名为 React

// 导入自定义组件（假设项目里有）：
import Sidebar from './Sidebar';
// 翻译：从当前目录下的 Sidebar.tsx 里，拿默认导出的东西，命名为 Sidebar
```

**新人拆解：**
- **`import`** 是"进货"操作，把别的文件/包里的东西拿过来用。
- 导入路径的规则：
  - `'react'` → 从 `node_modules` 里找（第三方包）
  - `'./Sidebar'` → 从当前目录找（相对路径）
  - `'@/components/Sidebar'` → 从项目根目录的 `src` 里找（别名路径，需配置）

---

### 11.3 相对路径与别名 —— 找路指南

**真实代码来源：** `TabBar.tsx` 的 `import './TabBar.css'`、`vite.renderer.config.ts` 中配置的别名

**语法原型：**
```tsx
// 相对路径：
import 东西 from './文件名';    // 当前目录
import 东西 from '../文件名';   // 上级目录
import 东西 from '../../文件名'; // 上上级目录

// 别名路径（项目配置了 @）：
import 东西 from '@/文件夹/文件名';
```

**真实示例（项目配置）：**
```tsx
// vite.renderer.config.ts 中配置了别名：
resolve: {
  alias: {
    '@': resolve(__dirname, 'src/renderer'),
  },
}

// 所以你可以这样导入：
import Sidebar from '@/components/Sidebar';
// 等同于：import Sidebar from 'src/renderer/components/Sidebar';

// 而不是写长长的：
import Sidebar from '../../../components/Sidebar';
```

**新人拆解：**
- **`.`** 表示当前目录，**`..`** 表示上级目录。
- **`./`** 开头：从当前文件所在目录开始找。
- **`../`** 开头：从上一级目录开始找。
- **别名**（如 `@`）是一种"快捷方式"，避免写冗长的相对路径。
- 别名的好处：文件移动时，不用改一大堆 `../../`。

---

## 第十二章：实用工具方法 —— 日常开发必备

> **本章解决的核心问题：** 怎么过滤数组？怎么给数字加千分位？怎么补全时间格式？

### 12.1 数组方法（`filter`、`find`）—— 筛子与探测器

**真实代码来源：** 虽然没有直接用，但这是 JS 数组最常用的方法

**语法原型：**
```tsx
// filter：过滤出符合条件的元素（返回新数组）
数组.filter(元素 => 条件);
// find：找出第一个符合条件的元素（返回该元素）
数组.find(元素 => 条件);
```

**语法硬核翻译：**
```tsx
const numbers = [1, 2, 3, 4, 5, 6];

// filter：过滤出偶数
const evens = numbers.filter(num => num % 2 === 0);
// evens → [2, 4, 6]
// 翻译："从 numbers 里筛出所有偶数"

// find：找到第一个大于 3 的数
const firstBig = numbers.find(num => num > 3);
// firstBig → 4
// 翻译："从 numbers 里找到第一个大于 3 的数"

// 实际场景：过滤树节点（删除某个节点）
const filteredTree = treeData.filter(node => node.id !== 'json');
// 翻译："从树数据里删除 id 为 'json' 的节点"

// 实际场景：查找某个用户
const targetUser = users.find(user => user.id === 123);
// 翻译："从用户列表里找到 id 为 123 的用户"
```

---

### 12.2 数字格式化（`toLocaleString`）—— 千分位转换器

**真实代码来源：** `Dashboard.tsx` 中的 `{totalKeys.toLocaleString()}`

**语法原型：**
```tsx
数字.toLocaleString();  // 给数字加千分位逗号
```

**真实示例（来自 Dashboard.tsx）：**
```tsx
// 真实代码：
<div className="stat-value">{totalKeys.toLocaleString()}</div>
// 假设 totalKeys = 192569
// .toLocaleString() 把它变成 "192,569"
// 显示为 192,569，更容易阅读

// 其他示例：
const num = 1234567.89;
num.toLocaleString();        // "1,234,567.89"
num.toLocaleString('zh-CN'); // "1,234,567.89"（中文环境）
num.toLocaleString('de-DE'); // "1.234.567,89"（德文环境，用 . 和 , 相反）
```

---

### 12.3 字符串填充（`padStart`）—— 对齐强迫症的福音

**真实代码来源：** `Dashboard.tsx` 中的 `now.getHours().toString().padStart(2, '0')`

**语法原型：**
```tsx
字符串.padStart(目标长度, 填充字符);
// 如果字符串长度不够，在开头填充指定字符直到达到目标长度
```

**真实示例（来自 Dashboard.tsx）：**
```tsx
// 真实代码：
const hours = now.getHours().toString().padStart(2, '0');
const minutes = now.getMinutes().toString().padStart(2, '0');
const seconds = now.getSeconds().toString().padStart(2, '0');

// 假设现在时间是 9:5:3（早上 9 点 5 分 3 秒）
// hours → '9'.padStart(2, '0') → '09'
// minutes → '5'.padStart(2, '0') → '05'
// seconds → '3'.padStart(2, '0') → '03'
// 最终得到 '09:05:03'，显示格式整齐统一

// 其他示例：
'1'.padStart(3, '0');   // '001'
'12'.padStart(3, '0');  // '012'
'123'.padStart(3, '0'); // '123'（长度够了，不填充）

// 场景：生成固定长度的编号
const id = 5;
const formattedId = id.toString().padStart(4, '0');  // '0005'
```

---

## 附录：快速查字典（按符号索引）

| 符号 | 读音/读法 | 作用 | 所在章节 |
| :--- | :--- | :--- | :--- |
| `const` | 常量 | 声明不可变的变量 | 1.1 |
| `let` | 可变 | 声明可变的变量 | 1.1 |
| `string` | 字符串 | 文本类型 | 1.2 |
| `number` | 数字 | 数字类型 | 1.2 |
| `boolean` | 布尔 | true/false 类型 | 1.2 |
| `` ` `` | 反引号 | 模板字符串 | 1.3 |
| `${}` | 插值 | 在模板字符串里插入 JS | 1.3 |
| `function` | 函数 | 定义函数 | 2.1 |
| `=>` | 箭头/变成 | 箭头函数 | 2.2 |
| `void` | 空 | 函数无返回值 | 2.3 |
| `[]` | 方括号 | 数组 | 3.1 |
| `.map()` | 映射 | 遍历数组并转换 | 3.2 |
| `...` | 展开 | 展开数组/对象 | 3.3 |
| `{}` | 花括号 | 对象/代码块/JSX 插槽 | 4.1 |
| `.` | 点号 | 访问对象属性 | 4.1 |
| `?.` | 可选链 | 安全访问属性 | 4.3 |
| `??` | 空值合并 | 为 null/undefined 设默认值 | 4.3 |
| `:` | 冒号 | 类型注解 | 5.1 |
| `interface` | 接口 | 定义对象"合同" | 5.2 |
| `<>` | 尖括号 | 泛型参数 | 5.3 |
| `JSX` | 杰爱斯艾克斯 | 在 JS 里写 HTML | 6.1 |
| `props` | 属性 | 父传子的数据 | 6.2 |
| `children` | 子内容 | 组件嵌套的内容 | 6.3 |
| `&&` | 并且 | 条件渲染 | 7.2 |
| `? :` | 三元 | 二选一渲染 | 7.2 |
| `key` | 键 | 列表项唯一标识 | 7.3 |
| `onClick` | 点击 | 点击事件 | 8.1 |
| `e` | 事件对象 | 点击的详细信息 | 8.2 |
| `stopPropagation` | 阻止冒泡 | 防止事件传播 | 8.3 |
| `useState` | 状态 | 组件的"记忆" | 9.1 |
| `useEffect` | 副作用 | 组件的"闹钟" | 9.2 |
| `useMemo` | 记忆化 | 缓存计算结果 | 10.1 |
| `useCallback` | 回调 | 缓存函数引用 | 10.2 |
| `import` | 导入 | 进货 | 11.2 |
| `export` | 导出 | 出货 | 11.1 |
| `.filter()` | 过滤 | 筛出符合条件的元素 | 12.1 |
| `.find()` | 查找 | 找出第一个符合条件的 | 12.1 |
| `.toLocaleString()` | 格式化 | 加千分位 | 12.2 |
| `.padStart()` | 填充 | 补齐字符串长度 | 12.3 |

---

**结语：**

写下这份手册时，我一直在回想当年自己第一次看到 TSX 代码时的茫然。那时候如果有人能告诉我："`=>` 就是 `function` 的简写，`{}` 就是 HTML 里的脚本入口"，我可能能省下好几个通宵。

现在，这份手册就是写给当年的你，也写给当年的我。

**最后的建议：**
1. **遇到不认识的语法，先翻这份手册的"按符号索引"**。
2. **把手册放在手边，写代码时对照着看**，不用背，肌肉记忆会自然形成。
3. **写够 500 行代码后**，你会发现这些符号已经刻在了直觉里，不再需要查手册了。

加油，未来的资深工程师。🚀

















END.