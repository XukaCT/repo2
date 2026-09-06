import { create } from 'zustand';
import type { TenderFilters } from '../types/tender.types';

interface TenderStore {
  filters: TenderFilters;
  setFilter: <K extends keyof TenderFilters>(key: K, value: TenderFilters[K]) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
}

const DEFAULT_FILTERS: TenderFilters = {
  page: 1,
  page_size: 20,
  status: 'closed',
};

export const useTenderStore = create<TenderStore>((set) => ({
  filters: DEFAULT_FILTERS,

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value, page: 1 } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  setPage: (page) =>
    set((s) => ({ filters: { ...s.filters, page } })),
}));