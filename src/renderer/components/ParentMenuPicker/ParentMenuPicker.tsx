import { useState } from 'react';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { MenuItem } from '../../types/menu';
import './ParentMenuPicker.css';

interface ParentMenuPickerProps {
  value: string | null;
  onChange: (parentId: string | null) => void;
  menus: MenuItem[];
  currentId?: string | null; // 当前编辑的菜单 ID，用于排除自己
}

interface TreeItemProps {
  item: MenuItem;
  level: number;
  selectedId: string | null;
  currentId?: string | null;
  onSelect: (id: string | null) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

function TreeItem({ item, level, selectedId, currentId, onSelect, expandedIds, onToggle }: TreeItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);
  const isSelected = selectedId === item.id;
  const isCurrent = currentId === item.id;

  const handleClick = () => {
    if (!isCurrent) {
      onSelect(item.id);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(item.id);
    }
  };

  return (
    <div className="parent-tree-item">
      <div
        className={`parent-tree-node ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
      >
        {hasChildren && (
          <span className="parent-tree-toggle" onClick={handleToggle}>
            {isExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
        {!hasChildren && <span className="parent-tree-placeholder" />}
        <span className="parent-tree-label">{item.label}</span>
        {isCurrent && <span className="parent-tree-current-tag">当前</span>}
      </div>
      {hasChildren && isExpanded && (
        <div className="parent-tree-children">
          {item.children!.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              level={level + 1}
              selectedId={selectedId}
              currentId={currentId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentMenuPicker({ value, onChange, menus, currentId }: ParentMenuPickerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(menus.map((m) => m.id))
  );

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectRoot = () => {
    onChange(null);
  };

  return (
    <div className="parent-menu-picker">
      <div
        className={`parent-tree-node ${value === null ? 'selected' : ''}`}
        onClick={handleSelectRoot}
      >
        <span className="parent-tree-label">顶级菜单（无父级）</span>
      </div>
      {menus.map((item) => (
        <TreeItem
          key={item.id}
          item={item}
          level={0}
          selectedId={value}
          currentId={currentId}
          onSelect={onChange}
          expandedIds={expandedIds}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
