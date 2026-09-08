# 应用图标（icon.ico）与离线生成方案

## 背景 / 症状

`npm run package`（electron-builder）时控制台出现：

```
• default Electron icon is used  reason=application icon is not set
```

含义：打包出的 exe/安装包用的是 **Electron 默认图标**，不是本应用自定义图标。

## 根因

`../../package.json` 里配置了：
```json
"build": { "win": { "target": "nsis", "icon": "assets/icon.ico" } }
```
但项目里**根本没有 `../../assets/icon.ico`**（`../../assets` 目录都不存在）。electron-builder 找不到指定图标，于是：
1. 回退到 Electron 自带图标；
2. 打印上面那条 warning。

> 注意：这条 warning 与「winCodeSign / nsis 二进制下载超时」是**两件独立的事**——前者是缺图标文件（本档解决），后者是 GitHub 网络问题（见对话记录 / 另行处理）。补齐图标只消除图标告警。

## 约束

- 期望「以 `../../public/vite.svg`（Vite 闪电 logo）为准，或做一个类似的」。
- 本机**没有 SVG 光栅化工具**（无 ImageMagick/inkscape/sharp），且 **GitHub 网络受限**，不适合临时 `npx` 拉取转换包。
- 需要产物是**合法的 Windows `.ico`**，且 electron-builder 的 win 目标期望包含 **≥256×256** 的帧。

## 方案（已采用）：纯 Node 零依赖，程序化生成 PNG-in-ICO

新增可复现脚本 [`../../scripts/gen-icon-test.mjs`](../../scripts/gen-icon-test.mjs)，并加 npm 脚本：
```json
"gen:icon": "node scripts/gen-icon-test.mjs"
```

设计：一枚 **Vite 风格图标**——圆角方形底铺 Vite 品牌对角渐变（`#41D1FF → #BD34FE`），上叠白色**闪电**折线；透明外边。与尺寸无关的归一化几何 + **4× 超采样**做边缘抗锯齿。

技术上分三段，全部只用 Node 内置能力（`zlib` + `Buffer`）：

1. **光栅化**：逐像素计算 RGBA（点在多边形内=闪电白；在圆角方形内=渐变色；否则透明）。
2. **手写 PNG 编码器**：标准 `IHDR/IDAT/IEND` 分块 + 自实现 CRC32 + `zlib.deflateSync`（truecolor+alpha，filter=0）。
3. **打包 ICO 容器**：`ICONDIR + ICONDIRENTRY[] + 各帧 PNG`，即 **PNG-in-ICO（Vista+ 格式）**，Windows 与 electron-builder 均可直接识别。256 帧的尺寸字节按规范写 `0`。

输出多尺寸帧：**16 / 24 / 32 / 48 / 64 / 128 / 256**，写入 `../../assets/icon.ico`。

### 为什么用 PNG-in-ICO 而非 BMP-in-ICO
PNG 帧更小、带 8 位 alpha、支持 256 大帧；Vista 起的 Windows 与 electron-builder 都吃这种格式，实现也最简（直接内嵌上面产出的 PNG，省去 BMP 掩码/反行序处理）。

## 使用 / 复现

```powershell
npm run gen:icon          # 生成 assets/icon.ico（可重复运行、幂等覆盖）
npm run package           # 之后打包即采用自定义图标，默认图标告警消失
```
脚本末尾会**自检**：回读文件解析 `ICONDIR` 与每帧 PNG 的 `IHDR`，打印：
```
[icon] bytes=13091 type=1 count=7 frames=[16x16(png), 24x24(png), 32x32(png), 48x48(png), 64x64(png), 128x128(png), 256x256(png)]
```
`type=1`(图标)、`count=7`、每帧 `(png)` 且尺寸正确，即结构合法。

想换造型/配色：改脚本里的 `BADGE`、`BOLT`、渐变色值、`SIZES` 后重跑 `gen:icon` 即可。

## 验证

- 生成：`node scripts/gen-icon.mjs` 成功，产物 `../../assets/icon.ico` 13KB、7 帧 PNG（含 256）。
- 目标路径与 `../../package.json` 的 `build.win.icon = "assets/icon.ico"` 一致。
- 补齐后，electron-builder 打包时不再走「默认 Electron 图标」分支（前提：winCodeSign/nsis 二进制可正常下载，网络问题解决后整包即可带上自定义图标）。

## 影响面 / 未改动项

- 浏览器页签 **favicon** 仍是 `../../index.html` 里的 `<link rel="icon" href="/vite.svg">`（`../../public/vite.svg` 保留），与桌面 exe 图标是两回事，未改。
- 若后续要让 favicon 也换成同款，可用本脚本导一张 `icon.png` 替换即可。

## 相关文件

| 文件 | 说明 |
|------|------|
| `../../scripts/gen-icon-test.mjs` | 零依赖图标生成器（光栅化 + PNG 编码 + ICO 打包 + 自检） |
| `../../assets/icon.ico` | 生成的多尺寸 Windows 图标（新增） |
| `../../package.json` | 新增 `gen:icon` 脚本；`build.win.icon` 指向 `../../assets/icon.ico` |
