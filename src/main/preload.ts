import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Mock data from main process
  onMockData: (callback: (data: MockData) => void) => {
    ipcRenderer.on('mock-data', (_event, data: MockData) => callback(data));
  },
  removeMockDataListener: () => {
    ipcRenderer.removeAllListeners('mock-data');
  },
});

export interface MockData {
  timestamp: number;
  commandsPerSec: number;
  connectedClients: number;
  memoryUsage: number;
  networkInput: number;
  networkOutput: number;
}
