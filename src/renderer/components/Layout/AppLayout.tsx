import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import TabBar from './TabBar';
import { ToastProvider } from '../Toast/ToastProvider';
import { useAuthStore } from '../../stores/useAuthStore';
import './AppLayout.css';

// 导出 toast hook 供全局使用
export { useToast } from '../Toast/ToastProvider';

function AppLayout() {
  const userInfo = useAuthStore((state) => state.userInfo);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userInfo) {
      logout(); // 统一清除状态（token、isAuthenticated）
      navigate('/login', { replace: true });
    }
  }, [userInfo, logout, navigate]);

  // 登录失效时保留布局渲染，避免卸载子组件中断正在进行的导航
  // 实际的跳转由上方 useEffect 负责
  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <Header />
          <TabBar />
          <main className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default AppLayout;
