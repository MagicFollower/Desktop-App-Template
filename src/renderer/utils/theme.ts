/**
 * 主题切换工具函数
 */
import type { ThemeMode } from '../types/theme';

/**
 * 初始化主题（从 localStorage 读取）
 */
export function initTheme(): ThemeMode {
  const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
  const mode = savedMode || 'dark';
  document.documentElement.setAttribute('data-theme', mode);
  return mode;
}

/**
 * 切换主题并保存到 localStorage
 */
export function setTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme-mode', mode);
}
