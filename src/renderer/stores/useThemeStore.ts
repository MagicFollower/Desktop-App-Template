import { create } from 'zustand';
import type { ThemeMode, ThemeState } from '../types/theme';

interface ThemeStore extends ThemeState {
  initTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'dark',
  setMode: (mode: ThemeMode) => {
    set({ mode });
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme-mode', mode);
  },
  initTheme: () => {
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
    const mode = savedMode || 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    set({ mode });
  },
}));
