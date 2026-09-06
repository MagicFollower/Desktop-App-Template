import { useMemo, useState, useEffect } from 'react';
import {
  LeftOutlined,
  RightOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
} from '@ant-design/icons';
import './Pagination.css';

interface PaginationProps {
  /** 当前页码，1-based */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 可选的每页条数，默认 [10, 20, 50, 100] */
  pageSizeOptions?: number[];
  /** 页码或每页条数变化回调；切换每页条数时组件内部已把页码重置为 1 */
  onChange: (page: number, pageSize: number) => void;
  /** 是否显示快速跳转输入框 */
  showQuickJumper?: boolean;
  /** 是否显示每页条数选择器 */
  showSizeChanger?: boolean;
}

/**
 * 生成分页页码序列，超长时以省略号折叠。
 * 返回元素为页码数字或占位符 '...'（前后各一个，用 key 区分）。
 * 规则：首页、末页、当前页及其左右各一页恒定显示，其余用省略号代替。
 */
function buildPageItems(current: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | '...')[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);

  items.push(1);
  if (left > 2) items.push('...');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < totalPages - 1) items.push('...');
  items.push(totalPages);

  return items;
}

function Pagination({
  current,
  pageSize,
  total,
  pageSizeOptions = [10, 20, 50, 100],
  onChange,
  showQuickJumper = true,
  showSizeChanger = true,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 快速跳转输入框的受控值
  const [jumpValue, setJumpValue] = useState('');

  // 外部页码变化时（如查询后重置为第 1 页）清空跳转框残留输入
  useEffect(() => {
    setJumpValue('');
  }, [current]);

  const pageItems = useMemo(
    () => buildPageItems(current, totalPages),
    [current, totalPages]
  );

  // 无数据时仍展示总数信息，保持布局稳定
  const goto = (page: number, size = pageSize) => {
    const safePage = Math.min(Math.max(1, page), Math.ceil(total / size) || 1);
    onChange(safePage, size);
  };

  const handleSizeChange = (nextSize: number) => {
    // 改变每页条数时回到第 1 页，避免停留在越界页
    onChange(1, nextSize);
  };

  const handleJump = () => {
    const page = parseInt(jumpValue, 10);
    if (Number.isFinite(page)) goto(page);
    setJumpValue('');
  };

  return (
    <div className="pagination">
      <span className="pagination-total">共 {total} 条记录</span>

      {showSizeChanger && (
        <select
          className="pagination-size-changer"
          value={pageSize}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
          aria-label="每页条数"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
      )}

      <div className="pagination-pages">
        {/* 首页 / 上一页 */}
        <button
          className="pagination-item nav"
          disabled={current <= 1}
          onClick={() => goto(1)}
          title="首页"
          aria-label="首页"
        >
          <DoubleLeftOutlined />
        </button>
        <button
          className="pagination-item nav"
          disabled={current <= 1}
          onClick={() => goto(current - 1)}
          title="上一页"
          aria-label="上一页"
        >
          <LeftOutlined />
        </button>

        {/* 页码列表 */}
        {pageItems.map((item, idx) =>
          item === '...' ? (
            <span className="pagination-ellipsis" key={`ellipsis-${idx}`}>
              •••
            </span>
          ) : (
            <button
              className={`pagination-item ${item === current ? 'active' : ''}`}
              key={item}
              onClick={() => goto(item)}
              aria-current={item === current ? 'page' : undefined}
            >
              {item}
            </button>
          )
        )}

        {/* 下一页 / 末页 */}
        <button
          className="pagination-item nav"
          disabled={current >= totalPages}
          onClick={() => goto(current + 1)}
          title="下一页"
          aria-label="下一页"
        >
          <RightOutlined />
        </button>
        <button
          className="pagination-item nav"
          disabled={current >= totalPages}
          onClick={() => goto(totalPages)}
          title="末页"
          aria-label="末页"
        >
          <DoubleRightOutlined />
        </button>
      </div>

      {showQuickJumper && (
        <div className="pagination-jumper">
          跳至
          <input
            className="pagination-jump-input"
            type="text"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            aria-label="跳转到指定页"
          />
          页
        </div>
      )}
    </div>
  );
}

export default Pagination;
