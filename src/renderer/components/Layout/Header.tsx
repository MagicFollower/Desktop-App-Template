import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useMenuStore } from '../../stores/useMenuStore';
import type { ThemeMode } from '../../types/theme';
import './Header.css';

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: '深色模式' },
  { value: 'light', label: '浅色模式' },
  { value: 'blue', label: '蓝色主题' },
  { value: 'green', label: '绿色主题' },
];

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const userInfo = useAuthStore((state) => state.userInfo);
  const logout = useAuthStore((state) => state.logout);
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const setSelected = useMenuStore((state) => state.setSelected);
  const ensureExpanded = useMenuStore((state) => state.ensureExpanded);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setDropdownVisible(false);
      }
    };

    if (dropdownVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownVisible]);

  const toggleDropdown = () => {
    setDropdownVisible((prev) => !prev);
  };

  // 根据路径生成面包屑
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    if (paths.length === 0) return [{ label: '仪表盘', path: '/' }];

    const breadcrumbMap: Record<string, string> = {
      system: '系统管理',
      users: '人员管理',
      profile: '个人信息',
      menus: '菜单管理',
      tools: '工具模块',
      files: '文件管理',
      redis: 'Redis 查询',
      ftp: 'FTP 查询',
    };

    return paths.map((path, index) => ({
      label: breadcrumbMap[path] || path,
      path: '/' + paths.slice(0, index + 1).join('/'),
    }));
  };

  const breadcrumbs = getBreadcrumbs();

  const handleLogout = () => {
    logout();
    // 用路由 navigate 而非 window.location.href：打包后为 file:// + HashRouter，
    // 直接赋值 href 会跳到 file:///login 而丢失 index.html 入口。navigate 会正确写入 hash。
    navigate('/login');
  };

  const handleNavigateToProfile = () => {
    // 确保"系统管理"父菜单展开
    ensureExpanded('system');
    // 选中"个人信息"子菜单
    setSelected('system-profile');
    // 客户端路由跳转（不刷新页面）
    navigate('/system/profile');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <nav className="breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="breadcrumb-item">
              {index > 0 && <span className="breadcrumb-separator">/</span>}
              <span className="breadcrumb-label">{crumb.label}</span>
            </span>
          ))}
        </nav>
      </div>

      <div className="header-right">
        {/* 主题切换 */}
        <div className="theme-switcher">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            className="theme-select"
          >
            {themeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 用户信息 */}
        <div
          ref={userMenuRef}
          className="user-menu"
          onClick={toggleDropdown}
        >
          <div className="user-avatar">
            {userInfo?.avatar ? (
              <img src={userInfo.avatar} alt="头像" />
            ) : (
              <UserOutlined />
            )}
          </div>
          <span className="user-name">{userInfo?.nickname || userInfo?.username}</span>

          {dropdownVisible && (
            <div className="user-dropdown">
              <div className="dropdown-item" onClick={(e) => {
                e.stopPropagation();
                handleNavigateToProfile();
                setDropdownVisible(false);
              }}>
                <UserOutlined />
                <span>个人信息</span>
              </div>
              <div className="dropdown-item danger" onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}>
                <LogoutOutlined />
                <span>退出登录</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
