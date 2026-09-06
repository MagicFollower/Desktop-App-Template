/**
 * 菜单树构建工具（从 services/sqlite.ts 抽出，A1）。
 * 供 IPC / HTTP 两个数据适配器与纯浏览器演示兜底共用。
 */

import type { MenuRecord } from '../../main/dto';
import type { MenuItem } from '../types/menu';

/** 把 null / undefined / '' 统一成 null，避免建树时出现指向空字符串的父级 */
export function normalizeParentId(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

/** 去掉树形节点上的 children，保证持久化的始终是扁平结构。
 * 接受树形 MenuItem 或扁平 MenuRecord（两者的 icon/path 可空性不同，统一归一为 null） */
export function toFlatMenu(menu: MenuItem | MenuRecord): MenuRecord {
  // cast 到带可选字段的一侧：MenuRecord 缺 children/component，解构后即丢弃
  const { children, component, ...rest } = menu as MenuItem;
  return {
    id: rest.id,
    parentId: normalizeParentId(rest.parentId),
    label: rest.label,
    icon: rest.icon ?? null,
    path: rest.path ?? null,
    sortOrder: rest.sortOrder ?? 0,
    isSystem: rest.isSystem ?? false,
    roles: rest.roles,
  };
}

/** 将扁平菜单列表转换为按 sortOrder 排序的树形结构 */
export function buildMenuTree(flatItems: MenuRecord[]): MenuItem[] {
  const map = new Map<string, MenuItem>();
  const roots: MenuItem[] = [];

  flatItems.forEach((item) => {
    // MenuRecord 的 icon/path 为 string|null，树形 MenuItem 为可空 undefined，归一转换
    const flat = toFlatMenu(item);
    map.set(item.id, {
      ...flat,
      icon: flat.icon ?? undefined,
      path: flat.path ?? undefined,
      children: [],
    });
  });

  flatItems.forEach((item) => {
    const node = map.get(item.id)!;
    const parentId = normalizeParentId(item.parentId);
    if (parentId && map.has(parentId) && parentId !== item.id) {
      (map.get(parentId)!.children as MenuItem[]).push(node);
    } else {
      roots.push(node);
    }
  });

  const bySortOrder = (a: MenuItem, b: MenuItem) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

  const finalize = (nodes: MenuItem[]) => {
    nodes.sort(bySortOrder);
    nodes.forEach((node) => {
      if (!node.children || node.children.length === 0) {
        delete node.children;
      } else {
        finalize(node.children);
      }
    });
  };
  finalize(roots);

  return roots;
}

/**
 * 按当前用户角色过滤菜单树（A3）：
 * - 节点未声明 roles（空）→ 所有角色可见；
 * - 节点声明了 roles 但不含当前角色 → 该节点连同整棵子树隐藏（父级无权限则子级不可达）；
 * - 返回新数组/新节点，不修改入参（Sidebar 的 state 与菜单管理页共享数据源）。
 */
export function filterMenuTreeByRole(items: MenuItem[], role: string | null | undefined): MenuItem[] {
  const result: MenuItem[] = [];
  for (const item of items) {
    if (item.roles && item.roles.length > 0 && (!role || !item.roles.includes(role))) {
      continue;
    }
    if (item.children && item.children.length > 0) {
      const children = filterMenuTreeByRole(item.children, role);
      result.push(children.length > 0 ? { ...item, children } : { ...item, children: undefined });
    } else {
      result.push(item);
    }
  }
  return result;
}
