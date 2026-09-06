export interface TabItem {
  id: string;        // 唯一标识（通常与路由路径一致）
  title: string;     // 显示标题
  path: string;      // 路由路径
  closable: boolean; // 是否可关闭（首页不可关闭）
}

export interface TabState {
  tabs: TabItem[];
  activeTabId: string | null;
  addTab: (tab: Omit<TabItem, 'closable'>) => void;
  /** 更新已存在 Tab 的标题（不动 activeTabId）：TabBar 菜单标题就绪后修正 fallback 路径标题 */
  updateTabTitle: (id: string, title: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  closeLeft: (id: string) => void;
  closeRight: (id: string) => void;
  closeAll: () => void;
  closeCurrent: (id: string) => void;
}
