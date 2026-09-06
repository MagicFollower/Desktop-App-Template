import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './DashboardPage.css';

interface ChartData {
  time: string;
  value: number;
}

function generateMockData(count: number, base: number, variance: number): ChartData[] {
  const data: ChartData[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    data.push({
      time: `${hours}:${minutes}`,
      value: Math.max(0, base + Math.floor(Math.random() * variance * 2) - variance),
    });
  }
  return data;
}

const chartConfigs = [
  { title: 'CPU 使用率', color: '#4a9eff', base: 45, variance: 35, unit: '%' },
  { title: '内存使用', color: '#9b59b6', base: 68, variance: 25, unit: '%' },
  { title: '磁盘 I/O', color: '#2ecc71', base: 120, variance: 80, unit: 'MB/s' },
  { title: '网络流量', color: '#f5a623', base: 250, variance: 180, unit: 'Mbps' },
  { title: '活跃连接', color: '#ff6b9d', base: 150, variance: 100, unit: '个' },
  { title: '请求延迟', color: '#1abc9c', base: 85, variance: 60, unit: 'ms' },
];

function DashboardPage() {
  const userInfo = useAuthStore((state) => state.userInfo);
  const [chartData, setChartData] = useState<ChartData[][]>(
    chartConfigs.map(() => generateMockData(20, 50, 20))
  );

  // 每3秒更新图表数据（模拟实时数据，增加随机性）
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData((prev) =>
        prev.map((data, index) => {
          const config = chartConfigs[index];
          const newData = [...data.slice(1)];
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const seconds = now.getSeconds().toString().padStart(2, '0');
          // 增加随机性：使用更大的波动范围，并偶尔产生极端值
          const randomFactor = Math.random();
          let value;
          if (randomFactor > 0.9) {
            // 10% 概率产生极端值（峰值或谷值）
            value = config.base + (Math.random() > 0.5 ? config.variance * 1.5 : -config.variance * 1.2);
          } else {
            // 正常波动
            value = config.base + Math.floor(Math.random() * config.variance * 2) - config.variance;
          }
          newData.push({
            time: `${hours}:${minutes}:${seconds}`,
            value: Math.max(0, Math.floor(value)),
          });
          return newData;
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h1>欢迎，{userInfo?.username}！</h1>
        <p>系统运行正常，以下是实时监控数据</p>
      </div>

      <div className="charts-grid-6">
        {chartConfigs.map((config, index) => (
          <div key={config.title} className="chart-card">
            <div className="chart-card-header">
              <h3>{config.title}</h3>
              <span className="chart-unit">{config.unit}</span>
            </div>
            <div className="chart-card-body">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData[index]}>
                  <defs>
                    <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                    }}
                    labelStyle={{ color: 'var(--color-text-muted)' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    fill={`url(#gradient-${index})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;
