export type ThemeMode = 'dark' | 'light' | 'blue' | 'green';

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}
