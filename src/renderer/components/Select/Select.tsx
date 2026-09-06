import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DownOutlined,
  CloseCircleFilled,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useClickOutside } from '../../hooks/useClickOutside';
import './Select.css';

/**
 * 下拉选项。
 * - value：实际取用的值（通常是 id）
 * - label：展示的名称（name）
 * 其余任意字段均可自由附加（如 code / desc / color），配合 optionRender 展示多属性，
 * 从而满足「下拉框具有多个属性、展示 name 取 id」的通用诉求。
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  [extra: string]: unknown;
}

export type SelectValue = string | string[];

export interface SelectProps {
  /** 选项数据源 */
  options: SelectOption[];
  /** 受控值 */
  value?: SelectValue;
  /** 非受控初始值 */
  defaultValue?: SelectValue;
  /** 值变化回调；多选回传 string[]，单选回传 string */
  onChange?: (value: SelectValue) => void;
  /** 'multiple' 为多选 */
  mode?: 'multiple';
  placeholder?: string;
  /** 是否展示右侧清除按钮 */
  allowClear?: boolean;
  disabled?: boolean;
  /** 是否在面板顶部展示搜索框（按 label 做模糊匹配） */
  showSearch?: boolean;
  /** 多选时最多直接展示的标签数，超出折叠为 +N */
  maxTagCount?: number;
  /** 自定义选项渲染；默认渲染 label */
  optionRender?: (option: SelectOption) => ReactNode;
  className?: string;
}

/** 归一化：把受控/非受控、单选/多选的入参统一成数组，内部逻辑只处理数组 */
function toArray(value: SelectValue | undefined): string[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * 通用下拉选择器。
 *
 * 覆盖能力：单选 / 多选、模糊搜索、选项携带多属性（展示 name 取 id）、可清除、
 * 多选标签折叠。同时支持受控与非受控两种用法，便于被 QueryForm 等业务组件复用。
 */
function Select({
  options,
  value,
  defaultValue,
  onChange,
  mode,
  placeholder = '请选择',
  allowClear = true,
  disabled = false,
  showSearch = false,
  maxTagCount,
  optionRender,
  className = '',
}: SelectProps) {
  const multiple = mode === 'multiple';

  // 受控优先：外部传 value 时用外部值，否则用内部 state
  const [inner, setInner] = useState<SelectValue>(defaultValue ?? (multiple ? [] : ''));
  const current = value !== undefined ? value : inner;
  const selected = useMemo(() => toArray(current), [current]);

  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setKeyword(''); // 关闭时清空搜索词，下次打开是完整列表
  }, []);
  useClickOutside(rootRef, close, open);

  // value -> option 映射，供触发器回显 label
  const optionMap = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options]
  );

  // 关键词过滤（模糊匹配 label，大小写不敏感）
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!showSearch || !kw) return options;
    return options.filter((o) => o.label.toLowerCase().includes(kw));
  }, [options, keyword, showSearch]);

  const emit = (next: SelectValue) => {
    if (value === undefined) setInner(next); // 非受控时维护内部 state
    onChange?.(next);
  };

  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return;
    if (!multiple) {
      emit(option.value);
      close();
      return;
    }
    const next = selected.includes(option.value)
      ? selected.filter((v) => v !== option.value)
      : [...selected, option.value];
    emit(next);
  };

  const handleRemoveTag = (removed: string) => {
    emit(selected.filter((v) => v !== removed));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    emit(multiple ? [] : '');
  };

  const hasValue = selected.length > 0;
  const visibleTags =
    multiple && maxTagCount !== undefined ? selected.slice(0, maxTagCount) : selected;
  const hiddenCount = multiple ? selected.length - visibleTags.length : 0;

  return (
    <div
      className={`ui-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      ref={rootRef}
    >
      {/* 触发器 */}
      <div
        className="ui-select-selector"
        onClick={() => !disabled && setOpen((v) => !v)}
        role="combobox"
        aria-expanded={open}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && setOpen((v) => !v)}
      >
        <div className="ui-select-content">
          {hasValue ? (
            multiple ? (
              <>
                {visibleTags.map((v) => (
                  <span className="ui-select-tag" key={v}>
                    <span className="ui-select-tag-text">{optionMap.get(v)?.label ?? v}</span>
                    <CloseOutlined
                      className="ui-select-tag-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTag(v);
                      }}
                    />
                  </span>
                ))}
                {hiddenCount > 0 && (
                  <span className="ui-select-tag ui-select-tag-more">+{hiddenCount}</span>
                )}
              </>
            ) : (
              <span className="ui-select-single">
                {optionMap.get(selected[0])?.label ?? selected[0]}
              </span>
            )
          ) : (
            <span className="ui-select-placeholder">{placeholder}</span>
          )}
        </div>

        {allowClear && hasValue && !disabled ? (
          <CloseCircleFilled className="ui-select-clear" onClick={handleClear} />
        ) : (
          <DownOutlined className="ui-select-arrow" />
        )}
      </div>

      {/* 下拉面板 */}
      {open && (
        <div className="ui-select-dropdown">
          {showSearch && (
            <div className="ui-select-search">
              <input
                autoFocus
                className="ui-select-search-input"
                placeholder="搜索"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <ul className="ui-select-list">
            {filtered.length === 0 && <li className="ui-select-empty">无匹配数据</li>}
            {filtered.map((option) => {
              const active = selected.includes(option.value);
              return (
                <li
                  key={option.value}
                  className={`ui-select-option ${active ? 'active' : ''} ${
                    option.disabled ? 'disabled' : ''
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  {multiple && (
                    <span className={`ui-select-checkbox ${active ? 'checked' : ''}`}>
                      {active && <CheckOutlined />}
                    </span>
                  )}
                  <span className="ui-select-option-main">
                    {optionRender ? optionRender(option) : option.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Select;
