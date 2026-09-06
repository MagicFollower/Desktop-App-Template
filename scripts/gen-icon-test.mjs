/**
 * 应用图标生成脚本（零依赖，纯 Node）。
 *
 * 背景：package.json 的 build.win.icon 指向 assets/icon.ico，但该文件此前不存在，
 * electron-builder 打包时退回默认 Electron 图标并告警。本机没有 SVG 光栅化工具、
 * 且 GitHub 网络受限不便临时装依赖，故这里用「程序化绘制 + 手写 PNG 编码 + 打包成 ICO」
 * 的方式离线生成一枚 Vite 风格图标（品牌渐变底 + 白色闪电），完全可复现、可微调。
 *
 * 运行：node scripts/gen-icon-test.mjs   （或 npm run gen:icon）
 * 产物：assets/icon.ico（含 16/24/32/48/64/128/256 多尺寸 PNG 帧）
 */
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'assets', 'icon.ico');
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SS = 4; // 超采样倍率，用于边缘抗锯齿

// ---- 几何（归一化坐标 [0,1]，与尺寸无关）----
const BADGE = { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92, r: 0.20 }; // 圆角方形底
// 经典闪电折线（Z 形），完全落在 badge 内
const BOLT = [
  [0.56, 0.12],
  [0.28, 0.56],
  [0.47, 0.56],
  [0.42, 0.88],
  [0.72, 0.42],
  [0.52, 0.42],
];

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

/** 射线法：点是否落在多边形内 */
function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj,yj] = pts[j];
    const hit = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** 点是否落在圆角方形内 */
function inRoundedRect(x, y) {
  const { x0, y0, x1, y1, r } = BADGE;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + r - x, x - (x1 - r), 0);
  const dy = Math.max(y0 + r - y, y - (y1 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

/** 采样某个归一化坐标的颜色（返回 RGBA 数组；闪电 > 渐变底 > 透明） */
function sample(x, y) {
  if (pointInPoly(x, y, BOLT)) return [255, 255, 255, 255];
  if (inRoundedRect(x, y)) {
    const t = (x + y) / 2; // 左上→右下对角渐变
    // #41D1FF(65,209,255) → #BD34FE(189,52,254)，Vite 品牌色
    return [lerp(65, 189, t), lerp(209, 52, t), lerp(255, 254, t), 255];
  }
  return [0, 0, 0, 0];
}

/** 渲染指定边长的 RGBA 缓冲，使用 SS×SS 超采样 + 预乘 alpha 平均，得到平滑边缘 */
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let pr = 0, pg = 0, pb = 0, pa = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (x + (sx + 0.5) / SS) / size;
          const fy = (y + (sy + 0.5) / SS) / size;
          const c = sample(fx, fy);
          const a = c[3] / 255;
          pr += c[0] * a; pg += c[1] * a; pb += c[2] * a; pa += c[3];
          n++;
        }
      }
      const alpha = Math.round(pa / n);
      let R = 0, G = 0, B = 0;
      if (alpha > 0) {
        const div = alpha / 255;
        R = Math.min(255, Math.round(pr / n / div));
        G = Math.min(255, Math.round(pg / n / div));
        B = Math.min(255, Math.round(pb / n / div));
      }
      const o = (y * size + x) * 4;
      rgba[o] = R; rgba[o + 1] = G; rgba[o + 2] = B; rgba[o + 3] = alpha;
    }
  }
  return rgba;
}

// ---- PNG 编码（truecolor+alpha, filter=0, deflate）----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let nn = 0; nn < 256; nn++) {
    let c = nn;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[nn] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (~c >>> 0);
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit, RGBA
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---- ICO 容器（PNG-in-ICO，Vista+）----
function buildICO(frames) {
  const count = frames.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const parts = [header];
  for (const f of frames) {
    const e = Buffer.alloc(16);
    e[0] = f.size === 256 ? 0 : f.size;
    e[1] = f.size === 256 ? 0 : f.size;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4);   // planes
    e.writeUInt16LE(32, 6);  // bit count
    e.writeUInt32LE(f.png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += f.png.length;
    parts.push(e);
  }
  for (const f of frames) parts.push(f.png);
  return Buffer.concat(parts);
}

// ---- 生成 + 自检 ----
const frames = SIZES.map((s) => ({ size: s, png: encodePNG(s, render(s)) }));
const ico = buildICO(frames);
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, ico);

// 回读解析 ICONDIR 与各帧 PNG IHDR，验证结构合法
const check = fs.readFileSync(OUT_PATH);
const cType = check.readUInt16LE(2), cCount = check.readUInt16LE(4);
const dims = [];
for (let i = 0; i < cCount; i++) {
  const entry = 6 + i * 16;
  const imageOffset = check.readUInt32LE(entry + 12);
  const isPng = check.readUInt32BE(imageOffset) === 0x89504e47;
  const w = check.readUInt32BE(imageOffset + 16);
  const h = check.readUInt32BE(imageOffset + 20);
  dims.push(`${w}x${h}${isPng ? '(png)' : '(?)'}`);
}
console.log(`[icon] wrote ${OUT_PATH}`);
console.log(`[icon] bytes=${ico.length} type=${cType} count=${cCount} frames=[${dims.join(', ')}]`);
