以下是一个完整的 Node.js 脚本（`.mjs`），用于将输入的图片（PNG、JPEG、SVG 等常见格式）转换为多尺寸的 `.ico` 图标文件。脚本使用 `sharp` 进行图像处理（支持 SVG 渲染），并手动构建符合规范的 ICO 文件（包含 16、32、48、64、128、256 六种尺寸的 PNG 图像）。

```javascript
#!/usr/bin/env node
/**
 * gen-icon.mjs
 * 将任意图片（PNG/JPEG/SVG等）转换为多尺寸 .ico 图标文件
 * 用法：
 *   node gen-icon.mjs <输入文件路径> [输出文件路径]
 * 示例：
 *   node gen-icon.mjs icon.png
 *   node gen-icon.mjs logo.svg dist/app.ico
 *
 * 依赖：sharp（请先安装：npm install sharp）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 检查 sharp 是否已安装
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.error('错误：未找到 sharp 模块。请先安装依赖：');
  console.error('  npm install sharp');
  process.exit(1);
}

// 要生成的图标尺寸（像素）
const SIZES = [16, 32, 48, 64, 128, 256];

/**
 * 将输入文件转换为包含多个尺寸 PNG 的 ICO 文件
 */
async function generateIcon(inputPath, outputPath) {
  // 验证输入文件存在
  if (!fs.existsSync(inputPath)) {
    console.error(`错误：输入文件不存在：${inputPath}`);
    process.exit(1);
  }

  // 确定输出路径
  if (!outputPath) {
    const parsed = path.parse(inputPath);
    outputPath = path.join(parsed.dir, `${parsed.name}.ico`);
  }

  console.log(`正在处理：${inputPath}`);
  console.log(`输出文件：${outputPath}`);

  try {
    // 读取输入图像，SVG 设置较高 density 以获取足够大的源
    const image = sharp(inputPath, { density: 300 });

    // 获取原始元数据（可选）
    // const metadata = await image.metadata();

    // 生成各尺寸 PNG 缓冲区
    const pngBuffers = [];
    for (const size of SIZES) {
      // 调整尺寸并转换为 PNG
      const buffer = await image
        .clone()
        .resize(size, size, {
          fit: 'contain',      // 保持比例，完整包含在正方形内
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
        })
        .png()
        .toBuffer();
      pngBuffers.push({ size, buffer });
      console.log(`  生成 ${size}x${size} PNG (${buffer.length} bytes)`);
    }

    // 构建 ICO 文件
    const icoBuffer = buildIco(pngBuffers);

    // 写入输出文件
    fs.writeFileSync(outputPath, icoBuffer);
    console.log(`成功生成 ICO 文件：${outputPath}`);
  } catch (err) {
    console.error('处理图像时出错：', err.message);
    process.exit(1);
  }
}

/**
 * 根据 PNG 图像数组构建 ICO 文件缓冲区
 * @param {Array<{size: number, buffer: Buffer}>} images
 * @returns {Buffer}
 */
function buildIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const count = images.length;

  // 计算所有图像数据的偏移量
  const dataOffset = headerSize + entrySize * count;
  let currentOffset = dataOffset;

  // 创建 ICO 头
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // 保留字段，必须为 0
  header.writeUInt16LE(1, 2);      // 类型：1 表示 ICO
  header.writeUInt16LE(count, 4);  // 图像数量

  // 创建目录条目数组
  const entries = [];

  for (const { size, buffer } of images) {
    // 宽度和高度：256 需要写入 0
    const dimension = size >= 256 ? 0 : size;

    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(dimension, 0);          // 宽度
    entry.writeUInt8(dimension, 1);          // 高度
    entry.writeUInt8(0, 2);                  // 颜色数（0 表示使用 PNG 内部调色板）
    entry.writeUInt8(0, 3);                  // 保留
    entry.writeUInt16LE(1, 4);               // 颜色平面数（通常为 1）
    entry.writeUInt16LE(32, 6);              // 位深（32 位 RGBA）
    entry.writeUInt32LE(buffer.length, 8);   // 图像数据大小
    entry.writeUInt32LE(currentOffset, 12);  // 图像数据偏移

    entries.push(entry);
    currentOffset += buffer.length;
  }

  // 合并所有部分
  const totalLength = currentOffset;
  const ico = Buffer.alloc(totalLength);

  // 写入头部
  header.copy(ico, 0);

  // 写入目录条目
  let offset = headerSize;
  for (const entry of entries) {
    entry.copy(ico, offset);
    offset += entrySize;
  }

  // 写入图像数据
  for (const { buffer } of images) {
    buffer.copy(ico, offset);
    offset += buffer.length;
  }

  return ico;
}

// 解析命令行参数
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('用法：node gen-icon.mjs <输入文件路径> [输出文件路径]');
  process.exit(1);
}

const input = path.resolve(args[0]);
const output = args[1] ? path.resolve(args[1]) : null;

generateIcon(input, output);
```

## 使用说明

### 1. 安装依赖
脚本依赖 `sharp` 进行图像处理，请先安装：
```bash
npm install sharp
```
> 如果使用 Electron 等环境，注意 `sharp` 的原生模块可能需要与 Node 版本匹配，通常安装即可自动处理。

### 2. 运行脚本
```bash
node gen-icon.mjs input.png
# 或
node gen-icon.mjs logo.svg dist/app.ico
```

- **第一个参数**：输入图片路径（支持 PNG、JPEG、SVG、WebP 等 sharp 支持的所有格式）。
- **第二个参数（可选）**：输出 `.ico` 文件路径。若不指定，则在输入文件同目录下生成同名的 `.ico` 文件。

### 3. 功能特性
- 生成包含 **16、32、48、64、128、256** 六种尺寸的图标。
- 保持原始宽高比，居中放置在透明背景上（适合非正方形源图）。
- 输出为 PNG 压缩格式的 ICO，现代 Windows 系统均支持。
- 对 SVG 输入自动设置 `density=300`，确保渲染足够清晰。

### 4. 错误处理
- 如果输入文件不存在，脚本会提示并退出。
- 如果图像处理失败（例如格式不受支持），会输出错误信息。
- 如果 `sharp` 未安装，脚本会给出安装提示。

## 技术说明
- **ICO 文件结构**：严格遵循 [ICO 规范](https://en.wikipedia.org/wiki/ICO_(file_format))，使用 PNG 数据作为图像内容（Vista 及更高版本推荐）。
- **尺寸处理**：使用 `sharp` 的 `resize` 方法，`fit: 'contain'` 确保图像完整包含在目标尺寸内，背景透明。
- **性能考虑**：利用 `sharp` 的链式 API 和 `clone()` 避免重复解码源文件，提高处理效率。

该脚本可直接作为项目中的 `gen:icon` 脚本使用（对应 `package.json` 中的命令），用于自动生成 Windows 安装包所需的 `.ico` 图标。