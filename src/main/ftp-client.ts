/**
 * FTP 存储薄封装（basic-ftp）。
 * 独立成模块的原因：service 层不感知 FTP 协议细节，冒烟/单测可整体替换本模块。
 * 不 import electron / 数据库 —— 连接参数由调用方从 file_config 取出后传入。
 */
import { Client } from 'basic-ftp';
import { Readable, Writable } from 'stream';

export interface FtpConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  /** FTP 根目录（相对 FTP 登录根；空串 = 登录根） */
  root: string;
}

/** POSIX 风格拼接（FTP 路径恒用 /，Windows 的 \ 不适用）。
 * 导出供 service 复用：FTP 记录的展示用完整路径需同规则拼接 */
export function joinRemote(root: string, relDir: string, fileName: string): string {
  const dir = [root.replace(/\/+$/, ''), relDir.replace(/^\/+|\/+$/g, '')].filter((s) => s !== '').join('/');
  return dir ? `${dir}/${fileName}` : fileName;
}

/** 上传二进制到 FTP：ensureDir 逐级建目录后写入。
 * 抛错即失败（网络/凭据/磁盘），由 service 层决定如何呈现给用户 */
export async function ftpPut(cfg: FtpConnectionConfig, relDir: string, fileName: string, data: Uint8Array): Promise<void> {
  const client = new Client(20000);
  try {
    await client.access({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      secure: cfg.secure,
    });
    const remote = joinRemote(cfg.root, relDir, fileName);
    // 只取父目录 ensureDir：uploadFrom 需要目录已存在
    const dir = remote.slice(0, remote.lastIndexOf('/'));
    if (dir) await client.ensureDir(dir);
    await client.uploadFrom(Readable.from(Buffer.from(data)), remote);
  } finally {
    client.close();
  }
}

/** 下载 FTP 文件到内存：Writable 逐块收集后合并。
 * 下载用途是「另存到本地目录」，与删除不同——文件不存在必须报错（用户要的是内容） */
export async function ftpDownload(cfg: FtpConnectionConfig, relDir: string, fileName: string): Promise<Buffer> {
  const client = new Client(20000);
  try {
    await client.access({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      secure: cfg.secure,
    });
    const remote = joinRemote(cfg.root, relDir, fileName);
    const chunks: Buffer[] = [];
    await client.downloadTo(new Writable({
      write(chunk, _enc, callback) {
        chunks.push(chunk);
        callback();
      },
    }), remote);
    return Buffer.concat(chunks);
  } finally {
    client.close();
  }
}

/** 删除 FTP 上的文件：文件不存在返回 false（视为已清理，不阻塞记录删除）；
 * 其余错误（网络/凭据）抛出，由调用方决定是否阻塞 */
export async function ftpRemove(cfg: FtpConnectionConfig, relDir: string, fileName: string): Promise<boolean> {
  const client = new Client(20000);
  try {
    await client.access({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      secure: cfg.secure,
    });
    const remote = joinRemote(cfg.root, relDir, fileName);
    await client.remove(remote);
    return true;
  } catch (err: any) {
    // FTP 服务端对"文件不存在"的响应码常见 550（Requested action not taken）
    if (typeof err?.code === 'number' && err.code === 550) return false;
    throw err;
  } finally {
    client.close();
  }
}
