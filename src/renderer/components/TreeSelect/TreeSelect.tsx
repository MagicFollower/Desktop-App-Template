import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DownOutlined,
  RightOutlined,
  CloseCircleFilled,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useClickOutside } from '../../hooks/useClickOutside';
import './TreeSelect.css';

/** 树节点。value 为取用值（id），label 为展示名称（name） */
export interface TreeNode {
  value: string;
  label: string;
  disabled?: boolean;
  children?: TreeNode[];
}

export type TreeSelectValue = string | string[];

export interface TreeSelectProps {
  treeData: TreeNode[];
  value?: TreeSelectValue;
  defaultValue?: TreeSelectValue;
  onChange?: (value: TreeSelectValue) => void;
  /** 是否为多选（带复选框） */
  multiple?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  /** 顶部搜索框，按 label 模糊过滤并自动展开命中项的祖先 */
  showSearch?: boolean;
  /** 多选时最多直接展示的标签数，超出折叠为 +N */
  maxTagCount?: number;
  className?: string;
}

function toArray(value: TreeSelectValue | undefined): string[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** 收集所有节点的 value -> label，供触发器回显 */
function buildLabelMap(nodes: TreeNode[], map: Map<string, string>) {
  for (const n of nodes) {
    map.set(n.value, n.label);
    if (n.children) buildLabelMap(n.children, map);
  }
  return map;
}

/** 收集满足关键词的节点，同时保留其祖先链；命中节点的整棵子树随之保留 */
function filterTree(nodes: TreeNode[], keyword: string): TreeNode[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return nodes;
  const result: TreeNode[] = [];
  for (const n of nodes) {
    const selfMatch = n.label.toLowerCase().includes(kw);
    if (selfMatch) {
      // 命中：保留整节点（含原始子树）
      result.push(n);
    } else if (n.children) {
      const kept = filterTree(n.children, keyword);
      if (kept.length > 0) result.push({ ...n, children: kept });
    }
  }
  return result;
}

/** 收集树中全部节点的 value，用于搜索态默认展开 */
function collectAllKeys(nodes: TreeNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.children && n.children.length > 0) {
      acc.push(n.value);
      collectAllKeys(n.children, acc);
    }
  }
  return acc;
}

interface TreeNodeRowProps {
  node: TreeNode;
  level: number;
  expanded: Set<string>;
  selected: string[];
  multiple: boolean;
  onToggle: (value: string) => void;
  onSelect: (node: TreeNode) => void;
}

/** 单个树节点行（递归渲染子节点） */
function TreeRow({
  node,
  level,
  expanded,
  selected,
  multiple,
  onToggle,
  onSelect,
}: TreeNodeRowProps) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.value);
  const isSelected = selected.includes(node.value);

  return (
    <>
      <div
        className={`ui-tree-row ${isSelected ? 'selected' : ''} ${node.disabled ? 'disabled' : ''}`}
        style={{ paddingLeft: `${level * 18 + 6}px` }}
        onClick={() => !node.disabled && onSelect(node)}
      >
        <span
          className={`ui-tree-toggle ${hasChildren ? '' : 'placeholder'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.value);
          }}
        >
          {hasChildren && (isOpen ? <DownOutlined /> : <RightOutlined />)}
        </span>

        {multiple && (
          <span className={`ui-tree-checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && <CheckOutlined />}
          </span>
        )}

        <span className="ui-tree-label">{node.label}</span>
      </div>

      {hasChildren && isOpen && (
        <>
          {node.children!.map((child) => (
            <TreeRow
              key={child.value}
              node={child}
              level={level + 1}
              expanded={expanded}
              selected={selected}
              multiple={multiple}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  );
}

/**
 * 通用树形下拉选择器。
 *
 * 覆盖能力：单选 / 多选、展开收起、模糊搜索（命中自动展开祖先）、可清除、多选标签折叠。
 * 用于「树形下拉选择」类查询条件，例如按父级目录筛选。
 */
function TreeSelect({
  treeData,
  value,
  defaultValue,
  onChange,
  multiple = false,
  placeholder = '请选择',
  allowClear = true,
  disabled = false,
  showSearch = false,
  maxTagCount,
  className = '',
}: TreeSelectProps) {
  // 受控优先：外部传 value 用外部值，否则维护内部 state，兼容非受控用法
  const [inner, setInner] = useState<TreeSelectValue>(defaultValue ?? (multiple ? [] : ''));
  const current = value !== undefined ? value : inner;
  const selected = useMemo(() => toArray(current), [current]);

  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const labelMap = useMemo(() => buildLabelMap(treeData, new Map<string, string>()), [treeData]);

  // 搜索时以过滤后的树展示；无关键词时用原始树
  const displayTree = useMemo(
    () => (showSearch && keyword.trim() ? filterTree(treeData, keyword) : treeData),
    [treeData, keyword, showSearch]
  );

  // 有关键词时展开全部命中项的祖先，保证可见
  const effectiveExpanded = useMemo(() => {
    if (showSearch && keyword.trim()) {
      return new Set(collectAllKeys(displayTree));
    }
    return expanded;
  }, [expanded, keyword, showSearch, displayTree]);

  const close = useCallback(() => {
    setOpen(false);
    setKeyword('');
  }, []);
  useClickOutside(rootRef, close, open);

  const emit = (next: TreeSelectValue) => {
    if (value === undefined) setInner(next); // 非受控时维护内部 state
    onChange?.(next);
  };

  const handleToggle = (v: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const handleSelect = (node: TreeNode) => {
    if (!multiple) {
      emit(node.value);
      close();
      return;
    }
    const next = selected.includes(node.value)
      ? selected.filter((v) => v !== node.value)
      : [...selected, node.value];
    emit(next);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    emit(multiple ? [] : '');
  };

  const hasValue = selected.length > 0;
  const visibleTags = multiple && maxTagCount !== undefined ? selected.slice(0, maxTagCount) : selected;
  const hiddenCount = multiple ? selected.length - visibleTags.length : 0;

  return (
    <div
      className={`ui-tree-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      ref={rootRef}
    >
      <div
        className="ui-tree-select-selector"
        onClick={() => !disabled && setOpen((v) => !v)}
        role="combobox"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
      >
        <div className="ui-tree-select-content">
          {hasValue ? (
            multiple ? (
              <>
                {visibleTags.map((v) => (
                  <span className="ui-tree-select-tag" key={v}>
                    <span className="ui-tree-select-tag-text">{labelMap.get(v) ?? v}</span>
                    <CloseOutlined
                      className="ui-tree-select-tag-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        emit(selected.filter((s) => s !== v));
                      }}
                    />
                  </span>
                ))}
                {hiddenCount > 0 && (
                  <span className="ui-tree-select-tag ui-tree-select-tag-more">+{hiddenCount}</span>
                )}
              </>
            ) : (
              <span className="ui-tree-select-single">{labelMap.get(selected[0]) ?? selected[0]}</span>
            )
          ) : (
            <span className="ui-tree-select-placeholder">{placeholder}</span>
          )}
        </div>

        {allowClear && hasValue && !disabled ? (
          <CloseCircleFilled className="ui-tree-select-clear" onClick={handleClear} />
        ) : (
          <DownOutlined className="ui-tree-select-arrow" />
        )}
      </div>

      {open && (
        <div className="ui-tree-select-dropdown">
          {showSearch && (
            <div className="ui-tree-select-search">
              <input
                autoFocus
                className="ui-tree-select-search-input"
                placeholder="搜索"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="ui-tree-select-body">
            {displayTree.length === 0 && <div className="ui-tree-empty">无匹配数据</div>}
            {displayTree.map((node) => (
              <TreeRow
                key={node.value}
                node={node}
                level={0}
                expanded={effectiveExpanded}
                selected={selected}
                multiple={multiple}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TreeSelect;
