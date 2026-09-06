/**
 * 跨进程数据契约（DTO）——单一类型源（A2）。
 *
 * 渲染层（pages/services/preload 声明）与主进程（service/ipc/preload 实现）
 * 全部从本文件引用同一套类型，消除旧实现中 service/preload/electron.d.ts
 * 三层 any 泛滥的问题：字段改名、漏传字段在编译期即可发现。
 *
 * 约定（A5）：
 * - 数据库行（snake_case）不出 service 层，出口一律映射为本文件的 camelCase 契约；
 * - 契约字段除标注外均必填——服务端负责补默认值，客户端不再到处 ?? '' 兜底。
 */

export type UserRole = 'admin' | 'manager' | 'user';
export type UserStatus = 'active' | 'disabled';

/** 用户记录：userList / authLogin 的返回（与渲染端 UserInfo 结构兼容） */
export interface UserRecord {
  id: string;
  username: string;
  /** 用户编码（用户账号）：由单据号规则 USER 自动生成，永不变更 */
  userCode: string;
  email: string;
  phone: string;
  avatar: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

/** 用户保存入参（新增/更新共用；id/createdAt 由客户端生成，服务端兑底）。
 * 注意无 userCode：用户编码由服务端在 userCreate 时经单据号规则 USER 生成，
 * 不接受客户端传入（可编辑的编码会被伪造/冲突） */
export interface UserInput {
  id: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  nickname?: string;
  role?: UserRole;
  status?: UserStatus;
  createdAt?: string;
}

/** 个人资料更新入参（按 username UPSERT，字段缺省保留原值） */
export interface ProfilePatch {
  username: string;
  nickname?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

/** 菜单记录：menuList 返回的扁平 camelCase 列表（树形构建在渲染端完成） */
export interface MenuRecord {
  id: string;
  parentId: string | null;
  label: string;
  icon: string | null;
  path: string | null;
  sortOrder: number;
  isSystem: boolean;
  /** 可见角色列表（A3）：空 = 所有角色可见；树形渲染前由渲染层按当前用户角色过滤 */
  roles?: string[];
}

/** 菜单保存入参（扁平结构，不含 children） */
export interface MenuInput {
  id: string;
  parentId?: string | null;
  label: string;
  icon?: string;
  path?: string | null;
  sortOrder?: number;
  isSystem?: boolean;
  roles?: string[];
}

/** 菜单拖拽排序的批量更新入参 */
export interface MenuReorderEntry {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

// ==================== 单据号规则 ====================

/** 日期段格式：none=无日期段 */
export type DocDateType = 'none' | 'yyyy' | 'yyyyMM' | 'yyyyMMdd';
/** 流水号重置周期：never=永不重置 */
export type DocResetPolicy = 'never' | 'daily' | 'monthly' | 'yearly';

/** 单据号规则记录：docRuleList 的返回 */
export interface DocRuleRecord {
  id: string;
  code: string;
  name: string;
  prefix: string;
  dateType: DocDateType;
  seqLength: number;
  resetPolicy: DocResetPolicy;
  separator: string;
  enabled: boolean;
  remark: string;
  /** 当前最近被使用的流水值：优先当前周期行，无则取最近使用过的周期行；null = 从未取号 */
  currentSeq: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 单据号规则保存入参（新增/更新共用；updatedAt 由服务端维护） */
export interface DocRuleInput {
  id: string;
  code: string;
  name: string;
  prefix?: string;
  dateType?: DocDateType;
  seqLength?: number;
  resetPolicy?: DocResetPolicy;
  separator?: string;
  enabled?: boolean;
  remark?: string;
}

// ==================== 文件管理 ====================

/** 存储后端：本地磁盘 / FTP 服务器 */
export type FileStorage = 'local' | 'ftp';

/** 逻辑目录：纯组织层（不落盘，物理文件仍按 yyyy/MM 分桶）；树由 parentId 递归构成，根为 null */
export interface FileDirRecord {
  id: string;
  /** 父目录 id；null = 根目录 */
  parentId: string | null;
  name: string;
  createdAt: string;
  /** 所属文件数（含子目录内的；仅 fileDirList 出口携带，其余场景可推导不进契约） */
  fileCount: number;
}

/** 新增目录入参：parentId=null 表示建在根下 */
export interface FileDirInput {
  parentId: string | null;
  name: string;
}

/** 上传文件记录：fileList 的返回 */
export interface FileRecord {
  id: string;
  /** 原始文件名（用户选择时的名字，含扩展名） */
  name: string;
  /** 服务端重命名后的存储名（防同名覆盖与路径穿越） */
  storedName: string;
  storage: FileStorage;
  /** 字节数 */
  size: number;
  mime: string;
  /** 相对目录（yyyy/MM/），不含文件名；物理根由存储配置决定 */
  path: string;
  uploadedBy: string;
  createdAt: string;
  /** 所属逻辑目录 id；null = 未分组 */
  dirId: string | null;
  /** 展示用完整路径（按当前存储配置解析）：local = 磁盘绝对路径；ftp = ftp://host:port/远端路径。
   * 注意：配置变更后旧文件的物理位置不迁移，此字段是「当前配置视角」的定位参考 */
  fullPath: string;
}

/** 存储配置：fileConfigGet 的返回。
 * 刻意不含 ftpPassword —— 密码只写不读：
 * 渲染端不回显明文，HTTP 通路也不将其下发 */
export interface FileConfigRecord {
  activeStorage: FileStorage;
  /** LOCAL 存储根目录；空串 = 默认 userData/files */
  localDir: string;
  ftpHost: string;
  ftpPort: number;
  ftpUser: string;
  ftpRoot: string;
  ftpSecure: boolean;
}

/** 存储配置保存入参（字段缺省保留原值；ftpPassword 缺省 = 不改密码） */
export interface FileConfigInput {
  activeStorage?: FileStorage;
  localDir?: string;
  ftpHost?: string;
  ftpPort?: number;
  ftpUser?: string;
  /** 只写不读：保存后任何出口不再返回 */
  ftpPassword?: string;
  ftpRoot?: string;
  ftpSecure?: boolean;
}

/** 上传入参的公共部分（二进制数据由各通路自行编码：IPC 传 Uint8Array，HTTP 传 base64） */
export interface FileUploadMeta {
  name: string;
  mime: string;
  /** 上传者 username（记录归属；渲染端取自登录态） */
  uploadedBy?: string;
  /** 目标逻辑目录 id：缺省/空串/null = 未分组 */
  dirId?: string | null;
}

/** 下载到本地目录的单文件失败明细 */
export interface FileSaveFailure {
  /** 文件展示名 */
  name: string;
  /** 失败原因（物理文件不存在/网络错误等） */
  reason: string;
}

/** 下载到本地目录的结果：单文件失败不阻塞其余，逐条收集 */
export interface FileSaveResult {
  saved: number;
  failed: FileSaveFailure[];
}
