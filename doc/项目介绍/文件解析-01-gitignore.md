# .gitignore 深度解析

> **本文档目标**：让新入职同学理解这个文件是什么、每一行在干什么、为什么这么配置、以及不配置会出什么问题。

---

## 一、它是什么

`.gitignore` 是一个**纯文本配置文件**，告诉 Git 版本控制系统**不要跟踪哪些文件和文件夹**。

它不是用来"删除"文件的——文件已经在你的电脑上了，它只是告诉 Git："这些文件别管它们，别记录它们的变更，别提交到远程仓库。"

**类比**：想象你和同事共用一个共享文件夹。`.gitignore` 就像一张便利贴，贴在文件夹上写着"这些文件是临时的/私密的/自动生成的，不要传给别人"。

---

## 二、文件内容逐行解析

### 2.1 依赖包（Dependencies）

```gitignore
# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml
```

| 行 | 内容 | 解释 |
|---|------|------|
| 2 | `node_modules/` | **最关键的一行**。npm 安装依赖后生成的文件夹，包含所有第三方库的源码。通常有几千个文件，体积几百 MB 到几 GB。如果不忽略，Git 会把整个 `node_modules` 提交到仓库，导致仓库体积爆炸（可能从 1MB 变成 500MB+），且每次 `npm install` 产生的文件都有细微差异，造成大量无意义的 diff。 |
| 3 | `package-lock.json` | npm 的锁文件，记录了每个依赖的精确版本和下载链接。不同机器上这个文件可能不同（因为网络环境不同），提交到仓库会导致不必要的冲突。 |
| 4-5 | `yarn.lock` / `pnpm-lock.yaml` | 其他包管理器的锁文件。即使你只用 npm，这些文件也可能存在于别人的机器上（比如同事用 yarn），忽略它们可以避免跨包管理器协作时的混乱。 |

> **新人小结：为什么 `node_modules/` 是最重要的？**
>
> 这是 Git 新手最容易犯的错误——忘记忽略 `node_modules`，导致：
> 1. 仓库体积膨胀到几百 MB
> 2. `git status` 显示几万个文件变更
> 3. `git push` 需要上传几 GB 数据
> 4. 其他同事克隆项目需要等很久
>
> **记住这个铁律**：任何 `node_modules/`、`vendor/`、`__pycache__/` 这样的依赖文件夹，必须忽略。

### 2.2 构建输出（Build Output）

```gitignore
# Build output
dist/
dist-electron/
```

| 行 | 内容 | 解释 |
|---|------|------|
| 8 | `dist/` | 项目构建后生成的输出目录。本项目中，`npm run build` 会把 TypeScript 编译结果放在 `dist/main/`，把 React 打包结果放在 `dist/renderer/`。这些文件是**自动生成的**，从源代码可以重新编译出来，不需要提交到仓库。 |
| 9 | `dist-electron/` | electron-builder 打包时可能生成的额外输出目录（旧版 electron-builder 使用）。 |

> **新人小结：dist 目录和 src 目录的关系**
>
> ```
> src/ (源代码)  ──编译/打包──▶  dist/ (构建产物)
> ```
>
> - `src/` 是你写的代码，**必须提交到 Git**
> - `dist/` 是代码编译后的结果，**不能提交到 Git**
>
> 如果不小心把 `dist/` 提交了，别人克隆项目后需要先删除 `dist/` 再运行 `npm run build`，多了一步操作。更严重的是，如果 `dist/` 中的代码和你的 `src/` 不同步（比如你改了源码但没重新构建），别人拿到的是"旧代码+新源码"的混合体，会产生难以排查的 bug。

### 2.3 编辑器文件（Editor Files）

```gitignore
# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

| 行 | 内容 | 解释 |
|---|------|------|
| 12 | `.vscode/*` | VS Code 编辑器的配置文件夹。里面可能有你的个人设置（快捷键、主题、扩展配置等），这些是**个人偏好**，不应该影响其他人。 |
| 13 | `!.vscode/extensions.json` | **注意 `!` 前缀**——这是 gitignore 的"反忽略"语法，意思是"除了这个文件，其他 .vscode 下的文件都忽略"。`extensions.json` 记录了项目需要的 VS Code 扩展列表，**应该提交**，这样别人克隆项目后能自动安装推荐的扩展。 |
| 14 | `.idea` | JetBrains 系列 IDE（WebStorm、IntelliJ IDEA）的项目配置文件。 |
| 15 | `.DS_Store` | macOS 系统自动生成的文件，记录文件夹的自定义设置（图标位置、排序方式等）。在 Windows 和 Linux 上完全没用，但如果你用 Mac 开发，它会被自动创建。 |
| 16-20 | `*.suo`、`*.ntvs*` 等 | 旧版 Visual Studio 的临时文件，现代开发中很少见，但保留忽略规则以防万一。 |

> **新人小结：`!` 反忽略语法**
>
> `.gitignore` 支持用 `!` 开头来"取消忽略"某个文件。规则是**从上到下逐条匹配**，后面的规则可以覆盖前面的：
>
> ```gitignore
> .vscode/*          ← 忽略 .vscode 下所有文件
> !.vscode/extensions.json  ← 但保留 extensions.json
> ```
>
> 最终效果：`.vscode/` 下的所有文件都被忽略，**除了** `extensions.json`。
>
> **常见错误**：把 `!` 放在第一行。Git 的匹配规则是"先忽略后排除"，如果 `!` 在最前面，后面的忽略规则仍然会生效。正确的做法是：先写忽略规则，再写排除规则。

### 2.4 日志文件（Logs）

```gitignore
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

| 行 | 内容 | 解释 |
|---|------|------|
| 23 | `logs` | 项目可能产生的日志目录（如果代码中有写日志到文件的逻辑）。 |
| 24 | `*.log` | 所有 `.log` 结尾的文件。运行时产生的日志通常包含敏感信息（用户数据、错误堆栈），不应该提交。 |
| 25-27 | `npm-debug.log*` 等 | npm/yarn 安装过程中产生的调试日志。这些文件通常在 `npm install` 失败时生成，包含详细的错误信息，但它们是**临时的**，重新安装即可生成。 |

> **新人小结：为什么日志文件不能提交？**
>
> 1. **体积大**：日志文件可能达到几十 MB 甚至几百 MB
> 2. **含敏感信息**：可能包含用户数据、API 密钥、错误堆栈中的内部路径
> 3. **频繁变动**：每次运行都会产生新日志，提交会导致大量无意义的变更
> 4. **可再生**：日志是运行时的产物，源代码中没有，不需要版本管理

### 2.5 环境变量（Environment Variables）

```gitignore
# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

| 行 | 内容 | 解释 |
|---|------|------|
| 30 | `.env` | 通用环境变量文件，可能包含数据库密码、API 密钥等敏感信息。 |
| 31 | `.env.local` | **本地覆盖文件**，通常包含个人开发环境特有的配置（比如本地数据库地址 `localhost:3306`）。这个文件**绝对不能提交**，否则你的本地配置会覆盖其他人的配置。 |
| 32-34 | `.env.development.local` 等 | 不同环境（开发/测试/生产）的环境变量文件。通常只提交 `.env.example`（示例文件，不含真实值），让其他人知道需要哪些变量。 |

> **新人小结：.env 文件的安全风险**
>
> 这是前端开发中最常见的安全失误之一。很多人会把 `.env` 文件提交到 Git，导致：
> 1. **API 密钥泄露**：如果 `.env` 中有 `API_KEY=sk-xxx`，任何人看到仓库都能用这个密钥
> 2. **数据库密码泄露**：`DB_PASSWORD=xxx` 被提交后，恶意人员可能连接你的数据库
> 3. **配置污染**：你的本地配置（如 `VITE_API_URL=http://localhost:8080`）覆盖了他人的配置
>
> **正确做法**：
> - `.env` 和 `.env.local` 永远不提交
> - 创建一个 `.env.example` 文件，只包含变量名和示例值（不含真实值）
> - `.env.example` 应该提交到仓库，让其他人知道需要配置哪些变量

### 2.6 Electron 专用（Electron）

```gitignore
# Electron
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

这一部分和上面的日志部分有重复，是 Electron 项目的额外保障。因为 Electron 应用会运行 Node.js 代码，日志文件可能包含更多敏感信息（如进程路径、内存地址等）。

### 2.7 操作系统文件（OS Files）

```gitignore
# OS files
.DS_Store
Thumbs.db
```

| 行 | 内容 | 解释 |
|---|------|------|
| 42 | `.DS_Store` | macOS 的文件夹元数据文件（前面已提）。 |
| 43 | `Thumbs.db` | Windows 资源管理器的缩略图缓存文件。 |

### 2.8 IDE 配置（IDE）

```gitignore
# IDE
.vscode/
.idea/
```

和前面的编辑器部分重复，确保 IDE 配置文件被完全忽略。

### 2.9 临时文件（Temporary Files）

```gitignore
# Temporary files
*.tmp
*.temp
*.cache
```

编辑器或构建工具产生的临时文件。比如 VS Code 的 `.vscode-workspace` 临时文件，Vite 的 `.vite` 缓存目录等。

### 2.10 测试覆盖（Coverage）

```gitignore
# Coverage
coverage/
.nyc_output/
```

单元测试覆盖率报告（如 `coverage/lcov-report/`）和 NYC（Istanbul 的 Node 实现）的中间输出文件。这些是**分析结果**，不是代码本身。

### 2.11 测试报告（Testing）

```gitignore
# Testing
jest-report/
test-results/
```

测试框架（如 Jest）生成的报告文件。

### 2.12 其他（Misc）

```gitignore
# Misc
*.tsbuildinfo
```

TypeScript 编译产生的增量编译信息文件，用于加速后续编译。可以重新生成，不需要提交。

---

## 三、生效流程

```
开发者执行 git add / git commit
        │
        ▼
Git 读取 .gitignore 文件
        │
        ▼
逐条匹配规则（从上到下）
        │
        ├── 匹配到忽略规则 → 跳过该文件，不纳入版本控制
        │
        └── 匹配到反忽略规则（!） → 恢复跟踪该文件
        │
        ▼
未匹配的文件 → 纳入版本控制（git add）
```

**关键规则**：
1. `.gitignore` 只能忽略**未跟踪**的文件。如果文件已经被 Git 跟踪了（之前提交过），忽略规则不会生效。需要先 `git rm --cached <file>` 取消跟踪，再忽略。
2. 规则从上到下匹配，后面的可以覆盖前面的。
3. 通配符 `*` 匹配任意字符（不包括 `/`），`**` 匹配任意层级目录。
4. 以 `/` 结尾的路径只匹配目录（如 `node_modules/` 只忽略 `node_modules` 目录，不忽略 `my-node_modules` 文件）。

---

## 四、常见错误与排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `node_modules` 被提交了 | `.gitignore` 中缺少 `node_modules/` | 添加 `node_modules/` 并执行 `git rm -r --cached node_modules` |
| 改了 `.gitignore` 但文件仍被跟踪 | 文件之前已被 Git 跟踪 | 执行 `git rm --cached <file>` 取消跟踪 |
| `.env` 泄露到远程仓库 | 不小心 `git add .env` 后提交 | 立即从 Git 历史中移除（`git filter-branch` 或 BFG Repo Cleaner），并轮换所有泄露的密钥 |
| 不同团队用不同 IDE，配置冲突 | 没有忽略 IDE 配置文件 | 确保 `.vscode/` 和 `.idea/` 在 `.gitignore` 中 |

---

## 五、总结

`.gitignore` 虽然只有几十行，但它是项目健康运行的**基础设施**。它的作用可以总结为三点：

1. **保护安全**：不泄露密钥、密码、个人配置
2. **保持整洁**：不提交自动生成的文件，让 `git status` 只显示真正的代码变更
3. **提高协作效率**：不同开发者用不同工具、不同环境，`.gitignore` 确保大家只共享代码本身

> **给新人的建议**：每次新建项目时，先写好 `.gitignore`，再开始写代码。这比事后补救要容易得多。
