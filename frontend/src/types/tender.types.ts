// ── tender.types.ts ──────────────────────────────────────────

export type TenderStatus = 'active' | 'upcoming' | 'closed';

export type Sector =
  | 'cleaning'
  | 'construction'
  | 'facility_management'
  | 'it_services'
  | 'healthcare'
  | 'transportation'
  | 'other';

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'ACT' | 'NT' | 'TAS' | 'Federal';

export interface Tender {
  id: string;
  title: string;
  description: string | null;
  agency: string;
  sector: Sector | null;
  state: AustralianState | null;
  status: TenderStatus;
  contract_value: number | null;
  close_date: string | null;
  published_date: string | null;
  source_name: string;
  source_id: string;
  source_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TenderListResponse {
  items: Tender[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TenderFilters {
  page?: number;
  page_size?: number;
  status?: TenderStatus | string;
  sector?: string;
  state?: string;
  source_name?: string;
  search?: string;
  min_value?: number;
  max_value?: number;
}

export interface OverviewStats {
  total_tenders: number;
  active_tenders: number;
  closed_tenders: number;
  upcoming_tenders: number;
  total_value: number;
  avg_value: number;
  active_value: number;
  closed_value: number;
  upcoming_value: number;
  sources: Record<string, number>;
}

export interface SectorStat {
  sector: string;
  count: number;
  total_value: number;
}

export interface StateStat {
  state: string;
  count: number;
  total_value: number;
}

/** Per-status count/value for one source. Legacy data may still include open as active. */
export interface SourceStatusBreakdown {
  count: number;
  value: number;
}

/** Nested map: source_name → status → { count, value } */
export type SourceStatsBySource = Record<string, Record<string, SourceStatusBreakdown>>;
