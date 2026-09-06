import fs from 'fs';
import path from 'path';
import type { SqlDriver } from './types';

/**
 * better-sqlite3 驱动（可选，性能更优）。
 *
 * 原生模块：二进制必须与 Electron 内置 Node 的 ABI 匹配，否则加载即崩溃
 * （参见 doc/SQLite数据库路径配置与Native Module问题.md）。因此这里用 `require` 懒加载：
 * - 未安装或 ABI 不符时 require 抛错，由 database.ts 捕获并自动回退到 sql.js；
 * - 只要不开启 DB_DRIVER=better，本文件不会被真正加载依赖，不影响现有 sql.js 方案。
 *
 * better-sqlite3 直接操作磁盘文件（WAL），故 persist() 为空操作。
 */
export function createBetterSqlite3Driver(dbPath: string): SqlDriver {
  // 懒加载：若模块不存在会在此抛出，交由上层回退
  const BetterSqlite3 = require('better-sqlite3');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  // 开启外键约束（B3）：SQLite 默认关闭，不开则 ON DELETE CASCADE 形同虚设
  db.pragma('foreign_keys = ON');

  return {
    all<T = any>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params);
    },
    get<T = any>(sql: string, params: unknown[] = []): T | null {
      const row = db.prepare(sql).get(...params);
      return row === undefined ? null : (row as T);
    },
    run(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(...params);
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      // better-sqlite3 原生事务：fn 抛错自动回滚，成功自动提交
      return db.transaction(fn)();
    },
    persist(): void {
      // 文件型数据库写操作即时落盘，无需导出
    },
    close(): void {
      db.close();
    },
  };
}
