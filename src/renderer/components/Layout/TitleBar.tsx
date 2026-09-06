import { titleBarText } from '../../app-config';
import './TitleBar.css';

// SVG 直接内联在 JSX 中，不抽成子组件：
// 抽成组件会让每次 render 都产生新的函数标识，触发子树卸载重挂

interface TitleBarProps {
  /** 窗口是否最大化，由顶层 App 统一订阅主进程事件后下发，用于切换还原/最大化图标 */
  maximized: boolean;
}

function TitleBar({ maximized }: TitleBarProps) {
  // 浏览器开发模式下没有 electronAPI，浏览器自带窗口控件，无需渲染标题栏
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;

  if (!api) return null;

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region">{titleBarText()}</div>

      <div className="window-controls">
        <button
          type="button"
          className="window-control-btn"
          onClick={() => api.minimize()}
          title="最小化"
          aria-label="最小化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          className="window-control-btn"
          onClick={() => api.maximize()}
          title={maximized ? '向下还原' : '最大化'}
          aria-label={maximized ? '向下还原' : '最大化'}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M2.5 2.5v-2h7v7h-2M0.5 2.5h7v7h-7z"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="window-control-btn close"
          onClick={() => api.close()}
          title="关闭"
          aria-label="关闭"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
