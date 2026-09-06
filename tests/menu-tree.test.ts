import { describe, it, expect } from 'vitest';
import { buildMenuTree, toFlatMenu, filterMenuTreeByRole, normalizeParentId } from '../src/renderer/services/menu-tree';
import type { MenuRecord } from '../src/main/dto';

const FLAT: MenuRecord[] = [
  { id: 'dashboard', parentId: null, label: '仪表盘', icon: 'DashboardOutlined', path: '/', sortOrder: 0, isSystem: true },
  { id: 'system', parentId: null, label: '系统管理', icon: 'SettingOutlined', path: null, sortOrder: 1, isSystem: true },
  { id: 'system-users', parentId: 'system', label: '人员管理', icon: 'UserOutlined', path: '/system/users', sortOrder: 0, isSystem: true },
  { id: 'system-profile', parentId: 'system', label: '个人信息', icon: 'IdcardOutlined', path: '/system/profile', sortOrder: 1, isSystem: true },
  // 乱序传入，验证 sortOrder 排序
  { id: 'tools', parentId: null, label: '工具模块', icon: 'ToolOutlined', path: null, sortOrder: 2, isSystem: true },
  { id: 'tools-redis', parentId: 'tools', label: 'Redis 查询', icon: 'DatabaseOutlined', path: '/tools/redis', sortOrder: 1, isSystem: true },
  { id: 'tools-files', parentId: 'tools', label: '文件管理', icon: 'FolderOutlined', path: '/tools/files', sortOrder: 0, isSystem: true },
];

describe('normalizeParentId', () => {
  it('把 null / undefined / 空字符串统一为 null', () => {
    expect(normalizeParentId(null)).toBeNull();
    expect(normalizeParentId(undefined)).toBeNull();
    expect(normalizeParentId('')).toBeNull();
    expect(normalizeParentId('system')).toBe('system');
  });
});

describe('buildMenuTree', () => {
  const tree = buildMenuTree(FLAT);

  it('根节点只包含 parentId 为 null 的项', () => {
    expect(tree.map((n) => n.id)).toEqual(['dashboard', 'system', 'tools']);
  });

  it('子节点挂到对应父级且按 sortOrder 排序', () => {
    const tools = tree.find((n) => n.id === 'tools')!;
    expect(tools.children?.map((n) => n.id)).toEqual(['tools-files', 'tools-redis']);
  });

  it('父级不存在（被删除后的孤儿）时提升为根节点', () => {
    const orphan: MenuRecord = { ...FLAT[0], id: 'orphan', parentId: 'ghost' };
    const result = buildMenuTree([...FLAT, orphan]);
    expect(result.map((n) => n.id)).toContain('orphan');
  });

  it('parentId 指向自身（环）时不挂为子节点，提升为根', () => {
    const selfRef: MenuRecord = { ...FLAT[0], id: 'self-ref', parentId: 'self-ref' };
    const result = buildMenuTree([...FLAT, selfRef]);
    expect(result.map((n) => n.id)).toContain('self-ref');
  });

  it('空 children 字段在 finalize 后被删除（序列化干净）', () => {
    expect('children' in tree[0]).toBe(false);
  });
});

describe('toFlatMenu', () => {
  it('树形节点去 children/component，roles 保留', () => {
    const tree = buildMenuTree([...FLAT, { ...FLAT[1], id: 'admin-only', roles: ['admin'] }]);
    const adminOnly = tree.find((n) => n.id === 'admin-only')!;
    const flat = toFlatMenu(adminOnly);
    expect('children' in flat).toBe(false);
    expect('component' in flat).toBe(false);
    expect(flat.roles).toEqual(['admin']);
    expect(flat.parentId).toBeNull();
  });
});

describe('filterMenuTreeByRole（A3）', () => {
  // FLAT 中去掉 system 相关节点，用带 roles 的版本重新加入（避免重复 id 产生重复节点）
  const base = FLAT.filter((m) => !m.id.startsWith('system'));
  const tree = buildMenuTree([
    ...base,
    { id: 'system', parentId: null, label: '系统管理', icon: 'SettingOutlined', path: null, sortOrder: 1, isSystem: true, roles: ['admin'] },
    { id: 'system-users', parentId: 'system', label: '人员管理', icon: 'UserOutlined', path: '/system/users', sortOrder: 0, isSystem: true, roles: ['admin'] },
    { id: 'system-profile', parentId: 'system', label: '个人信息', icon: 'IdcardOutlined', path: '/system/profile', sortOrder: 1, isSystem: true },
  ]);

  it('未声明 roles 的节点对所有角色可见', () => {
    const result = filterMenuTreeByRole(tree, 'user');
    expect(result.map((n) => n.id)).toEqual(['dashboard', 'tools']);
  });

  it('admin 角色可见全部菜单', () => {
    const result = filterMenuTreeByRole(tree, 'admin');
    expect(result.map((n) => n.id)).toEqual(['dashboard', 'system', 'tools']);
  });

  it('父级无权限时整棵子树隐藏（子级即使不限角色也不可达）', () => {
    // system 限 admin；system-profile 未限角色，但作为 system 的子节点对 user 不可达
    const result = filterMenuTreeByRole(tree, 'user');
    expect(result.find((n) => n.id === 'system')).toBeUndefined();
    // admin 视角下 system-profile 仍在（不限角色的子节点）
    const adminView = filterMenuTreeByRole(tree, 'admin');
    expect(adminView.find((n) => n.id === 'system')?.children?.map((n) => n.id)).toEqual(['system-users', 'system-profile']);
  });

  it('不修改入参（返回新节点）', () => {
    const before = JSON.stringify(tree);
    filterMenuTreeByRole(tree, 'user');
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('未登录（role 为空）时只可见未限角色的菜单', () => {
    const result = filterMenuTreeByRole(tree, null);
    expect(result.map((n) => n.id)).toEqual(['dashboard', 'tools']);
  });
});
