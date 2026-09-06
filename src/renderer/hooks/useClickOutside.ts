import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * 点击元素外部时触发回调。
 *
 * 用于下拉框、弹出面板等需要「点击空白处关闭」的通用组件，
 * 避免在每个组件里重复书写 document 事件监听与清理逻辑。
 *
 * @param ref     需要监听的容器 ref，落在该容器之外的 mousedown 才视为「外部点击」
 * @param handler 外部点击回调
 * @param active  是否启用监听；传 false 时不绑定任何事件（如弹层未打开）
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  handler: () => void,
  active = true
): void {
  useEffect(() => {
    if (!active) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      // 未挂载或点击发生在容器内部，忽略
      if (!el || el.contains(event.target as Node)) return;
      handler();
    };

    // 用 mousedown 而非 click，可在按钮 click 之前先行收起，避免与点击态冲突
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, active]);
}
