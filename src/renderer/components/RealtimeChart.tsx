import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './RealtimeChart.css';

interface RealtimeChartProps {
  title: string;
  data: number;
  color: string;
  unit: string;
  dataInput?: number;
  dataOutput?: number;
  colorInput?: string;
  colorOutput?: string;
  dualMode?: boolean;
}

interface DataPoint {
  time: string;
  value: number;
}

function RealtimeChart({
  title,
  data,
  color,
  unit,
  dataInput,
  dataOutput,
  colorInput = '#4a9eff',
  colorOutput = '#2ecc71',
  dualMode = false,
}: RealtimeChartProps) {
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize with some data points
    const initialData: DataPoint[] = [];
    const now = new Date();
    for (let i = 9; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 1000);
      initialData.push({
        time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`,
        value: Math.random() * 2,
      });
    }
    setChartData(initialData);

    // Update every second
    intervalRef.current = setInterval(() => {
      setChartData(prev => {
        const newData = [...prev.slice(1)];
        const now = new Date();
        newData.push({
          time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
          value: data,
        });
        return newData;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [data]);

  const gradientId = `gradient-${title.replace(/\s/g, '-')}`;

  if (dualMode) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">{title}</h3>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-color" style={{ background: colorInput }}></span>
              <span className="legend-label">网络输入</span>
            </span>
            <span className="legend-item">
              <span className="legend-color" style={{ background: colorOutput }}></span>
              <span className="legend-label">网络输出</span>
            </span>
          </div>
        </div>
        <div className="chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`${gradientId}-input`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorInput} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colorInput} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${gradientId}-output`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorOutput} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colorOutput} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis
                dataKey="time"
                stroke="#666"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#666"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value} ${unit}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #2a2a3e',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colorInput}
                fill={`url(#${gradientId}-input)`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colorOutput}
                fill={`url(#${gradientId}-output)`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color" style={{ background: color }}></span>
            <span className="legend-label">{unit}</span>
          </span>
        </div>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis
              dataKey="time"
              stroke="#666"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#666"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value} ${unit}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a2e',
                border: '1px solid #2a2a3e',
                borderRadius: '6px',
                color: '#e0e0e0',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default RealtimeChart;
