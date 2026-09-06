/**
 * 纯浏览器演示模式的兜底适配器（A1：从 services/sqlite.ts 抽出的降级分支）。
 *
 * 仅在「无 Electron 且 Dev API 离线」（npm run dev 纯浏览器）时由 adapter.ts
 * 动态 import 加载——默认菜单与演示账号不进入主 bundle，也不参与生产代码路径。
 *
 * 语义（区别于旧实现的静默吞错，见 README B5）：
 * - 读操作返回演示数据，保证界面可调试；
 * - 写操作一律抛错提示「演示模式不可持久化」，不再假装成功。
 */

import type { UserRecord, UserInput, ProfilePatch, MenuRecord, MenuInput, MenuReorderEntry, DocRuleRecord, DocRuleInput, FileRecord, FileConfigRecord, FileConfigInput, FileUploadMeta, FileSaveResult, FileDirRecord, FileDirInput } from '../../main/dto';
import type { MenuItem } from '../types/menu';
import type { DataAdapter } from './adapter';
import { buildMenuTree } from './menu-tree';

const NOT_PERSISTED = '浏览器演示模式：无持久化能力，修改不会保存。请使用 npm run start 启动完整环境';

/** 纯浏览器 dev 模式下的演示菜单（与主进程 schema 种子一致；roles 与迁移 v3 一致） */
const DEFAULT_MENUS: MenuRecord[] = [
  { id: 'dashboard', parentId: null, label: '仪表盘', icon: 'DashboardOutlined', path: '/', sortOrder: 0, isSystem: true },
  { id: 'system', parentId: null, label: '系统管理', icon: 'SettingOutlined', path: null, sortOrder: 1, isSystem: true, roles: ['admin'] },
  { id: 'system-users', parentId: 'system', label: '人员管理', icon: 'UserOutlined', path: '/system/users', sortOrder: 0, isSystem: true, roles: ['admin'] },
  { id: 'system-profile', parentId: 'system', label: '个人信息', icon: 'IdcardOutlined', path: '/system/profile', sortOrder: 1, isSystem: true },
  { id: 'system-menus', parentId: 'system', label: '菜单管理', icon: 'MenuOutlined', path: '/system/menus', sortOrder: 2, isSystem: true, roles: ['admin'] },
  { id: 'system-doc-rules', parentId: 'system', label: '单据号规则', icon: 'FileTextOutlined', path: '/system/doc-rules', sortOrder: 3, isSystem: true, roles: ['admin'] },
  { id: 'tools', parentId: null, label: '工具模块', icon: 'ToolOutlined', path: null, sortOrder: 2, isSystem: true },
  { id: 'tools-files', parentId: 'tools', label: '文件管理', icon: 'FolderOutlined', path: '/tools/files', sortOrder: 0, isSystem: true },
  { id: 'tools-redis', parentId: 'tools', label: 'Redis 查询', icon: 'DatabaseOutlined', path: '/tools/redis', sortOrder: 1, isSystem: true },
  { id: 'tools-ftp', parentId: 'tools', label: 'FTP 查询', icon: 'CloudServerOutlined', path: '/tools/ftp', sortOrder: 2, isSystem: true },
];

/** 演示账号（仅无 API 服务器时的登录调试） */
const BROWSER_DEV_ACCOUNTS: Record<string, string> = { admin: 'admin123', user: 'user123' };

/** 演示用户数据（与主进程 schema 种子一致；userCode 对应迁移 v5 的回填结果） */
const DEMO_USERS: UserRecord[] = [
  { id: '1', username: 'admin', userCode: 'U0001', email: 'admin@example.com', phone: '', avatar: '', nickname: '', role: 'admin', status: 'active', createdAt: new Date().toISOString() },
  { id: '2', username: 'user', userCode: 'U0002', email: 'user@example.com', phone: '', avatar: '', nickname: '', role: 'user', status: 'active', createdAt: new Date().toISOString() },
  { id: '3', username: 'zhangsan', userCode: 'U0003', email: 'zhangsan@example.com', phone: '13800138001', avatar: '', nickname: '张三', role: 'manager', status: 'active', createdAt: new Date().toISOString() },
  { id: '4', username: 'lisi', userCode: 'U0004', email: 'lisi@example.com', phone: '13800138002', avatar: '', nickname: '李四', role: 'user', status: 'active', createdAt: new Date().toISOString() },
  { id: '5', username: 'wangwu', userCode: 'U0005', email: 'wangwu@example.com', phone: '13800138003', avatar: '', nickname: '王五', role: 'user', status: 'disabled', createdAt: new Date().toISOString() },
];

/** 演示单据号规则（纯浏览器模式只读展示；与迁移 v4 无种子，仅一条示例） */
const DEMO_DOC_RULES: DocRuleRecord[] = [
  { id: 'doc-demo-1', code: 'PO', name: '采购入库单', prefix: 'PO', dateType: 'yyyyMMdd', seqLength: 4, resetPolicy: 'daily', separator: '-', enabled: true, remark: '演示数据', currentSeq: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

/** 演示目录（逻辑目录树，不落盘）：两级结构演示多级目录 */
const DEMO_FILE_DIRS: FileDirRecord[] = [
  { id: 'dir-demo-1', parentId: null, name: '项目文档', createdAt: new Date().toISOString(), fileCount: 1 },
  { id: 'dir-demo-1-1', parentId: 'dir-demo-1', name: '验收材料', createdAt: new Date().toISOString(), fileCount: 1 },
];

/** 演示上传记录（纯浏览器模式只读展示；fullPath 为演示视角的虚拟路径） */
const DEMO_FILES: FileRecord[] = [
  { id: 'file-demo-1', name: '需求说明.pdf', storedName: '20260907-abc123-需求说明.pdf', storage: 'local', size: 204800, mime: 'application/pdf', path: '2026/09/', uploadedBy: 'admin', createdAt: new Date().toISOString(), dirId: 'dir-demo-1', fullPath: 'C:\\Users\\demo\\AppData\\Roaming\\app\\files\\2026/09/20260907-abc123-需求说明.pdf' },
  { id: 'file-demo-2', name: '验收清单.xlsx', storedName: '20260907-def456-验收清单.xlsx', storage: 'local', size: 35840, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', path: '2026/09/', uploadedBy: 'admin', createdAt: new Date().toISOString(), dirId: 'dir-demo-1-1', fullPath: 'C:\\Users\\demo\\AppData\\Roaming\\app\\files\\2026/09/20260907-def456-验收清单.xlsx' },
];

/** 演示存储配置（与迁移 v6 默认行一致，不含 ftpPassword） */
const DEMO_FILE_CONFIG: FileConfigRecord = {
  activeStorage: 'local',
  localDir: '',
  ftpHost: '',
  ftpPort: 21,
  ftpUser: '',
  ftpRoot: '',
  ftpSecure: false,
};

export class FallbackAdapter implements DataAdapter {
  async userList(): Promise<UserRecord[]> {
    return DEMO_USERS;
  }

  async userSave(_input: UserInput, _isEdit: boolean): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async userDelete(_id: string): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async profileUpdate(_patch: ProfilePatch): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async authLogin(username: string, password: string): Promise<UserRecord | null> {
    if (BROWSER_DEV_ACCOUNTS[username] !== password) return null;
    const user = DEMO_USERS.find((u) => u.username === username);
    return user ?? null;
  }

  async passwordChange(): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async menuList(): Promise<MenuItem[]> {
    return buildMenuTree(DEFAULT_MENUS);
  }

  async menuUpsert(_menu: MenuInput): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async menuBatchUpdate(_entries: MenuReorderEntry[]): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async menuDelete(_id: string): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async docRuleList(): Promise<DocRuleRecord[]> {
    return DEMO_DOC_RULES;
  }

  async docRuleUpsert(_rule: DocRuleInput): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  async docRuleDelete(_id: string): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }

  // 取号即写计数，同样是写操作
  async docNextNumber(_code: string): Promise<string> {
    throw new Error(NOT_PERSISTED);
  }

  // ---------- 文件管理（纯浏览器模式只读列表，写操作不支持） ----------

  async fileList(): Promise<FileRecord[]> {
    return DEMO_FILES;
  }

  // ---------- 文件目录（逻辑目录树，只读展示；写操作不支持） ----------

  async fileDirList(): Promise<FileDirRecord[]> {
    return DEMO_FILE_DIRS;
  }

  async fileDirCreate(_input: FileDirInput): Promise<FileDirRecord> {
    throw new Error(NOT_PERSISTED);
  }

  async fileDirDelete(_id: string): Promise<{ success: boolean }> {
    throw new Error(NOT_PERSISTED);
  }

  async fileUpload(_meta: FileUploadMeta, _data: Uint8Array): Promise<FileRecord> {
    throw new Error(NOT_PERSISTED);
  }

  async fileDelete(_ids: string[]): Promise<{ deleted: number }> {
    throw new Error(NOT_PERSISTED);
  }

  // 下载需要读真实物理文件，演示模式无存储后端
  async fileSaveTo(_ids: string[], _targetDir: string): Promise<FileSaveResult> {
    throw new Error(NOT_PERSISTED);
  }

  async selectDownloadDir(): Promise<string | null> {
    throw new Error('浏览器演示模式无法访问本机目录，请使用 npm run start 启动完整环境');
  }

  // 存储配置可以读（演示默认值），保存与上传一样需要真实后端
  async fileConfigGet(): Promise<FileConfigRecord> {
    return DEMO_FILE_CONFIG;
  }

  async fileConfigSave(_input: FileConfigInput): Promise<void> {
    throw new Error(NOT_PERSISTED);
  }
}
