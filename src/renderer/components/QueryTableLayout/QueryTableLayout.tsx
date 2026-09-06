import type { ReactNode } from 'react';
import './QueryTableLayout.css';

export interface QueryTableLayoutProps {
  /** 查询面板插槽：置于区域最上方（通常放 QueryForm） */
  query?: ReactNode;
  /** 工具栏插槽：位于查询面板与数据列表之间，内容左对齐（放「新增」等主操作） */
  toolbar?: ReactNode;
  /** 数据主体插槽（表格 / 树形表格等） */
  children: ReactNode;
  /** 分页器插槽；置于数据主体下方的固定底部，不传则不占位 */
  pagination?: ReactNode;
  /** 首次加载态：为 true 时在数据区显示占位，查询面板保持挂载以免丢失已输入条件 */
  loading?: boolean;
  /** 加载中文案 */
  loadingText?: ReactNode;
  /** 素面模式：去掉数据区卡片描边/背景，供自带卡片样式的主体（如树形表格）使用 */
  plain?: boolean;
  className?: string;
}

/**
 * 查询页通用布局（核心业务骨架）。
 *
 * 把「查询面板 + 工具栏 + 数据 GRID + 分页器」组合成一个自上而下、撑满可用高度的完整区域：
 * - 顶部：查询面板（固定，不随数据滚动）；页面标题由 TabBar 承载，此处不再重复；
 * - 查询与列表之间：工具栏，内容左对齐，承载「新增」等主操作；
 * - 中部：数据主体，占据剩余高度（flex:1）并在内部滚动；
 * - 底部：分页器，紧贴数据区下沿固定，数据量少时仍保持在区域相对底部。
 *
 * 整体缩放（浏览器/Electron zoom）时，因采用 flex 撑高 + 内层滚动，分页器始终保持在
 * 该区域的相对底部，不会随内容被顶出视野。业务页只需按插槽填入即可复用。
 */
function QueryTableLayout({
  query,
  toolbar,
  children,
  pagination,
  loading = false,
  loadingText = '加载中...',
  plain = false,
  className = '',
}: QueryTableLayoutProps) {
  return (
    <div className={`query-table-layout ${className}`}>
      {query && <div className="qt-query">{query}</div>}

      {toolbar && <div className="qt-toolbar">{toolbar}</div>}

      <div className={`qt-body ${plain ? 'qt-plain' : ''}`}>
        <div className="qt-grid">
          {loading ? <div className="qt-loading">{loadingText}</div> : children}
        </div>
        {pagination && <div className="qt-pagination">{pagination}</div>}
      </div>
    </div>
  );
}

export default QueryTableLayout;
