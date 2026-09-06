import type { SqlDriver } from './types';
import { logger } from '../logger';

/**
 * 版本化迁移（A8）：以 PRAGMA user_version 记录 schema 版本，启动时按序执行未应用的迁移。
 * 替代旧的手写 PRAGMA table_info 补丁——后者靠 if 累积，三个版本后将不可维护。
 *
 * 规则：
 * - 每个 migration 的 up() 必须可安全重复执行（建表用 IF NOT EXISTS、种子用 INSERT OR IGNORE），
 *   因为版本号写入失败重试时会再次执行同一版本；
 * - 新表结构变更一律追加新版本，禁止回头修改历史 migration；
 * - 迁移 v1 内含默认种子数据：对旧库（版本化之前创建）只会补种一次，
 *   此后删除种子数据不会再随重启复活。
 */

interface Migration {
  version: number;
  description: string;
  up: (db: SqlDriver) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: '基础表结构（users/menus/user_profiles/passwords）+ 默认种子数据',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          avatar TEXT,
          nickname TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS menus (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          label TEXT NOT NULL,
          icon TEXT,
          path TEXT,
          sort_order INTEGER DEFAULT 0,
          is_system INTEGER DEFAULT 0,
          FOREIGN KEY (parent_id) REFERENCES menus(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          username TEXT PRIMARY KEY,
          nickname TEXT,
          email TEXT,
          phone TEXT,
          avatar TEXT,
          FOREIGN KEY (username) REFERENCES users(username)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS passwords (
          username TEXT PRIMARY KEY,
          hash TEXT NOT NULL
        )
      `);

      // 版本化之前旧库的手写迁移：为已存在的 menus 表补 is_system 列（幂等检查）
      const menuColumns = db.all('PRAGMA table_info(menus)') as Array<{ name: string }>;
      if (!menuColumns.some((col) => col.name === 'is_system')) {
        db.run('ALTER TABLE menus ADD COLUMN is_system INTEGER DEFAULT 0');
        logger.info('[DB Migration] v1: Added is_system column to menus table');
      }

      db.exec(`
        INSERT OR IGNORE INTO menus (id, parent_id, label, icon, path, sort_order, is_system) VALUES
          ('dashboard', NULL, '仪表盘', 'DashboardOutlined', '/', 0, 1),
          ('system', NULL, '系统管理', 'SettingOutlined', NULL, 1, 1),
          ('system-users', 'system', '人员管理', 'UserOutlined', '/system/users', 0, 1),
          ('system-profile', 'system', '个人信息', 'IdcardOutlined', '/system/profile', 1, 1),
          ('system-menus', 'system', '菜单管理', 'MenuOutlined', '/system/menus', 2, 1),
          ('tools', NULL, '工具模块', 'ToolOutlined', NULL, 2, 1),
          ('tools-files', 'tools', '文件管理', 'FolderOutlined', '/tools/files', 0, 1),
          ('tools-redis', 'tools', 'Redis 查询', 'DatabaseOutlined', '/tools/redis', 1, 1),
          ('tools-ftp', 'tools', 'FTP 查询', 'CloudServerOutlined', '/tools/ftp', 2, 1)
      `);

      db.exec(`
        INSERT OR IGNORE INTO passwords (username, hash) VALUES
          ('admin', '$2b$10$3RmDrVOAAnoZzUQeDn7cCeO8DTUHBhygJMQDZ.5kMi7YIgqglCPHy'),
          ('user', '$2b$10$t1ch6jO/yjVgz8zkBQwhkuLiqDqXQRb0/qoZH1jSiKmfCRB8by8wC')
      `);

      db.exec(`
        INSERT OR IGNORE INTO users (id, username, email, phone, avatar, nickname, role, status, created_at) VALUES
          ('1', 'admin', 'admin@example.com', NULL, NULL, NULL, 'admin', 'active', datetime('now')),
          ('2', 'user', 'user@example.com', NULL, NULL, NULL, 'user', 'active', datetime('now')),
          ('3', 'zhangsan', 'zhangsan@example.com', '13800138001', NULL, '张三', 'manager', 'active', datetime('now')),
          ('4', 'lisi', 'lisi@example.com', '13800138002', NULL, '李四', 'user', 'active', datetime('now')),
          ('5', 'wangwu', 'wangwu@example.com', '13800138003', NULL, '王五', 'user', 'disabled', datetime('now'))
      `);
    },
  },
  {
    version: 2,
    description: 'user_profiles 外键改为 ON DELETE/UPDATE CASCADE（配合驱动开启的 PRAGMA foreign_keys=ON）',
    up: (db) => {
      // v1 的外键无级联动作：开启 foreign_keys 后，删除用户会被 user_profiles 的外键阻拦报错，
      // 改名则直接违反外键约束。SQLite 无法 ALTER 外键，需建新表迁移数据。
      db.exec(`
        CREATE TABLE user_profiles_v2 (
          username TEXT PRIMARY KEY,
          nickname TEXT,
          email TEXT,
          phone TEXT,
          avatar TEXT,
          FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      // 只迁移仍指向真实用户的行：旧库中可能残留已删用户的孤儿 profile，此处顺带清理
      db.exec(`
        INSERT INTO user_profiles_v2 (username, nickname, email, phone, avatar)
        SELECT username, nickname, email, phone, avatar FROM user_profiles
        WHERE username IN (SELECT username FROM users)
      `);
      db.exec('DROP TABLE user_profiles');
      db.exec('ALTER TABLE user_profiles_v2 RENAME TO user_profiles');
    },
  },
  {
    version: 3,
    description: 'menus 增加 roles 列（角色可见性，A3）：空 = 所有角色可见',
    up: (db) => {
      // 幂等加列：新库（v1 建表时无 roles）与已应用过 v3 的库重复执行都安全
      const menuColumns = db.all('PRAGMA table_info(menus)') as Array<{ name: string }>;
      if (!menuColumns.some((col) => col.name === 'roles')) {
        db.run('ALTER TABLE menus ADD COLUMN roles TEXT');
      }
      // 种子：系统管理目录及其下的管理页限 admin（与 RequireRole 守卫一致），
      // 其余菜单不设限制（NULL = 所有角色可见）。UPDATE 无条件执行：幂等且可让
      // 旧库手动改过菜单后重新对齐内置权限。
      db.run(`
        UPDATE menus SET roles = 'admin'
        WHERE id IN ('system', 'system-users', 'system-menus')
      `);
    },
  },
  {
    version: 4,
    description: '单据号规则：doc_rules 规则表 + doc_counters 计数表 + 菜单种子',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS doc_rules (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          prefix TEXT DEFAULT '',
          date_type TEXT NOT NULL DEFAULT 'none',
          seq_length INTEGER NOT NULL DEFAULT 4,
          reset_policy TEXT NOT NULL DEFAULT 'never',
          separator TEXT DEFAULT '',
          enabled INTEGER NOT NULL DEFAULT 1,
          remark TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS doc_counters (
          rule_code TEXT NOT NULL,
          reset_key TEXT NOT NULL DEFAULT '',
          seq INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (rule_code, reset_key)
        )
      `);
      // 菜单种子：系统管理下的新入口（roles 限 admin，与迁移 v3 的兄弟菜单一致）。
      // is_system=1 防止在菜单管理页被误删；INSERT OR IGNORE 保证幂等。
      db.exec(`
        INSERT OR IGNORE INTO menus (id, parent_id, label, icon, path, sort_order, is_system, roles) VALUES
          ('system-doc-rules', 'system', '单据号规则', 'FileTextOutlined', '/system/doc-rules', 3, 1, 'admin')
      `);
    },
  },
  {
    version: 5,
    description: '用户编码：users 加 user_code 列（单据号规则 USER 自动生成）+ 回填 + USER 规则种子',
    up: (db) => {
      // 幂等加列：新库与重复执行都安全
      const userColumns = db.all('PRAGMA table_info(users)') as Array<{ name: string }>;
      if (!userColumns.some((col) => col.name === 'user_code')) {
        db.run('ALTER TABLE users ADD COLUMN user_code TEXT');
      }

      // 回填既有用户：按 created_at（同时间则按 id）稳定排序生成 U0001…；
      // 相关子查询模拟 row_number，教学场景下同毫秒同 id 前缀冲突可忽略
      db.run(`
        UPDATE users SET user_code = 'U' || printf('%04d', (
          SELECT COUNT(*) + 1 FROM users u2
          WHERE u2.created_at < users.created_at
             OR (u2.created_at = users.created_at AND u2.id < users.id)
        ))
        WHERE COALESCE(user_code, '') = ''
      `);

      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code)');

      // 预置用户编码规则：U + 4 位流水 + 永不重置（人员编码应全局唯一递增）
      db.exec(`
        INSERT OR IGNORE INTO doc_rules
          (id, code, name, prefix, date_type, seq_length, reset_policy, separator, enabled, remark, created_at, updated_at)
        VALUES
          ('doc-rule-user', 'USER', '用户编码', 'U', 'none', 4, 'never', '', 1, '人员管理新增用户时自动生成', datetime('now'), datetime('now'))
      `);
      // 计数与回填同步：下一个新用户从「已回填数 + 1」起号，
      // 否则首号 U0001 会与回填值撞 UNIQUE 索引
      db.exec(`
        INSERT OR IGNORE INTO doc_counters (rule_code, reset_key, seq)
        SELECT 'USER', '', COUNT(*) FROM users WHERE COALESCE(user_code, '') != ''
      `);
    },
  },
  {
    version: 6,
    description: '文件管理：files 上传记录表 + file_config 存储配置表（LOCAL/FTP 可配）',
    up: (db) => {
      // 上传记录：物理文件与记录一一对应；stored_name 为服务端重命名后的存储名
      // （防同名覆盖与路径穿越），path 为相对目录（yyyy/MM/），物理根由配置决定
      db.exec(`
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          storage TEXT NOT NULL DEFAULT 'local',
          size INTEGER NOT NULL,
          mime TEXT NOT NULL DEFAULT '',
          path TEXT NOT NULL DEFAULT '',
          uploaded_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        )
      `);
      // 存储配置：单行表（CHECK 固定 id=1）。菜单 tools-files 在 v1 已有种，无需种子。
      // ftp_password 明文存库为已知取舍（模板级）；生产应使用系统凭据库或加密列
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          active_storage TEXT NOT NULL DEFAULT 'local',
          local_dir TEXT NOT NULL DEFAULT '',
          ftp_host TEXT NOT NULL DEFAULT '',
          ftp_port INTEGER NOT NULL DEFAULT 21,
          ftp_user TEXT NOT NULL DEFAULT '',
          ftp_password TEXT NOT NULL DEFAULT '',
          ftp_root TEXT NOT NULL DEFAULT '',
          ftp_secure INTEGER NOT NULL DEFAULT 0
        )
      `);
      db.exec('INSERT OR IGNORE INTO file_config (id) VALUES (1)');
    },
  },
  {
    version: 7,
    description: '文件目录：file_dirs 逻辑目录树（支持多级）+ files 加 dir_id 归属列',
    up: (db) => {
      // 逻辑目录树：目录不落盘（物理文件仍按 yyyy/MM 分桶），纯组织层。
      // 不建 parent_id 外键：删除目录的业务规则是「只允许删空目录」（应用层校验），
      // ON DELETE CASCADE 反而会绕过这条规则连锢子目录
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_dirs (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      // 幂等加列：新库与重复执行都安全；旧文件 dir_id=NULL = 未分组
      const fileColumns = db.all('PRAGMA table_info(files)') as Array<{ name: string }>;
      if (!fileColumns.some((col) => col.name === 'dir_id')) {
        db.run('ALTER TABLE files ADD COLUMN dir_id TEXT');
      }
    },
  },
];

/** 建表 + 迁移 + 种子：启动时调用一次，按 user_version 顺序应用未执行的迁移 */
export function applySchemaAndSeed(db: SqlDriver): void {
  const row = db.get('PRAGMA user_version') as { user_version: number } | null;
  const current = row?.user_version ?? 0;

  if (current >= migrations.length) return;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    // 单个迁移包在事务里：DDL 在 SQLite 中可回滚，
    // 中途失败不会留下半成品结构（否则重试时 CREATE 无 IF NOT EXISTS 的语句会报错）
    db.transaction(() => migration.up(db));
    // PRAGMA 不支持参数绑定；version 来自内部常量，无注入风险。
    // user_version 写入放在事务外（PRAGMA 在事务内不生效）
    db.run(`PRAGMA user_version = ${migration.version}`);
    logger.info(`[DB Migration] Applied v${migration.version}: ${migration.description}`);
  }
}
