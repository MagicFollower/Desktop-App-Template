import { createHashRouter } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import RequireRole from './components/RequireRole';
import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard/DashboardPage';
import UserManagement from './pages/System/UserManagement';
import Profile from './pages/System/Profile';
import MenuManagement from './pages/System/MenuManagement';
import DocRuleManagement from './pages/System/DocRuleManagement';
import FileManager from './pages/Tools/FileManager';
import RedisManager from './pages/Tools/RedisManager';
import FtpManager from './pages/Tools/FtpManager';
import NotFound from './pages/NotFound';

// 使用 HashRouter：打包后 Electron 通过 file:// 协议加载页面，
// location.pathname 会变成 index.html 的完整磁盘路径，导致 createBrowserRouter
// 匹配不到任何路由而落到 '*'（404）。HashRouter 改为从 location.hash 读取路由
// （如 ...index.html#/system/users），与 file:// 前缀无关，开发和打包均可用。
export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'system/profile', element: <Profile /> },
      // A3：菜单可见性过滤只遮入口，路由层再拦一道——地址栏直达也需过守卫。
      // 守卫角色与迁移 v3 的菜单种子 roles 保持一致（'admin'）
      {
        path: 'system/users',
        element: (
          <RequireRole roles={['admin']}>
            <UserManagement />
          </RequireRole>
        ),
      },
      {
        path: 'system/menus',
        element: (
          <RequireRole roles={['admin']}>
            <MenuManagement />
          </RequireRole>
        ),
      },
      // 单据号规则：同为系统配置页，守卫角色与迁移 v4 种子的 roles 保持一致
      {
        path: 'system/doc-rules',
        element: (
          <RequireRole roles={['admin']}>
            <DocRuleManagement />
          </RequireRole>
        ),
      },
      { path: 'tools/files', element: <FileManager /> },
      { path: 'tools/redis', element: <RedisManager /> },
      { path: 'tools/ftp', element: <FtpManager /> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
