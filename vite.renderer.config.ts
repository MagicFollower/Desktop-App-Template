import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // 打包为桌面应用后经 file:// 加载，资源必须用相对路径；
  // 默认的 '/' 会生成 /assets/xxx.js 绝对路径，在 file:// 下无法解析，
  // 且会让 CSP 的 default-src 'self' 无法匹配同源资源。dev 模式不受 base 影响。
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
