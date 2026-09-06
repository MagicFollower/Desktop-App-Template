import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

interface RequireRoleProps {
  /** 允许访问的角色列表；当前用户角色不在其中时渲染无权限提示 */
  roles: string[];
  children: ReactNode;
}

/**
 * 角色路由守卫（A3）。
 *
 * 动态菜单的 roles 过滤只解决"菜单可见性"——用户仍可通过地址栏直达受限路由，
 * 守卫在路由层再拦一道，与菜单过滤共用同一角色数据源（authStore.userInfo.role）。
 * AppLayout 已保证登录态：进入本组件时 userInfo 必然存在。
 */
function RequireRole({ roles, children }: RequireRoleProps) {
  const userInfo = useAuthStore((state) => state.userInfo);
  const navigate = useNavigate();

  if (!userInfo || !roles.includes(userInfo.role)) {
    return (
      <div className="forbidden-page">
        <div className="forbidden-code">403</div>
        <div className="forbidden-title">无访问权限</div>
        <div className="forbidden-desc">
          当前账号（{userInfo?.username ?? '未知用户'}，角色 {userInfo?.role ?? '-'}）无权访问此页面，
          如需权限请联系管理员调整。
        </div>
        <button className="btn-primary" onClick={() => navigate('/', { replace: true })}>
          返回首页
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireRole;
