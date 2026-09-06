import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueryValue } from '../components/QueryForm/QueryForm';

/** 查询条件集合 */
export type QueryParams = Record<string, QueryValue>;

export interface UseQueryTableConfig<T> {
  /**
   * 数据拉取：内部封装 IPC / HTTP / 兜底，返回全量记录。
   * 客户端过滤与分页在其完成后进行；若走服务端分页，可忽略 rows 直接用 records。
   */
  fetcher: () => Promise<T[]>;
  /**
   * 客户端过滤：给定全量记录与当前查询条件，返回过滤后的列表（用于计算 total 与分页切片）。
   * 必须是纯函数（不依赖组件内可变状态），建议定义在模块作用域，以保证引用稳定、结果可预期。
   */
  filter?: (records: T[], query: QueryParams) => T[];
  /** 初始每页条数，默认 10 */
  initialPageSize?: number;
  /** 是否客户端分页，默认 true；false 时 rows === filtered（树形 / 不分页场景） */
  clientPagination?: boolean;
}

export interface QueryTableState<T> {
  /** 首次加载中（加载完成后恒为 false，刷新不再回到 true，避免卸载查询面板） */
  loading: boolean;
  /** 原始全量记录 */
  records: T[];
  /** 过滤后的全量记录 */
  filtered: T[];
  /** 当前页数据（clientPagination=false 时等于 filtered） */
  rows: T[];
  /** 过滤后总条数 */
  total: number;
  /** 当前页码（已按 total 收敛，恒在合法范围） */
  page: number;
  pageSize: number;
  query: QueryParams;
  /** 重新拉取最新数据（不改动查询条件与页码） */
  reload: () => Promise<void>;
  /** 应用查询条件：设置条件 + 回到第 1 页 + 拉取最新数据 */
  search: (query: QueryParams) => void;
  /** 分页变化：更新页码 / 每页条数 */
  onPageChange: (page: number, pageSize: number) => void;
}

/**
 * 列表/查询页的数据状态管理 Hook。
 *
 * 统一封装「拉取 → 过滤 → 分页」与查询、翻页、刷新，并集中解决一个易错点：
 * React.StrictMode 在开发环境会 double-invoke 挂载副作用，导致首次进入页面查询两次。
 * 这里用 initialized ref 守卫，确保初始化只拉取一次。
 *
 * 依赖设计：fetcher / filter 通过 ref 固化最新引用，因此 reload、search 回调身份稳定，
 * 初始化 effect 只依赖 [reload]，不会因父级重渲染而重复触发。
 */
export function useQueryTable<T>({
  fetcher,
  filter,
  initialPageSize = 10,
  clientPagination = true,
}: UseQueryTableConfig<T>): QueryTableState<T> {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 用 ref 持有最新闭包：回调保持稳定，又能拿到最新的 fetcher / filter
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const reload = useCallback(async () => {
    const data = await fetcherRef.current();
    setRecords(data);
    setLoading(false);
  }, []);

  // 首次挂载只拉取一次：规避 StrictMode 下的双调用
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () => (filterRef.current ? filterRef.current(records, query) : records),
    [records, query]
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // 收敛页码，避免删除/过滤后 total 变小导致停留在越界空页
  const currentPage = Math.min(page, totalPages);

  const rows = useMemo(() => {
    if (!clientPagination) return filtered;
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize, clientPagination]);

  const search = useCallback(
    (next: QueryParams) => {
      setQuery({ ...next });
      setPage(1);
      void reload();
    },
    [reload]
  );

  const onPageChange = useCallback((nextPage: number, nextSize: number) => {
    setPage(nextPage);
    setPageSize(nextSize);
  }, []);

  return {
    loading,
    records,
    filtered,
    rows,
    total,
    page: currentPage,
    pageSize,
    query,
    reload,
    search,
    onPageChange,
  };
}
