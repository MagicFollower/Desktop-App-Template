import { create } from 'zustand';
import type { UserInfo } from '../types/user';

const USER_KEY = 'auth-user';
const TOKEN_KEY = 'auth-token';

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserInfo) => void;
  logout: () => void;
  updateUserInfo: (patch: Partial<UserInfo>) => void;
}

function persistUser(user: UserInfo): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // 头像 base64 可能超出配额，此时仅保留内存状态
  }
}

function loadStoredUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

function persistToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 忽略持久化失败，登录状态仍保存在内存中
  }
}

function loadStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

const storedUser = loadStoredUser();
const storedToken = loadStoredToken();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storedToken,
  userInfo: storedUser,
  isAuthenticated: !!storedToken && !!storedUser,
  login: (token, user) => {
    persistToken(token);
    persistUser(user);
    set({ token, userInfo: user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, userInfo: null, isAuthenticated: false });
  },
  updateUserInfo: (patch) => {
    const current = get().userInfo;
    if (!current) return;
    const next = { ...current, ...patch };
    persistUser(next);
    set({ userInfo: next });
  },
}));
