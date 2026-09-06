创建时间：2026年9月6日22:48:40

---

```json
{  
  "name": "desktop-app-template",  
  "version": "1.0.0",  
  "author": "XX <XX@XX.com>",  
  "description": "Dark-themed Windows desktop app template (Electron + React + TypeScript)",  
  "main": "dist/main/main.js",  
  "scripts": {  
    "dev": "vite --config vite.renderer.config.ts",  
    "start": "concurrently \"npm run dev\" \"npm run electron:dev\"",  
    "electron:dev": "npm run build:main && cross-env NODE_ENV=development electron .",  
    "build": "npm run build:main && npm run build:renderer",  
    "build:main": "tsc -p tsconfig.main.json",  
    "build:main:prod": "tsc -p tsconfig.main.prod.json",  
    "build:renderer": "vite build --config vite.renderer.config.ts",  
    "build:prod": "npm run build:main:prod && npm run build:renderer",  
    "gen:icon": "node scripts/gen-icon-test.mjs",  
    "postinstall": "electron-builder install-app-deps",  
    "rebuild": "electron-rebuild",  
    "package": "npm run build:prod && electron-builder",  
    "package:cn": "cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/ ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run package"  
  },  
  "build": {  
    "appId": "com.template.desktop-app",  
    "productName": "Desktop App",  
    "directories": {  
      "output": "dist/electron"  
    },  
    "files": [  
      "dist/main/**/*",  
      "dist/renderer/**/*",  
      "package.json",  
      "!**/*.map",  
      "!**/*.d.ts"  
    ],  
    "asar": true,  
    "asarUnpack": [  
      "**/node_modules/sql.js/dist/sql-wasm.wasm"  
    ],  
    "compression": "maximum",  
    "win": {  
      "target": [  
        {  
          "target": "nsis",  
          "arch": ["x64"]  
        }  
      ],  
      "icon": "assets/icon.ico"  
    },  
    "nsis": {  
      "oneClick": false,  
      "allowToChangeInstallationDirectory": true  
    },  
    "npmRebuild": true  
  },  
  "dependencies": {  
    "bcryptjs": "^3.0.3",  
    "sql.js": "^1.14.2"  
  },  
  "devDependencies": {  
    "@ant-design/icons": "^6.3.4",  
    "@types/bcryptjs": "^2.4.6",  
    "@types/better-sqlite3": "^9.6.0",  
    "@types/react": "^18.3.12",  
    "@types/react-dom": "^18.3.1",  
    "@types/sql.js": "^1.4.11",  
    "@vitejs/plugin-react": "^4.3.4",  
    "concurrently": "^10.0.5",  
    "cross-env": "^10.1.0",  
    "electron": "^33.2.0",  
    "electron-builder": "^25.0.12",  
    "react": "^18.3.1",  
    "react-dom": "^18.3.1",  
    "react-router-dom": "^7.18.3",  
    "recharts": "^2.12.7",  
    "typescript": "^5.6.3",  
    "vite": "^6.0.3",  
    "zustand": "^5.0.15"  
  }  
}
```



# desktop-app-template 的 `package.json` 逐行解析

> 本文面向全体开发成员，包括零基础新人。目标是完整理解这份配置中“每一行”在做什么、为什么这么设计，以及背后涉及的技术决策。  
> 项目定位：一个基于 **Electron + React + TypeScript** 的深色主题 Windows 桌面应用模板。

---

## 0. 整体架构先了解

这个项目分为两个进程：

- **主进程（Main Process）**：Electron 的入口，负责创建窗口、调用系统能力、访问 Node.js API。由 TypeScript 编译到 `dist/main/main.js`。
- **渲染进程（Renderer Process）**：就是前端 UI，使用 React + Vite 开发、构建到 `dist/renderer`。

`package.json` 在这里承担了三件事：

1. 声明项目元信息；
2. 定义开发、构建、打包脚本；
3. 配置 electron-builder 的打包行为。

下面逐行/逐字段说明。

---

## 1. 顶层字段

```json
"name": "desktop-app-template"
```

- **含义**：npm 包名，也是项目标识。
- **作用**：安装依赖时生成 `node_modules` 目录结构；在日志、缓存目录、锁文件中会用到。该名称不是最终安装包显示名，显示名由后面 `build.productName` 控制。
- **注意**：包名必须小写，不能包含空格，可以用连字符。

---

```json
"version": "1.0.0"
```

- **含义**：当前版本号，遵循语义化版本（SemVer）规范：`主版本.次版本.修订号`。
- **作用**：electron-builder 默认会使用该版本号生成安装包版本，如 `Desktop App Setup 1.0.0.exe`。
- **专家提示**：发布新版本时务必提升版本号，否则可能被 Windows 安装器判定为同一版本，导致升级失败。

---

```json
"author": "XX <XX@XX.com>"
```

- **含义**：作者信息。
- **作用**：写入 npm 元数据；某些安装包属性中会显示作者/厂商信息。

---

```json
"description": "Dark-themed Windows desktop app template (Electron + React + TypeScript)"
```

- **含义**：项目描述。
- **作用**：写入 npm 元数据；electron-builder 在部分平台可能使用该描述作为应用说明。

---

```json
"main": "dist/main/main.js"
```

- **含义**：Electron 主进程入口文件。
- **作用**：当执行 `electron .` 时，Electron 会读取该字段并加载这个 JavaScript 文件作为主进程入口。
- **注意**：
  - 这个文件不是手写的，而是由 TypeScript 编译生成。
  - 在运行 `electron .` 之前，必须先执行主进程构建，否则文件不存在。

---

## 2. `scripts`：脚本命令

```json
"dev": "vite --config vite.renderer.config.ts"
```

- **作用**：单独启动渲染进程的开发服务器。
- **解析**：
  - `vite` 使用指定配置文件 `vite.renderer.config.ts`。
  - 该命令只启动前端 UI 部分，不会启动 Electron 窗口。
- **适用场景**：纯前端调试、查看页面效果，不需要桌面窗口时使用。

---

```json
"start": "concurrently \"npm run dev\" \"npm run electron:dev\""
```

- **作用**：完整桌面开发模式，同时运行渲染进程开发服务器和 Electron 主进程。
- **解析**：
  - `concurrently` 并行执行两个命令：
    - `npm run dev`：启动 Vite 渲染进程开发服务器。
    - `npm run electron:dev`：编译主进程并启动 Electron。
  - Electron 启动后会加载 Vite 提供的开发地址，实现渲染进程热更新。
- **专家提示**：这是日常开发最常用的命令。主进程代码修改后需要重启 Electron，而渲染进程代码修改通常由 Vite 热更新自动生效。

---

```json
"electron:dev": "npm run build:main && cross-env NODE_ENV=development electron ."
```

- **作用**：编译主进程，然后以开发模式启动 Electron。
- **解析**：
  - `npm run build:main`：先编译主进程 TypeScript。
  - `&&`：前一个命令成功后才会执行后续。
  - `cross-env NODE_ENV=development`：跨平台设置环境变量，Windows 与 Linux/macOS 都兼容。
  - `electron .`：启动 Electron，读取 `main` 字段加载主进程。
- **注意**：这里主进程没有热重载，只有渲染进程有热更新。

---

```json
"build": "npm run build:main && npm run build:renderer"
```

- **作用**：执行一次普通构建，包含主进程和渲染进程。
- **解析**：
  - 先编译主进程，再构建渲染进程。
  - 这里的 `build:main` 不是生产优化版，可能包含 sourcemap，适合快速检查。

---

```json
"build:main": "tsc -p tsconfig.main.json"
```

- **作用**：使用 TypeScript 编译器编译主进程代码。
- **解析**：
  - `tsc`：TypeScript 官方编译命令。
  - `-p`：指定 tsconfig 文件。
  - `tsconfig.main.json`：专门为主进程编写的 TypeScript 配置，输出目录通常是 `dist/main`。

---

```json
"build:main:prod": "tsc -p tsconfig.main.prod.json"
```

- **作用**：使用生产配置编译主进程。
- **解析**：
  - 与 `build:main` 的区别在于使用 `tsconfig.main.prod.json`。
  - 生产配置通常会关闭 sourcemap、开启更严格的优化，减少产物体积和暴露源码。

---

```json
"build:renderer": "vite build --config vite.renderer.config.ts"
```

- **作用**：构建渲染进程前端资源。
- **解析**：
  - Vite 会打包 React 代码、CSS、静态资源到 `dist/renderer`。
  - 产物是纯静态文件，运行时不再依赖 Vite 开发服务器。

---

```json
"build:prod": "npm run build:main:prod && npm run build:renderer"
```

- **作用**：执行完整生产构建。
- **解析**：
  - 主进程使用生产配置编译。
  - 渲染进程使用 Vite 生产构建。
  - 这是打包前必需的步骤。

---

```json
"gen:icon": "node scripts/gen-icon-test.mjs"
```

- **作用**：运行图标生成脚本。
- **解析**：
  - 脚本路径 `../../scripts/gen-icon-test.mjs`。
  - 通常用于从一张源图生成多尺寸图标，或转换为 Windows 所需的 `.ico` 格式。
- **注意**：该脚本具体行为需要查看源码，但它属于资源预处理工具。

---

```json
"postinstall": "electron-builder install-app-deps"
```

- **作用**：npm 生命周期钩子，每次执行 `npm install` 后自动运行。
- **解析**：
  - `electron-builder install-app-deps`：安装/重建针对当前 Electron 版本的原生依赖。
  - 确保像 `sql.js` 这类依赖与 Electron 的 ABI 匹配。
- **专家提示**：如果安装依赖后出现原生模块报错，可手动执行该命令修复。

---

```json
"rebuild": "electron-rebuild"
```

- **作用**：手动重建原生模块。
- **解析**：
  - `electron-rebuild` 会重新编译需要原生编译的 Node 模块，使其匹配当前 Electron 版本。
  - 与 `postinstall` 类似，但这个是手动执行，用于问题排查或升级 Electron 后。

---

```json
"package": "npm run build:prod && electron-builder"
```

- **作用**：打包桌面应用安装包。
- **解析**：
  - 先执行完整生产构建，确保 `dist/main` 和 `dist/renderer` 都是最新生产产物。
  - 再调用 `electron-builder` 根据下面的 `build` 字段配置生成安装程序。

---

```json
"package:cn": "cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/ ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run package"
```

- **作用**：针对中国大陆网络环境的打包命令。
- **解析**：
  - 设置两个镜像环境变量：
    - `ELECTRON_BUILDER_BINARIES_MIRROR`：electron-builder 工具二进制下载镜像。
    - `ELECTRON_MIRROR`：Electron 运行时下载镜像。
  - 然后复用 `npm run package` 的完整打包流程。
- **专家提示**：如果国内环境直接执行 `npm run package` 出现下载超时，请优先使用 `npm run package:cn`。

---

## 3. `build`：electron-builder 打包配置

> 注意：`build` 既是 `scripts` 里的一个脚本名，也是 electron-builder 读取的顶层配置字段，两者互不冲突。

```json
"appId": "com.template.desktop-app"
```

- **含义**：应用唯一标识符。
- **作用**：
  - 在 Windows 中用于标识安装，写入注册表。
  - 避免不同应用安装目录、缓存、配置冲突。
- **格式**：通常使用反向域名格式。

---

```json
"productName": "Desktop App"
```

- **含义**：应用显示名称。
- **作用**：
  - 决定安装包文件名、安装目录名、桌面快捷方式名称、应用窗口标题默认值。
- **注意**：与顶层 `name` 不同，`productName` 允许包含空格和大小写。

---

```json
"directories": {
  "output": "dist/electron"
}
```

- **含义**：electron-builder 输出目录。
- **作用**：生成的安装包、解包目录、构建缓存等都会放在 `dist/electron`。
- **注意**：该目录通常需要加入 `.gitignore`，避免提交构建产物。

---

```json
"files": [
  "dist/main/**/*",
  "dist/renderer/**/*",
  "package.json",
  "!**/*.map",
  "!**/*.d.ts"
]
```

- **含义**：指定打包进应用的文件范围。
- **作用**：
  - `dist/main/**/*`：主进程编译产物全部打入。
  - `dist/renderer/**/*`：渲染进程构建产物全部打入。
  - `package.json`：必须包含，Electron 运行时需要读取 `main` 字段。
  - `!**/*.map`：排除 sourcemap 文件，减小体积，避免源码泄露。
  - `!**/*.d.ts`：排除 TypeScript 类型声明文件，运行时不需要。
- **专家提示**：electron-builder 会自动处理 `dependencies` 中的运行时依赖并打入 `node_modules`，不需要在此显式声明 `node_modules`。

---

```json
"asar": true
```

- **含义**：启用 asar 打包。
- **作用**：
  - 将应用文件打包成一个 `app.asar` 归档文件。
  - 提高加载性能，减少小文件数量，同时增加源码被直接查看的难度。
- **原理**：Electron 能像读取普通目录一样读取 asar 内部文件。

---

```json
"asarUnpack": [
  "**/node_modules/sql.js/dist/sql-wasm.wasm"
]
```

- **含义**：指定某些文件不打包进 `app.asar`，而是解压到 `app.asar.unpacked` 目录。
- **作用**：
  - `sql.js` 使用 WebAssembly 文件 `sql-wasm.wasm`。
  - WebAssembly 的加载可能需要真实文件路径，放在 asar 内可能无法正常读取。
  - 因此将其解包，保证运行时可访问。
- **专家提示**：遇到原生模块、WebAssembly、`.node` 文件加载失败时，优先考虑是否需要 `asarUnpack`。

---

```json
"compression": "maximum"
```

- **含义**：asar 内部压缩级别。
- **作用**：
  - `maximum` 表示最大压缩率，产物体积最小。
  - 缺点是安装/首次启动时解压开销略高。
- **可选值**：`store`（不压缩）、`normal`、`maximum`。

---

```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ],
  "icon": "assets/icon.ico"
}
```

- **含义**：Windows 平台打包配置。
- **作用**：
  - `target.nsis`：生成 NSIS 安装程序（`.exe` 安装包）。
  - `arch: ["x64"]`：仅构建 64 位安装包。
  - `icon`：指定安装包和应用程序图标，必须是 `.ico` 格式。
- **注意**：`assets/icon.ico` 必须存在，否则打包失败。

---

```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true
}
```

- **含义**：NSIS 安装器的行为配置。
- **作用**：
  - `oneClick: false`：不使用一键安装，显示安装向导步骤。
  - `allowToChangeInstallationDirectory: true`：允许用户选择安装目录。
- **适用场景**：正式分发给用户时通常需要这些选项，提升用户体验。

---

```json
"npmRebuild": true
```

- **含义**：打包前自动重建原生 npm 模块。
- **作用**：
  - electron-builder 会在打包过程中执行 `npm rebuild`，确保原生模块与 Electron ABI 匹配。
  - 与 `postinstall` 形成双保险，避免原生依赖在打包后无法使用。

---

## 4. `dependencies`：运行时依赖

> 这些包会被打包进最终应用的 `node_modules`，必须在应用运行时可用。

```json
"bcryptjs": "^3.0.3"
```

- **作用**：密码哈希与验证库。
- **特点**：纯 JavaScript 实现，不依赖原生编译，跨平台兼容性好。
- **为什么在这里**：如果主进程在运行时需要使用 bcrypt 功能，它必须出现在 `dependencies` 中，否则打包后找不到模块。
- **`^3.0.3`**：表示允许安装 `3.x.x` 的最新兼容版本，主版本固定为 3。

---

```json
"sql.js": "^1.14.2"
```

- **作用**：SQLite 数据库的 WebAssembly 版本。
- **特点**：无需安装原生 SQLite，可以在 Node.js 和浏览器中通过 WebAssembly 运行 SQLite。
- **为什么在这里**：运行时需要加载数据库引擎，且包含 `sql-wasm.wasm` 文件，所以在打包时被 `asarUnpack` 特别处理。
- **注意**：数据默认存在内存中，需要手动持久化到文件。

---

## 5. `devDependencies`：开发期依赖

> 这些包只在开发、构建、类型检查阶段使用，不会被打包进最终应用（除非被主进程运行时直接 `require`）。

```json
"@ant-design/icons": "^6.3.4"
```

- **作用**：Ant Design 图标组件库。
- **使用场景**：渲染进程 UI 中直接引入图标。
- **注意**：它属于前端依赖，会被 Vite 打包进静态资源，因此无需出现在 `dependencies`。

---

```json
"@types/bcryptjs": "^2.4.6"
```

- **作用**：`bcryptjs` 的 TypeScript 类型声明。
- **说明**：只在开发时提供类型提示和编译检查，运行时不需要。

---

```json
"@types/better-sqlite3": "^9.6.0"
```

- **作用**：`better-sqlite3` 的类型声明。
- **注意**：当前 `dependencies` 中并没有 `better-sqlite3`，这可能是历史遗留或未来计划替换 `sql.js`。如果代码中没有使用，暂时无害；如果后续使用，需要安装对应的运行时包。

---

```json
"@types/react": "^18.3.12"
```

- **作用**：React 的 TypeScript 类型声明。
- **说明**：提供 JSX 类型、组件类型、Hook 类型等。

---

```json
"@types/react-dom": "^18.3.1"
```

- **作用**：ReactDOM 的 TypeScript 类型声明。

---

```json
"@types/sql.js": "^1.4.11"
```

- **作用**：`sql.js` 的 TypeScript 类型声明。

---

```json
"@vitejs/plugin-react": "^4.3.4"
```

- **作用**：Vite 官方 React 插件。
- **说明**：支持 React JSX 转换、Fast Refresh（热更新）等特性。

---

```json
"concurrently": "^10.0.5"
```

- **作用**：并行执行多个 npm 脚本。
- **使用位置**：`start` 脚本中同时启动 Vite 和 Electron。

---

```json
"cross-env": "^10.1.0"
```

- **作用**：跨平台设置环境变量。
- **说明**：解决 Windows 与 Unix 系统下设置环境变量语法不同的问题。

---

```json
"electron": "^33.2.0"
```

- **作用**：Electron 运行时。
- **说明**：开发时提供 `electron` 命令和 Electron API。它是运行时，但通常放在 `devDependencies`，因为最终安装包中会内置 Electron 运行时，不需要再在 `node_modules` 中安装。

---

```json
"electron-builder": "^25.0.12"
```

- **作用**：桌面应用打包工具。
- **说明**：负责生成 NSIS 安装包、处理 asar、图标、依赖等。

---

```json
"react": "^18.3.1"
```

- **作用**：React 核心库。
- **为什么在 devDependencies**：渲染进程代码会被 Vite 打包成静态文件，最终应用加载的是打包后的 JS，不需要在运行时从 `node_modules` 加载 React。
- **新人容易混淆**：这里不是错误，而是 Electron + 前端构建工具的标准实践。

---

```json
"react-dom": "^18.3.1"
```

- **作用**：React 的 DOM 渲染器。
- **说明**：同样属于构建期依赖。

---

```json
"react-router-dom": "^7.18.3"
```

- **作用**：React 路由库。
- **使用场景**：渲染进程页面导航。

---

```json
"recharts": "^2.12.7"
```

- **作用**：图表库。
- **说明**：基于 React 和 D3，用于渲染进程中的数据可视化。

---

```json
"typescript": "^5.6.3"
```

- **作用**：TypeScript 编译器。
- **说明**：所有 `.ts`/`.tsx` 代码的编译、类型检查都依赖它。

---

```json
"vite": "^6.0.3"
```

- **作用**：前端构建工具和开发服务器。
- **说明**：负责渲染进程的开发与生产构建。

---

```json
"zustand": "^5.0.15"
```

- **作用**：轻量级状态管理库。
- **说明**：用于渲染进程的全局状态管理，API 简单、性能好。

---

## 6. 关键注意事项总结

1. **主进程与渲染进程的构建分离**  
   - 主进程用 `tsc` 编译到 `dist/main`。  
   - 渲染进程用 `vite build` 构建到 `dist/renderer`。  
   - 最终打包时两个目录都被包含。

2. **依赖分类原则**  
   - 运行时从 `node_modules` 加载的包放在 `dependencies`。  
   - 仅构建、类型检查、开发使用的包放在 `devDependencies`。  
   - 渲染进程的 React 等库因为被打包进静态产物，所以可以放在 `devDependencies`。

3. **`sql.js` 需要特殊处理**  
   - `sql-wasm.wasm` 必须通过 `asarUnpack` 解包，否则运行时可能找不到文件。

4. **国内网络环境优先使用 `npm run package:cn`**  
   - 它通过镜像环境变量解决 Electron 和 electron-builder 二进制下载慢的问题。

5. **`@types/better-sqlite3` 与 `better-sqlite3` 不匹配**  
   - 当前只有类型声明，没有运行时包。如果确定不再使用，建议清理；如果未来要使用，请补充 `better-sqlite3` 运行时依赖。

---

这份配置整体设计清晰，主进程与渲染进程职责明确，构建与打包链路完整。理解每一行配置背后的意图，有助于后续维护、升级和排错。







END.