import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { SearchOutlined, ReloadOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import Select from '../Select/Select';
import type { SelectOption } from '../Select/Select';
import TreeSelect from '../TreeSelect/TreeSelect';
import type { TreeNode } from '../TreeSelect/TreeSelect';
import './QueryForm.css';

/** 查询条件值：文本/单选为 string，多选为 string[] */
export type QueryValue = string | string[];

/** 下拉选项：value 取用（id），label 展示（name），可携带任意附加属性 */
export type QueryOption = SelectOption;

/** 树形选项节点 */
export type QueryTreeNode = TreeNode;

/** 字段公共配置 */
interface QueryFieldBase {
  /** 字段名，作为 onSearch 回传对象的 key */
  name: string;
  label: string;
  placeholder?: string;
  /** 初始值；缺省时按类型自动取空值（单选/输入为 ''，多选为 []） */
  initialValue?: QueryValue;
  /** 栅格列跨度，默认 1 */
  span?: number;
}

/** 文本输入（模糊查询）字段 */
export interface QueryInputField extends QueryFieldBase {
  type: 'input';
}

/** 列表选择字段：单选 / 多选，支持模糊搜索、选项携带多属性（展示 name 取 id） */
export interface QuerySelectField extends QueryFieldBase {
  type: 'select';
  options: QueryOption[];
  /** 为 true 时为多选 */
  multiple?: boolean;
  /** 面板内模糊搜索 */
  showSearch?: boolean;
  /** 多选标签最多展示数，超出折叠为 +N */
  maxTagCount?: number;
  /** 自定义选项渲染，默认展示 label */
  optionRender?: (option: QueryOption) => ReactNode;
}

/** 树形下拉选择字段 */
export interface QueryTreeSelectField extends QueryFieldBase {
  type: 'treeSelect';
  treeData: QueryTreeNode[];
  multiple?: boolean;
  showSearch?: boolean;
  maxTagCount?: number;
}

/** 查询字段配置联合类型 —— 新增字段类型时在此扩展 */
export type QueryFieldConfig = QueryInputField | QuerySelectField | QueryTreeSelectField;

interface QueryFormProps {
  fields: QueryFieldConfig[];
  /** 每行列数，默认 3 */
  columns?: number;
  /** 外部指定的初始值，优先级高于字段自身的 initialValue */
  defaultValues?: Record<string, QueryValue>;
  /** 查询回调：点击查询 / 重置 / 输入回车均会触发 */
  onSearch: (values: Record<string, QueryValue>) => void;
  /** 重置后的额外回调 */
  onReset?: (values: Record<string, QueryValue>) => void;
  /** 加载态：禁用查询/重置按钮，避免重复提交 */
  loading?: boolean;
  /** 是否允许折叠，默认 true（字段数超过列数时自动出现展开/收起） */
  collapsible?: boolean;
}

/** 依据字段类型给出空值：多选返回 []，其余返回 '' */
function emptyValueOf(field: QueryFieldConfig): QueryValue {
  const multi =
    (field.type === 'select' || field.type === 'treeSelect') && field.multiple;
  return multi ? [] : '';
}

/** 组装各字段的初始值对象 */
function buildInitialValues(
  fields: QueryFieldConfig[],
  defaultValues?: Record<string, QueryValue>
): Record<string, QueryValue> {
  const values: Record<string, QueryValue> = {};
  for (const field of fields) {
    const preset = defaultValues?.[field.name] ?? field.initialValue;
    values[field.name] = preset ?? emptyValueOf(field);
  }
  return values;
}

/**
 * 通用查询表单（核心基础组件）。
 *
 * 设计目标：以「字段配置驱动」屏蔽各类控件差异，业务侧只需声明字段即可，
 * 无需关心具体渲染。当前支持的字段类型：
 * - input       文本模糊查询
 * - select      列表选择（单选 / 多选），选项可携带多属性、展示 name 取 id，支持模糊搜索
 * - treeSelect  树形下拉选择（单选 / 多选），支持模糊搜索
 *
 * 本组件只负责「条件收集 + 查询/重置动作」，分页与列表展示由 QueryTableLayout 组合，
 * 保持职责单一。`onSearch` 在查询 / 重置 / 输入回车时触发。
 */
function QueryForm({
  fields,
  columns = 3,
  defaultValues,
  onSearch,
  onReset,
  loading = false,
  collapsible = true,
}: QueryFormProps) {
  const [values, setValues] = useState<Record<string, QueryValue>>(() =>
    buildInitialValues(fields, defaultValues)
  );
  const [collapsed, setCollapsed] = useState(true);

  // 字段数超过一屏才需要折叠
  const showCollapseToggle = collapsible && fields.length > columns;
  const visibleFields = collapsed && showCollapseToggle ? fields.slice(0, columns) : fields;

  const handleChange = useCallback((name: string, value: QueryValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    // 传浅拷贝，避免父级持有内部 state 引用
    onSearch({ ...values });
  }, [onSearch, values]);

  const handleReset = useCallback(() => {
    const cleared = buildInitialValues(fields); // 重置即清空全部条件
    setValues(cleared);
    onSearch({ ...cleared });
    onReset?.({ ...cleared });
  }, [fields, onSearch, onReset]);

  /** 单个字段控件：按类型分发到对应的通用组件 */
  const renderControl = (field: QueryFieldConfig) => {
    switch (field.type) {
      case 'select':
        return (
          <Select
            value={values[field.name]}
            options={field.options}
            mode={field.multiple ? 'multiple' : undefined}
            placeholder={field.placeholder || `请选择${field.label}`}
            showSearch={field.showSearch}
            maxTagCount={field.maxTagCount}
            optionRender={field.optionRender}
            onChange={(v) => handleChange(field.name, v)}
          />
        );
      case 'treeSelect':
        return (
          <TreeSelect
            value={values[field.name]}
            treeData={field.treeData}
            multiple={field.multiple}
            placeholder={field.placeholder || `请选择${field.label}`}
            showSearch={field.showSearch}
            maxTagCount={field.maxTagCount}
            onChange={(v) => handleChange(field.name, v)}
          />
        );
      case 'input':
      default:
        return (
          <input
            className="query-input"
            type="text"
            placeholder={field.placeholder || `请输入${field.label}`}
            value={(values[field.name] as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        );
    }
  };

  return (
    <div className="query-form">
      <div
        className="query-fields"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {visibleFields.map((field) => (
          <div
            className="query-field"
            key={field.name}
            style={{ gridColumn: `span ${field.span ?? 1}` }}
          >
            <label className="query-label">{field.label}</label>
            <div className="query-control">{renderControl(field)}</div>
          </div>
        ))}
      </div>

      <div className="query-actions">
        {showCollapseToggle && (
          <button className="btn-collapse" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '展开' : '收起'}
            {collapsed ? <DownOutlined /> : <UpOutlined />}
          </button>
        )}
        <button className="btn-reset" onClick={handleReset} disabled={loading}>
          <ReloadOutlined />
          重置
        </button>
        <button className="btn-search" onClick={handleSearch} disabled={loading}>
          <SearchOutlined />
          查询
        </button>
      </div>
    </div>
  );
}

export default QueryForm;
