import { describe, it, expect } from 'vitest';
import { buildDocNumber, resetKey, padSeq, validateDocRule } from '../src/main/doc-number';

// 用固定日期避免「今天」漂移导致测试随时间变红：2026-09-07。
// 注意 JS 月份从 0 计：8 = 九月（经典陷阱，故特意用注释标出）
const NOW = new Date(2026, 8, 7);

describe('resetKey（周期键折叠）', () => {
  it('never → 空串（所有流水共用一行计数）', () => {
    expect(resetKey('never', NOW)).toBe('');
  });

  it('daily → yyyyMMdd', () => {
    expect(resetKey('daily', NOW)).toBe('20260907');
  });

  it('monthly → yyyyMM；yearly → yyyy', () => {
    expect(resetKey('monthly', NOW)).toBe('202609');
    expect(resetKey('yearly', NOW)).toBe('2026');
  });

  it('跨天换键：daily 周期键随日期变化（新周期自动从 1 重计）', () => {
    expect(resetKey('daily', new Date(2026, 8, 8))).not.toBe(resetKey('daily', NOW));
  });
});

describe('padSeq（流水补零）', () => {
  it('不足位数左补零', () => {
    expect(padSeq(1, 4)).toBe('0001');
  });

  it('超出位数不截断（截断会造成重号）', () => {
    expect(padSeq(12345, 4)).toBe('12345');
  });
});

describe('buildDocNumber（组装）', () => {
  const base = { prefix: 'PO', dateType: 'yyyyMMdd' as const, seqLength: 4, separator: '-' };

  it('前缀 + 日期 + 流水全量拼接', () => {
    expect(buildDocNumber(base, 1, NOW)).toBe('PO-20260907-0001');
  });

  it('dateType=none 跳过日期段', () => {
    expect(buildDocNumber({ ...base, dateType: 'none' }, 12, NOW)).toBe('PO-0012');
  });

  it('前缀为空跳过前缀段', () => {
    expect(buildDocNumber({ ...base, prefix: '' }, 1, NOW)).toBe('20260907-0001');
  });

  it('分隔符为空时直接连接', () => {
    expect(buildDocNumber({ ...base, separator: '' }, 1, NOW)).toBe('PO202609070001');
  });

  it('流水超出位数不截断', () => {
    expect(buildDocNumber(base, 12345, NOW)).toBe('PO-20260907-12345');
  });
});

describe('validateDocRule（入参校验）', () => {
  const ok = { code: 'PO', name: '采购入库单', seqLength: 4 };

  it('合法输入返回空串', () => {
    expect(validateDocRule(ok)).toBe('');
  });

  it('code 小写被拒；数字开头被拒；单字符被拒', () => {
    expect(validateDocRule({ ...ok, code: 'po' })).not.toBe('');
    expect(validateDocRule({ ...ok, code: '1PO' })).not.toBe('');
    expect(validateDocRule({ ...ok, code: 'P' })).not.toBe('');
  });

  it('seqLength 越界（0 / 9 / 小数）被拒', () => {
    expect(validateDocRule({ ...ok, seqLength: 0 })).not.toBe('');
    expect(validateDocRule({ ...ok, seqLength: 9 })).not.toBe('');
    expect(validateDocRule({ ...ok, seqLength: 2.5 })).not.toBe('');
  });

  it('name 为空被拒；前缀/分隔符超长被拒', () => {
    expect(validateDocRule({ ...ok, name: '  ' })).not.toBe('');
    expect(validateDocRule({ ...ok, prefix: 'x'.repeat(17) })).not.toBe('');
    expect(validateDocRule({ ...ok, separator: '-----' })).not.toBe('');
  });
});
