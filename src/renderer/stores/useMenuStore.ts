import { create } from 'zustand';
import type { MenuState } from '../types/menu';

export const useMenuStore = create<MenuState>((set) => ({
  selectedId: null,
  expandedIds: [],
  setSelected: (id: string) => set({ selectedId: id }),
  toggleExpanded: (id: string) =>
    set((state) => ({
      expandedIds: state.expandedIds.includes(id)
        ? state.expandedIds.filter((i) => i !== id)
        : [...state.expandedIds, id],
    })),
  ensureExpanded: (id: string) =>
    set((state) => ({
      expandedIds: state.expandedIds.includes(id)
        ? state.expandedIds
        : [...state.expandedIds, id],
    })),
}));
