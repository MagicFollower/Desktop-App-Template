/**
 * 文件名/路径纯函数（文件管理功能）。
 * 与 doc-number.ts 同样的分层约定：不依赖 electron / 数据库，可被单测直接导入。
 *
 * 安全边界说明：渲染端传入的文件名是不可信输入——可能包含路径分隔符（路径穿越）、
 * 控制字符、非法 Windows 文件名字符。所有落盘/拼接存储名的入口必须先过 sanitizeFileName。
 */

/** 清洗文件名：先按路径分隔符分段并剥 .. 穿越段，再逐段去 Windows 非法字符/控制字符、压缩空白，
 * 段间以空格连接（原分隔符不进文件名）；中文等 Unicode 正常保留。
 * 注意顺序：先分段后清洗——若先删分隔符，`../../etc/passwd` 会连成 `....etcpasswd`，穿越段再也剥不掉 */
export function sanitizeFileName(name: string): string {
  return name
    .split(/[\\/]/)
    .filter((seg) => seg !== '..' && seg !== '.')
    .map((seg) => seg.replace(/[:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim()) // eslint-disable-line no-control-regex -- 清洗不可信输入中的控制字符，属安全刚需
    .filter((seg) => seg !== '')
    .join(' ');
}

/** 生成存储名：`yyyyMMddHHmmss-<随机6位>-<清洗后的原始名>`。
 * 时间戳 + 随机前缀保证同毫秒上传同名文件不冲突；保留原始名便于人工排查 */
export function buildStoredName(originalName: string, now: Date): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const rand = Math.random().toString(36).slice(2, 8).padStart(6, '0');
  const safe = sanitizeFileName(originalName) || 'file';
  return `${stamp}-${rand}-${safe}`;
}

/** 相对目录：按月分桶（yyyy/MM/），避免单目录文件数无上限膨胀。
 * 返回值恒以 / 结尾且不含 ..（由数字构成，天然安全） */
export function buildRelativeDir(now: Date): string {
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/`;
}

/** 单文件大小上限（20MB）：IPC 结构化克隆整块传输，过大的文件会撑爆渲染/主进程内存。
 * 生产项目应改分片上传/流式管道；模板级以显式上限 + 明确报错兜底 */
export const FILE_MAX_BYTES = 20 * 1024 * 1024;

/** 上传入参校验（service 层最后防线）：返回错误消息，null 表示通过 */
export function validateFileUpload(name: string, size: number): string | null {
  const safe = sanitizeFileName(name);
  if (!safe) return '文件名不能为空';
  if (safe.length > 200) return '文件名过长（清洗后超过 200 字符）';
  if (size <= 0) return '文件内容为空';
  if (size > FILE_MAX_BYTES) return `单文件大小不能超过 ${FILE_MAX_BYTES / 1024 / 1024}MB`;
  return null;
}

/** 字节数 → 人类可读（渲染端展示用；等价实现放主进程便于复用与单测） */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}
