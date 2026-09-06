import type { DocDateType, DocResetPolicy, DocRuleRecord } from './dto';

/**
 * 单据号规则的纯逻辑：不碰数据库、不碰 Electron。
 * 单测见 tests/doc-number.test.ts——正因为它纯，才测得起。
 *
 * 设计要点（详见 doc/新手实战-单据号规则功能从零到验收.md 第 2 章）：
 * - 重置周期用 reset_key 周期键折叠（如 daily → '20260907'），
 *   跨周期自然落到新 key 上从 1 重计，无需定时任务、无需删旧数据；
 * - 流水号超出位数时补零不截断（截断会造成重号）。
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 日期段格式化：none → 空串（该段被跳过） */
export function formatDateSegment(dateType: DocDateType, now: Date): string {
  switch (dateType) {
    case 'yyyy': return `${now.getFullYear()}`;
    case 'yyyyMM': return `${now.getFullYear()}${pad2(now.getMonth() + 1)}`;
    case 'yyyyMMdd': return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    case 'none': default: return '';
  }
}

/** 流水号补零：位数内左补 0，超出位数不截断（截断会造成重号） */
export function padSeq(seq: number, length: number): string {
  return String(seq).padStart(length, '0');
}

/** 重置周期键：把"当前时间"折叠成周期标识。never → ''（所有流水共用一行计数） */
export function resetKey(policy: DocResetPolicy, now: Date): string {
  switch (policy) {
    case 'daily': return formatDateSegment('yyyyMMdd', now);
    case 'monthly': return formatDateSegment('yyyyMM', now);
    case 'yearly': return formatDateSegment('yyyy', now);
    case 'never': default: return '';
  }
}

/** 组装单据号：前缀/日期为空的段自动跳过，剩余段用分隔符连接 */
export function buildDocNumber(
  rule: Pick<DocRuleRecord, 'prefix' | 'dateType' | 'seqLength' | 'separator'>,
  seq: number,
  now: Date,
): string {
  const segments = [rule.prefix, formatDateSegment(rule.dateType, now), padSeq(seq, rule.seqLength)]
    .filter((s) => s !== '');
  return segments.join(rule.separator);
}

/** 入参校验（service 层最后防线）：返回错误消息，空串 = 通过 */
export function validateDocRule(input: {
  code: string; name: string; seqLength: number; prefix?: string; separator?: string;
}): string {
  if (!/^[A-Z][A-Z0-9_-]{1,15}$/.test(input.code)) return '单据编码需以字母开头，2-16 位大写字母/数字/_/-';
  if (!input.name.trim()) return '请输入规则名称';
  if (!Number.isInteger(input.seqLength) || input.seqLength < 1 || input.seqLength > 8) {
    return '流水号位数需为 1-8 的整数';
  }
  if ((input.prefix ?? '').length > 16) return '前缀不能超过 16 个字符';
  if ((input.separator ?? '').length > 4) return '分隔符不能超过 4 个字符';
  return '';
}
