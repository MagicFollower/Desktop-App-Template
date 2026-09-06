import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueryTable } from '../src/renderer/hooks/useQueryTable';

interface Row {
  id: number;
  name: string;
}

const makeRows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `row-${i + 1}` }));

describe('useQueryTable（A7 冒烟）', () => {
  it('挂载后拉取一次数据并收敛 loading', async () => {
    const fetcher = vi.fn(async () => makeRows(5));
    const { result } = renderHook(() => useQueryTable<Row>({ fetcher }));

    // fetcher 已 resolve：records 更新、loading 归 false
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.records).toHaveLength(5);
    expect(result.current.total).toBe(5);
  });

  it('rerender 不会重复拉取（StrictMode 双调用守卫的语义）', async () => {
    const fetcher = vi.fn(async () => makeRows(5));
    const { rerender } = renderHook(() => useQueryTable<Row>({ fetcher }));
    await act(async () => {});
    rerender();
    rerender();
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('过滤后 total 变小，越界页码收敛到合法范围', async () => {
    const rows = makeRows(25);
    const fetcher = async () => rows;
    const { result } = renderHook(() =>
      useQueryTable<Row>({
        fetcher,
        filter: (records, query) => (query.keyword ? records.filter((r) => r.name.includes(String(query.keyword))) : records),
        initialPageSize: 10,
      }),
    );
    await act(async () => {});

    // 翻到第 3 页（21–25 条）
    act(() => result.current.onPageChange(3, 10));
    expect(result.current.page).toBe(3);

    // 应用过滤后只剩 5 条：页码应从 3 收敛到 1，且 rows 非空
    act(() => result.current.search({ keyword: 'row-1' }));
    await act(async () => {});
    expect(result.current.page).toBe(1);
    expect(result.current.rows.length).toBeGreaterThan(0);
    expect(result.current.total).toBeLessThanOrEqual(25);
  });

  it('数据被删除后停留在越界页时自动收敛', async () => {
    let rows = makeRows(25);
    const fetcher = async () => rows;
    const { result } = renderHook(() => useQueryTable<Row>({ fetcher, initialPageSize: 10 }));
    await act(async () => {});

    act(() => result.current.onPageChange(3, 10));
    expect(result.current.page).toBe(3);
    expect(result.current.rows).toHaveLength(5);

    // 模拟删除 20 条后 reload：第 3 页已不存在，收敛到第 1 页
    rows = makeRows(5);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.page).toBe(1);
    expect(result.current.rows).toHaveLength(5);
  });

  it('clientPagination=false 时 rows 等于 filtered（不分页场景）', async () => {
    const { result } = renderHook(() =>
      useQueryTable<Row>({ fetcher: async () => makeRows(37), clientPagination: false }),
    );
    await act(async () => {});
    expect(result.current.rows).toHaveLength(37);
    expect(result.current.total).toBe(37);
  });

  it('search 回到第 1 页并应用新条件', async () => {
    const { result } = renderHook(() =>
      useQueryTable<Row>({
        fetcher: async () => makeRows(30),
        filter: (records, query) => (query.keyword ? records.filter((r) => r.name.includes(String(query.keyword))) : records),
        initialPageSize: 10,
      }),
    );
    await act(async () => {});

    act(() => result.current.onPageChange(3, 10));
    act(() => result.current.search({ keyword: 'row-2' }));
    await act(async () => {});
    expect(result.current.page).toBe(1);
    expect(result.current.filtered.every((r) => r.name.includes('row-2'))).toBe(true);
  });
});
