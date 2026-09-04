import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import Dashboard from './components/Dashboard';
import WindowControls from './components/WindowControls';
import type { MockData } from '../main/preload';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

const initialTabs: Tab[] = [
  { id: 'status', label: '状态', icon: '📊' },
];

function App() {
  const [activeTab, setActiveTab] = useState('status');
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [sidebarSelected, setSidebarSelected] = useState('json');
  const [wsConnected, setWsConnected] = useState(true);
  const [mockData, setMockData] = useState<MockData | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api) {
      api.onMockData((data: MockData) => setMockData(data));
      return () => api.removeMockDataListener();
    }
  }, []);

  const handleAddTab = useCallback(() => {
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      label: `新标签 ${tabs.length + 1}`,
      icon: '📄',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newTab.id);
  }, [tabs.length]);

  const handleCloseTab = useCallback((tabId: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  }, [tabs, activeTab]);

  return (
    <div className="app">
      <WindowControls />
      <div className="app-body">
        <Sidebar
          selected={sidebarSelected}
          onSelect={setSidebarSelected}
        />
        <div className="main-content">
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAddTab={handleAddTab}
            onCloseTab={handleCloseTab}
          />
          <Dashboard
            activeTab={activeTab}
            mockData={mockData}
            wsConnected={wsConnected}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
