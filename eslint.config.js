import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLint flat config（A7）。
 * 基线：@eslint/js + typescript-eslint recommended + react-hooks 规则。
 * 未开 type-checked 规则集：现有代码存在跨进程边界的显式 any（api-server 等），
 * 引入需先清存量，留作后续增强。
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'doc/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/main/**/*.ts'],
    rules: {
      // 主进程编译为 CJS：require 是对可选原生模块（better-sqlite3 / electron-log）
      // 做懒加载 + 失败回退的标准手段，不能用 ESM 静态 import 替代
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      // 项目既有风格：允许 console（已收敛到 logger 门面）与显式 any 的渐进治理
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // 下划线前缀参数/变量 = 刻意丢弃（DataAdapter 接口占位实现）；
      // 解构 ...rest 时丢弃的字段（toFlatMenu 去 children）不规 unused
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
);
