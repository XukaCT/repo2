// ── useTenders.ts ────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { getTenders, getTenderById, tendersApi } from '../api/endpoints/tenders.api';
import type {
  OverviewStats,
  SectorStat,
  StateStat,
  SourceStatsBySource,
} from '../types/tender.types';

export function useTenders(filters: any = {}) {
  return useQuery<{ items: any[], total: number, page: number, page_size: number, total_pages?: number }>({
    queryKey: ['tenders', filters],
    queryFn: () => getTenders(filters),
    initialData: { items: [], total: 0, page: 1, page_size: 15 },
  });
}

export function useTender(id: string) {
  return useQuery<{ message: any }>({
    queryKey: ['tender', id],
    queryFn: () => getTenderById(id),
    enabled: !!id, // Only run if an ID is passed
  });
}

export function useOverviewStats() {
  return useQuery<OverviewStats>({
    queryKey: ['overview-stats'],
    queryFn: tendersApi.overview,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSectorStats() {
  return useQuery<SectorStat[]>({
    queryKey: ['sector-stats'],
    queryFn: tendersApi.bySector,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStateStats() {
  return useQuery<StateStat[]>({
    queryKey: ['state-stats'],
    queryFn: tendersApi.byState,
    staleTime: 5 * 60 * 1000,
  });
}
export function useSourceStats() {
  return useQuery<SourceStatsBySource>({
    queryKey: ['source-stats'],
    queryFn: tendersApi.bySource,
    staleTime: 5 * 60 * 1000,
  });
}