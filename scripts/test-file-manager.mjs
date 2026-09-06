/**
 * 临时验证脚本（文件管理功能 / 迁移 v6，LOCAL 全链路）：
 * 1) v5 → v6 迁移：files / file_config 建表 + 配置默认行
 * 2) fileConfigGet/Save：只写不读（出口无 ftp_password）、部分更新合并、切换 FTP 前置校验
 * 3) fileUpload：落盘路径（月分桶 + 重命名 + 清洗）、记录入库、20MB 上限、路径穿越清洗
 * 4) fileDelete：单条 + 批量、物理文件与记录同步消失、无主记录不报错
 * 5) fileSaveTo：下载到指定目录、内容一致、重名加序号不覆盖、物理缺失进 failed 不阻塞
 *
 * 纯 Node 环境无 electron，用 Module._load mock 掉（与 test-doc-rule.mjs 同模式）；
 * LOCAL 根配置为临时目录，上传/删除直接用 fs 验证物理副作用。
 * FTP 真实链路需要外部服务器，冒烟只覆盖「未配置主机时明确报错」的拒绝路径。
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TMP_HOME = path.resolve('tmp-test-file-home');
fs.mkdirSync(TMP_HOME, { recursive: true });
fs.copyFileSync(path.resolve('app-data.db'), path.join(TMP_HOME, 'app-data.db'));
// LOCAL 存储根：独立临时目录，不污染 userData
const STORAGE_ROOT = path.join(TMP_HOME, 'storage');

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

// ---------- T1：v5 → v6 → v7 迁移 ----------
const { getDatabase } = await import('../dist/main/database.js');
const db = await getDatabase();
const version = db.get('PRAGMA user_version');
check('T1a user_version = 7', version.user_version === 7, `got ${version.user_version}`);

const tables = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('files','file_config','file_dirs')");
check('T1b 三表已建', tables.length === 3, `got ${tables.map((t) => t.name).join(',')}`);

const configRow = db.get('SELECT active_storage FROM file_config WHERE id=1');
check('T1c 配置默认行存在（active_storage=local）', !!configRow && configRow.active_storage === 'local');

// ---------- T2：配置读写 ----------
const cfg1 = await svc.fileConfigGet();
check('T2a 出口契约（camelCase 且无 ftpPassword 字段）',
  cfg1.activeStorage === 'local' && typeof cfg1.ftpPort === 'number' && !('ftpPassword' in cfg1), JSON.stringify(cfg1));

// 配置 LOCAL 根目录 + 保存
await svc.fileConfigSave({ localDir: STORAGE_ROOT });
const cfg2 = await svc.fileConfigGet();
check('T2b 保存生效（localDir 回读一致）', cfg2.localDir === STORAGE_ROOT);

// 部分更新：只改 ftp_user，localDir 等保持（吸取 docRuleUpsert 覆盖缺陷的教训）
await svc.fileConfigSave({ ftpUser: 'demo' });
const cfg3 = await svc.fileConfigGet();
check('T2c 部分更新合并（localDir 不被清空）', cfg3.localDir === STORAGE_ROOT && cfg3.ftpUser === 'demo');

// 切换 FTP 前置校验：主机为空时拒绝
try {
  await svc.fileConfigSave({ activeStorage: 'ftp' });
  check('T2d 切 FTP 未配主机被拒', false, '未抛错');
} catch (e) {
  check('T2d 切 FTP 未配主机被拒', e.message.includes('主机'));
}

// ---------- T3：上传（LOCAL 全链路） ----------
const payload = Buffer.from('hello file management');
const rec1 = await svc.fileUpload({ name: '测试 文件.txt', mime: 'text/plain', uploadedBy: 'admin' }, new Uint8Array(payload));
check('T3a 返回记录（camelCase 契约 + fullPath 按当前配置解析）',
  rec1.storage === 'local' && rec1.size === payload.length && rec1.uploadedBy === 'admin' && rec1.name === '测试 文件.txt'
  && rec1.fullPath.includes(STORAGE_ROOT) && rec1.fullPath.includes(rec1.storedName), JSON.stringify(rec1));

// 物理文件：月分桶 + 重命名存储名
const now = new Date();
const relDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
const abs = path.join(STORAGE_ROOT, relDir, rec1.storedName);
check('T3b 物理文件落盘（月分桶）', fs.existsSync(abs), abs);
check('T3c 内容一致', fs.readFileSync(abs).toString() === payload.toString());

// 记录入库
const rows1 = await svc.fileList();
check('T3d 列表含新记录', rows1.some((r) => r.id === rec1.id));

// 路径穿越清洗：恶意名不逃出存储根
const rec2 = await svc.fileUpload({ name: '..\\..\\evil.txt', mime: 'text/plain' }, new Uint8Array(Buffer.from('evil')));
check('T3e 穿越名被清洗（无 .. 与路径分隔符）', !rec2.storedName.includes('..') && !rec2.storedName.includes('\\') && !rec2.storedName.includes('/'), JSON.stringify(rec2.storedName));
const abs2 = path.join(STORAGE_ROOT, relDir, rec2.storedName);
check('T3f 恶意名仍落在分桶目录内', fs.existsSync(abs2) && path.dirname(abs2) === path.join(STORAGE_ROOT, relDir), abs2);

// 同名连续上传不覆盖（随机前缀）
const rec3 = await svc.fileUpload({ name: '测试 文件.txt', mime: 'text/plain' }, new Uint8Array(Buffer.from('second')));
check('T3g 同名文件不冲突（storedName 唯一）', rec3.storedName !== rec1.storedName);

// 20MB 上限
try {
  await svc.fileUpload({ name: 'big.bin', mime: 'application/octet-stream' }, new Uint8Array(20 * 1024 * 1024 + 1));
  check('T3h 超过 20MB 被拒', false, '未抛错');
} catch (e) {
  check('T3h 超过 20MB 被拒', e.message.includes('20MB'));
}

// ---------- T6：下载（fileSaveTo：读物理写入指定目录） ----------
const DOWNLOAD_DIR = path.join(TMP_HOME, 'downloads');
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
const dl1 = await svc.fileSaveTo([rec1.id], DOWNLOAD_DIR);
check('T6a 单条下载：saved=1 且无失败', dl1.saved === 1 && dl1.failed.length === 0, JSON.stringify(dl1));
const dl1Path = path.join(DOWNLOAD_DIR, rec1.name); // 目标名 = 原始展示名（非存储名）
check('T6b 落盘文件名为原始展示名', fs.existsSync(dl1Path), dl1Path);
check('T6c 下载内容一致', fs.readFileSync(dl1Path).toString() === payload.toString());

// 重名不覆盖：再次下载同一记录 → `名字 (1).ext`
await svc.fileSaveTo([rec1.id], DOWNLOAD_DIR);
const dl1Dup = path.join(DOWNLOAD_DIR, '测试 文件 (1).txt');
check('T6d 重名自动加序号不覆盖', fs.existsSync(dl1Dup) && fs.existsSync(dl1Path));

// 批量下载（T3 还在库里的 rec1/rec3）
const dlBatch = await svc.fileSaveTo([rec1.id, rec3.id], DOWNLOAD_DIR);
check('T6e 批量下载计数', dlBatch.saved === 2 && dlBatch.failed.length === 0, JSON.stringify(dlBatch));

// 物理文件缺失：进 failed 不阻塞其余
const recD = await svc.fileUpload({ name: 'missing.txt', mime: 'text/plain' }, new Uint8Array(Buffer.from('x')));
const absD = path.join(STORAGE_ROOT, relDir, recD.storedName);
fs.unlinkSync(absD);
const dlMiss = await svc.fileSaveTo([recD.id, rec3.id], DOWNLOAD_DIR);
check('T6f 物理缺失进 failed（含原因）且其余照常保存',
  dlMiss.saved === 1 && dlMiss.failed.length === 1 && dlMiss.failed[0].name === 'missing.txt' && !!dlMiss.failed[0].reason, JSON.stringify(dlMiss));

// 空目录入参拒绝
try {
  await svc.fileSaveTo([rec3.id], '');
  check('T6g 空目标目录被拒', false, '未抛错');
} catch (e) {
  check('T6g 空目标目录被拒', e.message.includes('目录'));
}

// ---------- T7：目录（逻辑目录树，不落盘） ----------
// 新增：根下 + 子目录（多级）
const dirA = await svc.fileDirCreate({ parentId: null, name: '项目文档' });
check('T7a 根下新增目录（camelCase 契约）',
  !!dirA.id && dirA.parentId === null && dirA.name === '项目文档' && dirA.fileCount === 0, JSON.stringify(dirA));

const dirA1 = await svc.fileDirCreate({ parentId: dirA.id, name: '验收材料' });
const dirA2 = await svc.fileDirCreate({ parentId: dirA.id, name: '设计稿' });
check('T7b 同父多子目录（多级）', dirA1.parentId === dirA.id && dirA2.parentId === dirA.id);

// 非法名清洗：穿越段与 Windows 非法字符不进目录名
const dirBad = await svc.fileDirCreate({ parentId: null, name: '..\\..\\报告:2026' });
check('T7c 非法目录名被清洗', !dirBad.name.includes('..') && !dirBad.name.includes('\\') && !dirBad.name.includes(':'), JSON.stringify(dirBad.name));

// 空名拒绝
try {
  await svc.fileDirCreate({ parentId: null, name: '   ' });
  check('T7d 空目录名被拒', false, '未抛错');
} catch (e) {
  check('T7d 空目录名被拒', e.message.includes('目录名'));
}

// 列表：DFS 序（父在子前）+ 深度可推导 + 计数正确（含子目录）
const dirList1 = await svc.fileDirList();
const idxA = dirList1.findIndex((d) => d.id === dirA.id);
const idxA1 = dirList1.findIndex((d) => d.id === dirA1.id);
check('T7e 列表 DFS 序（父在子前）', idxA !== -1 && idxA1 > idxA, JSON.stringify(dirList1.map((d) => d.name)));

// 上传落目录：记录 dirId + 计数（父含子累加）
const recDir = await svc.fileUpload({ name: '目录内文件.txt', mime: 'text/plain', uploadedBy: 'admin', dirId: dirA1.id }, new Uint8Array(Buffer.from('in-dir')));
check('T7f 上传带 dirId 落目录', recDir.dirId === dirA1.id);
const dirList2 = await svc.fileDirList();
check('T7g 计数含子目录（父=1 子=1）',
  dirList2.find((d) => d.id === dirA.id).fileCount === 1 && dirList2.find((d) => d.id === dirA1.id).fileCount === 1, JSON.stringify(dirList2));

// 目录指向不存在：上传拒绝（不静默落未分组）
try {
  await svc.fileUpload({ name: 'x.txt', mime: 'text/plain', dirId: 'dir-nonexistent' }, new Uint8Array(Buffer.from('x')));
  check('T7h 目录不存在时上传被拒', false, '未抛错');
} catch (e) {
  check('T7h 目录不存在时上传被拒', e.message.includes('目录'));
}

// 删除：有文件/有子目录都拒
try {
  await svc.fileDirDelete(dirA1.id);
  check('T7i 有文件目录被拒', false, '未抛错');
} catch (e) {
  check('T7i 有文件目录被拒', e.message.includes('文件'));
}
try {
  await svc.fileDirDelete(dirA.id);
  check('T7j 有子目录被拒', false, '未抛错');
} catch (e) {
  check('T7j 有子目录被拒', e.message.includes('子目录'));
}

// 清空后可删：先删文件再删目录（子→父）
await svc.fileDelete([recDir.id]);
const delDirA1 = await svc.fileDirDelete(dirA1.id);
check('T7k 清空后子目录可删', delDirA1.success);
await svc.fileDirDelete(dirA2.id);
const delDirA = await svc.fileDirDelete(dirA.id);
check('T7l 清空后父目录可删（多级逐层）', delDirA.success);
check('T7m 删除后列表不再含该目录', !(await svc.fileDirList()).some((d) => d.id === dirA.id));

// 无主目录：删除报明确错误（与文件删除的静默容忍不同——目录操作用户预期看到明确反馈）
const dirTmp = await svc.fileDirCreate({ parentId: null, name: '临时' });
try {
  await svc.fileDirDelete('dir-nonexistent');
  check('T7n 无主目录删除报明确错误', false, '未抛错');
} catch (e) {
  check('T7n 无主目录删除报明确错误', e.message.includes('不存在'));
}
await svc.fileDirDelete(dirTmp.id);

// ---------- T4：删除（单条 + 批量） ----------
await svc.fileDelete([rec2.id]);
check('T4a 单条删除：物理文件消失', !fs.existsSync(abs2));
const rows2 = await svc.fileList();
check('T4b 单条删除：记录消失', !rows2.some((r) => r.id === rec2.id));

const rec4 = await svc.fileUpload({ name: 'batch1.txt', mime: 'text/plain' }, new Uint8Array(Buffer.from('b1')));
const rec5 = await svc.fileUpload({ name: 'batch2.txt', mime: 'text/plain' }, new Uint8Array(Buffer.from('b2')));
const del = await svc.fileDelete([rec4.id, rec5.id]);
check('T4c 批量删除返回计数', del.deleted === 2, JSON.stringify(del));
const rows3 = await svc.fileList();
check('T4d 批量删除后记录清空', !rows3.some((r) => r.id === rec4.id || r.id === rec5.id));

// 无主 id 删除：不报错、不误删
const del2 = await svc.fileDelete(['file-nonexistent']);
check('T4e 无主 id 删除返回 0', del2.deleted === 0);

// 物理文件被外部删除后再删记录：ENOENT 容忍（不阻塞）
fs.unlinkSync(abs);
const del3 = await svc.fileDelete([rec1.id]);
check('T4f 物理文件已不在时记录仍可删（deleted=1）', del3.deleted === 1);

// ---------- T5：FTP 拒绝路径（真实 FTP 需外部服务器，冒烟不覆盖连通性） ----------
await svc.fileConfigSave({ ftpHost: '127.0.0.1', ftpPort: 1, ftpUser: 'u', ftpPassword: 'p', activeStorage: 'ftp' });
try {
  await svc.fileUpload({ name: 'ftp.txt', mime: 'text/plain' }, new Uint8Array(Buffer.from('x')));
  check('T5a FTP 不可达时上传明确报错', false, '未抛错');
} catch (e) {
  // basic-ftp 连接失败抛 Error（ECONNREFUSED 等）
  check('T5a FTP 不可达时上传明确报错', e instanceof Error && e.message.length > 0, String(e));
}
// FTP 记录未插入（物理失败不产生孤儿记录）
const rows4 = await svc.fileList();
check('T5b 上传失败无孤儿记录', !rows4.some((r) => r.name === 'ftp.txt'));
// 还原 local，便于后续重跑
await svc.fileConfigSave({ activeStorage: 'local' });

// ---------- 清理 ----------
db.close();
fs.rmSync(TMP_HOME, { recursive: true, force: true });
console.log(ok ? 'ALL PASS' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
