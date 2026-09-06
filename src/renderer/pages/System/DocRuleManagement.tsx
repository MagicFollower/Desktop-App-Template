import { useState } from 'react';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import QueryForm from '../../components/QueryForm/QueryForm';
import type { QueryFieldConfig } from '../../components/QueryForm/QueryForm';
import QueryTableLayout from '../../components/QueryTableLayout/QueryTableLayout';
import Pagination from '../../components/Pagination/Pagination';
import Modal from '../../components/Modal/Modal';
import { useQueryTable } from '../../hooks/useQueryTable';
import type { QueryParams } from '../../hooks/useQueryTable';
import type { DocRuleRecord, DocRuleInput, DocDateType, DocResetPolicy } from '../../services/sqlite';
import { loadDocRules, saveDocRule, deleteDocRule, nextDocNumber } from '../../services/sqlite';
import './DocRuleManagement.css';

const DATE_TYPE_LABELS: Record<DocDateType, string> = {
  none: '无日期',
  yyyy: '年（2026）',
  yyyyMM: '年月（202609）',
  yyyyMMdd: '年月日（20260907）',
};

const RESET_POLICY_LABELS: Record<DocResetPolicy, string> = {
  never: '不重置',
  daily: '每日',
  monthly: '每月',
  yearly: '每年',
};

const queryFields: QueryFieldConfig[] = [
  { name: 'code', label: '单据编码', type: 'input' },
  { name: 'name', label: '规则名称', type: 'input' },
  {
    name: 'enabled',
    label: '状态',
    type: 'select',
    options: [
      { value: 'enabled', label: '启用' },
      { value: 'disabled', label: '停用' },
    ],
  },
];

const asStr = (v?: QueryParams[string]): string => (typeof v === 'string' ? v : '');

/** 客户端过滤：纯函数、模块作用域（useQueryTable 的 filter 约定） */
function filterDocRules(records: DocRuleRecord[], query: QueryParams): DocRuleRecord[] {
  const code = asStr(query.code);
  const name = asStr(query.name);
  const enabled = asStr(query.enabled);
  return records.filter((r) => {
    if (code && !r.code.includes(code)) return false;
    if (name && !r.name.includes(name)) return false;
    if (enabled === 'enabled' && !r.enabled) return false;
    if (enabled === 'disabled' && r.enabled) return false;
    return true;
  });
}

interface DocFormState {
  id: string | null;
  code: string;
  name: string;
  prefix: string;
  dateType: DocDateType;
  seqLength: number;
  resetPolicy: DocResetPolicy;
  separator: string;
  enabled: boolean;
  remark: string;
}

const emptyForm: DocFormState = {
  id: null,
  code: '',
  name: '',
  prefix: '',
  dateType: 'yyyyMMdd',
  seqLength: 4,
  resetPolicy: 'never',
  separator: '',
  enabled: true,
  remark: '',
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 预览组装：与主进程 doc-number.ts 的 buildDocNumber 保持一致的渲染端版本。
 * 不直接 import 主进程模块的原因：src/main 的运行时代码不进渲染 bundle
 * （跨进程只共享 type），预览逻辑仅 10 行，复制成本低于耦合成本。
 */
function previewDocNumber(r: Pick<DocFormState, 'prefix' | 'dateType' | 'seqLength' | 'separator'>): string {
  const now = new Date();
  const date =
    r.dateType === 'none' ? '' :
    r.dateType === 'yyyy' ? `${now.getFullYear()}` :
    r.dateType === 'yyyyMM' ? `${now.getFullYear()}${pad2(now.getMonth() + 1)}` :
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  // 预览用流水号 1，不消耗计数器——取号测试才是计数器唯一入口
  const seq = '1'.padStart(r.seqLength, '0');
  return [r.prefix, date, seq].filter((s) => s !== '').join(r.separator);
}

function DocRuleManagement() {
  const {
    loading,
    rows: pagedRules,
    total,
    page,
    pageSize,
    search,
    reload,
    onPageChange,
  } = useQueryTable<DocRuleRecord>({
    fetcher: () => loadDocRules(),
    filter: filterDocRules,
  });

  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<DocFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DocRuleRecord | null>(null);
  const [saveError, setSaveError] = useState('');
  const [numberResult, setNumberResult] = useState<{ code: string; number: string } | null>(null);
  const [numberError, setNumberError] = useState('');

  const openAdd = () => {
    setForm(emptyForm);
    setSaveError('');
    setFormVisible(true);
  };

  const openEdit = (rule: DocRuleRecord) => {
    setForm({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      prefix: rule.prefix,
      dateType: rule.dateType,
      seqLength: rule.seqLength,
      resetPolicy: rule.resetPolicy,
      separator: rule.separator,
      enabled: rule.enabled,
      remark: rule.remark,
    });
    setSaveError('');
    setFormVisible(true);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!/^[A-Z][A-Z0-9_-]{1,15}$/.test(form.code)) {
      setSaveError('单据编码需以字母开头，2-16 位大写字母/数字/_/-');
      return;
    }
    if (!form.name.trim()) {
      setSaveError('请输入规则名称');
      return;
    }
    if (form.seqLength < 1 || form.seqLength > 8) {
      setSaveError('流水号位数需为 1-8');
      return;
    }

    // 表单已暴露全部字段，无需像 UserManagement 那样合入 original；
    // id 由列表行带入（编辑）或此处生成（新增），UPSERT 自动区分
    const input: DocRuleInput = {
      id: form.id ?? `doc-${Date.now()}`,
      code: form.code.trim(),
      name: form.name.trim(),
      prefix: form.prefix.trim(),
      dateType: form.dateType,
      seqLength: form.seqLength,
      resetPolicy: form.resetPolicy,
      separator: form.separator,
      enabled: form.enabled,
      remark: form.remark.trim(),
    };

    try {
      await saveDocRule(input);
      await reload();
      setFormVisible(false);
    } catch (err) {
      // 例：code 与其他规则重复时 SQLite UNIQUE 约束在此浮出
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDocRule(deleteTarget.id);
    setDeleteTarget(null);
    // 删除后刷新一次；若当前页因总数变少越界，useQueryTable 会自动收敛页码
    await reload();
  };

  const handleTestNumber = async (rule: DocRuleRecord) => {
    setNumberError('');
    setNumberResult(null);
    try {
      // 真实取号（计数器 +1）：验收流水递增无需会 SQL 的人
      const number = await nextDocNumber(rule.code);
      setNumberResult({ code: rule.code, number });
    } catch (err) {
      setNumberError(err instanceof Error ? err.message : '取号失败');
    }
  };

  return (
    <QueryTableLayout
      loading={loading}
      query={<QueryForm fields={queryFields} onSearch={search} />}
      toolbar={
        <button className="btn-primary" onClick={openAdd}>
          <PlusOutlined /> 新增规则
        </button>
      }
      pagination={
        total > 0 ? (
          <Pagination current={page} pageSize={pageSize} total={total} onChange={onPageChange} />
        ) : undefined
      }
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>格式预览</th>
            <th>当前流水</th>
            <th>重置周期</th>
            <th>状态</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {pagedRules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.code}</td>
              <td>{rule.name}</td>
              <td className="doc-preview-cell">{previewDocNumber(rule)}</td>
              <td className="doc-preview-cell">
                {/* 最近被使用的流水值：优先当前周期，无则最近使用过的周期；从未取号显示未使用 */}
                {rule.currentSeq == null ? '未使用' : String(rule.currentSeq).padStart(rule.seqLength, '0')}
              </td>
              <td>{RESET_POLICY_LABELS[rule.resetPolicy]}</td>
              <td>
                <span className={`status-badge ${rule.enabled ? 'active' : 'disabled'}`}>
                  {rule.enabled ? '启用' : '停用'}
                </span>
              </td>
              <td>{rule.remark || '-'}</td>
              <td>
                <button className="btn-link" onClick={() => handleTestNumber(rule)}>
                  <ThunderboltOutlined /> 取号
                </button>
                <button className="btn-link" onClick={() => openEdit(rule)}>编辑</button>
                <button className="btn-link danger" onClick={() => setDeleteTarget(rule)}>删除</button>
              </td>
            </tr>
          ))}
          {total === 0 && (
            <tr>
              <td colSpan={8} className="table-empty">暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 新增/编辑规则弹窗 */}
      <Modal
        visible={formVisible}
        title={form.id ? '编辑规则' : '新增规则'}
        onClose={() => { setFormVisible(false); setSaveError(''); }}
        onConfirm={handleSave}
      >
        <div className="modal-form">
          {saveError && <p style={{ color: 'var(--color-danger)', margin: '0 0 12px', fontSize: '13px' }}>{saveError}</p>}
          <div className="modal-form-row">
            <label>单据编码</label>
            {/* code 是外部取号凭据，编辑时锁定：改 code 会让历史计数与外部引用全部脱钩 */}
            <input
              value={form.code}
              disabled={!!form.id}
              onChange={(e) => { setForm({ ...form, code: e.target.value.toUpperCase() }); setSaveError(''); }}
              placeholder="如 PO / ER / OUT"
            />
          </div>
          <div className="modal-form-row">
            <label>规则名称</label>
            <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setSaveError(''); }} placeholder="如：采购入库单" />
          </div>
          <div className="modal-form-row">
            <label>前缀</label>
            <input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="可空" />
          </div>
          <div className="modal-form-row">
            <label>日期格式</label>
            <select value={form.dateType} onChange={(e) => setForm({ ...form, dateType: e.target.value as DocDateType })}>
              {Object.entries(DATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="modal-form-row">
            <label>流水号位数</label>
            <input
              type="number" min={1} max={8}
              value={form.seqLength}
              onChange={(e) => setForm({ ...form, seqLength: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="modal-form-row">
            <label>重置周期</label>
            <select value={form.resetPolicy} onChange={(e) => setForm({ ...form, resetPolicy: e.target.value as DocResetPolicy })}>
              {Object.entries(RESET_POLICY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="modal-form-row">
            <label>分隔符</label>
            <input value={form.separator} onChange={(e) => setForm({ ...form, separator: e.target.value })} placeholder="可空，如 -" />
          </div>
          <div className="modal-form-row">
            <label>状态</label>
            <select value={form.enabled ? '1' : '0'} onChange={(e) => setForm({ ...form, enabled: e.target.value === '1' })}>
              <option value="1">启用</option>
              <option value="0">停用</option>
            </select>
          </div>
          <div className="modal-form-row">
            <label>备注</label>
            <input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="可空" />
          </div>
          <div className="doc-preview-box">
            <div className="doc-preview-label">单据号预览（当前配置 + 流水号 1）</div>
            {previewDocNumber(form) || '（空配置）'}
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        visible={deleteTarget !== null}
        title="删除确认"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmText="删 除"
      >
        <p className="delete-confirm-text">
          确定要删除规则 <strong>{deleteTarget?.code}（{deleteTarget?.name}）</strong> 吗？
          其流水计数将一并清除，此操作不可恢复。
        </p>
      </Modal>

      {/* 取号结果弹窗 */}
      <Modal
        visible={numberResult !== null || !!numberError}
        title="取号测试"
        onClose={() => { setNumberResult(null); setNumberError(''); }}
      >
        {numberError
          ? <p className="delete-confirm-text">{numberError}</p>
          : <p className="delete-confirm-text">单据 <strong>{numberResult?.code}</strong> 的下一个号码：</p>}
        {numberResult && <div className="doc-preview-box">{numberResult.number}</div>}
      </Modal>
    </QueryTableLayout>
  );
}

export default DocRuleManagement;
