import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CloseOutlined, DownOutlined } from '@ant-design/icons';
import { useTabStore } from '../../stores/useTabStore';
import { loadMenus } from '../../services/sqlite';
import type { MenuItem } from '../../types/menu';
import './TabBar.css';

/**
 * path → 菜单标题：从菜单树解析，不再维护硬编码映射。
 * 旧实现在组件内写死 PATH_TITLE：新增页面（如 /system/doc-rules）漏加一行，
 * Tab 标题就显示成路径（本交修复项）；菜单管理页改名也不会同步。
 * 菜单树来自 loadMenus()（未按角色过滤的完整树）：标题解析不应受当前用户权限影响。
 */
function collectPathTitles(items: MenuItem[], map: Map<string, string>): void {
  for (const item of items) {
    if (item.path) map.set(item.path, item.label);
    if (item.children && item.children.length > 0) collectPathTitles(item.children, map);
  }
}

function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tabs, activeTabId, addTab, updateTabTitle, removeTab, setActiveTab, closeLeft, closeRight, closeAll, closeCurrent } = useTabStore();

  const [pathTitles, setPathTitles] = useState<Map<string, string>>(new Map());
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contextMenuTabId = useRef<string>('');

  // 菜单标题映射：加载一次，菜单管理页改动后经 menu-updated 事件重建
  useEffect(() => {
    let cancelled = false;
    const rebuild = () => {
      loadMenus().then((menus) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        collectPathTitles(menus, map);
        setPathTitles(map);
      });
    };
    rebuild();
    window.addEventListener('menu-updated', rebuild);
    return () => {
      cancelled = true;
      window.removeEventListener('menu-updated', rebuild);
    };
  }, []);

  // 路由变化时自动添加/激活 Tab
  useEffect(() => {
    const path = location.pathname;
    // 解析不到时回退显示路径（如 404 页）；菜单就绪后由下方 effect 修正
    const title = pathTitles.get(path) || path;
    addTab({ id: path, title, path });
  }, [location.pathname, addTab, pathTitles]);

  // 菜单标题就绪/更新后，修正已打开 Tab 的 fallback 标题（加载竞态兑底）。
  // 用 updateTabTitle 而非 addTab：后者会改 activeTabId，循环修正会误切激活 Tab
  useEffect(() => {
    for (const tab of tabs) {
      const resolved = pathTitles.get(tab.path);
      if (resolved && resolved !== tab.title) {
        updateTabTitle(tab.id, resolved);
      }
    }
  }, [pathTitles, tabs, updateTabTitle]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabClick = (tab: typeof tabs[number]) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeTab(id);
    // 如果关闭后还有 Tab，导航到激活的 Tab
    const remainingTabs = tabs.filter((t) => t.id !== id);
    if (remainingTabs.length > 0) {
      const targetTab = remainingTabs.find((t) => t.id === activeTabId) || remainingTabs[remainingTabs.length - 1];
      if (targetTab && targetTab.id !== activeTabId) {
        navigate(targetTab.path);
      }
    }
  };

  const openContextMenu = (tabId: string) => {
    contextMenuTabId.current = tabId;
    setDropdownVisible(true);
  };

  const handleCloseCurrent = () => {
    closeCurrent(contextMenuTabId.current);
    setDropdownVisible(false);
    const remainingTabs = tabs.filter((t) => t.id !== contextMenuTabId.current);
    if (remainingTabs.length > 0 && contextMenuTabId.current === activeTabId) {
      const targetTab = remainingTabs[remainingTabs.length - 1];
      navigate(targetTab.path);
    }
  };

  const handleCloseLeft = () => {
    closeLeft(contextMenuTabId.current);
    setDropdownVisible(false);
  };

  const handleCloseRight = () => {
    closeRight(contextMenuTabId.current);
    setDropdownVisible(false);
  };

  const handleCloseAll = () => {
    closeAll();
    setDropdownVisible(false);
    navigate('/');
  };

  // 检查菜单项是否应该禁用
  const currentIdx = tabs.findIndex((t) => t.id === contextMenuTabId.current);
  const canCloseLeft = currentIdx > 1; // 至少保留首页+当前
  const canCloseRight = currentIdx < tabs.length - 1 && currentIdx >= 0;

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => handleTabClick(tab)}
            onContextMenu={(e) => {
              e.preventDefault();
              openContextMenu(tab.id);
            }}
          >
            <span className="tab-title">{tab.title}</span>
            {tab.closable && (
              <span
                className="tab-close"
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                <CloseOutlined />
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="tab-actions">
        <div
          className="tab-dropdown-trigger"
          ref={triggerRef}
          onClick={() => {
            contextMenuTabId.current = activeTabId || '/';
            // 计算下拉菜单位置
            if (triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              setDropdownPosition({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
              });
            }
            setDropdownVisible(!dropdownVisible);
          }}
        >
          <DownOutlined />
        </div>

        {dropdownVisible && (
          <div
            className="tab-dropdown-menu"
            ref={dropdownRef}
            style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
          >
            <div
              className={`dropdown-item ${!canCloseLeft ? 'disabled' : ''}`}
              onClick={canCloseLeft ? handleCloseLeft : undefined}
            >
              关闭左侧
            </div>
            <div
              className={`dropdown-item ${!canCloseRight ? 'disabled' : ''}`}
              onClick={canCloseRight ? handleCloseRight : undefined}
            >
              关闭右侧
            </div>
            <div className="dropdown-item" onClick={handleCloseCurrent}>
              关闭当前
            </div>
            <div className="dropdown-item danger" onClick={handleCloseAll}>
              关闭所有
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TabBar;
