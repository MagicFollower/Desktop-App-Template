import { contextBridge, ipcRenderer } from 'electron';
import type { UserRecord, UserInput, ProfilePatch, MenuRecord, MenuInput, MenuReorderEntry, DocRuleRecord, DocRuleInput, FileRecord, FileConfigRecord, FileConfigInput, FileUploadMeta, FileSaveResult, FileDirRecord, FileDirInput } from './dto';

// 注意：preload 运行在独立的渲染上下文中，无法访问主进程的 electron.app 等模块，
// 因此这里绝对不可【运行时】import api-server / service / database 等主进程模块链，
// 否则会在模块加载阶段抛错，导致 contextBridge 注册失败、界面白屏。
// （上方对 dto 的 import type 例外：纯类型引用编译后完全擦除，无运行时影响）
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window:maximized-changed', (_event, maximized: boolean) => callback(maximized));
  },
  removeMaximizeChangeListener: () => {
    ipcRenderer.removeAllListeners('window:maximized-changed');
  },

  // User management（A2：参数/返回全部使用 dto.ts 契约，与主进程 service 签名一致）
  userList: () => ipcRenderer.invoke('user:list') as Promise<UserRecord[]>,
  userCreate: (user: UserInput) => ipcRenderer.invoke('user:create', user),
  userUpdate: (user: UserInput) => ipcRenderer.invoke('user:update', user),
  userDelete: (id: string) => ipcRenderer.invoke('user:delete', id),

  // Profile（profileGet 已删除：登录时由 authLogin 合并资料，渲染端无单独拉取需求）
  profileUpdate: (patch: ProfilePatch) => ipcRenderer.invoke('profile:update', patch),

  // Auth
  // B1：登录成功返回完整用户信息（camelCase），失败返回 null
  authLogin: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', { username, password }) as Promise<UserRecord | null>,
  // S3：旧密码验证 + 哈希在主进程完成，渲染层只传明文（本地 IPC 通道）
  passwordChange: (username: string, currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke('password:change', { username, currentPassword, newPassword }),

  // Menu
  menuList: () => ipcRenderer.invoke('menu:list') as Promise<MenuRecord[]>,
  menuUpsert: (menu: MenuInput) => ipcRenderer.invoke('menu:upsert', menu),
  menuBatchUpdate: (entries: MenuReorderEntry[]) => ipcRenderer.invoke('menu:batch-update', entries),
  menuDelete: (id: string) => ipcRenderer.invoke('menu:delete', id),

  // Doc number rules（单据号规则）
  docRuleList: () => ipcRenderer.invoke('doc:rule-list') as Promise<DocRuleRecord[]>,
  docRuleUpsert: (rule: DocRuleInput) => ipcRenderer.invoke('doc:rule-upsert', rule),
  docRuleDelete: (id: string) => ipcRenderer.invoke('doc:rule-delete', id),
  // 取号会推进计数器：规则不存在/停用时主进程抛错
  docNextNumber: (code: string) => ipcRenderer.invoke('doc:next-number', code) as Promise<string>,

  // File management（文件管理）
  fileList: () => ipcRenderer.invoke('file:list') as Promise<FileRecord[]>,
  // 逻辑目录（不落盘）：树形结构，只允许删空目录（业务规则在 service）
  fileDirList: () => ipcRenderer.invoke('file:dir-list') as Promise<FileDirRecord[]>,
  fileDirCreate: (input: FileDirInput) =>
    ipcRenderer.invoke('file:dir-create', input) as Promise<FileDirRecord>,
  fileDirDelete: (id: string) => ipcRenderer.invoke('file:dir-delete', id) as Promise<{ success: boolean }>,
  // 二进制走 IPC 结构化克隆：Uint8Array 整块传输（单文件上限见 file-util.FILE_MAX_BYTES）
  fileUpload: (meta: FileUploadMeta, data: Uint8Array) => ipcRenderer.invoke('file:upload', meta, data) as Promise<FileRecord>,
  // 单条/批量统一入口（单条即长度 1 的数组）
  fileDelete: (ids: string[]) => ipcRenderer.invoke('file:delete', ids) as Promise<{ deleted: number }>,
  // 下载：读物理写入用户选择的目录；单文件失败不阻塞其余（failed 明细逐条返回）
  fileSaveTo: (ids: string[], targetDir: string) =>
    ipcRenderer.invoke('file:save-to', ids, targetDir) as Promise<FileSaveResult>,
  // 原生目录选择器：用户取消返回 null
  selectDownloadDir: () => ipcRenderer.invoke('file:select-dir') as Promise<string | null>,
  // 存储配置查询不含 ftpPassword（只写不读）
  fileConfigGet: () => ipcRenderer.invoke('file:config-get') as Promise<FileConfigRecord>,
  fileConfigSave: (input: FileConfigInput) => ipcRenderer.invoke('file:config-save', input),

  // Log（A7）：渲染层关键日志转发主进程 electron-log 落盘（打包后渲染 console 不可见）
  log: (level: 'info' | 'warn' | 'error', message: string) =>
    ipcRenderer.invoke('log:renderer', { level, message }),
});
