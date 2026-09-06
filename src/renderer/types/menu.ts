import type { ReactNode } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  path?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isSystem?: boolean;
  /** 可见角色列表（A3）：空 = 所有角色可见；父级无权限时整棵子树隐藏 */
  roles?: string[];
  children?: MenuItem[];
  component?: ReactNode;
}

export interface MenuState {
  selectedId: string | null;
  expandedIds: string[];
  setSelected: (id: string) => void;
  toggleExpanded: (id: string) => void;
  ensureExpanded: (id: string) => void;
}
