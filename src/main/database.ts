import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';
import type { SqlDriver, SqlDriverKind } from './db/types';
import { createSqlJsDriver } from './db/sqljs-driver';
import { createBetterSqlite3Driver } from './db/better-sqlite3-driver';
import { applySchemaAndSeed } from './db/schema';
import { logger } from './logger';

/**
 * 数据库目录：
 * - 打包后（app.isPackaged）：用 app.getPath('userData')（Windows 下即 %APPDATA%\<应用名>）。
 *   原因：打包资源在只读的 app.asar 内，且安装目录常在 Program Files（普通用户无写权限）；
 *   userData 用户可写、随应用升级保留，是桌面端持久化数据的标准位置。
 * - 开发态：仍用项目根目录（app.getAppPath()），便于直接用 IDE / SQLite 工具查看 app-data.db。
 */
const DB_DIR = app.isPackaged ? app.getPath('userData') : app.getAppPath();

// 确保目录存在（userData 一般已由 Electron 创建，这里对自定义/子目录场景兜底）
fs.mkdirSync(DB_DIR, { recursive: true });

// 数据库文件路径
const DB_PATH = join(DB_DIR, 'app-data.db');

// sql.js WASM 文件路径
const WASM_PATH = require.resolve('sql.js/dist/sql-wasm.wasm');

let driver: SqlDriver | null = null;
let initError: Error | null = null;

/** 解析期望驱动：环境变量 DB_DRIVER，默认 sql.js。取值 better / better-sqlite3 时启用原生模块 */
function resolveRequestedDriver(): SqlDriverKind {
  const raw = (process.env.DB_DRIVER || 'sqljs').trim().toLowerCase();
  return raw === 'better' || raw === 'better-sqlite3' ? 'better' : 'sqljs';
}

/**
 * 按配置创建驱动实例。
 * 选择 better-sqlite3 时若原生模块缺失 / ABI 不符，打印告警并回退到 sql.js，
 * 保证应用在任何机器上都能启动（不因可选原生依赖而崩）。
 */
async function createDriver(): Promise<SqlDriver> {
  const requested = resolveRequestedDriver();

  if (requested === 'better') {
    try {
      const d = createBetterSqlite3Driver(DB_PATH);
      logger.info('[DB] Using better-sqlite3 driver, path:', DB_PATH);
      return d;
    } catch (err) {
      logger.error('[DB] better-sqlite3 unavailable (not installed / ABI mismatch?), falling back to sql.js:', err);
    }
  }

  logger.info('[DB] Using sql.js driver, path:', DB_PATH, '| WASM:', WASM_PATH);
  return createSqlJsDriver(DB_PATH, WASM_PATH);
}

/** 获取共享的数据库驱动单例；首次调用时初始化并建表、灌种子 */
export async function getDatabase(): Promise<SqlDriver> {
  if (driver) return driver;
  if (initError) throw initError;

  try {
    driver = await createDriver();
    applySchemaAndSeed(driver);
    // 首次把表结构与默认数据落盘（better-sqlite3 为内存级空操作，sql.js 真正写文件）
    driver.persist();
    logger.info('[DB] Database opened successfully');
  } catch (err) {
    driver = null;
    initError = err as Error;
    logger.error('[DB] Failed to open database:', err);
    throw err;
  }

  return driver;
}

/** 关闭数据库；sql.js 驱动会先把内存镜像落盘，作为优雅退出的兜底持久化 */
export function closeDatabase(): void {
  if (driver) {
    driver.close();
    driver = null;
  }
}
