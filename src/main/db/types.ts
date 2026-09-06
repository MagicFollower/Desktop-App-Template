/**
 * 主进程 SQLite 驱动统一契约。
 *
 * 目的：把 service 层与具体 SQLite 实现解耦，让同一套业务代码可以在两种驱动间切换：
 * - sql.js（默认）：纯 WASM，免编译，跨 Electron 版本稳定，但全内存、需手动 persist。
 * - better-sqlite3（可选）：原生模块，性能更好、直接落盘，但需与 Electron 的 Node ABI 匹配
 *   （装不了/编译不了时会由上层自动回退到 sql.js）。
 *
 * service 层只依赖本接口，不再 import 任何具体驱动。
 */
export interface SqlDriver {
  /** 查询多行；params 为位置参数（对应 SQL 中的 ?） */
  all<T = any>(sql: string, params?: unknown[]): T[];
  /** 查询单行，无结果返回 null */
  get<T = any>(sql: string, params?: unknown[]): T | null;
  /** 执行单条写语句（INSERT/UPDATE/DELETE） */
  run(sql: string, params?: unknown[]): void;
  /** 执行原始语句脚本（可含多条建表语句） */
  exec(sql: string): void;
  /** 在一个事务中执行 fn；fn 抛错则整体回滚并向上抛出 */
  transaction<T>(fn: () => T): T;
  /**
   * 把改动持久化到磁盘文件。
   * sql.js 必须显式导出快照（否则重启丢数据）；better-sqlite3 直接写盘，此方法为空操作。
   * 约定：service 层每个写函数执行完都必须调用 persist()。
   */
  persist(): void;
  /** 关闭底层连接/实例（sql.js 会先 persist 再关闭） */
  close(): void;
}

/** 支持的驱动标识 */
export type SqlDriverKind = 'sqljs' | 'better';
