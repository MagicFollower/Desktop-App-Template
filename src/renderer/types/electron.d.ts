import type { UserRecord, UserInput, ProfilePatch, MenuRecord, MenuInput, MenuReorderEntry, DocRuleRecord, DocRuleInput, FileRecord, FileConfigRecord, FileConfigInput, FileUploadMeta, FileSaveResult, FileDirRecord, FileDirInput } from '../../main/dto';

/**
 * Electron API 类型声明（A2：与 preload.ts 共享 dto.ts 单一类型源，
 * 此前本文件与 preload 各自维护一份 any 泛滥的签名，两边漂移无从发现）
 * 仅在 Electron 环境中可用，浏览器开发模式下 window.electronAPI 为 undefined
 */

export type { MenuReorderEntry };

export interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (maximized: boolean) => void) => void;
  removeMaximizeChangeListener: () => void;

  // User management
  userList: () => Promise<UserRecord[]>;
  userCreate: (user: UserInput) => Promise<{ success: boolean }>;
  userUpdate: (user: UserInput) => Promise<{ success: boolean }>;
  userDelete: (id: string) => Promise<{ success: boolean }>;

  // Profile
  profileUpdate: (patch: ProfilePatch) => Promise<{ success: boolean }>;

  // Auth
  authLogin: (username: string, password: string) => Promise<UserRecord | null>;
  passwordChange: (username: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean }>;

  // Menu
  menuList: () => Promise<MenuRecord[]>;
  menuUpsert: (menu: MenuInput) => Promise<{ success: boolean }>;
  menuBatchUpdate: (entries: MenuReorderEntry[]) => Promise<{ success: boolean }>;
  menuDelete: (id: string) => Promise<{ success: boolean }>;

  // Doc number rules
  docRuleList: () => Promise<DocRuleRecord[]>;
  docRuleUpsert: (rule: DocRuleInput) => Promise<{ success: boolean }>;
  docRuleDelete: (id: string) => Promise<{ success: boolean }>;
  docNextNumber: (code: string) => Promise<string>;

  // File management
  fileList: () => Promise<FileRecord[]>;
  // 逻辑目录（不落盘）：树形结构；只允许删空目录（业务规则在主进程）
  fileDirList: () => Promise<FileDirRecord[]>;
  fileDirCreate: (input: FileDirInput) => Promise<FileDirRecord>;
  fileDirDelete: (id: string) => Promise<{ success: boolean }>;
  fileUpload: (meta: FileUploadMeta, data: Uint8Array) => Promise<FileRecord>;
  fileDelete: (ids: string[]) => Promise<{ deleted: number }>;
  // 下载：读物理写入用户选择的目录；单文件失败不阻塞其余
  fileSaveTo: (ids: string[], targetDir: string) => Promise<FileSaveResult>;
  // 原生目录选择器：用户取消返回 null
  selectDownloadDir: () => Promise<string | null>;
  // 存储配置查询不含 ftpPassword（只写不读）
  fileConfigGet: () => Promise<FileConfigRecord>;
  fileConfigSave: (input: FileConfigInput) => Promise<{ success: boolean }>;

  // Log（A7）：渲染层日志转发主进程 electron-log
  log: (level: 'info' | 'warn' | 'error', message: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
