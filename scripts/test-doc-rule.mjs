/**
 * 临时验证脚本（单据号规则功能 / 迁移 v4 + v5 用户编码；当前库已至 v6，脚本同步断言最新版本）：
 * 1) v3 → v5 迁移：doc_rules / doc_counters 建表 + 菜单种子 + USER 规则种子 + users.user_code 回填
 * 2) docRuleUpsert / docRuleList：UPSERT + camelCase 映射 + code 重复拒绝
 * 3) docNextNumber：首号 0001、连号递增、跨周期重置、停用拦截、不存在抛错
 * 4) docRuleDelete：规则删除连带清理计数
 * 5) userCreate：新增用户自动生成 userCode（回填接续、连续递增、编辑不变）
 *
 * 纯 Node 环境无 electron，database.ts 顶层依赖 app —— 用 Module._load mock 掉，
 * 并把 getAppPath 指向临时目录（内含从 app-data.db 复制的 v3 库），避免触碰真实库。
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TMP_HOME = path.resolve('tmp-test-doc-rule-home');
fs.mkdirSync(TMP_HOME, { recursive: true });
// 复制真实库（当前版本 v3）作为升级起点
fs.copyFileSync(path.resolve('app-data.db'), path.join(TMP_HOME, 'app-data.db'));

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return { app: { isPackaged: false, getAppPath: () => TMP_HOME, getPath: () => TMP_HOME } };
  }
  return origLoad.call(this, request, parent, isMain);
};

const svc = await import('../dist/main/service.js');
let ok = true;
function check(name, pass, detail = '') {
  console.log(`[${name}]`, pass ? 'PASS' : `FAIL ${detail}`);
  if (!pass) ok = false;
}

// ---------- T1：迁移至最新版本（import service 即触发 getDatabase → applySchemaAndSeed） ----------
const { getDatabase } = await import('../dist/main/database.js');
const db = await getDatabase();
const version = db.get('PRAGMA user_version');
check('T1a user_version = 7（迁移随库同步推进）', version.user_version === 7, `got ${version.user_version}`);

const tables = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('doc_rules','doc_counters')");
check('T1b 两表已建', tables.length === 2, `got ${tables.map((t) => t.name).join(',')}`);

const menu = db.get("SELECT id, roles FROM menus WHERE id='system-doc-rules'");
check('T1c 菜单种子 + roles=admin', !!menu && menu.roles === 'admin', JSON.stringify(menu));

// v5：既有用户回填 U0001…，UNIQUE 索引就位，USER 规则/计数种子同步
const userCount = db.get('SELECT COUNT(*) AS c FROM users').c;
const backfilled = db.all('SELECT id, user_code FROM users ORDER BY user_code');
const backfillOk = backfilled.length === userCount
  && backfilled.every((r, i) => r.user_code === `U${String(i + 1).padStart(4, '0')}`)
  && backfilled.length > 0;
check('T1d 既有用户回填 user_code（U0001… 连续无冲突）', backfillOk, JSON.stringify(backfilled.map((r) => r.user_code)));
check('T1e user_code UNIQUE 索引', !!db.get("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_user_code'"));
const userRule = db.get("SELECT seq FROM doc_counters WHERE rule_code='USER' AND reset_key=''");
check('T1f USER 计数与回填同步（下次取号 = 回填数 + 1）', userRule && userRule.seq === userCount, JSON.stringify(userRule));

// ---------- T2：docRuleUpsert / docRuleList ----------
await svc.docRuleUpsert({ id: 'doc-t1', code: 'PO', name: '采购入库单', prefix: 'PO', dateType: 'yyyyMMdd', seqLength: 4, resetPolicy: 'daily', separator: '-' });
await svc.docRuleUpsert({ id: 'doc-t2', code: 'ER', name: '报销单', prefix: 'ER', dateType: 'none', seqLength: 6, resetPolicy: 'never', separator: '' });

const list = await svc.docRuleList();
const po = list.find((r) => r.code === 'PO');
check('T2a list 返回 camelCase 契约', po && po.dateType === 'yyyyMMdd' && po.seqLength === 4 && po.enabled === true && typeof po.createdAt === 'string', JSON.stringify(po));

// 更新走 UPSERT：改停用
await svc.docRuleUpsert({ id: 'doc-t2', code: 'ER', name: '报销单', enabled: false });
const er = (await svc.docRuleList()).find((r) => r.code === 'ER');
check('T2b UPSERT 更新生效（enabled=false）', er && er.enabled === false);

// code 重复（不同 id）→ UNIQUE 抛错
try {
  await svc.docRuleUpsert({ id: 'doc-t3', code: 'PO', name: '重复编码' });
  check('T2c code 重复被拒', false, '未抛错');
} catch {
  check('T2c code 重复被拒', true);
}

// 非法入参 → service 校验拦截
try {
  await svc.docRuleUpsert({ id: 'doc-t4', code: 'po', name: '小写编码' });
  check('T2d 非法 code 被 service 校验拒绝', false, '未抛错');
} catch (e) {
  check('T2d 非法 code 被 service 校验拒绝', e.message.includes('单据编码'));
}

// ---------- T3：docNextNumber ----------
const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
const n1 = await svc.docNextNumber('PO');
const n2 = await svc.docNextNumber('PO');
const n3 = await svc.docNextNumber('PO');
check('T3a 首号 + 连号递增', n1 === `PO-${ymd}-0001` && n2 === `PO-${ymd}-0002` && n3 === `PO-${ymd}-0003`, `${n1},${n2},${n3}`);

// 跨周期：伪造旧 reset_key 后取号 → 新周期从 1 开始，旧数据保留不删
db.run('UPDATE doc_counters SET reset_key = ? WHERE rule_code = ?', ['20200101', 'PO']);
const n4 = await svc.docNextNumber('PO');
const counterRows = db.all('SELECT reset_key, seq FROM doc_counters WHERE rule_code = ? ORDER BY reset_key', ['PO']);
check('T3b 跨周期从 1 重计', n4 === `PO-${ymd}-0001`, n4);
check('T3c 旧周期数据保留（不删数据重置）', counterRows.length === 2 && counterRows.some((r) => r.reset_key === '20200101' && r.seq === 3), JSON.stringify(counterRows));

// 列表 currentSeq：优先当前周期行（PO 当前周期 seq=1）；跨周期后显示新周期流水而非旧周期
const listAfter = await svc.docRuleList();
const poAfter = listAfter.find((r) => r.code === 'PO');
check('T3f 列表 currentSeq = 当前周期流水', poAfter && poAfter.currentSeq === 1, `got ${poAfter?.currentSeq}`);
// ER 从未取号 → currentSeq = null
const erAfter = listAfter.find((r) => r.code === 'ER');
check('T3g 从未取号 currentSeq = null', erAfter && erAfter.currentSeq === null, `got ${erAfter?.currentSeq}`);

// 停用拦截
try {
  await svc.docNextNumber('ER');
  check('T3d 停用规则取号被拒', false, '未抛错');
} catch (e) {
  check('T3d 停用规则取号被拒', e.message.includes('已停用'));
}

// 不存在
try {
  await svc.docNextNumber('NOPE');
  check('T3e 不存在规则取号抛错', false, '未抛错');
} catch (e) {
  check('T3e 不存在规则取号抛错', e.message.includes('不存在'));
}

// ---------- T4：docRuleDelete 连带清理计数 ----------
await svc.docRuleUpsert({ id: 'doc-t5', code: 'OUT', name: '出库单', resetPolicy: 'never' });
await svc.docNextNumber('OUT');
const outBefore = (await svc.docRuleList()).find((r) => r.code === 'OUT');
check('T4a never 规则取号后 currentSeq 可见', outBefore && outBefore.currentSeq === 1, `got ${outBefore?.currentSeq}`);
await svc.docRuleDelete('doc-t5');
const outLeft = db.get('SELECT COUNT(*) AS c FROM doc_rules WHERE code = ?', ['OUT']);
const outCounter = db.get('SELECT COUNT(*) AS c FROM doc_counters WHERE rule_code = ?', ['OUT']);
check('T4b 删除规则连带清理计数', outLeft.c === 0 && outCounter.c === 0, `rules=${outLeft.c} counters=${outCounter.c}`);

// ---------- T5：userCreate 自动生成 userCode ----------
await svc.userCreate({ id: 'user-t1', username: 'newuser1', email: 'n1@x.com', role: 'user', status: 'active' });
await svc.userCreate({ id: 'user-t2', username: 'newuser2', email: 'n2@x.com', role: 'user', status: 'active' });
const users = await svc.userList();
const nu1 = users.find((u) => u.id === 'user-t1');
const nu2 = users.find((u) => u.id === 'user-t2');
const nextCode = `U${String(userCount + 1).padStart(4, '0')}`;
const nextCode2 = `U${String(userCount + 2).padStart(4, '0')}`;
check('T5a 新增用户自动生成 userCode（回填后接续）', nu1 && nu1.userCode === nextCode, `got ${nu1?.userCode}, expect ${nextCode}`);
check('T5b 连续递增', nu2 && nu2.userCode === nextCode2, `got ${nu2?.userCode}, expect ${nextCode2}`);
check('T5c userList 出口携带 userCode', nu1 && typeof nu1.userCode === 'string' && nu1.userCode !== '');

// 编辑不改编码：改邮箱后 userCode 原样
await svc.userUpdate({ id: 'user-t1', username: 'newuser1', email: 'changed@x.com', role: 'user', status: 'active' });
const users2 = await svc.userList();
const nu1After = users2.find((u) => u.id === 'user-t1');
check('T5d 编辑后 userCode 不变', nu1After && nu1After.userCode === nextCode && nu1After.email === 'changed@x.com', JSON.stringify(nu1After));

// 停用 USER 规则 → 新增被拦
await svc.docRuleUpsert({ id: 'doc-rule-user', code: 'USER', name: '用户编码', enabled: false });
try {
  await svc.userCreate({ id: 'user-t3', username: 'newuser3', email: 'n3@x.com', role: 'user', status: 'active' });
  check('T5e USER 规则停用时新增被拦', false, '未抛错');
} catch (e) {
  check('T5e USER 规则停用时新增被拦', e.message.includes('USER'));
}
// 恢复启用，验证计数未因被拦的创建而消耗
await svc.docRuleUpsert({ id: 'doc-rule-user', code: 'USER', name: '用户编码', enabled: true });
await svc.userCreate({ id: 'user-t4', username: 'newuser4', email: 'n4@x.com', role: 'user', status: 'active' });
const nu4 = (await svc.userList()).find((u) => u.id === 'user-t4');
const nextCode4 = `U${String(userCount + 3).padStart(4, '0')}`;
check('T5f 被拦创建不消耗计数（号源无空洞）', nu4 && nu4.userCode === nextCode4, `got ${nu4?.userCode}, expect ${nextCode4}`);

// ---------- 清理 ----------
db.close();
fs.rmSync(TMP_HOME, { recursive: true, force: true });
console.log(ok ? 'ALL PASS' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
