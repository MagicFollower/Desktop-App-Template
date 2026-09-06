/**
 * 主进程日志门面（A7）：electron-log 落盘到 userData/logs/main.log，
 * 开发态同时保留终端输出——打包后 console 无处可看，现场问题靠日志文件排查。
 *
 * 兼容性：scripts/ 下的纯 Node 冒烟测试也会加载本模块链（database/service 等），
 * 此时 electron 不可用，require('electron-log/main') 会抛错——捕获后降级为 console，
 * 保证模块链在无 Electron 的环境仍可加载。
 */

interface LeveledLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

let impl: LeveledLogger | null = null;

function getImpl(): LeveledLogger {
  if (impl) return impl;
  try {
    const electronLog = require('electron-log/main') as LeveledLogger & {
      initialize: () => void;
      transports: { file: { maxSize: number } };
    };
    electronLog.initialize();
    // 单文件 5MB，超出后轮转归档（默认保留 3 个旧文件）
    electronLog.transports.file.maxSize = 5 * 1024 * 1024;
    impl = electronLog;
  } catch {
    impl = console as unknown as LeveledLogger;
  }
  return impl;
}

export const logger: LeveledLogger = {
  info: (...args: unknown[]) => getImpl().info(...args),
  warn: (...args: unknown[]) => getImpl().warn(...args),
  error: (...args: unknown[]) => getImpl().error(...args),
};
