import { create } from 'zustand';
import type { TabItem, TabState } from '../types/tab';

// 首页固定 Tab（不可关闭）
const HOME_TAB: TabItem = {
  id: '/',
  title: '仪表盘',
  path: '/',
  closable: false,
};

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [HOME_TAB],
  activeTabId: '/',

  addTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      // 已存在：仅激活，不改标题——标题修正走 updateTabTitle（避免误改 activeTabId）
      set({ activeTabId: tab.id });
      return;
    }
    const newTab: TabItem = { ...tab, closable: true };
    set({ tabs: [...tabs, newTab], activeTabId: tab.id });
  },

  updateTabTitle: (id, title) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.id === id)) return;
    set({ tabs: tabs.map((t) => (t.id === id ? { ...t, title } : t)) });
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (id === HOME_TAB.id) return; // 首页不可关闭

    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;

    // 如果关闭的是当前激活的 Tab，自动切换到相邻 Tab
    if (activeTabId === id) {
      const nextTab = newTabs[idx] || newTabs[idx - 1];
      newActiveId = nextTab?.id || HOME_TAB.id;
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  closeLeft: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx <= 1) return; // 保留首页和当前 Tab

    const keepTabs = tabs.slice(idx);
    const newTabs = [HOME_TAB, ...keepTabs.filter((t) => t.id !== HOME_TAB.id)];
    let newActiveId = activeTabId;
    if (!newTabs.some((t) => t.id === activeTabId)) {
      newActiveId = id;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  closeRight: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1 || idx === tabs.length - 1) return;

    const newTabs = tabs.slice(0, idx + 1);
    let newActiveId = activeTabId;
    if (!newTabs.some((t) => t.id === activeTabId)) {
      newActiveId = id;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  closeAll: () => {
    set({ tabs: [HOME_TAB], activeTabId: HOME_TAB.id });
  },

  closeCurrent: (id) => {
    get().removeTab(id);
  },
}));
