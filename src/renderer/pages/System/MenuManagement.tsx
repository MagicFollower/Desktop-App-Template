import { useState, useMemo, useRef } from 'react';
import { PlusOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import * as Icons from '@ant-design/icons';
import QueryForm from '../../components/QueryForm/QueryForm';
import type { QueryFieldConfig, QueryTreeNode, QueryValue } from '../../components/QueryForm/QueryForm';
import QueryTableLayout from '../../components/QueryTableLayout/QueryTableLayout';
import { useQueryTable } from '../../hooks/useQueryTable';
import type { QueryParams } from '../../hooks/useQueryTable';
import Modal from '../../components/Modal/Modal';
import IconPicker from '../../components/IconPicker/IconPicker';
import ParentMenuPicker from '../../components/ParentMenuPicker/ParentMenuPicker';
import { useToast } from '../../components/Layout/AppLayout';
import { loadMenus, saveMenu, deleteMenu, reorderMenus } from '../../services/sqlite';
import type { MenuReorderEntry } from '../../services/sqlite';
import type { MenuItem } from '../../types/menu';
import './MenuManagement.css';

interface MenuFormState {
  id: string | null;
  parentId: string | null;
  label: string;
  icon: string;
  path: string;
  sortOrder: number;
  /** 可见角色（A3）：空数组 = 所有角色可见 */
  roles: string[];
}

const emptyForm: MenuFormState = {
  id: null,
  parentId: null,
  label: '',
  icon: '',
  path: '',
  sortOrder: 0,
  roles: [],
};

/** 角色选项：与 dto.ts 的 UserRole 保持同步 */
const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'manager', label: '经理' },
  { value: 'user', label: '普通用户' },
];

/** 从查询条件里安全取字符串值（本项目菜单查询条件均为文本/单选） */
const asStr = (v?: QueryValue): string => (typeof v === 'string' ? v : '');

/**
 * 菜单树的查询过滤（供 useQueryTable 使用）：
 * 若选定父级，先裁剪出该父级子树；再在其内按名称/路径过滤。
 */
function filterMenusByQuery(records: MenuItem[], query: QueryParams): MenuItem[] {
  const parentId = asStr(query.parentId);
  const base = parentId ? (findMenu(records, parentId) ? [findMenu(records, parentId)!] : []) : records;
  return filterMenuTree(base, asStr(query.label), asStr(query.path));
}

/** 把菜单树转为 TreeSelect 需要的节点结构（value=id、label=展示名） */
function toTreeNodes(items: MenuItem[]): QueryTreeNode[] {
  return items.map((it) => ({
    value: it.id,
    label: it.label,
    children: it.children && it.children.length > 0 ? toTreeNodes(it.children) : undefined,
  }));
}

// 按名称/路径过滤菜单树：命中节点保留整个子树，未命中则递归查找子节点
function filterMenuTree(items: MenuItem[], label: string, path: string): MenuItem[] {
  if (!label && !path) return items;
  const result: MenuItem[] = [];
  for (const item of items) {
    const labelMatch = !label || item.label.includes(label);
    const pathMatch = !path || (item.path || '').includes(path);
    if (labelMatch && pathMatch) {
      result.push(item);
    } else if (item.children) {
      const matched = filterMenuTree(item.children, label, path);
      if (matched.length > 0) {
        result.push({ ...item, children: matched });
      }
    }
  }
  return result;
}

function findMenu(items: MenuItem[], id: string): MenuItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findMenu(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 查找菜单项的父级 ID；顶级返回 null，找不到节点返回 undefined */
function findParentId(
  items: MenuItem[],
  targetId: string,
  parentId: string | null = null
): string | null | undefined {
  for (const item of items) {
    if (item.id === targetId) return parentId;
    if (item.children) {
      const found = findParentId(item.children, targetId, item.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** 取出某个父级下的直接子菜单（顶级传 null），按当前排序返回 */
function getChildrenOf(items: MenuItem[], parentId: string | null): MenuItem[] {
  const list = parentId === null ? items : findMenu(items, parentId)?.children || [];
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** 检查 targetId 是否是 sourceId 的后代节点，用于防止循环引用 */
function isDescendantOf(allMenus: MenuItem[], sourceId: string, targetId: string): boolean {
  const sourceNode = findMenu(allMenus, sourceId);
  if (!sourceNode || !sourceNode.children) return false;
  return findMenu(sourceNode.children, targetId) !== null;
}

type DropPosition = 'before' | 'inside' | 'after';

interface DropPlan {
  /** 落点所在行；null 表示底部的"顶级菜单"投放区 */
  targetId: string | null;
  position: DropPosition;
  /** 拖拽完成后被拖节点的新父级 */
  parentId: string | null;
  /** before/after 的参照节点，inside 与顶级投放时为 null（追加到末尾） */
  anchorId: string | null;
  valid: boolean;
  reason: string;
}

const SYSTEM_MENU_REASON = '系统内置菜单不支持更改层级，仅允许同级排序';

/** 计算拖到某一行上边缘/中间/下边缘的结果 */
function planRowDrop(
  allMenus: MenuItem[],
  dragged: MenuItem,
  target: MenuItem,
  position: DropPosition
): DropPlan {
  const base = { targetId: target.id, position, anchorId: position === 'inside' ? null : target.id };

  if (dragged.id === target.id) {
    return { ...base, parentId: null, anchorId: null, valid: false, reason: '不能拖拽到自身' };
  }
  if (isDescendantOf(allMenus, dragged.id, target.id)) {
    return { ...base, parentId: null, anchorId: null, valid: false, reason: '不能将菜单拖到自己的子菜单下' };
  }

  const parentId = position === 'inside' ? target.id : findParentId(allMenus, target.id) ?? null;
  if (dragged.isSystem && parentId !== (findParentId(allMenus, dragged.id) ?? null)) {
    return { ...base, parentId, valid: false, reason: SYSTEM_MENU_REASON };
  }

  return { ...base, parentId, valid: true, reason: '' };
}

/** 计算拖到底部"顶级菜单"投放区的结果 */
function planRootDrop(allMenus: MenuItem[], dragged: MenuItem): DropPlan {
  const base: DropPlan = {
    targetId: null,
    position: 'inside',
    parentId: null,
    anchorId: null,
    valid: true,
    reason: '',
  };
  if (dragged.isSystem && (findParentId(allMenus, dragged.id) ?? null) !== null) {
    return { ...base, valid: false, reason: SYSTEM_MENU_REASON };
  }
  return base;
}

/**
 * 把一个合法的投放计划翻译成需要写库的变更集合
 * 目标层级的现有兄弟先剔除被拖节点，插入后被拖节点占 insertAt，其余依次后移
 */
function buildReorderEntries(
  allMenus: MenuItem[],
  dragged: MenuItem,
  plan: DropPlan
): MenuReorderEntry[] {
  const siblings = getChildrenOf(allMenus, plan.parentId).filter((m) => m.id !== dragged.id);

  let insertAt = siblings.length;
  if (plan.anchorId) {
    const anchorIndex = siblings.findIndex((m) => m.id === plan.anchorId);
    if (anchorIndex !== -1) {
      insertAt = plan.position === 'before' ? anchorIndex : anchorIndex + 1;
    }
  }

  const entries: MenuReorderEntry[] = [
    { id: dragged.id, parentId: plan.parentId, sortOrder: insertAt },
  ];
  siblings.forEach((sibling, index) => {
    entries.push({
      id: sibling.id,
      parentId: plan.parentId,
      sortOrder: index < insertAt ? index : index + 1,
    });
  });
  return entries;
}

/** 落点的中文描述，同时用于拖拽提示条和成功提示 */
function describeDropPlan(allMenus: MenuItem[], dragged: MenuItem, plan: DropPlan): string {
  if (plan.targetId === null) {
    return `"${dragged.label}" → 顶级菜单`;
  }
  const targetLabel = findMenu(allMenus, plan.targetId)?.label ?? '';
  if (plan.position === 'inside') {
    return `"${dragged.label}" → "${targetLabel}" 的子菜单`;
  }
  return `"${dragged.label}" → "${targetLabel}" 的${plan.position === 'before' ? '前' : '后'}面`;
}

function MenuManagement() {
  const toast = useToast();

  // 数据统一交给 useQueryTable：内部已解决 StrictMode 下的单次加载，并封装查询/过滤
  const {
    loading,
    records: menus,
    filtered: filteredMenus,
    search,
    reload,
  } = useQueryTable<MenuItem>({
    // loadMenus 内部对 IPC/HTTP 已有兑底，这里再兑一层异常，保证加载态一定收敛
    fetcher: () =>
      loadMenus().catch((err) => {
        console.error('[MenuManagement] Failed to load menus:', err);
        return [] as MenuItem[];
      }),
    filter: filterMenusByQuery,
    clientPagination: false, // 树形结构不分页
  });

  const [expandedRows, setExpandedRows] = useState<string[]>(['system', 'tools']);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<MenuFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [parentPickerVisible, setParentPickerVisible] = useState(false);
  const [draggedItem, setDraggedItem] = useState<MenuItem | null>(null);
  const draggedItemRef = useRef<MenuItem | null>(null);
  const [dragOverRow, setDragOverRow] = useState<{ id: string; position: DropPosition } | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  // 查询字段：菜单名称/路由地址为模糊文本，父级菜单为树形下拉（随菜单数据动态生成）
  const queryFields = useMemo<QueryFieldConfig[]>(
    () => [
      { name: 'label', label: '菜单名称', type: 'input' },
      { name: 'path', label: '路由地址', type: 'input' },
      {
        name: 'parentId',
        label: '父级菜单',
        type: 'treeSelect',
        treeData: toTreeNodes(menus),
        showSearch: true,
        placeholder: '全部（不限父级）',
      },
    ],
    [menus]
  );

  const toggleRow = (id: string) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const openAdd = (parentId: string | null) => {
    setForm({ 
      ...emptyForm, 
      parentId,
      icon: 'DashboardOutlined', // 默认使用第一个图标
      sortOrder: getChildrenOf(menus, parentId).length, // 追加到同级末尾
    });
    setFormVisible(true);
  };

  const openEdit = (item: MenuItem) => {
    // 查找当前菜单的父级 ID
    const parentId = findParentId(menus, item.id) ?? null;
    
    console.log(`[openEdit] Editing menu: ${item.label} (${item.id}), parentId: ${parentId}`);
    
    setForm({
      id: item.id,
      parentId: parentId,
      label: item.label,
      icon: item.icon || '',
      path: item.path || '',
      sortOrder: item.sortOrder || 0,
      roles: item.roles ? [...item.roles] : [],
    });
    setFormVisible(true);
  };

  const handleSave = async () => {
    if (!form.label) {
      setSaveError('请输入菜单名称');
      return;
    }
    
    const menuData = {
      id: form.id || `menu-${Date.now()}`,
      parentId: form.parentId,
      label: form.label,
      icon: form.icon || undefined,
      path: form.path || undefined,
      sortOrder: form.sortOrder,
      roles: form.roles.length > 0 ? form.roles : undefined,
    };

    try {
      await saveMenu(menuData);
      setSaveError('');
      
      // 重新从数据源加载以确保与库一致
      await reload();
      
      // 通知其他组件菜单已更新
      window.dispatchEvent(new CustomEvent('menu-updated'));
      
      toast.success(form.id ? '菜单更新成功' : '菜单创建成功');
      setFormVisible(false);
    } catch (err: any) {
      setSaveError(err.message || '保存失败，请重试');
      toast.error(err.message || '保存失败');
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      // 检查是否有子节点
      const hasChildren = deleteTarget.children && deleteTarget.children.length > 0;
      if (hasChildren) {
        toast.warning(`不能删除"${deleteTarget.label}"，该菜单下还有 ${deleteTarget.children!.length} 个子菜单，请先删除子菜单`);
        setDeleteTarget(null);
        return;
      }

      try {
        await deleteMenu(deleteTarget.id);
        setDeleteError('');
        
        // 重新从数据源加载以确保与库一致
        await reload();
        
        // 通知其他组件菜单已更新
        window.dispatchEvent(new CustomEvent('menu-updated'));
        
        toast.success('菜单删除成功');
        setDeleteTarget(null);
      } catch (err: any) {
        setDeleteError(err.message || '删除失败，请重试');
        toast.error(err.message || '删除失败');
      }
    }
  };

  const parentName = form.parentId ? findMenu(menus, form.parentId)?.label : null;

  // ==================== 拖拽排序 ====================

  /** 当前落点计划：由被拖节点 + 指针所在区域推导，合法性集中在此判断 */
  const dropPlan = useMemo<DropPlan | null>(() => {
    if (!draggedItem) return null;
    if (dragOverRow) {
      const target = findMenu(menus, dragOverRow.id);
      return target ? planRowDrop(menus, draggedItem, target, dragOverRow.position) : null;
    }
    if (rootDropActive) return planRootDrop(menus, draggedItem);
    return null;
  }, [draggedItem, dragOverRow, rootDropActive, menus]);

  const handleDragStart = (e: React.DragEvent, item: MenuItem) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    // ref 供 dragover 同步读取，避免依赖 setState 后的重渲染时机
    draggedItemRef.current = item;
    setDraggedItem(item);
  };

  const handleRowDragOver = (e: React.DragEvent, item: MenuItem) => {
    // 必须先 preventDefault，否则浏览器认为该行不可放置，drop 不会触发
    e.preventDefault();
    const dragged = draggedItemRef.current;
    if (!dragged || dragged.id === item.id) return;
    e.dataTransfer.dropEffect = 'move';

    // 上 25% 插到前面，下 25% 插到后面，中间 50% 成为其子菜单
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const position: DropPosition = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';

    setRootDropActive(false);
    // dragover 每秒触发数十次，状态没变化时返回原对象以避免无谓渲染
    setDragOverRow((prev) =>
      prev && prev.id === item.id && prev.position === position ? prev : { id: item.id, position }
    );
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItemRef.current) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverRow(null);
    setRootDropActive(true);
  };

  /** 指针离开整个表格时清掉落点提示（用几何判断，避免被子元素的 dragleave 误触发） */
  const handleTableDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverRow(null);
      setRootDropActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const dragged = draggedItem;
    const plan = dropPlan;

    setDraggedItem(null);
    draggedItemRef.current = null;
    setDragOverRow(null);
    setRootDropActive(false);

    if (!dragged || !plan) return;

    if (!plan.valid) {
      toast.warning(plan.reason);
      return;
    }

    const description = describeDropPlan(menus, dragged, plan);

    try {
      await reorderMenus(buildReorderEntries(menus, dragged, plan));

      await reload();

      // 拖入某个菜单内部时自动展开父级，让结果立刻可见
      if (plan.position === 'inside' && plan.parentId) {
        const newParentId = plan.parentId;
        setExpandedRows((prev) => (prev.includes(newParentId) ? prev : [...prev, newParentId]));
      }

      window.dispatchEvent(new CustomEvent('menu-updated'));
      toast.success(description);
    } catch (err: any) {
      console.error('[MenuManagement] Failed to reorder menus:', err);
      toast.error(err?.message || '拖拽失败，请重试');
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    draggedItemRef.current = null;
    setDragOverRow(null);
    setRootDropActive(false);
  };

  const renderRows = (items: MenuItem[], level: number) => {
    return items.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedRows.includes(item.id);
      const IconComponent = item.icon ? (Icons as any)[item.icon] : null;
      const isBeingDragged = draggedItem?.id === item.id;
      const plan = dropPlan && dropPlan.targetId === item.id ? dropPlan : null;

      const rowClass = [
        'menu-table-row',
        isBeingDragged ? 'dragging' : '',
        plan ? (plan.valid ? `drop-${plan.position}` : 'drop-invalid') : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <div key={item.id}>
          <div
            className={rowClass}
            style={{ marginLeft: `${level * 24}px` }}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => handleRowDragOver(e, item)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            {/* 同级插入指示线（成为子菜单时改用整行高亮，不画线） */}
            {plan?.valid && plan.position !== 'inside' && (
              <span className={`drop-line drop-line-${plan.position}`} />
            )}

            <span
              className={`menu-table-toggle ${hasChildren ? '' : 'placeholder'}`}
              onClick={() => hasChildren && toggleRow(item.id)}
            >
              {hasChildren && (
                isExpanded ? <DownOutlined /> : <RightOutlined />
              )}
            </span>
            <span className="menu-table-icon-cell">
              {IconComponent && <IconComponent className="menu-table-icon" />}
            </span>
            <span className="menu-table-label">{item.label}</span>
            <span className="menu-table-path">{item.path || '-'}</span>
            <span className="menu-table-type">{hasChildren ? '目录' : '菜单'}</span>
            <span className="menu-table-actions">
              <button className="btn-link" onClick={() => openEdit(item)}>编辑</button>
              <button className="btn-link" onClick={() => openAdd(item.id)}>新增下级</button>
              <button 
                className="btn-link danger" 
                onClick={() => setDeleteTarget(item)}
                disabled={item.isSystem}
                title={item.isSystem ? '系统内置菜单不允许删除' : ''}
              >
                删除
              </button>
            </span>
          </div>
          {hasChildren && isExpanded && renderRows(item.children!, level + 1)}
        </div>
      );
    });
  };

  return (
    <QueryTableLayout
      loading={loading}
      plain
      query={<QueryForm fields={queryFields} onSearch={search} />}
      toolbar={
        <button className="btn-primary" onClick={() => openAdd(null)}>
          <PlusOutlined /> 新增菜单
        </button>
      }
    >
      {/* 常驻渲染：拖拽开始时插入节点会把表格顶下去，导致抓住的行从指针下溜走 */}
      <div
        className={`menu-drag-hint ${
          draggedItem ? (dropPlan ? (dropPlan.valid ? 'valid' : 'invalid') : 'dragging') : ''
        }`}
      >
        {draggedItem
          ? dropPlan
            ? dropPlan.valid
              ? describeDropPlan(menus, draggedItem, dropPlan)
              : dropPlan.reason
            : `正在拖拽 "${draggedItem.label}"，移动到目标位置…`
          : '拖拽菜单行调整顺序与层级：上/下边缘 = 同级排序，中间 = 成为子菜单，底部 = 设为顶级'}
      </div>

      <div className="menu-table" onDragLeave={handleTableDragLeave}>
        <div className="menu-table-row menu-table-header-row">
          <span className="menu-table-toggle" />
          <span className="menu-table-icon-cell">图标</span>
          <span className="menu-table-label">菜单名称</span>
          <span className="menu-table-path">路由地址</span>
          <span className="menu-table-type">类型</span>
          <span className="menu-table-actions">操作</span>
        </div>
        {renderRows(filteredMenus, 0)}
        {filteredMenus.length === 0 && (
          <div className="menu-table-empty">暂无数据</div>
        )}
        <div
          className={`menu-root-drop-zone ${
            rootDropActive ? (dropPlan?.valid ? 'active' : 'invalid') : ''
          }`}
          onDragOver={handleRootDragOver}
          onDrop={handleDrop}
        >
          <PlusOutlined /> 拖到此处设为顶级菜单
        </div>
      </div>

      {/* 新增/编辑菜单弹窗 */}
      <Modal
        visible={formVisible}
        title={form.id ? '编辑菜单' : parentName ? `新增下级菜单（${parentName}）` : '新增菜单'}
        onClose={() => {
          setFormVisible(false);
          setSaveError('');
        }}
        onConfirm={handleSave}
      >
        <div className="modal-form">
          {saveError && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '16px', 
              background: 'rgba(255, 95, 87, 0.1)', 
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger)',
              fontSize: '13px'
            }}>
              {saveError}
            </div>
          )}
          <div className="modal-form-row">
            <label>菜单名称</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="请输入菜单名称"
            />
          </div>
          <div className="modal-form-row">
            <label>图标</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={form.icon || ''}
                readOnly
                placeholder="请选择图标"
                style={{ flex: 1 }}
              />
              <button 
                type="button"
                className="btn-primary"
                onClick={() => setIconPickerVisible(true)}
                style={{ whiteSpace: 'nowrap' }}
              >
                选择图标
              </button>
            </div>
          </div>
          <div className="modal-form-row">
            <label>父级菜单</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={form.parentId ? findMenu(menus, form.parentId)?.label || '' : '顶级菜单（无父级）'}
                readOnly
                placeholder="请选择父级菜单"
                style={{ flex: 1 }}
              />
              <button 
                type="button"
                className="btn-primary"
                onClick={() => setParentPickerVisible(true)}
                style={{ whiteSpace: 'nowrap' }}
              >
                选择父级
              </button>
            </div>
          </div>
          <div className="modal-form-row">
            <label>路由地址</label>
            <input
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="如 /system/users（可选）"
            />
          </div>
          <div className="modal-form-row">
            <label>可见角色</label>
            <div className="menu-roles-picker">
              {ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="menu-roles-option">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(opt.value)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        roles: e.target.checked
                          ? [...form.roles, opt.value]
                          : form.roles.filter((r) => r !== opt.value),
                      })}
                  />
                  {opt.label}
                </label>
              ))}
              <span className="menu-roles-hint">不勾选 = 所有角色可见</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* 图标选择器弹窗 */}
      <Modal
        visible={iconPickerVisible}
        title="选择图标"
        onClose={() => setIconPickerVisible(false)}
        onConfirm={() => setIconPickerVisible(false)}
        confirmText="关 闭"
      >
        <IconPicker 
          value={form.icon} 
          onChange={(iconName) => {
            setForm({ ...form, icon: iconName });
            setIconPickerVisible(false);
          }} 
        />
      </Modal>

      {/* 父级菜单选择器弹窗 */}
      <Modal
        visible={parentPickerVisible}
        title="选择父级菜单"
        onClose={() => setParentPickerVisible(false)}
        onConfirm={() => setParentPickerVisible(false)}
        confirmText="确 定"
      >
        <ParentMenuPicker
          value={form.parentId}
          onChange={(parentId) => {
            setForm({ ...form, parentId });
            setParentPickerVisible(false);
          }}
          menus={menus}
          currentId={form.id}
        />
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        visible={deleteTarget !== null}
        title="删除确认"
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        confirmText="删 除"
      >
        {deleteError && (
          <div style={{ 
            padding: '12px', 
            marginBottom: '16px', 
            background: 'rgba(255, 95, 87, 0.1)', 
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-danger)',
            fontSize: '13px'
          }}>
            {deleteError}
          </div>
        )}
        <p className="delete-confirm-text">
          确定要删除菜单 <strong>{deleteTarget?.label}</strong> 吗？
        </p>
      </Modal>
    </QueryTableLayout>
  );
}

export default MenuManagement;
