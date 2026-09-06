import { defineConfig } from 'vitest/config';

/**
 * 单元测试配置（A7）。
 *
 * 测试范围刻意收敛为「纯逻辑」：menu-tree / useQueryTable 等不依赖
 * Electron 与数据库的模块——service 层冒烟已由 scripts/test-*.mjs
 * 在真实驱动上覆盖，无需在此重复搭主进程环境。
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
