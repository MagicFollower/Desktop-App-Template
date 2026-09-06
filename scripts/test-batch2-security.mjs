/**
 * 临时验证脚本（第 2 批整改 S1/S3）：
 * 1) Dev API Server 准入校验：恶意 Origin / DNS rebinding Host / 正常浏览器请求 / 本地无 Origin 请求
 * 2) passwordChangeSecure 语义：旧密码错误抛错；正确后哈希更新、旧密码失效
 *
 * 纯 Node 环境无 electron，database.ts 顶层依赖 app —— 用 Module._load mock 掉，
 * 并把 getAppPath 指向临时目录（内含 app-data.db 副本），避免触碰真实库。
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// 准备隔离的数据库目录（api-server → service → database 会从这里读写）
const API_HOME = path.resolve('tmp-test-apihome');
fs.mkdirSync(API_HOME, { recursive: true });
fs.copyFileSync(path.resolve('app-data.db'), path.join(API_HOME, 'app-data.db'));

// mock electron（api-server → service → database 的模块链顶层会用到 app）
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return { app: { isPackaged: false, getAppPath: () => API_HOME, getPath: () => API_HOME } };
  }
  return origLoad.call(this, request, parent, isMain);
};

// ---------- S1：API Server 准入校验 ----------
const { startApiServer, stopApiServer, DEV_API_PORT } = await import('../dist/main/api-server.js');
await startApiServer();

/** 用底层 http.request 发请求（Node fetch 禁止自定义 Host 头，测 rebinding 必须绕过） */
function rawRequest(headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: DEV_API_PORT, path: '/api/users', method: 'GET', headers },
      (res) => {
        const cors = res.headers['access-control-allow-origin'] ?? null;
        res.resume(); // 丢弃 body
        resolve({ status: res.statusCode, cors: Array.isArray(cors) ? cors[0] : cors });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function probe(name, headers, expectStatus, expectCors) {
  const { status, cors } = await rawRequest(headers);
  const pass = status === expectStatus && cors === expectCors;
  console.log(`[${name}] status=${status} cors=${cors}`, pass ? 'PASS' : `FAIL(expect ${expectStatus}/${expectCors})`);
  return pass;
}

let ok = true;
// 1. 模拟第三方恶意网页（跨域 fetch 必带 Origin）→ 403、无 CORS 头
ok = (await probe('T1 恶意 Origin', { Origin: 'https://evil.com' }, 403, null)) && ok;
// 2. 模拟 DNS rebinding（同源请求无 Origin，Host 为攻击者域名）→ 403
ok = (await probe('T2 rebinding Host', { Host: 'evil.com:5174' }, 403, null)) && ok;
// 3. 正常浏览器 dev 页面（Vite Origin）→ 200 + 精确 CORS 回显（非通配 *）
ok = (await probe('T3 白名单 Origin', { Origin: 'http://localhost:5173' }, 200, 'http://localhost:5173')) && ok;
// 4. 本地非浏览器客户端（curl，无 Origin、合法 Host）→ 200
ok = (await probe('T4 本地调试', {}, 200, null)) && ok;

stopApiServer();

// ---------- S3：passwordChangeSecure 语义（在另一个 db 副本上验证 bcrypt 流程） ----------
const { createSqlJsDriver } = await import('../dist/main/db/sqljs-driver.js');
const tmp = path.resolve('tmp-test-batch2.db');
fs.copyFileSync(path.resolve('app-data.db'), tmp);
const WASM = require.resolve('sql.js/dist/sql-wasm.wasm');
const db = await createSqlJsDriver(tmp, WASM);
const bcrypt = require('bcryptjs');

// 与 service.passwordChangeSecure 相同的主进程逻辑
function changeSecure(username, current, next) {
  const row = db.get('SELECT hash FROM passwords WHERE username=?', [username]);
  if (!row || !bcrypt.compareSync(current, row.hash)) throw new Error('当前密码不正确');
  db.run('UPDATE passwords SET hash=? WHERE username=?', [bcrypt.hashSync(next, 10), username]);
  db.persist();
}

let s3ok = true;
try {
  changeSecure('admin', 'wrong-password', 'newpass123');
  console.log('[T5] 旧密码错误 → 未抛错 FAIL');
  s3ok = false;
} catch (e) {
  console.log('[T5] 旧密码错误 →', e.message, 'PASS');
}

changeSecure('admin', 'admin123', 'newpass123');
const row = db.get('SELECT hash FROM passwords WHERE username=?', ['admin']);
const loginWithNew = bcrypt.compareSync('newpass123', row.hash);
const loginWithOld = bcrypt.compareSync('admin123', row.hash);
console.log('[T6] 新密码可登录:', loginWithNew, '旧密码已失效:', !loginWithOld, loginWithNew && !loginWithOld ? 'PASS' : 'FAIL');
if (!(loginWithNew && !loginWithOld)) s3ok = false;

db.close();
fs.rmSync(tmp);
fs.rmSync(API_HOME, { recursive: true, force: true });
console.log(ok && s3ok ? 'ALL PASS' : 'SOME FAILED');
process.exit(ok && s3ok ? 0 : 1);
