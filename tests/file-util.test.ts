import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName, buildStoredName, buildRelativeDir, validateFileUpload, formatFileSize, FILE_MAX_BYTES,
} from '../src/main/file-util';

// 固定日期避免用例随时间漂移（注意 JS 月份从 0 计：8 = 9 月）
const NOW = new Date(2026, 8, 7, 13, 5, 9);

describe('sanitizeFileName', () => {
  it('去除 Windows 非法字符（保留字母）', () => {
    expect(sanitizeFileName('a<b>c:d"e|f?g*h')).toBe('abcdefgh');
  });
  it('路径分隔符分段：剥 .. 穿越段，段间以空格连接', () => {
    expect(sanitizeFileName('sub\\dir\\name.txt')).toBe('sub dir name.txt');
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc passwd');
    expect(sanitizeFileName('a..b.pdf')).toBe('a..b.pdf'); // 名字内合法双点不受影响
  });
  it('压缩连续空白并去除控制字符', () => {
    expect(sanitizeFileName('a \t\r\n b')).toBe('a b');
    expect(sanitizeFileName('x\u0000y')).toBe('xy');
  });
  it('中文文件名原样保留', () => {
    expect(sanitizeFileName('验收 清单 v1.pdf')).toBe('验收 清单 v1.pdf');
  });
  it('全非法输入得到空串（由 validate 兜底拒绝）', () => {
    expect(sanitizeFileName('???***')).toBe('');
  });
});

describe('buildStoredName', () => {
  it('时间戳-随机-原名三段结构', () => {
    const name = buildStoredName('报告.pdf', NOW);
    expect(name).toMatch(/^20260907130509-[a-z0-9]{6}-报告\.pdf$/);
  });
  it('原名经清洗：非法字符不进存储名', () => {
    const name = buildStoredName('bad:name?.txt', NOW);
    expect(name).toMatch(/^20260907130509-[a-z0-9]{6}-badname\.txt$/);
  });
  it('空名兜底为 file（不产生空段）', () => {
    expect(buildStoredName('???', NOW)).toMatch(/-file$/);
  });
});

describe('buildRelativeDir', () => {
  it('按月分桶 yyyy/MM/ 且以 / 结尾', () => {
    expect(buildRelativeDir(NOW)).toBe('2026/09/');
  });
  it('月份补零', () => {
    expect(buildRelativeDir(new Date(2026, 0, 15))).toBe('2026/01/');
  });
});

describe('validateFileUpload', () => {
  it('正常文件通过', () => {
    expect(validateFileUpload('a.pdf', 1024)).toBeNull();
  });
  it('空名/清洗后为空被拒', () => {
    expect(validateFileUpload('???', 1024)).toContain('文件名');
    expect(validateFileUpload('', 1024)).toContain('文件名');
  });
  it('超长文件名被拒', () => {
    expect(validateFileUpload('x'.repeat(201), 1024)).toContain('过长');
  });
  it('空内容与超限被拒', () => {
    expect(validateFileUpload('a.pdf', 0)).toContain('空');
    expect(validateFileUpload('a.pdf', FILE_MAX_BYTES + 1)).toContain('20MB');
    expect(validateFileUpload('a.pdf', FILE_MAX_BYTES)).toBeNull(); // 恰在上限内通过
  });
});

describe('formatFileSize', () => {
  it('各级单位与进位', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });
});
