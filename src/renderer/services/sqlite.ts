/**
 * 渲染进程统一数据访问入口（门面，A1 重构）。
 *
 * 三端通路的选择收敛在 services/adapter.ts（启动时一次性解析并缓存）：
 * - Electron → IPC；浏览器 + Dev API 在线 → HTTP；纯浏览器 → 演示兜底（动态加载）。
 * 本文件只保留稳定的业务语义函数，供页面直接调用；
 * 页面也可以绕过门面直接使用 getDataAdapter()（同一实例）。
 *
 * A2：入参/返回类型来自 src/main/dto.ts 的跨进程契约。
 */

import { getDataAdapter } from './adapter';
import type { UserRecord, UserInput, ProfilePatch, MenuInput, MenuReorderEntry, DocRuleRecord, DocRuleInput, DocDateType, DocResetPolicy, FileRecord, FileConfigRecord, FileConfigInput, FileUploadMeta, FileStorage, FileSaveResult, FileSaveFailure, FileDirRecord, FileDirInput } from '../../main/dto';
import type { MenuItem } from '../types/menu';

// 跨进程契约类型统一从 dto.ts 导出；这里 re-export 供既有调用方继续从 services/sqlite 引用
export type { UserRecord, UserInput, ProfilePatch, MenuInput, MenuReorderEntry, DocRuleRecord, DocRuleInput, DocDateType, DocResetPolicy, FileRecord, FileConfigRecord, FileConfigInput, FileUploadMeta, FileStorage, FileSaveResult, FileSaveFailure, FileDirRecord, FileDirInput };

// ==================== 用户管理 ====================

export async function loadUsers(): Promise<UserRecord[]> {
  return (await getDataAdapter()).userList();
}

/**
 * 保存用户（新增或更新）。
 * @param input 完整的用户信息（调用方需保证字段齐全）
 * @param isEdit true=更新已有用户，false=新增用户。
 *               新增/更新必须由调用方显式指定，不能用字段是否存在来推断。
 */
export async function saveUser(input: UserInput, isEdit: boolean): Promise<void> {
  await (await getDataAdapter()).userSave(input, isEdit);
}

export async function deleteUser(id: string): Promise<void> {
  await (await getDataAdapter()).userDelete(id);
}

// ==================== 个人资料 ====================

export async function saveProfile(patch: ProfilePatch): Promise<void> {
  await (await getDataAdapter()).profileUpdate(patch);
}

// ==================== 认证 ====================

/** 登录：验证成功返回库内完整用户信息（id/role 以数据库为准），失败返回 null。
 * 注意与 useAuthStore.login(token, user) 区分：本函数只做验证与取数 */
export async function authLogin(username: string, password: string): Promise<UserRecord | null> {
  return (await getDataAdapter()).authLogin(username, password);
}

/** 修改密码：旧密码验证与 bcrypt 哈希全部在主进程完成，旧密码错误抛错 */
export async function changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
  await (await getDataAdapter()).passwordChange(username, currentPassword, newPassword);
}

// ==================== 菜单 ====================

/** 加载菜单树（已按 sortOrder 排序；适配器内部完成扁平 → 树形构建） */
export async function loadMenus(): Promise<MenuItem[]> {
  return (await getDataAdapter()).menuList();
}

export async function saveMenu(menu: MenuInput): Promise<void> {
  await (await getDataAdapter()).menuUpsert(menu);
}

/** 批量更新菜单的层级与排序（拖拽排序使用）；事务与环检测由主进程完成 */
export async function reorderMenus(entries: MenuReorderEntry[]): Promise<void> {
  await (await getDataAdapter()).menuBatchUpdate(entries);
}

export async function deleteMenu(id: string): Promise<void> {
  await (await getDataAdapter()).menuDelete(id);
}

// ==================== 单据号规则 ====================

export async function loadDocRules(): Promise<DocRuleRecord[]> {
  return (await getDataAdapter()).docRuleList();
}

export async function saveDocRule(rule: DocRuleInput): Promise<void> {
  await (await getDataAdapter()).docRuleUpsert(rule);
}

export async function deleteDocRule(id: string): Promise<void> {
  await (await getDataAdapter()).docRuleDelete(id);
}

/** 取下一个单据号（计数 +1）；规则不存在/停用会拋错 */
export async function nextDocNumber(code: string): Promise<string> {
  return (await getDataAdapter()).docNextNumber(code);
}

// ==================== 文件管理 ====================

export async function loadFiles(): Promise<FileRecord[]> {
  return (await getDataAdapter()).fileList();
}

// ==================== 文件目录（逻辑目录树，不落盘） ====================

export async function loadFileDirs(): Promise<FileDirRecord[]> {
  return (await getDataAdapter()).fileDirList();
}

/** 新增目录：parentId=null 建在根下；支持多级 */
export async function createFileDir(parentId: string | null, name: string): Promise<FileDirRecord> {
  return (await getDataAdapter()).fileDirCreate({ parentId, name });
}

/** 删除目录：仅限空目录（无子目录且无文件，含子目录内）；规则在主进程 service */
export async function deleteFileDir(id: string): Promise<{ success: boolean }> {
  return (await getDataAdapter()).fileDirDelete(id);
}

/** 上传单个文件：二进制为 Uint8Array（适配层按通路编码——IPC 直传/HTTP 转 base64） */
export async function uploadFile(meta: FileUploadMeta, data: Uint8Array): Promise<FileRecord> {
  return (await getDataAdapter()).fileUpload(meta, data);
}

/** 删除文件（单条/批量统一入口：单条即 [id]）；物理文件尽力删，记录必删 */
export async function deleteFiles(ids: string[]): Promise<{ deleted: number }> {
  return (await getDataAdapter()).fileDelete(ids);
}

/** 下载到指定目录（单条/批量统一入口）；单文件失败不阻塞其余 */
export async function saveFilesTo(ids: string[], targetDir: string): Promise<FileSaveResult> {
  return (await getDataAdapter()).fileSaveTo(ids, targetDir);
}

/** 原生目录选择器（仅 Electron 窗口可用）；用户取消返回 null */
export async function selectDownloadDir(): Promise<string | null> {
  return (await getDataAdapter()).selectDownloadDir();
}

/** 存储配置查询（不含 ftpPassword） */
export async function loadFileConfig(): Promise<FileConfigRecord> {
  return (await getDataAdapter()).fileConfigGet();
}

export async function saveFileConfig(input: FileConfigInput): Promise<void> {
  await (await getDataAdapter()).fileConfigSave(input);
}
