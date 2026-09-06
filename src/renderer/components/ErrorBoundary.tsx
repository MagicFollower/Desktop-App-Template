import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 渲染层错误边界（A7）。
 *
 * React 18 中任何未被捕获的渲染异常都会卸载整棵组件树——桌面端表现为整个
 * 窗口白屏，用户只能强杀进程。本组件把爆炸半径收敛到“出错区域显示降级 UI”。
 *
 * 使用方式（main.tsx 已挂载在应用根部）：单个页面级子树也可以再包一层，
 * 异常时只有该区域降级，其余界面（侧边栏/标签页）保持可用。
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 打包后渲染进程 console 不可见：经 IPC 转发主进程 electron-log 落盘
    console.error('[ErrorBoundary] Uncaught renderer error:', error, info.componentStack);
    window.electronAPI?.log('error', `[ErrorBoundary] ${error.message}\n${info.componentStack ?? ''}`);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-title">页面出现异常</div>
          <div className="error-boundary-desc">{this.state.error.message || String(this.state.error)}</div>
          <div className="error-boundary-actions">
            <button
              className="btn-primary"
              onClick={() => {
                this.setState({ error: null });
              }}
            >
              重试
            </button>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              刷新应用
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
