/**
 * 数据适配层（A1）——渲染进程统一的数据访问通路。
 *
 * 旧实现（services/sqlite.ts）里每个数据函数都是 isElectron() ? IPC : HTTP 双分支
 * + 降级兜底，13 个函数 × 3 种环境 = 大量重复样板。现改为启动时一次性解析适配器：
 * - Electron 环境 → IpcAdapter（preload 暴露的 electronAPI）
 * - 浏览器 + Dev API 在线（npm run start）→ HttpAdapter（http://127.0.0.1:5174，
 *   准入校验见 src/main/api-server.ts）
 * - 纯浏览器（npm run dev，无持久化能力）→ FallbackAdapter（动态加载，演示数据）
 *
 * 页面只面向 DataAdapter 接口编程；新增接口只需在三个实现里各写一次，
 * 不再有贯穿所有函数的环境分支。
 */

import type { UserRecord, UserInput, ProfilePatch, MenuRecord, MenuInput, MenuReorderEntry, DocRuleRecord, DocRuleInput, FileRecord, FileConfigRecord, FileConfigInput, FileUploadMeta, FileSaveResult, FileDirRecord, FileDirInput } from '../../main/dto';
import type { MenuItem } from '../types/menu';
import { buildMenuTree } from './menu-tree';

/** 渲染进程看到的全部数据能力（与 preload electronAPI 语义对齐） */
export interface DataAdapter {
  userList(): Promise<UserRecord[]>;
  userSave(input: UserInput, isEdit: boolean): Promise<void>;
  userDelete(id: string): Promise<void>;
  profileUpdate(patch: ProfilePatch): Promise<void>;
  authLogin(username: string, password: string): Promise<UserRecord | null>;
  passwordChange(username: string, currentPassword: string, newPassword: string): Promise<void>;
  /** 返回已按 sortOrder 排序的菜单树 */
  menuList(): Promise<MenuItem[]>;
  menuUpsert(menu: MenuInput): Promise<void>;
  menuBatchUpdate(entries: MenuReorderEntry[]): Promise<void>;
  menuDelete(id: string): Promise<void>;

  /** 单据号规则：列表/保存/删除；取号会推进计数器，规则不存在/停用时抛错 */
  docRuleList(): Promise<DocRuleRecord[]>;
  docRuleUpsert(rule: DocRuleInput): Promise<void>;
  docRuleDelete(id: string): Promise<void>;
  docNextNumber(code: string): Promise<string>;

  /** 文件管理：列表/上传/删除/下载；存储配置（查询不含 ftpPassword） */
  fileList(): Promise<FileRecord[]>;
  /** 逻辑目录（不落盘）：树形列表（DFS 序，父在子前）；新增支持多级；删除仅限空目录 */
  fileDirList(): Promise<FileDirRecord[]>;
  fileDirCreate(input: FileDirInput): Promise<FileDirRecord>;
  fileDirDelete(id: string): Promise<{ success: boolean }>;
  fileUpload(meta: FileUploadMeta, data: Uint8Array): Promise<FileRecord>;
  /** 单条/批量统一入口（单条即长度 1 的数组） */
  fileDelete(ids: string[]): Promise<{ deleted: number }>;
  /** 下载：读物理写入用户选择的目录；单文件失败不阻塞其余 */
  fileSaveTo(ids: string[], targetDir: string): Promise<FileSaveResult>;
  /** 原生目录选择器（仅 Electron 可用）：用户取消返回 null */
  selectDownloadDir(): Promise<string | null>;
  fileConfigGet(): Promise<FileConfigRecord>;
  fileConfigSave(input: FileConfigInput): Promise<void>;
}

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;

/** 主进程能力检测：preload 只在页面加载时注入一次，npm run start 期间改了主进程代码，
 * 渲染端经 Vite HMR 拿到新页面但 Electron 还是旧 preload —— 调用新方法会报
 * 「xxx is not a function」。与其让用户看裸错，不如直接给出重启指引 */
function requireMainApi<T>(method: T | undefined, what: string): T {
  if (typeof method !== 'function') {
    throw new Error(`主进程版本过旧（缺少${what}）：请重启 npm run start 后重试`);
  }
  return method;
}

/** ipcRenderer.invoke 抛错时 Electron 会包一层
 * 「Error invoking remote method 'channel': Error: 原始消息」——
 * 业务提示（如「目录下存在文件，请先删除或移出文件」）不应携带这层技术前缀 */
async function invokeClean<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof Error) {
      const m = err.message.match(/^Error invoking remote method '[^']+': (?:Error: )?([\s\S]*)$/);
      if (m) throw new Error(m[1], { cause: err });
    }
    throw err;
  }
}

/**
 * Dev API 服务器地址（固定端口）。
 * 必须与 src/main/api-server.ts 的 DEV_API_PORT 保持一致。
 */
const DEV_API_BASE = 'http://127.0.0.1:5174';

// ==================== HTTP 工具（仅 HttpAdapter 使用） ====================

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${DEV_API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

const postJson = (data: unknown) => ({ method: 'POST', body: JSON.stringify(data) });
const putJson = (data: unknown) => ({ method: 'PUT', body: JSON.stringify(data) });
const deleteJson = (data: unknown) => ({ method: 'DELETE', body: JSON.stringify(data) });

/** 二进制 → base64（仅 HttpAdapter 的上传通路用）：分块拼接避免 String.fromCharCode
 * 对大 buffer 的参数长度上限（栈溢出） */
function arrayBufferToBase64(buffer: ArrayBufferLike, byteOffset: number, byteLength: number): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer, byteOffset, byteLength);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ==================== 适配器实现 ====================

/** Electron 环境：IPC 通路 */
class IpcAdapter implements DataAdapter {
  async userList(): Promise<UserRecord[]> {
    try {
      return await window.electronAPI!.userList();
    } catch {
      // 如实反映「数据库不可用」，由页面展示空态
      return [];
    }
  }

  async userSave(input: UserInput, isEdit: boolean): Promise<void> {
    if (isEdit) await window.electronAPI!.userUpdate(input);
    else await window.electronAPI!.userCreate(input);
  }

  async userDelete(id: string): Promise<void> {
    await window.electronAPI!.userDelete(id);
  }

  async profileUpdate(patch: ProfilePatch): Promise<void> {
    await window.electronAPI!.profileUpdate(patch);
  }

  async authLogin(username: string, password: string): Promise<UserRecord | null> {
    try {
      return await window.electronAPI!.authLogin(username, password);
    } catch {
      return null;
    }
  }

  async passwordChange(username: string, currentPassword: string, newPassword: string): Promise<void> {
    await window.electronAPI!.passwordChange(username, currentPassword, newPassword);
  }

  async menuList(): Promise<MenuItem[]> {
    try {
      return buildMenuTree(await window.electronAPI!.menuList());
    } catch {
      return [];
    }
  }

  async menuUpsert(menu: MenuInput): Promise<void> {
    await window.electronAPI!.menuUpsert(menu);
  }

  async menuBatchUpdate(entries: MenuReorderEntry[]): Promise<void> {
    await window.electronAPI!.menuBatchUpdate(entries);
  }

  async menuDelete(id: string): Promise<void> {
    await window.electronAPI!.menuDelete(id);
  }

  async docRuleList(): Promise<DocRuleRecord[]> {
    try {
      return await window.electronAPI!.docRuleList();
    } catch {
      // 如实反映「数据库不可用」，由页面展示空态
      return [];
    }
  }

  async docRuleUpsert(rule: DocRuleInput): Promise<void> {
    await window.electronAPI!.docRuleUpsert(rule);
  }

  async docRuleDelete(id: string): Promise<void> {
    await window.electronAPI!.docRuleDelete(id);
  }

  async docNextNumber(code: string): Promise<string> {
    return window.electronAPI!.docNextNumber(code);
  }

  async fileList(): Promise<FileRecord[]> {
    try {
      return await window.electronAPI!.fileList();
    } catch {
      return [];
    }
  }

  async fileDirList(): Promise<FileDirRecord[]> {
    try {
      return await requireMainApi(window.electronAPI!.fileDirList, '目录列表')();
    } catch {
      return [];
    }
  }

  async fileDirCreate(input: FileDirInput): Promise<FileDirRecord> {
    return invokeClean(requireMainApi(window.electronAPI!.fileDirCreate, '新增目录')(input));
  }

  async fileDirDelete(id: string): Promise<{ success: boolean }> {
    return invokeClean(requireMainApi(window.electronAPI!.fileDirDelete, '删除目录')(id));
  }

  async fileUpload(meta: FileUploadMeta, data: Uint8Array): Promise<FileRecord> {
    // IPC 结构化克隆直接传 Uint8Array（整块传输，无编码开销）
    return window.electronAPI!.fileUpload(meta, data);
  }

  async fileDelete(ids: string[]): Promise<{ deleted: number }> {
    return window.electronAPI!.fileDelete(ids);
  }

  async fileSaveTo(ids: string[], targetDir: string): Promise<FileSaveResult> {
    return requireMainApi(window.electronAPI!.fileSaveTo, '文件下载')(ids, targetDir);
  }

  async selectDownloadDir(): Promise<string | null> {
    return requireMainApi(window.electronAPI!.selectDownloadDir, '目录选择')();
  }

  async fileConfigGet(): Promise<FileConfigRecord> {
    return window.electronAPI!.fileConfigGet();
  }

  async fileConfigSave(input: FileConfigInput): Promise<void> {
    await window.electronAPI!.fileConfigSave(input);
  }
}

/** 浏览器 + Dev API 在线：HTTP 通路（与 Electron 窗口共享同一 SQLite） */
class HttpAdapter implements DataAdapter {
  async userList(): Promise<UserRecord[]> {
    try {
      return await apiFetch<UserRecord[]>('/api/users');
    } catch {
      return [];
    }
  }

  async userSave(input: UserInput, isEdit: boolean): Promise<void> {
    await apiFetch('/api/users', isEdit ? putJson(input) : postJson(input));
  }

  async userDelete(id: string): Promise<void> {
    await apiFetch('/api/users', deleteJson({ id }));
  }

  async profileUpdate(patch: ProfilePatch): Promise<void> {
    await apiFetch('/api/profile', putJson(patch));
  }

  async authLogin(username: string, password: string): Promise<UserRecord | null> {
    return apiFetch<UserRecord | null>('/api/auth/login', postJson({ username, password }));
  }

  async passwordChange(username: string, currentPassword: string, newPassword: string): Promise<void> {
    await apiFetch('/api/auth/password', putJson({ username, current: currentPassword, next: newPassword }));
  }

  async menuList(): Promise<MenuItem[]> {
    try {
      return buildMenuTree(await apiFetch<MenuRecord[]>('/api/menus'));
    } catch {
      return [];
    }
  }

  async menuUpsert(menu: MenuInput): Promise<void> {
    await apiFetch('/api/menus', postJson(menu));
  }

  async menuBatchUpdate(entries: MenuReorderEntry[]): Promise<void> {
    await apiFetch('/api/menus/batch-update', postJson(entries));
  }

  async menuDelete(id: string): Promise<void> {
    await apiFetch('/api/menus', deleteJson({ id }));
  }

  async docRuleList(): Promise<DocRuleRecord[]> {
    try {
      return await apiFetch<DocRuleRecord[]>('/api/doc-rules');
    } catch {
      return [];
    }
  }

  async docRuleUpsert(rule: DocRuleInput): Promise<void> {
    await apiFetch('/api/doc-rules', postJson(rule));
  }

  async docRuleDelete(id: string): Promise<void> {
    await apiFetch('/api/doc-rules', deleteJson({ id }));
  }

  async docNextNumber(code: string): Promise<string> {
    const res = await apiFetch<{ number: string }>('/api/doc-rules/next-number', postJson({ code }));
    return res.number;
  }

  async fileList(): Promise<FileRecord[]> {
    try {
      return await apiFetch<FileRecord[]>('/api/files');
    } catch {
      return [];
    }
  }

  async fileDirList(): Promise<FileDirRecord[]> {
    try {
      return await apiFetch<FileDirRecord[]>('/api/file-dirs');
    } catch {
      return [];
    }
  }

  async fileDirCreate(input: FileDirInput): Promise<FileDirRecord> {
    return apiFetch<FileDirRecord>('/api/file-dirs', postJson(input));
  }

  async fileDirDelete(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/file-dirs', deleteJson({ id }));
  }

  async fileUpload(meta: FileUploadMeta, data: Uint8Array): Promise<FileRecord> {
    // HTTP 通路：二进制转 base64 进 JSON（服务端 api-server 解码为 Uint8Array 后调 service）
    const res = await apiFetch<FileRecord>('/api/files', postJson({
      name: meta.name,
      mime: meta.mime,
      uploadedBy: meta.uploadedBy,
      dirId: meta.dirId ?? null,
      dataBase64: arrayBufferToBase64(data.buffer, data.byteOffset, data.byteLength),
    }));
    return res;
  }

  async fileDelete(ids: string[]): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>('/api/files', deleteJson({ ids }));
  }

  async fileSaveTo(ids: string[], targetDir: string): Promise<FileSaveResult> {
    return apiFetch<FileSaveResult>('/api/files/save', postJson({ ids, targetDir }));
  }

  // 目录选择是主进程 GUI 能力（dialog.showOpenDialog），HTTP 通路不暴露——
  // 浏览器页面拿不到本机目录选择器，明确报错比静默降级更诚实
  async selectDownloadDir(): Promise<string | null> {
    throw new Error('目录选择仅支持 Electron 窗口；HTTP 调试通路请直接传入目标目录');
  }

  async fileConfigGet(): Promise<FileConfigRecord> {
    return apiFetch<FileConfigRecord>('/api/files/config');
  }

  async fileConfigSave(input: FileConfigInput): Promise<void> {
    await apiFetch('/api/files/config', putJson(input));
  }
}

// ==================== 解析工厂 ====================

let adapterPromise: Promise<DataAdapter> | null = null;

/** 探测 Dev API 是否在线（短超时，避免纯 dev 模式下长时间挂起） */
async function probeDevApi(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000);
  try {
    await fetch(`${DEV_API_BASE}/api/users`, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析数据适配器（进程生命周期内只解析一次，结果缓存）。
 * FallbackAdapter 通过动态 import 加载：默认菜单/演示账号不进入主 bundle，
 * Electron 生产环境运行时也永远不会执行该分支。
 */
export function getDataAdapter(): Promise<DataAdapter> {
  if (!adapterPromise) {
    adapterPromise = (async () => {
      if (isElectron()) return new IpcAdapter();
      if (await probeDevApi()) return new HttpAdapter();
      const { FallbackAdapter } = await import('./dev-fallback');
      return new FallbackAdapter();
    })();
  }
  return adapterPromise;
}
