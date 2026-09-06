/**
 * 共享业务逻辑层
 * 供 IPC handlers 和 HTTP API server 共同使用，保证两端数据操作完全一致。
 *
 * 依赖解耦：本层只通过 SqlDriver 接口（all/get/run/transaction/persist）访问数据库，
 * 不感知底层是 sql.js 还是 better-sqlite3 —— 驱动选择在 database.ts 完成。
 */

import { getDatabase } from './database';
import bcrypt from 'bcryptjs';
import { buildDocNumber, resetKey, validateDocRule } from './doc-number';
import { buildRelativeDir, buildStoredName, sanitizeFileName, validateFileUpload } from './file-util';
import { ftpPut, ftpRemove, ftpDownload, joinRemote, type FtpConnectionConfig } from './ftp-client';
import { app } from 'electron';
import { promises as fsp } from 'fs';
import * as nodePath from 'path';
import { logger } from './logger';
import type { UserRecord, UserInput, ProfilePatch, MenuRecord, MenuInput, MenuReorderEntry, UserRole, DocRuleRecord, DocRuleInput, DocDateType, DocResetPolicy, FileRecord, FileStorage, FileConfigRecord, FileConfigInput, FileUploadMeta, FileSaveResult, FileSaveFailure, FileDirRecord, FileDirInput } from './dto';

// 持久化约定：sql.js 为全内存引擎，run/transaction 只改内存镜像。
// 因此下方每个写函数在操作完成后都必须调用 db.persist() 落盘；
// better-sqlite3 驱动的 persist() 为空操作，故该约定对两种驱动都安全。
// 契约约定（A2/A5）：本层出口一律映射为 dto.ts 的 camelCase 类型，
// snake_case 数据库行不出 service 层。

// ==================== 用户 ====================

/** users 表的原始行（snake_case） */
interface UserRow {
  id: string;
  username: string;
  user_code: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  nickname: string | null;
  role: string;
  status: string;
  created_at: string;
}

/** snake_case 行 → camelCase 用户对象：跨 IPC 边界的统一出口契约（B1/B2/A5） */
function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    // v5 之前的极老库无此列时理论上可为 NULL；出口契约必填，退化显示空串
    userCode: row.user_code ?? '',
    email: row.email,
    phone: row.phone ?? '',
    avatar: row.avatar ?? '',
    nickname: row.nickname ?? '',
    // DB 无 CHECK 约束，种子与表单只产出这三个值；异常值按 unknown 归为 user
    role: (['admin', 'manager', 'user'] as const).includes(row.role as UserRole) ? (row.role as UserRole) : 'user',
    status: row.status === 'disabled' ? 'disabled' : 'active',
    createdAt: row.created_at,
  };
}

export async function userList(): Promise<UserRecord[]> {
  const db = await getDatabase();
  const rows = db.all('SELECT * FROM users ORDER BY created_at DESC') as UserRow[];
  // 出口统一为 camelCase：旧实现直接透传 snake_case 行，渲染层拿到的
  // phone/status/createdAt 全是 undefined（创建时间列曾显示 Invalid Date）
  return rows.map(mapUserRow);
}

export async function userCreate(user: UserInput) {
  const db = await getDatabase();
  // 用户编码：服务端经单据号规则 USER 生成，永不接受客户端传入（UserInput 无此字段）。
  // 直接走 docNextNumber 的同源逻辑而非调它本身：其出口按 seqLength 补零，
  // 而此处入库值须与 UNIQuE 索引下的回填格式严格一致，统一以补零后的编码为准。
  const codeRow = db.get('SELECT * FROM doc_rules WHERE code=?', ['USER']) as DocRuleRow | null;
  if (!codeRow || codeRow.enabled !== 1) {
    throw new Error('用户编码规则（USER）不存在或已停用，无法新增用户');
  }
  const now = new Date();
  const key = resetKey(
    (DOC_RESET_POLICIES as string[]).includes(codeRow.reset_policy)
      ? (codeRow.reset_policy as DocResetPolicy)
      : 'never',
    now,
  );
  let userCode = '';
  db.transaction(() => {
    db.run(`
      INSERT INTO doc_counters (rule_code, reset_key, seq) VALUES (?, ?, 0)
      ON CONFLICT(rule_code, reset_key) DO NOTHING
    `, ['USER', key]);
    db.run('UPDATE doc_counters SET seq = seq + 1 WHERE rule_code=? AND reset_key=?', ['USER', key]);
    const counter = db.get('SELECT seq FROM doc_counters WHERE rule_code=? AND reset_key=?', ['USER', key]) as { seq: number };
    userCode = buildDocNumber(mapDocRuleRow(codeRow), counter.seq, now);
  });
  // created_at 为 NOT NULL 列：缺失时补当前时间，避免绑定 undefined 使 sql.js 抛
  // “tried to bind a value of an unknown type (undefined)”。
  // phone/avatar/nickname 等可选字段统一用 ?? null 归一，空值写入 NULL。
  db.run(`
    INSERT INTO users (id, username, user_code, email, phone, avatar, nickname, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    user.id,
    user.username,
    userCode,
    user.email,
    user.phone ?? null,
    user.avatar ?? null,
    user.nickname ?? null,
    user.role ?? 'user',
    user.status ?? 'active',
    user.createdAt ?? new Date().toISOString(),
  ]);
  db.persist();
  return { success: true };
}

export async function userUpdate(user: UserInput) {
  const db = await getDatabase();
  const existing = db.get('SELECT username FROM users WHERE id=?', [user.id]) as { username: string } | null;
  // 更新不动 created_at（保留原有创建时间）；同样对可选字段做 ?? null 归一，防 undefined 绑定
  db.transaction(() => {
    db.run(`
      UPDATE users SET username=?, email=?, phone=?, avatar=?, nickname=?, role=?, status=?
      WHERE id=?
    `, [
      user.username,
      user.email,
      user.phone ?? null,
      user.avatar ?? null,
      user.nickname ?? null,
      user.role ?? 'user',
      user.status ?? 'active',
      user.id,
    ]);
    // B4：改名联动。user_profiles 由外键 ON UPDATE CASCADE 自动跟随（见 schema 迁移 v2）；
    // passwords 无外键约束，必须手动同步，否则改完名就无法登录
    if (existing && existing.username !== user.username) {
      db.run('UPDATE passwords SET username=? WHERE username=?', [user.username, existing.username]);
    }
  });
  db.persist();
  return { success: true };
}

export async function userDelete(id: string) {
  const db = await getDatabase();
  const existing = db.get('SELECT username FROM users WHERE id=?', [id]) as { username: string } | null;
  db.transaction(() => {
    // B4：user_profiles 由外键 ON DELETE CASCADE 自动清理；passwords 无外键，手动删除避免孤儿数据
    if (existing) {
      db.run('DELETE FROM passwords WHERE username=?', [existing.username]);
    }
    db.run('DELETE FROM users WHERE id=?', [id]);
  });
  db.persist();
  return { success: true };
}

// ==================== 个人资料 ====================

// profileGet 已删除（A1 批次清理）：B1 改造后渲染端不再单独拉取资料，
// authLogin 已在主进程合并 user_profiles 字段。

export async function profileUpdate(patch: ProfilePatch) {
  const db = await getDatabase();
  db.run(`
    INSERT INTO user_profiles (username, nickname, email, phone, avatar)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      nickname=COALESCE(?, nickname),
      email=COALESCE(?, email),
      phone=COALESCE(?, phone),
      avatar=COALESCE(?, avatar)
  `, [
    patch.username,
    patch.nickname || null, patch.email || null,
    patch.phone || null, patch.avatar || null,
    patch.nickname || null, patch.email || null,
    patch.phone || null, patch.avatar || null,
  ]);
  db.persist();
  return { success: true };
}

// ==================== 认证 ====================

/**
 * 修改密码（S3）：旧密码验证与 bcrypt 哈希全部在主进程完成。
 * 旧接口接收渲染层算好的 hash，密码学责任错位——渲染进程被 XSS 时可直接接触
 * 哈希逻辑，且 bcryptjs 被无谓打进渲染 bundle。IPC 是本地进程间通道，
 * 传明文给主进程并不比渲染端先哈希更不安全。
 */
export async function passwordChangeSecure(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  const db = await getDatabase();
  const row = db.get('SELECT hash FROM passwords WHERE username=?', [username]) as { hash: string } | null;
  if (!row || !bcrypt.compareSync(currentPassword, row.hash)) {
    throw new Error('当前密码不正确');
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.run('UPDATE passwords SET hash=? WHERE username=?', [newHash, username]);
  db.persist();
  return { success: true };
}

/**
 * 登录（B1）：验证密码并返回数据库中的完整用户信息。
 * 旧实现只返回布尔值，登录页被迫硬编码 id/role（admin 判断），
 * 数据库中的 role（如 manager）被无视 —— 权限控制的源头即不可信。
 * 个人资料（昵称/头像等）优先于账号默认值，与个人信息页的编辑结果保持一致。
 */
export async function authLogin(username: string, password: string): Promise<UserRecord | null> {
  const db = await getDatabase();
  const pwd = db.get('SELECT hash FROM passwords WHERE username=?', [username]) as { hash: string } | null;
  if (!pwd || !bcrypt.compareSync(password, pwd.hash)) return null;

  const row = db.get(`
    SELECT u.*, p.nickname AS profile_nickname, p.avatar AS profile_avatar,
           p.phone AS profile_phone, p.email AS profile_email
    FROM users u
    LEFT JOIN user_profiles p ON p.username = u.username
    WHERE u.username = ?
  `, [username]) as (UserRow & Record<string, string | null>) | null;
  // 有密码但无用户记录（理论上不该出现）：拒绝登录
  if (!row) return null;

  const base = mapUserRow(row);
  return {
    ...base,
    nickname: row.profile_nickname ?? base.nickname,
    avatar: row.profile_avatar ?? base.avatar,
    phone: row.profile_phone ?? base.phone,
    email: row.profile_email ?? base.email,
  };
}

// ==================== 菜单 ====================

function normalizeParentId(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function normalizeSortOrder(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** menus 表的原始行（snake_case） */
interface MenuRow {
  id: string;
  parent_id: string | null;
  label: string;
  icon: string | null;
  path: string | null;
  sort_order: number;
  is_system: number;
  /** 逗号分隔的角色列表；NULL/空 = 所有角色可见（A3） */
  roles: string | null;
}

/** 'admin,manager' → ['admin','manager']；空值 → undefined（所有角色可见） */
function parseRoles(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const roles = value.split(',').map((r) => r.trim()).filter(Boolean);
  return roles.length > 0 ? roles : undefined;
}

/** ['admin','manager'] → 'admin,manager'；空数组/undefined → null（所有角色） */
function serializeRoles(roles?: string[]): string | null {
  if (!roles || roles.length === 0) return null;
  return roles.join(',');
}

export async function menuList(): Promise<MenuRecord[]> {
  const db = await getDatabase();
  const rows = db.all('SELECT * FROM menus ORDER BY sort_order ASC, id ASC') as MenuRow[];
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    icon: row.icon,
    path: row.path,
    sortOrder: row.sort_order,
    isSystem: row.is_system === 1,
    roles: parseRoles(row.roles),
  }));
}

export async function menuUpsert(menu: MenuInput) {
  const db = await getDatabase();
  db.run(`
    INSERT INTO menus (id, parent_id, label, icon, path, sort_order, is_system, roles)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      parent_id = excluded.parent_id,
      label = excluded.label,
      icon = excluded.icon,
      path = excluded.path,
      sort_order = excluded.sort_order,
      roles = excluded.roles
  `, [
    menu.id,
    normalizeParentId(menu.parentId),
    menu.label,
    menu.icon || null,
    menu.path || null,
    normalizeSortOrder(menu.sortOrder),
    menu.isSystem ? 1 : 0,
    serializeRoles(menu.roles),
  ]);
  db.persist();
  return { success: true };
}

/**
 * 批量更新菜单的层级与排序（拖拽排序使用）。
 * 环检测在事务外完成；实际写入放进单个事务，失败整体回滚。
 */
export async function menuBatchUpdate(entries: MenuReorderEntry[]) {
  if (!Array.isArray(entries) || entries.length === 0) return { success: true };

  const db = await getDatabase();

  // 预演变更后的父级关系并检测环
  const parentMap = new Map<string, string | null>();
  const existingRows = db.all('SELECT id, parent_id FROM menus') as any[];
  for (const row of existingRows) {
    parentMap.set(row.id, normalizeParentId(row.parent_id));
  }
  for (const entry of entries) {
    parentMap.set(entry.id, normalizeParentId(entry.parentId));
  }
  for (const id of parentMap.keys()) {
    const visited = new Set<string>();
    let cursor: string | null = id;
    while (cursor) {
      if (visited.has(cursor)) {
        throw new Error('菜单层级出现循环引用，本次调整已取消');
      }
      visited.add(cursor);
      cursor = parentMap.get(cursor) ?? null;
    }
  }

  db.transaction(() => {
    for (const entry of entries) {
      db.run('UPDATE menus SET parent_id=?, sort_order=? WHERE id=?', [
        normalizeParentId(entry.parentId),
        normalizeSortOrder(entry.sortOrder),
        entry.id,
      ]);
    }
  });

  db.persist();
  return { success: true };
}

export async function menuDelete(id: string) {
  const db = await getDatabase();
  const menu = db.get('SELECT is_system FROM menus WHERE id=?', [id]) as any;
  if (menu && menu.is_system === 1) {
    throw new Error('系统内置菜单不允许删除');
  }
  // B3：外键级联删除（驱动已开启 PRAGMA foreign_keys=ON）。
  // 旧实现 `WHERE id=? OR parent_id=?` 只删一层，孙级成孤儿后
  // 被 buildMenuTree 兑底提升为根节点，表现为“被删菜单的孙辈出现在侧边栏根部”。
  db.run('DELETE FROM menus WHERE id=?', [id]);
  db.persist();
  return { success: true };
}

// ==================== 单据号规则 ====================

/** doc_rules 表的原始行（snake_case） */
interface DocRuleRow {
  id: string;
  code: string;
  name: string;
  prefix: string | null;
  date_type: string;
  seq_length: number;
  reset_policy: string;
  separator: string | null;
  enabled: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

const DOC_DATE_TYPES: DocDateType[] = ['none', 'yyyy', 'yyyyMM', 'yyyyMMdd'];
const DOC_RESET_POLICIES: DocResetPolicy[] = ['never', 'daily', 'monthly', 'yearly'];

/** snake_case 行 → camelCase 契约；异常枚举值静默归默认（老库脏数据防线）。
 * currentSeq 由 docRuleList 单独计算后传入（其它调用点传 null） */
function mapDocRuleRow(row: DocRuleRow, currentSeq: number | null = null): DocRuleRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    prefix: row.prefix ?? '',
    dateType: (DOC_DATE_TYPES as string[]).includes(row.date_type) ? (row.date_type as DocDateType) : 'none',
    seqLength: row.seq_length,
    resetPolicy: (DOC_RESET_POLICIES as string[]).includes(row.reset_policy)
      ? (row.reset_policy as DocResetPolicy)
      : 'never',
    separator: row.separator ?? '',
    enabled: row.enabled === 1,
    remark: row.remark ?? '',
    currentSeq,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function docRuleList(): Promise<DocRuleRecord[]> {
  const db = await getDatabase();
  const rows = db.all('SELECT * FROM doc_rules ORDER BY created_at DESC') as DocRuleRow[];
  // 一次性取全部计数行（规则表是配置表，量级极小，内存聚合比逐规则子查询简单）
  const counters = db.all('SELECT rule_code, reset_key, seq FROM doc_counters') as Array<{
    rule_code: string; reset_key: string; seq: number;
  }>;
  const now = new Date();
  const byCode = new Map<string, typeof counters>();
  for (const c of counters) {
    const list = byCode.get(c.rule_code) ?? [];
    list.push(c);
    byCode.set(c.rule_code, list);
  }
  // 每规则选一行作为「当前流水」：优先当前周期行（reset_key 相等），
  // 无则取最近使用过的周期行（reset_key 字典序最大；各周期键均为定长数字串，字典序即时间序）。
  // 语义：daily 规则昨天用过、今天还没取号 → 显示昨天的流水，而不是「未使用」。
  const pick = (row: DocRuleRow): number | null => {
    const list = byCode.get(row.code);
    if (!list || list.length === 0) return null;
    const active = resetKey(
      (DOC_RESET_POLICIES as string[]).includes(row.reset_policy) ? (row.reset_policy as DocResetPolicy) : 'never',
      now,
    );
    const chosen = list.find((c) => c.reset_key === active)
      ?? list.reduce((max, c) => (c.reset_key > max.reset_key ? c : max));
    return chosen.seq;
  };
  return rows.map((row) => mapDocRuleRow(row, pick(row)));
}

export async function docRuleUpsert(rule: DocRuleInput) {
  const db = await getDatabase();
  // 部分字段更新防线：先读既有行合并，未传字段保持原值。
  // 历史缺陷：只传 { id, code, name, enabled } 时 prefix 等会被默认值覆盖清空
  // （页面全量传参掩盖了它，HTTP 直调/脚本暴露）
  const existing = db.get('SELECT * FROM doc_rules WHERE id=?', [rule.id]) as DocRuleRow | undefined;
  const merged = {
    prefix: rule.prefix !== undefined ? rule.prefix : existing?.prefix ?? '',
    dateType: rule.dateType ?? existing?.date_type ?? 'none',
    seqLength: rule.seqLength ?? existing?.seq_length ?? 4,
    resetPolicy: rule.resetPolicy ?? existing?.reset_policy ?? 'never',
    separator: rule.separator !== undefined ? rule.separator : existing?.separator ?? '',
    // undefined：已有行保持原状态，新行默认启用；显式 false 才停用
    enabled: rule.enabled === undefined ? (existing ? existing.enabled === 1 : true) : rule.enabled,
    remark: rule.remark !== undefined ? rule.remark : existing?.remark ?? '',
  };

  // 入参校验放 service 层：渲染端可绕过（HTTP 直调），这里是最后防线
  const error = validateDocRule({
    code: rule.code,
    name: rule.name,
    seqLength: merged.seqLength,
    prefix: merged.prefix,
    separator: merged.separator,
  });
  if (error) throw new Error(error);

  const now = new Date().toISOString();
  db.run(`
    INSERT INTO doc_rules (id, code, name, prefix, date_type, seq_length, reset_policy, separator, enabled, remark, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code, name = excluded.name, prefix = excluded.prefix,
      date_type = excluded.date_type, seq_length = excluded.seq_length,
      reset_policy = excluded.reset_policy, separator = excluded.separator,
      enabled = excluded.enabled, remark = excluded.remark, updated_at = excluded.updated_at
  `, [
    rule.id,
    rule.code,
    rule.name,
    merged.prefix,
    merged.dateType,
    merged.seqLength,
    merged.resetPolicy,
    merged.separator,
    merged.enabled ? 1 : 0,
    merged.remark,
    now, now,
  ]);
  db.persist();
  return { success: true };
}

export async function docRuleDelete(id: string) {
  const db = await getDatabase();
  const rule = db.get('SELECT code FROM doc_rules WHERE id=?', [id]) as { code: string } | null;
  db.transaction(() => {
    db.run('DELETE FROM doc_rules WHERE id=?', [id]);
    // 计数是规则的状态而非配置：规则删除即一并清理，避免同 code 重建后旧计数复活
    if (rule) db.run('DELETE FROM doc_counters WHERE rule_code=?', [rule.code]);
  });
  db.persist();
  return { success: true };
}

/**
 * 取下一个单据号：定位规则 → 计算周期键 → 事务内计数 +1 → 组装返回。
 * 必须在单个事务里：Electron 窗口（IPC）与浏览器调试（Dev API）可能同时取号，
 * 事务把「读-改-写」串行化，保证不发出重复的号。
 * 跨周期（如跨天）自动落到新的 reset_key 上、从 1 重新计数——无需任何定时任务。
 */
export async function docNextNumber(code: string): Promise<string> {
  const db = await getDatabase();
  const row = db.get('SELECT * FROM doc_rules WHERE code=?', [code]) as DocRuleRow | null;
  if (!row) throw new Error(`单据规则不存在：${code}`);
  if (row.enabled !== 1) throw new Error(`单据规则已停用：${code}`);

  const rule = mapDocRuleRow(row);
  const now = new Date();
  const key = resetKey(rule.resetPolicy, now);
  let next = '';

  db.transaction(() => {
    // UPSERT 起步行（首次取号/新周期）：已存在则什么都不做。
    // 三连（INSERT DO NOTHING → UPDATE +1 → SELECT）在事务内是取号标准姿势：
    // 首次与后续走同一路径，无需「先 SELECT 判断存在」的分支。
    // transaction 包装不保证透传回调返回值，用闭包变量带出结果。
    db.run(`
      INSERT INTO doc_counters (rule_code, reset_key, seq) VALUES (?, ?, 0)
      ON CONFLICT(rule_code, reset_key) DO NOTHING
    `, [rule.code, key]);
    db.run('UPDATE doc_counters SET seq = seq + 1 WHERE rule_code=? AND reset_key=?', [rule.code, key]);
    const counter = db.get('SELECT seq FROM doc_counters WHERE rule_code=? AND reset_key=?', [rule.code, key]) as { seq: number };
    next = buildDocNumber(rule, counter.seq, now);
  });
  db.persist();
  return next;
}

// ==================== 文件管理 ====================

/** files 表的原始行（snake_case） */
interface FileRow {
  id: string;
  name: string;
  stored_name: string;
  storage: string;
  size: number;
  mime: string;
  path: string;
  uploaded_by: string;
  created_at: string;
  dir_id: string | null;
}

/** file_config 表的原始行（单行表，id 恒为 1） */
interface FileConfigRow {
  active_storage: string;
  local_dir: string;
  ftp_host: string;
  ftp_port: number;
  ftp_user: string;
  ftp_password: string;
  ftp_root: string;
  ftp_secure: number;
}

/** file_dirs 表的原始行 */
interface FileDirRow {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

/** 目录树节点（service 内部中间结构：与渲染端 buildMenuTree 同构的递归组装） */
interface DirTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  fileCount: number;
  children: DirTreeNode[];
}

/** dirId 及其全部子孙目录 id（含自身）：用于「选中目录看含子目录文件」与空目录校验 */
function dirSubtreeIds(dirs: FileDirRow[], dirId: string): Set<string> {
  const ids = new Set<string>([dirId]);
  // 自底向上把子孙排前面不可能（无深度信息），直接循环到不动点：把 parent 在集合里的目录收进来
  let changed = true;
  while (changed) {
    changed = false;
    for (const dir of dirs) {
      if (dir.parent_id && ids.has(dir.parent_id) && !ids.has(dir.id)) {
        ids.add(dir.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** 目录名清洗：与文件名同规则（去 Windows 非法字符/控制字符/穿越段）。
 * 逻辑目录不落盘，但名字会进 DB 与 UI，清洗可防注入性展示与后续物理化时的穿越 */
function sanitizeDirName(name: string): string {
  return sanitizeFileName(name);
}

export async function fileDirList(): Promise<FileDirRecord[]> {
  const db = await getDatabase();
  const dirs = db.all('SELECT * FROM file_dirs ORDER BY created_at') as FileDirRow[];
  const files = db.all('SELECT dir_id FROM files') as Array<{ dir_id: string | null }>;
  // dirId → 文件计数（不含子目录）：后续算 fileCount 时按子树累加
  const countByDir = new Map<string, number>();
  for (const f of files) {
    if (f.dir_id) countByDir.set(f.dir_id, (countByDir.get(f.dir_id) ?? 0) + 1);
  }

  // 递归组装树 + 子树文件数累加
  const build = (parentId: string | null): DirTreeNode[] =>
    dirs
      .filter((d) => d.parent_id === parentId)
      .map((d) => {
        const children = build(d.id);
        return {
          id: d.id,
          parentId: d.parent_id,
          name: d.name,
          createdAt: d.created_at,
          fileCount: (countByDir.get(d.id) ?? 0) + children.reduce((sum, c) => sum + c.fileCount, 0),
          children,
        };
      });

  // 出口扁平化：DFS 序（父在子前），渲染端可直接逐行渲染并按深度缩进
  const out: FileDirRecord[] = [];
  const walk = (nodes: DirTreeNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ id: n.id, parentId: n.parentId, name: n.name, createdAt: n.createdAt, fileCount: n.fileCount });
      walk(n.children, depth + 1);
    }
  };
  walk(build(null), 0);
  return out;
}

export async function fileDirCreate(input: FileDirInput): Promise<FileDirRecord> {
  const db = await getDatabase();
  const name = sanitizeDirName(input?.name ?? '');
  if (!name) throw new Error('目录名不能为空');
  if (name.length > 50) throw new Error('目录名过长（清洗后超过 50 字符）');

  const parentId = input?.parentId ?? null;
  if (parentId) {
    const parent = db.get('SELECT id FROM file_dirs WHERE id = ?', [parentId]);
    if (!parent) throw new Error('父目录不存在（可能已被删除），请刷新后重试');
  }

  const now = new Date();
  const id = `dir-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  db.run('INSERT INTO file_dirs (id, parent_id, name, created_at) VALUES (?, ?, ?, ?)',
    [id, parentId, name, now.toISOString()]);
  db.persist();
  return { id, parentId, name, createdAt: now.toISOString(), fileCount: 0 };
}

export async function fileDirDelete(id: string): Promise<{ success: boolean }> {
  if (!id) throw new Error('目录 id 不能为空');
  const db = await getDatabase();
  const dirs = db.all('SELECT * FROM file_dirs') as FileDirRow[];
  const target = dirs.find((d) => d.id === id);
  if (!target) throw new Error('目录不存在（可能已被删除），请刷新后重试');

  // 只允许删空目录：有子目录或有文件（含子目录内的）都拒绝
  const subtree = dirSubtreeIds(dirs, id);
  const hasChildDir = dirs.some((d) => d.parent_id === id);
  if (hasChildDir) throw new Error('目录下存在子目录，请先删除子目录');
  const placeholders = Array.from(subtree).map(() => '?').join(',');
  const fileCount = (db.get(`SELECT COUNT(*) AS c FROM files WHERE dir_id IN (${placeholders})`, Array.from(subtree)) as { c: number }).c;
  if (fileCount > 0) throw new Error('目录下存在文件，请先删除或移出文件');

  db.run('DELETE FROM file_dirs WHERE id = ?', [id]);
  db.persist();
  return { success: true };
}

function mapFileRow(row: FileRow, cfg: FileConfigRow): FileRecord {
  const storage: FileStorage = row.storage === 'ftp' ? 'ftp' : 'local';
  return {
    id: row.id,
    name: row.name,
    storedName: row.stored_name,
    storage,
    size: row.size,
    mime: row.mime ?? '',
    path: row.path ?? '',
    uploadedBy: row.uploaded_by ?? '',
    createdAt: row.created_at,
    dirId: row.dir_id ?? null,
    fullPath: fileFullPath(cfg, storage, row.path ?? '', row.stored_name),
  };
}

/** 出口刻意不携带 ftp_password（只写不读）：配置查询返回给渲染端/HTTP 均不含明文 */
function mapFileConfigRow(row: FileConfigRow): FileConfigRecord {
  return {
    activeStorage: row.active_storage === 'ftp' ? 'ftp' : 'local',
    localDir: row.local_dir ?? '',
    ftpHost: row.ftp_host ?? '',
    ftpPort: row.ftp_port ?? 21,
    ftpUser: row.ftp_user ?? '',
    ftpRoot: row.ftp_root ?? '',
    ftpSecure: row.ftp_secure === 1,
  };
}

async function loadFileConfigRow(db: Awaited<ReturnType<typeof getDatabase>>): Promise<FileConfigRow> {
  const row = db.get('SELECT * FROM file_config WHERE id=1') as FileConfigRow | undefined;
  // 迁移 v6 保证单行存在；防御性兑底：极端情况下也能给出可用默认值
  return row ?? { active_storage: 'local', local_dir: '', ftp_host: '', ftp_port: 21, ftp_user: '', ftp_password: '', ftp_root: '', ftp_secure: 0 };
}

/** LOCAL 存储根：配置了绝对目录则用之，空则默认 userData/files */
function resolveLocalRoot(localDir: string): string {
  return localDir.trim() ? localDir : nodePath.join(app.getPath('userData'), 'files');
}

/** LOCAL 物理文件绝对路径（记录的 path/storedName 均由服务端生成，拼接是安全的） */
function localAbsolutePath(localDir: string, relDir: string, storedName: string): string {
  return nodePath.join(resolveLocalRoot(localDir), relDir, storedName);
}

/** 由配置行构造 FTP 连接参数 */
function toFtpConfig(row: FileConfigRow): FtpConnectionConfig {
  return { host: row.ftp_host, port: row.ftp_port, user: row.ftp_user, password: row.ftp_password, secure: row.ftp_secure === 1, root: row.ftp_root };
}

/** 展示用完整路径（按当前存储配置解析）：local = 磁盘绝对路径；ftp = ftp://host:port/远端路径。
 * 注意：配置变更后旧文件不迁移，此字段是「当前配置视角」的定位参考 */
function fileFullPath(cfg: FileConfigRow, storage: FileStorage, relDir: string, storedName: string): string {
  if (storage === 'ftp') {
    const remote = joinRemote(cfg.ftp_root, relDir, storedName);
    return cfg.ftp_host ? `ftp://${cfg.ftp_host}:${cfg.ftp_port}/${remote}` : remote;
  }
  return localAbsolutePath(cfg.local_dir, relDir, storedName);
}

export async function fileList(): Promise<FileRecord[]> {
  const db = await getDatabase();
  const cfg = await loadFileConfigRow(db);
  const rows = db.all('SELECT * FROM files ORDER BY created_at DESC') as FileRow[];
  return rows.map((row) => mapFileRow(row, cfg));
}

export async function fileConfigGet(): Promise<FileConfigRecord> {
  const db = await getDatabase();
  return mapFileConfigRow(await loadFileConfigRow(db));
}

export async function fileConfigSave(input: FileConfigInput) {
  const db = await getDatabase();
  // 吸取 docRuleUpsert 教训：先读既有行合并，未传字段保持原值；
  // ftpPassword 缺省 = 不改密码（与「只写不读」配套：改密码后出口不回显）
  const existing = await loadFileConfigRow(db);
  const merged = {
    activeStorage: input.activeStorage ?? (existing.active_storage === 'ftp' ? 'ftp' : 'local'),
    localDir: input.localDir !== undefined ? input.localDir : existing.local_dir,
    ftpHost: input.ftpHost !== undefined ? input.ftpHost : existing.ftp_host,
    ftpPort: input.ftpPort !== undefined ? input.ftpPort : existing.ftp_port,
    ftpUser: input.ftpUser !== undefined ? input.ftpUser : existing.ftp_user,
    ftpPassword: input.ftpPassword !== undefined ? input.ftpPassword : existing.ftp_password,
    ftpRoot: input.ftpRoot !== undefined ? input.ftpRoot : existing.ftp_root,
    ftpSecure: input.ftpSecure !== undefined ? input.ftpSecure : existing.ftp_secure === 1,
  };
  if (merged.activeStorage !== 'local' && merged.activeStorage !== 'ftp') {
    throw new Error('存储类型只能是 local 或 ftp');
  }
  if (typeof merged.ftpPort !== 'number' || merged.ftpPort < 1 || merged.ftpPort > 65535 || !Number.isInteger(merged.ftpPort)) {
    throw new Error('FTP 端口需为 1-65535 的整数');
  }
  // 切到 ftp 时前置校验主机：保存时就把配置缺口暴露出来，而不是等首次上传才半路失败
  if (merged.activeStorage === 'ftp' && !merged.ftpHost.trim()) {
    throw new Error('切换到 FTP 前请先填写主机地址');
  }

  db.run(`
    UPDATE file_config SET active_storage=?, local_dir=?, ftp_host=?, ftp_port=?, ftp_user=?, ftp_password=?, ftp_root=?, ftp_secure=?
    WHERE id=1
  `, [
    merged.activeStorage,
    merged.localDir,
    merged.ftpHost,
    merged.ftpPort,
    merged.ftpUser,
    merged.ftpPassword,
    merged.ftpRoot,
    merged.ftpSecure ? 1 : 0,
  ]);
  db.persist();
  return { success: true };
}

/** 上传：写物理文件（LOCAL/FTP 由配置决定）+ 插记录。
 * 二进制由调用通路解码为 Uint8Array 后传入（IPC 直传，HTTP 由 base64 解码） */
export async function fileUpload(meta: FileUploadMeta, data: Uint8Array): Promise<FileRecord> {
  const db = await getDatabase();
  const cfg = await loadFileConfigRow(db);
  const storage: FileStorage = cfg.active_storage === 'ftp' ? 'ftp' : 'local';

  // 入参校验放 service 层：渲染端可绕过（HTTP 直调），这里是最后防线
  const error = validateFileUpload(meta.name, data.byteLength);
  if (error) throw new Error(error);

  // 目标目录存在性校验：目录被并发删除时上传拒绝而非静默落「未分组」
  const dirId = meta.dirId?.trim() ? meta.dirId.trim() : null;
  if (dirId) {
    const dir = db.get('SELECT id FROM file_dirs WHERE id = ?', [dirId]);
    if (!dir) throw new Error('目标目录不存在（可能已被删除），请刷新后重试');
  }

  const now = new Date();
  const storedName = buildStoredName(meta.name, now);
  const relDir = buildRelativeDir(now);
  const record: FileRecord = {
    id: `file-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    name: sanitizeFileName(meta.name),
    storedName,
    storage,
    size: data.byteLength,
    mime: meta.mime ?? '',
    path: relDir,
    uploadedBy: meta.uploadedBy ?? '',
    createdAt: now.toISOString(),
    dirId,
    fullPath: fileFullPath(cfg, storage, relDir, storedName),
  };

  if (storage === 'ftp') {
    if (!cfg.ftp_host) throw new Error('FTP 存储未配置主机地址，请先在存储设置中完善');
    await ftpPut(toFtpConfig(cfg), relDir, storedName, data);
  } else {
    const abs = localAbsolutePath(cfg.local_dir, relDir, storedName);
    await fsp.mkdir(nodePath.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, data);
  }

  db.run(`
    INSERT INTO files (id, name, stored_name, storage, size, mime, path, uploaded_by, created_at, dir_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [record.id, record.name, record.storedName, record.storage, record.size, record.mime, record.path, record.uploadedBy, record.createdAt, record.dirId]);
  db.persist();
  return record;
}

/** 删除（单条/批量统一入口：单条即长度 1 的数组）。
 * 策略：物理文件尽力删除（失败记日志不阻塞——文件可能已被外部移动/删除），
 * 记录必删（DB 是唯一权威，否则无入口重试）。返回实际删除的记录数 */
export async function fileDelete(ids: string[]): Promise<{ deleted: number }> {
  if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0 };
  const db = await getDatabase();
  const cfg = await loadFileConfigRow(db);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.all(`SELECT * FROM files WHERE id IN (${placeholders})`, ids) as FileRow[];
  if (rows.length === 0) return { deleted: 0 };

  // 物理删除（尽力而为）：LOCAL 文件不存在视作已清理；FTP 网络失败也不阻塞记录删除
  for (const row of rows) {
    try {
      if (row.storage === 'ftp') {
        if (cfg.ftp_host) await ftpRemove(toFtpConfig(cfg), row.path, row.stored_name);
      } else {
        await fsp.unlink(localAbsolutePath(cfg.local_dir, row.path, row.stored_name)).catch((err: NodeJS.ErrnoException) => {
          // ENOENT：文件已不在磁盘（被外部清理）——正好，记录删除后两者就一致了
          if (err.code !== 'ENOENT') throw err;
        });
      }
    } catch (err) {
      logger.warn(`[File] 物理文件删除失败（记录仍将删除）: ${row.stored_name}`, err);
    }
  }

  const rowIds = rows.map((r) => r.id);
  db.transaction(() => {
    db.run(`DELETE FROM files WHERE id IN (${placeholders})`, rowIds);
  });
  db.persist();
  return { deleted: rows.length };
}

/** 目标目录内不重名：存在则 `名字 (n).ext` 递增，绝不覆盖已有文件 */
async function uniqueDestPath(dir: string, name: string): Promise<string> {
  const ext = nodePath.extname(name);
  const base = nodePath.basename(name, ext);
  for (let i = 0; ; i += 1) {
    const candidate = i === 0 ? name : `${base} (${i})${ext}`;
    const abs = nodePath.join(dir, candidate);
    try {
      await fsp.access(abs); // 存在 → 继续尝试下一个序号
    } catch {
      return abs; // 不存在 → 可用
    }
  }
}

/** 下载（单条/批量统一入口：单条即长度 1 的数组）：从存储（LOCAL/FTP）读出并写入用户指定目录。
 * 与删除相反——下载要的是内容，单文件失败必须报出来，但不阻塞其余文件（逐条收集 failed）。
 * 目标文件名用原始展示名（而非存储名），重名自动加 (n) 序号，绝不覆盖已有文件 */
export async function fileSaveTo(ids: string[], targetDir: string): Promise<FileSaveResult> {
  if (!Array.isArray(ids) || ids.length === 0) return { saved: 0, failed: [] };
  if (!targetDir || !targetDir.trim()) throw new Error('请先选择下载目录');
  const db = await getDatabase();
  const cfg = await loadFileConfigRow(db);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.all(`SELECT * FROM files WHERE id IN (${placeholders})`, ids) as FileRow[];

  let saved = 0;
  const failed: FileSaveFailure[] = [];
  for (const row of rows) {
    try {
      const data = row.storage === 'ftp'
        ? await ftpDownload(toFtpConfig(cfg), row.path, row.stored_name)
        : await fsp.readFile(localAbsolutePath(cfg.local_dir, row.path, row.stored_name));
      const dest = await uniqueDestPath(targetDir, row.name);
      await fsp.writeFile(dest, data);
      saved += 1;
    } catch (err) {
      failed.push({ name: row.name, reason: err instanceof Error ? err.message : '读取失败' });
      logger.warn(`[File] 下载失败: ${row.stored_name}`, err);
    }
  }
  return { saved, failed };
}
