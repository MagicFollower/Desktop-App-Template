import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from '@ant-design/icons';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { MenuItem } from '../../types/menu';
import { useMenuStore } from '../../stores/useMenuStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { loadMenus } from '../../services/sqlite';
import { filterMenuTreeByRole } from '../../services/menu-tree';
import { APP_NAME } from '../../app-config';
import './Sidebar.css';

interface MenuItemProps {
  item: MenuItem;
  level?: number;
}

function MenuItemComponent({ item, level = 0 }: MenuItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedId, expandedIds, setSelected, toggleExpanded } = useMenuStore();
  const userInfo = useAuthStore((state) => state.userInfo);
  const logout = useAuthStore((state) => state.logout);

  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.includes(item.id);
  const isSelected = selectedId === item.id;
  const isActive = location.pathname === item.path;

  // 动态获取图标组件
  const IconComponent = item.icon
    ? (Icons as any)[item.icon]
    : null;

  const handleClick = () => {
    if (hasChildren) {
      toggleExpanded(item.id);
    } else if (item.path) {
      // 登录状态失效时，清除状态并跳转登录页
      if (!userInfo) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setSelected(item.id);
      navigate(item.path);
    }
  };

  return (
    <div className="menu-item-wrapper">
      <div
        className={`menu-item ${isSelected || isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${16 + level * 16}px` }}
        onClick={handleClick}
      >
        {IconComponent && <IconComponent className="menu-icon" />}
        <span className="menu-label">{item.label}</span>
        {hasChildren && (
          <span className="menu-arrow">
            {isExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="menu-children">
          {item.children!.map((child) => (
            <MenuItemComponent key={child.id} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const location = useLocation();
  const setSelected = useMenuStore((state) => state.setSelected);
  const ensureExpanded = useMenuStore((state) => state.ensureExpanded);
  // A3：菜单按当前用户角色过滤；登录账号切换时重新计算
  const role = useAuthStore((state) => state.userInfo?.role);

  // 从数据适配层加载菜单树（Electron→IPC / 浏览器→HTTP / 纯浏览器→演示数据），
  // 再按当前角色裁剪：无权限的节点（连同子树）不出现在侧边栏
  useEffect(() => {
    loadMenus().then((menus) => {
      setMenuItems(filterMenuTreeByRole(menus, role));
    });

    // 监听菜单更新事件
    const handleMenuUpdate = () => {
      loadMenus().then((menus) => {
        setMenuItems(filterMenuTreeByRole(menus, role));
      });
    };

    window.addEventListener('menu-updated', handleMenuUpdate);
    return () => window.removeEventListener('menu-updated', handleMenuUpdate);
  }, [role]);

  // 根据当前路由自动同步菜单选中状态和展开状态
  useEffect(() => {
    const path = location.pathname;
    
    // 路径到菜单ID的映射
    const pathToMenuId: Record<string, string> = {
      '/': 'dashboard',
      '/system/users': 'system-users',
      '/system/profile': 'system-profile',
      '/system/menus': 'system-menus',
      '/system/doc-rules': 'system-doc-rules',
      '/tools/files': 'tools-files',
      '/tools/redis': 'tools-redis',
      '/tools/ftp': 'tools-ftp',
    };

    const menuId = pathToMenuId[path];
    if (menuId) {
      setSelected(menuId);
      
      // 确保父菜单展开（不 toggle，只确保存在）
      if (menuId.startsWith('system-')) {
        ensureExpanded('system');
      } else if (menuId.startsWith('tools-')) {
        ensureExpanded('tools');
      }
    }
  }, [location.pathname, setSelected, ensureExpanded]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">{APP_NAME}</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <MenuItemComponent key={item.id} item={item} />
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
