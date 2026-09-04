import './TabBar.css';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
}

function TabBar({ tabs, activeTab, onTabChange, onAddTab, onCloseTab }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={onAddTab} title="添加标签">
          +
        </button>
      </div>
    </div>
  );
}

export default TabBar;
