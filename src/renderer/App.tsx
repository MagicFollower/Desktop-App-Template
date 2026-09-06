import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { useThemeStore } from './stores/useThemeStore';
import { useEffect, useState } from 'react';
import TitleBar from './components/Layout/TitleBar';
import './App.css';

function App() {
  const initTheme = useThemeStore((state) => state.initTheme);
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;

  // 仅在 Electron 环境下存在窗口最大化状态；浏览器 dev 模式恒为 false
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  /**
   * Electron 窗口圆角支持：
   * 1. 标记 is-electron，让全局样式在桌面端启用透明背景 + 圆角外壳；
   * 2. 订阅主进程的最大化状态，切换 is-maximized（最大化时去掉圆角与边框）。
   * 这里作为该 IPC 事件的唯一订阅者，TitleBar 通过 props 复用同一状态，
   * 避免多处注册后 removeMaximizeChangeListener 相互清除监听。
   */
  useEffect(() => {
    if (!api) return;

    const root = document.documentElement;
    root.classList.add('is-electron');

    // 读取初始状态，之后由主进程事件驱动更新
    api.isMaximized().then(setMaximized).catch(() => {});
    api.onMaximizeChange(setMaximized);

    return () => {
      root.classList.remove('is-electron');
      root.classList.remove('is-maximized');
      api.removeMaximizeChangeListener();
    };
  }, [api]);

  // 同步最大化状态到根元素类名，供 CSS 控制圆角显隐
  useEffect(() => {
    if (!api) return;
    document.documentElement.classList.toggle('is-maximized', maximized);
  }, [api, maximized]);

  return (
    <div className="app-shell">
      {/* 全局唯一实例，位于路由之外：导航时不会卸载重挂，登录页同样拥有窗口控件 */}
      <TitleBar maximized={maximized} />
      <div className="app-shell-body">
        <RouterProvider router={router} />
      </div>
    </div>
  );
}

export default App;
