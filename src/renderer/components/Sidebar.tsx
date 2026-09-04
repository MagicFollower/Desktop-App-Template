import { useState } from 'react';
import './Sidebar.css';

interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  icon?: string;
  children?: TreeNode[];
  badge?: number;
}

const treeData: TreeNode[] = [
  {
    id: 'json',
    label: 'json',
    type: 'folder',
    icon: '📦',
    badge: 8,
    children: [
      {
        id: 'string',
        label: 'string',
        type: 'folder',
        icon: '📁',
        badge: 7,
        children: [
          { id: 'en_us', label: 'en_us', type: 'file', icon: 'S' },
          { id: 'en_us_raw2', label: 'en_us_raw2', type: 'file', icon: 'S' },
          { id: 'unicode', label: 'unicode', type: 'file', icon: 'S' },
          { id: 'zh_cn', label: 'zh_cn', type: 'file', icon: 'S' },
          { id: 'zh_cn_raw', label: 'zh_cn_raw', type: 'file', icon: 'S' },
          { id: 'zh_cn_raw2', label: 'zh_cn_raw2', type: 'file', icon: 'S' },
          { id: 'zh_cn_unicode', label: 'zh_cn_unicode', type: 'file', icon: 'S' },
        ],
      },
      { id: 'json5', label: 'json5', type: 'file', icon: 'S' },
    ],
  },
  { id: 'login', label: 'login', type: 'folder', icon: '📁', badge: 1 },
  { id: 'new', label: 'new', type: 'folder', icon: '📁', badge: 1 },
  { id: 'redis_cache', label: 'redis_cache', type: 'folder', icon: '📁', badge: 2 },
  { id: 'test', label: 'test', type: 'folder', icon: '📁', badge: 5 },
  { id: 'Test', label: 'Test', type: 'folder', icon: '📁', badge: 7 },
  { id: 'xml', label: 'xml', type: 'folder', icon: '📁', badge: 1 },
  { id: 'yaml', label: 'yaml', type: 'folder', icon: '📁', badge: 1 },
];

interface SidebarProps {
  selected: string;
  onSelect: (id: string) => void;
}

function Sidebar({ selected, onSelect }: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['json', 'string'])
  );

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selected === node.id;

    if (node.type === 'folder') {
      return (
        <div key={node.id}>
          <div
            className={`tree-item folder ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              toggleFolder(node.id);
              onSelect(node.id);
            }}
          >
            <span className="tree-toggle">
              {isExpanded ? '▾' : '▸'}
            </span>
            <span className="tree-icon">{node.icon || '📁'}</span>
            <span className="tree-label">{node.label}</span>
            {node.badge !== undefined && (
              <span className="tree-badge">{node.badge}</span>
            )}
          </div>
          {isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <div
        key={node.id}
        className={`tree-item file ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 24}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span className="tree-icon file-icon">{node.icon || '📄'}</span>
        <span className="tree-label">{node.label}</span>
      </div>
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="db-selector">
          <span className="db-name">db0</span>
          <span className="db-count">144</span>
        </div>
        <div className="sidebar-actions">
          <button className="action-btn" title="刷新">↻</button>
          <button className="action-btn" title="添加">+</button>
          <button className="action-btn" title="更多">⋯</button>
        </div>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="条件扫描/筛选"
          className="search-input"
        />
      </div>
      <div className="tree-container">
        {treeData.map(node => renderNode(node))}
      </div>
      <div className="sidebar-footer">
        <button className="footer-btn" title="收藏">☆</button>
        <button className="footer-btn" title="历史">🕐</button>
      </div>
    </div>
  );
}

export default Sidebar;
