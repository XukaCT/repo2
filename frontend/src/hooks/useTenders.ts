// ── useTenders.ts ────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { tendersApi } from '../api/endpoints/tenders.api';
import type {
  TenderFilters,
  TenderListResponse,
  OverviewStats,
  SectorStat,
  StateStat,
  SourceStatsBySource,
} from '../types/tender.types';

export function useTenders(filters: TenderFilters = {}) {
  return useQuery<TenderListResponse>({
    queryKey: ['tenders', filters],
    queryFn: () => tendersApi.list(filters),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    placeholderData: (prev) => prev,
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