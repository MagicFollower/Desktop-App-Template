/**
 * 迁移冒烟脚本：在 app-data.db 副本上验证
 * 1) 迁移 v1→v6 正确执行且 user_version=6
 * 2) menus 外键级联删除（B3）
 * 3) user_profiles 外键级联删除/孤儿清理（v2 + B4）
 * 4) sql.js 驱动 foreign_keys=ON 生效
 * 5) v3：menus.roles 列与 admin 种子（A3）；v4：单据号规则两表 + 菜单种子；v5：users.user_code 回填 + USER 规则种子；v6：files/file_config 两表 + 配置默认行
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createSqlJsDriver } from '../dist/main/db/sqljs-driver.js';
import { applySchemaAndSeed } from '../dist/main/db/schema.js';

const require = createRequire(import.meta.url);

const src = path.resolve('app-data.db');
const tmp = path.resolve('tmp-test-migration.db');
fs.copyFileSync(src, tmp);

const WASM = require.resolve('sql.js/dist/sql-wasm.wasm');
const db = await createSqlJsDriver(tmp, WASM);

// 副本库为旧结构：先跑迁移
applySchemaAndSeed(db);

const version = db.get('PRAGMA user_version');
console.log('[T1] user_version =', version.user_version, version.user_version === 7 ? 'PASS' : 'FAIL');

// v5 回填基线：迁移后立即捕获（T4 会删用户、T5 会插无编码用户，届时不能再用实时数据断言）
const migratedUsers = db.all('SELECT id, user_code FROM users');

const fk = db.get('PRAGMA foreign_keys');
console.log('[T2] foreign_keys =', fk.foreign_keys, fk.foreign_keys === 1 ? 'PASS' : 'FAIL');

// B3：删除 tools 菜单，其三个子菜单应级联消失
db.run('DELETE FROM menus WHERE id=?', ['tools']);
const orphanMenus = db.all("SELECT id FROM menus WHERE id LIKE 'tools-%'");
console.log('[T3] delete tools → 子菜单残留:', JSON.stringify(orphanMenus), orphanMenus.length === 0 ? 'PASS' : 'FAIL');

// v2：user_profiles 现在带 ON DELETE CASCADE——删除用户，其 profile 应自动清理
db.run("INSERT OR IGNORE INTO user_profiles (username, nickname) VALUES ('zhangsan', '张三')");
db.run("DELETE FROM users WHERE username='zhangsan'");
const orphanProfile = db.all("SELECT * FROM user_profiles WHERE username='zhangsan'");
console.log('[T4] delete user → profile 残留:', JSON.stringify(orphanProfile), orphanProfile.length === 0 ? 'PASS' : 'FAIL');

// v2：改名联动（users.username 改动，profile 外键 ON UPDATE CASCADE 跟随）
db.run("INSERT OR IGNORE INTO users (id, username, email, created_at) VALUES ('99', 'testuser', 't@e.com', datetime('now'))");
db.run("INSERT INTO user_profiles (username, nickname) VALUES ('testuser', '测试')");
db.run("UPDATE users SET username='testuser2' WHERE id='99'");
const followed = db.get("SELECT username FROM user_profiles WHERE nickname='测试'");
console.log('[T5] 改名后 profile.username =', followed?.username, followed?.username === 'testuser2' ? 'PASS' : 'FAIL');

// user_version 已达最新：重复执行 applySchemaAndSeed 应为空操作（幂等）
applySchemaAndSeed(db);
const version2 = db.get('PRAGMA user_version');
const menuCount = db.all('SELECT COUNT(*) AS c FROM menus')[0].c;
applySchemaAndSeed(db);
const menuCount2 = db.all('SELECT COUNT(*) AS c FROM menus')[0].c;
console.log('[T6] 重复迁移幂等：menus', menuCount, '→', menuCount2, menuCount === menuCount2 && version2.user_version === 7 ? 'PASS' : 'FAIL');

// 菜单 id → roles 映射（T7/T8 共用）
const roles = db.all('SELECT id, roles FROM menus ORDER BY sort_order, id');
const byId = Object.fromEntries(roles.map((r) => [r.id, r.roles]));

// v4：单据号规则两表存在 + 菜单种子 system-doc-rules（roles=admin，与 v3 兄弟菜单一致）
const docTables = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('doc_rules','doc_counters')").map((t) => t.name);
const docMenu = byId['system-doc-rules'];
console.log(
  '[T7] v4 doc 两表 + 菜单种子：tables =', JSON.stringify(docTables), '；roles =', docMenu,
  docTables.length === 2 && docMenu === 'admin' ? 'PASS' : 'FAIL',
);

// v3（A3）：roles 列存在，系统菜单限 admin，其余为 NULL
const adminOnly = ['system', 'system-users', 'system-menus', 'system-doc-rules'].every((id) => byId[id] === 'admin');
const unrestricted = ['dashboard', 'system-profile', 'tools'].every((id) => byId[id] == null);
console.log(
  '[T8] v3 roles 种子：admin 专属菜单 =', adminOnly, '；不限角色菜单 =', unrestricted,
  adminOnly && unrestricted ? 'PASS' : 'FAIL',
);

// v5：users.user_code 回填 + USER 规则种子 + 计数同步。
// 注：T4 删除了 zhangsan、T5 插入了迁移后才创建的 testuser（id=99，无编码）
// ——断言用迁移后立即捕获的基线 migratedUsers，不受后续变更影响
const backfillOk = migratedUsers.length > 0 && migratedUsers.every((r) => /^U\d{4}$/.test(r.user_code || ''));
const userRule = db.get("SELECT enabled, prefix, seq_length, reset_policy FROM doc_rules WHERE code='USER'");
const userCounter = db.get("SELECT seq FROM doc_counters WHERE rule_code='USER' AND reset_key=''");
const userSeedOk = !!userRule && userRule.enabled === 1 && userRule.prefix === 'U' && userRule.seq_length === 4 && userRule.reset_policy === 'never'
  && !!userCounter && userCounter.seq === migratedUsers.length;
console.log(
  '[T9] v5 用户编码：回填', migratedUsers.length, '个用户全有编码 =', backfillOk, '；USER 规则/计数种子 =', userSeedOk,
  backfillOk && userSeedOk ? 'PASS' : 'FAIL',
);

// v6：文件管理两表 + 单行配置默认行（active_storage=local）
const fileTables = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('files','file_config')").map((t) => t.name);
const fileConfig = db.get('SELECT active_storage, ftp_port, ftp_secure FROM file_config WHERE id=1');
const v6Ok = fileTables.length === 2 && !!fileConfig && fileConfig.active_storage === 'local' && fileConfig.ftp_port === 21 && fileConfig.ftp_secure === 0;
console.log(
  '[T10] v6 文件管理：tables =', JSON.stringify(fileTables), '；配置默认行 =', JSON.stringify(fileConfig),
  v6Ok ? 'PASS' : 'FAIL',
);

// v7：文件目录表 + files.dir_id 列（旧文件 dir_id=NULL = 未分组）
const dirTable = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='file_dirs'").map((t) => t.name);
const filesColumns = db.all('PRAGMA table_info(files)').map((c) => c.name);
const v7Ok = dirTable.length === 1 && filesColumns.includes('dir_id');
console.log(
  '[T11] v7 文件目录：file_dirs 表 =', JSON.stringify(dirTable), '；files.dir_id 列存在 =', filesColumns.includes('dir_id'),
  v7Ok ? 'PASS' : 'FAIL',
);

db.close();
fs.rmSync(tmp);
console.log('DONE');
