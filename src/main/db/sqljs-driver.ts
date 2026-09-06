import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import type { SqlDriver } from './types';
import { logger } from '../logger';

/**
 * sql.js 驱动（默认）。
 *
 * sql.js 是「全内存」SQLite：读写只作用于内存镜像，必须显式 `db.export()` 写文件才落盘。
 * 因此本驱动的 run/exec/transaction 之后都要靠 persist() 才持久化；close() 也会先落盘。
 *
 * @param dbPath   app-data.db 磁盘路径
 * @param wasmPath sql-wasm.wasm 的绝对路径（由 require.resolve 提供）
 */
export async function createSqlJsDriver(dbPath: string, wasmPath: string): Promise<SqlDriver> {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  let initial: Uint8Array | undefined;
  if (fs.existsSync(dbPath)) {
    initial = new Uint8Array(fs.readFileSync(dbPath));
    logger.info('[DB/sql.js] Loading existing database file');
  } else {
    logger.info('[DB/sql.js] Creating new database file');
  }

  const db: SqlJsDatabase = new SQL.Database(initial);

  // 开启外键约束（B3）：SQLite 默认关闭，不开则 ON DELETE CASCADE 形同虚设。
  // 注意 foreign_keys 是连接级开关、不可在事务内执行，放初始化处。
  db.run('PRAGMA foreign_keys = ON');

  function all<T = any>(sql: string, params: unknown[] = []): T[] {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params as any);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  function persist(): void {
    try {
      fs.writeFileSync(dbPath, Buffer.from(db.export()));
      // 每次写操作都会 persist，成功不打日志（高频，会刷爆日志文件），只记失败
    } catch (err) {
      logger.error('[DB/sql.js] Failed to save database:', err);
    }
  }

  return {
    all,
    get<T = any>(sql: string, params: unknown[] = []): T | null {
      const rows = all<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },
    run(sql: string, params: unknown[] = []): void {
      db.run(sql, params as any);
    },
    exec(sql: string): void {
      db.run(sql);
    },
    transaction<T>(fn: () => T): T {
      db.run('BEGIN TRANSACTION');
      try {
        const result = fn();
        db.run('COMMIT');
        return result;
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
    },
    persist,
    close(): void {
      persist();
      db.close();
    },
  };
}
