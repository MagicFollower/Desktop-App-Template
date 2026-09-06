/**
 * 轻量 HTTP API 服务器
 * 仅在开发模式下启动，让浏览器 dev 界面也能访问主进程的 SQLite 数据库，
 * 保证 Electron 窗口与浏览器窗口数据完全一致。
 */

import http from 'http';
import * as svc from './service';
import { logger } from './logger';

/**
 * 开发模式 API 服务器固定端口。
 * 浏览器 dev 界面无法拿到 Electron 动态分配的端口，因此必须使用固定端口，
 * 该值需与 src/renderer/services/sqlite.ts 中的 DEV_API_BASE 保持一致。
 */
export const DEV_API_PORT = 5174;
const DEV_API_HOST = '127.0.0.1';

let server: http.Server | null = null;

export function getApiPort(): number {
  return DEV_API_PORT;
}

// ==================== 准入校验（S1） ====================

/** 允许的 Host 头（防 DNS rebinding：rebinding 请求的 Host 是攻击者域名而非本机） */
const ALLOWED_HOSTS = new Set([`127.0.0.1:${DEV_API_PORT}`, `localhost:${DEV_API_PORT}`]);
/** 允许的浏览器页面来源（Vite dev server） */
const ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

/**
 * 请求准入校验，拦截两类本机后门攻击：
 * - Origin 白名单：浏览器跨域 fetch 强制携带 Origin 头 ——
 *   任何第三方网页 JS 调用本端口都会被拦（修复旧版 CORS * 零鉴权问题）；
 * - Host 白名单：防 DNS rebinding —— 攻击者域名重绑到 127.0.0.1 后页面对其发同源请求
 *   （无 Origin 头），只能靠 Host ≠ 本机地址拦截。
 * 两者都缺失时为本地非浏览器客户端（curl 等开发调试），放行。
 */
function checkRequestOrigin(req: http.IncomingMessage): { allowed: boolean; origin?: string } {
  const host = req.headers.host;
  if (host && !ALLOWED_HOSTS.has(host)) return { allowed: false };
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return { allowed: false };
  // 仅当 Origin 命中白名单时回写精确值（不再使用通配 *）
  return { allowed: true, origin: origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined };
}

// ==================== HTTP 工具 ====================

/**
 * 发送 JSON 响应。仅当请求 Origin 命中白名单时才回写 CORS 头（精确值，非通配）。
 */
function sendJson(res: http.ServerResponse, data: any, status = 200, corsOrigin?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, message: string, status = 500) {
  sendJson(res, { error: message }, status);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseUrl(raw: string) {
  const qIdx = raw.indexOf('?');
  const pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const searchParams = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');
  return { pathname, searchParams };
}

// ==================== 路由 ====================

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  // S1：准入校验（Origin/Host 白名单），未通过直接 403，不进入路由
  const { allowed, origin } = checkRequestOrigin(req);
  if (!allowed) {
    logger.warn(`[API Server] Rejected request: Host=${req.headers.host} Origin=${req.headers.origin}`);
    sendJson(res, { error: 'Forbidden' }, 403);
    return;
  }

  // CORS 预检（仅对白名单内的浏览器来源放行）
  if (req.method === 'OPTIONS') {
    sendJson(res, null, 200, origin);
    return;
  }

  const { pathname } = parseUrl(req.url || '/');
  const method = req.method!;
  // 所有业务响应统一带上白名单 Origin（未命中则无 CORS 头，浏览器跨域读取会被拦）
  const json = (data: any, status = 200) => sendJson(res, data, status, origin);

  try {
    // ---------- 用户 ----------
    if (pathname === '/api/users' && method === 'GET') {
      return json(await svc.userList());
    }
    if (pathname === '/api/users' && method === 'POST') {
      return json(await svc.userCreate(await readBody(req)));
    }
    if (pathname === '/api/users' && method === 'PUT') {
      return json(await svc.userUpdate(await readBody(req)));
    }
    if (pathname === '/api/users' && method === 'DELETE') {
      const { id } = await readBody(req);
      return json(await svc.userDelete(id));
    }

    // ---------- 个人资料 ----------
    // /api/profile GET 已删除（profileGet 无调用方：登录时由 authLogin 合并资料）
    if (pathname === '/api/profile' && method === 'PUT') {
      return json(await svc.profileUpdate(await readBody(req)));
    }

    // ---------- 认证 ----------
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { username, password } = await readBody(req);
      const user = await svc.authLogin(username, password);
      return json(user);
    }
    if (pathname === '/api/auth/password' && method === 'PUT') {
      const { username, current, next } = await readBody(req);
      return json(await svc.passwordChangeSecure(username, current, next));
    }

    // ---------- 菜单 ----------
    if (pathname === '/api/menus' && method === 'GET') {
      return json(await svc.menuList());
    }
    if (pathname === '/api/menus' && method === 'POST') {
      return json(await svc.menuUpsert(await readBody(req)));
    }
    if (pathname === '/api/menus/batch-update' && method === 'POST') {
      return json(await svc.menuBatchUpdate(await readBody(req)));
    }
    if (pathname === '/api/menus' && method === 'DELETE') {
      const { id } = await readBody(req);
      return json(await svc.menuDelete(id));
    }

    // ---------- 单据号规则 ----------
    if (pathname === '/api/doc-rules' && method === 'GET') {
      return json(await svc.docRuleList());
    }
    if (pathname === '/api/doc-rules' && method === 'POST') {
      return json(await svc.docRuleUpsert(await readBody(req)));
    }
    if (pathname === '/api/doc-rules' && method === 'DELETE') {
      const { id } = await readBody(req);
      return json(await svc.docRuleDelete(id));
    }
    // 取号是写操作（计数 +1），用 POST 而不是 GET：GET 在语义上是安全的（无副作用），
    // 是否可缓存/可重试取决于此
    if (pathname === '/api/doc-rules/next-number' && method === 'POST') {
      const { code } = await readBody(req);
      return json({ number: await svc.docNextNumber(code) });
    }

    // ---------- 文件管理 ----------
    if (pathname === '/api/files' && method === 'GET') {
      return json(await svc.fileList());
    }
    // 逻辑目录：树形列表 / 新增 / 删除（只允许删空目录）
    if (pathname === '/api/file-dirs' && method === 'GET') {
      return json(await svc.fileDirList());
    }
    if (pathname === '/api/file-dirs' && method === 'POST') {
      const { parentId, name } = await readBody(req);
      return json(await svc.fileDirCreate({ parentId: parentId ?? null, name: String(name || '') }));
    }
    if (pathname === '/api/file-dirs' && method === 'DELETE') {
      const { id } = await readBody(req);
      return json(await svc.fileDirDelete(String(id || '')));
    }
    // 上传：HTTP 通路二进制走 base64（JSON 文本通道装不进原始字节；
    // IPC 通路走结构化克隆无此开销，两者在 adapter 内各自编码/解码）
    if (pathname === '/api/files' && method === 'POST') {
      const { name, mime, uploadedBy, dirId, dataBase64 } = await readBody(req);
      const data = Buffer.from(String(dataBase64 || ''), 'base64');
      return json(await svc.fileUpload({ name: String(name || ''), mime: String(mime || ''), uploadedBy, dirId: dirId ?? null }, new Uint8Array(data)));
    }
    // 删除：批量统一入口（单条即长度 1 的数组）
    if (pathname === '/api/files' && method === 'DELETE') {
      const { ids } = await readBody(req);
      return json(await svc.fileDelete(Array.isArray(ids) ? ids.map(String) : []));
    }
    // 下载：写入主进程可访问的目录（目录选择器是 GUI 能力，仅 IPC 通路暴露；
    // 此路由供 curl 等本地调试用，浏览器页面拿不到目录选择入口）
    if (pathname === '/api/files/save' && method === 'POST') {
      const { ids, targetDir } = await readBody(req);
      return json(await svc.fileSaveTo(Array.isArray(ids) ? ids.map(String) : [], String(targetDir || '')));
    }
    if (pathname === '/api/files/config' && method === 'GET') {
      return json(await svc.fileConfigGet());
    }
    if (pathname === '/api/files/config' && method === 'PUT') {
      return json(await svc.fileConfigSave(await readBody(req)));
    }

    // ---------- 404 ----------
    sendError(res, 'Not Found', 404);
  } catch (err: any) {
    logger.error('[API Server] Error:', err);
    sendError(res, err.message || 'Internal Server Error');
  }
}

// ==================== 启动 / 停止 ====================

/**
 * 启动开发模式 HTTP API 服务器（固定端口 5174）。
 * 返回后浏览器可直接通过 http://127.0.0.1:5174 访问与 Electron 同一个 SQLite。
 */
export function startApiServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    server = http.createServer(handleRequest);

    server.listen(DEV_API_PORT, DEV_API_HOST, () => {
      logger.info(`[API Server] Dev API server running at http://${DEV_API_HOST}:${DEV_API_PORT}`);
      resolve(DEV_API_PORT);
    });

    server.on('error', (err) => {
      logger.error('[API Server] Failed to start:', err);
      reject(err);
    });
  });
}

export function stopApiServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
