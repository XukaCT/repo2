import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

// ── Types ─────────────────────────────────────────────────────
export interface MonthlyVolume {
  month: string;
  count: number;
}

export interface ValueOverTime {
  month:       string;
  total_value: number;
  count:       number;
}

export interface TopDepartment {
  agency:         string;
  contract_count: number;
  total_value:    number;
  avg_value:      number;
}

export interface AnalyticsSummary {
  total_contracts: number;
  total_value:     number;
  avg_value:       number;
  top_sector:      string | null;
  top_state:       string | null;
}

export interface SourceBreakdown {
  source:      string;
  count:       number;
  total_value: number;
}

export interface StatusBreakdown {
  status: string;
  count:  number;
}

export interface ClosingSoonBucket {
  label: string;
  count: number;
  color: string;
}

export interface ClosingSoon {
  next_30:      number;
  next_60:      number;
  next_90:      number;
  total_active: number;
  buckets:      ClosingSoonBucket[];
}

export interface ValueDistribution {
  range: string;
  count: number;
  color: string;
}

// ── Hooks ─────────────────────────────────────────────────────
const STALE = 5 * 60 * 1000;

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics', 'summary'],
    queryFn:  async () => (await apiClient.get('/analytics/summary')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useMonthlyVolume(dateField: 'close_date' | 'published_date' = 'close_date') {
  return useQuery<MonthlyVolume[]>({
    queryKey: ['analytics', 'monthly-volume', dateField],
    queryFn:  async () => (await apiClient.get(`/analytics/monthly-volume?date_field=${dateField}`)).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useValueOverTime(dateField: 'close_date' | 'published_date' = 'close_date') {
  return useQuery<ValueOverTime[]>({
    queryKey: ['analytics', 'value-over-time', dateField],
    queryFn:  async () => (await apiClient.get(`/analytics/value-over-time?date_field=${dateField}`)).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useTopDepartments(limit = 10) {
  return useQuery<TopDepartment[]>({
    queryKey: ['analytics', 'top-departments', limit],
    queryFn:  async () => (await apiClient.get(`/analytics/top-departments?limit=${limit}`)).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useSourceBreakdown() {
  return useQuery<SourceBreakdown[]>({
    queryKey: ['analytics', 'source-breakdown'],
    queryFn:  async () => (await apiClient.get('/analytics/source-breakdown')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useStatusBreakdown() {
  return useQuery<StatusBreakdown[]>({
    queryKey: ['analytics', 'status-breakdown'],
    queryFn:  async () => (await apiClient.get('/analytics/status-breakdown')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useClosingSoon() {
  return useQuery<ClosingSoon>({
    queryKey: ['analytics', 'closing-soon'],
    queryFn:  async () => (await apiClient.get('/analytics/closing-soon')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useValueDistribution() {
  return useQuery<ValueDistribution[]>({
    queryKey: ['analytics', 'value-distribution'],
    queryFn:  async () => (await apiClient.get('/analytics/value-distribution')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export interface SourceFreshness {
  source:       string;
  label:        string;
  count:        number;
  last_updated: string | null;
  method:       'scheduler' | 'upload';
}

export function useSourceFreshness() {
  return useQuery<SourceFreshness[]>({
    queryKey: ['analytics', 'source-freshness'],
    queryFn:  async () => (await apiClient.get('/analytics/source-freshness')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export interface ClosingByMonth {
  month: string;
  count: number;
}

export interface PipelineData {
  data:    Record<string, string | number>[];
  sources: string[];
}

export function useClosingByMonth(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to', dateTo);
  const qs = params.toString();
  return useQuery<ClosingByMonth[]>({
    queryKey: ['analytics', 'closing-by-month', dateFrom, dateTo],
    queryFn:  async () => (await apiClient.get(`/analytics/closing-by-month${qs ? '?' + qs : ''}`)).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function usePipelineByMonth(
  source:   string = 'all',
  status:   string = 'all',
  dateFrom?: string,
  dateTo?:   string,
) {
  const params = new URLSearchParams({ source, status });
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to', dateTo);
  return useQuery<PipelineData>({
    queryKey: ['analytics', 'pipeline-by-month', source, status, dateFrom, dateTo],
    queryFn:  async () => (await apiClient.get(`/analytics/pipeline-by-month?${params.toString()}`)).data,
    staleTime: STALE,
    retry: 1,
  });
}

export interface WinWindowData {
  data:    Record<string, string | number>[];
  sectors: string[];
}

export interface HeatmapData {
  matrix:  Record<string, Record<string, number>>;
  sectors: string[];
  states:  string[];
}

export interface AgencyFrequency {
  agency:         string;
  count:          number;
  open_count:     number;
  upcoming_count: number;
}

export interface ScatterPoint {
  title:          string;
  agency:         string;
  sector:         string;
  state:          string;
  contract_value: number;
  close_date:     string;
  source_name:    string;
}

export function useWinWindow() {
  return useQuery<WinWindowData>({
    queryKey: ['analytics', 'win-window'],
    queryFn:  async () => (await apiClient.get('/analytics/win-window')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useSectorStateHeatmap() {
  return useQuery<HeatmapData>({
    queryKey: ['analytics', 'sector-state-heatmap'],
    queryFn:  async () => (await apiClient.get('/analytics/sector-state-heatmap')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useAgencyFrequency(limit = 15) {
  return useQuery<AgencyFrequency[]>({
    queryKey: ['analytics', 'agency-frequency', limit],
    queryFn:  async () => (await apiClient.get(`/analytics/agency-frequency?limit=${limit}`)).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useValueScatter() {
  return useQuery<ScatterPoint[]>({
    queryKey: ['analytics', 'value-scatter'],
    queryFn:  async () => (await apiClient.get('/analytics/value-scatter')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export interface TreemapItem {
  sector: string;
  state:  string;
  count:  number;
}

export interface SectorStatusItem {
  sector:   string;
  open:     number;
  closed:   number;
  upcoming: number;
  total:    number;
}

export function useSectorTreemap() {
  return useQuery<TreemapItem[]>({
    queryKey: ['analytics', 'sector-treemap'],
    queryFn:  async () => (await apiClient.get('/analytics/sector-treemap')).data,
    staleTime: STALE,
    retry: 1,
  });
}

export function useSectorStatusBreakdown() {
  return useQuery<SectorStatusItem[]>({
    queryKey: ['analytics', 'sector-status-breakdown'],
    queryFn:  async () => (await apiClient.get('/analytics/sector-status-breakdown')).data,
    staleTime: STALE,
    retry: 1,
  });
}