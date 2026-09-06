创建时间：2026年9月5日17:52:41

---

动态数据的变化逻辑分为**三个层级**，从主进程到渲染进程层层传递：

---

### 1. **数据源：Electron 主进程定时生成（`src/main/main.ts:51-63`）**

```typescript
const mockDataInterval = setInterval(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const data = {
      timestamp: Date.now(),
      commandsPerSec: Math.floor(Math.random() * 2) + 1,
      connectedClients: Math.floor(Math.random() * 3) + 1,
      memoryUsage: Math.floor(Math.random() * 100) + 150,
      networkInput: Math.floor(Math.random() * 15),
      networkOutput: Math.floor(Math.random() * 5),
    };
    mainWindow.webContents.send('mock-data', data);
  }
}, 1000);
```

- **每 1 秒**执行一次
- 用 `Math.random()` 生成随机数值模拟 Redis 指标
- 通过 `webContents.send('mock-data', data)` 把数据推送到渲染进程

---

### 2. **桥梁：Preload 脚本监听 IPC（`src/main/preload.ts:11-14`）**

```typescript
onMockData: (callback: (data: MockData) => void) => {
  ipcRenderer.on('mock-data', (_event, data: MockData) => callback(data));
},
removeMockDataListener: () => {
  ipcRenderer.removeAllListeners('mock-data');
},
```

- 在主进程和渲染进程之间建立安全的通信通道
- 暴露 `window.electronAPI.onMockData()` 给渲染进程使用

---

### 3. **接收端：React App 组件订阅（`src/renderer/App.tsx:25-31`）**

```typescript
useEffect(() => {
  const api = (window as any).electronAPI;
  if (api) {
    api.onMockData((data: MockData) => setMockData(data));
    return () => api.removeMockDataListener();
  }
}, []);
```

- 组件挂载时注册监听器
- 每次收到 `'mock-data'` 事件就调用 `setMockData(data)` 更新 React state
- 组件卸载时清理监听器，防止内存泄漏

---

### 4. **展示层：Dashboard 组件消费数据（`src/renderer/components/Dashboard.tsx`）**

```tsx
function Dashboard({ mockData, wsConnected }: DashboardProps) {
  // ...
  <div className="stat-value">{mockData?.connectedClients || 2}</div>
  <div className="stat-value">{mockData?.memoryUsage || 168.32}MB</div>
  <RealtimeChart data={mockData?.commandsPerSec || 0} ... />
  // ...
}
```

- 直接从 props 读取 `mockData`
- 用可选链 `?.` 安全访问，首次渲染时为 `null` 则显示默认值

---

### 完整数据流

```
主进程 (main.ts)
  ↓ setInterval 每 1s 生成随机数据
  ↓ webContents.send('mock-data', data)
  
Preload (preload.ts)
  ↓ ipcRenderer.on('mock-data', ...)
  ↓ 暴露为 window.electronAPI.onMockData()
  
渲染进程 (App.tsx)
  ↓ useEffect 订阅 onMockData
  ↓ setMockData(data) 触发 React 重新渲染
  
Dashboard 组件
  ↓ 从 props 读取 mockData
  ↓ 更新界面上的数字和图表
```

---

### 新人小结

> **关键点**：这不是传统的"前端发 HTTP 请求拉取数据"，而是 **Electron 主进程主动推送**。主进程像是一个后台定时器，每秒生成新数据并通过 IPC（进程间通信）推给渲染进程。渲染进程只需要"订阅"这个事件，数据来了就自动更新界面。这种模式叫 **Server-Push（服务器推送）**，和你之前看的 Vite HMR 通过 WebSocket 推送更新的原理类似——都是"服务端主动通知，客户端被动接收"。














END.