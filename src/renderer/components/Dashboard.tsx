import { useState, useEffect } from 'react';
import RealtimeChart from './RealtimeChart';
import './Dashboard.css';

interface MockData {
  timestamp: number;
  commandsPerSec: number;
  connectedClients: number;
  memoryUsage: number;
  networkInput: number;
  networkOutput: number;
}

interface DashboardProps {
  activeTab: string;
  mockData: MockData | null;
  wsConnected: boolean;
}

function Dashboard({ mockData, wsConnected }: DashboardProps) {
  const [uptime, setUptime] = useState('1天');
  const [totalKeys, setTotalKeys] = useState(192569);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      // Simulate uptime display
      setUptime('1天');
      // Simulate key count fluctuation
      setTotalKeys(prev => prev + Math.floor(Math.random() * 10) - 5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1 className="app-title">本地服务</h1>
          <div className="version-tags">
            <span className="tag version">v8.6.2</span>
            <span className="tag standalone">standalone</span>
            <span className="tag master">master</span>
          </div>
        </div>
        <div className="header-right">
          <div className={`connection-status ${wsConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">{wsConnected ? '已连接' : '未连接'}</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">运行时间</div>
          <div className="stat-value">{uptime}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已连客户端</div>
          <div className="stat-value">
            {mockData?.connectedClients || 2}
            <span className="stat-icon">🖥️</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">键总数</div>
          <div className="stat-value">{totalKeys.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">内存使用</div>
          <div className="stat-value">{mockData?.memoryUsage || 168.32}MB</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <RealtimeChart
          title="每秒执行命令"
          data={mockData?.commandsPerSec || 0}
          color="#ff6b9d"
          unit="次/秒"
        />
        <RealtimeChart
          title="已连客户端"
          data={mockData?.connectedClients || 2}
          color="#f5a623"
          unit="个"
        />
        <RealtimeChart
          title="内存使用"
          data={mockData?.memoryUsage || 168}
          color="#9b59b6"
          unit="MB"
        />
        <RealtimeChart
          title="网络输入 / 网络输出"
          dataInput={mockData?.networkInput || 0}
          dataOutput={mockData?.networkOutput || 0}
          colorInput="#4a9eff"
          colorOutput="#2ecc71"
          unit="B"
          dualMode
        />
      </div>
    </div>
  );
}

export default Dashboard;
