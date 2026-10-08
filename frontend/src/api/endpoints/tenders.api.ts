import { apiClient } from '../client';
import type {
  TenderListResponse,
  TenderFilters,
  OverviewStats,
  SectorStat,
  StateStat,
  SourceStatsBySource,
} from '../../types/tender.types';

// Pass the filters up to your get_tenders Python function
export const getTenders = async (params: any = {}) => {
  try {
    // FIXED: Added /api/method/
    const res = await apiClient.get('/api/method/warroom_app.api.get_tenders', { params });
    return res.data.message || { items: [], total: 0, page: 1, page_size: 15 };
  } catch (error) {
    console.error("Frappe server might be rebooting:", error);
    return { items: [], total: 0, page: 1, page_size: 15 }; 
  }
};

// Pass the ID to your get_tender_by_id Python function
export const getTenderById = async (id: string) => {
  try {
    // FIXED: Added /api/method/
    const res = await apiClient.get('/api/method/warroom_app.api.get_tender_by_id', { params: { id } });
    return res.data.message;
  } catch (error) {
    console.error("Frappe server might be rebooting:", error);
    return null;
  }
};

export const tendersApi = {
  // Call Frappe function: get_tenders
  list: (filters: TenderFilters = {}) =>
    apiClient.get<{ message: TenderListResponse }>('/api/method/warroom_app.api.get_tenders', { params: filters })
      .then(r => r.data.message),

  // Call Frappe function: get_tender_by_id
  get: (id: string) =>
    apiClient.get<{ message: any }>('/api/method/warroom_app.api.get_tender_by_id', { params: { id } })
      .then(r => r.data.message),

  // Call Frappe function: get_overview_stats
  overview: () =>
    apiClient.get<{ message: OverviewStats }>('/api/method/warroom_app.api.get_overview_stats')
      .then(r => r.data.message),

  // Call Frappe function: get_sector_stats
  bySector: () =>
    apiClient.get<{ message: SectorStat[] }>('/api/method/warroom_app.api.get_sector_stats')
      .then(r => r.data.message),

  // Call Frappe function: get_state_stats
  byState: () =>
    apiClient.get<{ message: StateStat[] }>('/api/method/warroom_app.api.get_state_stats')
      .then(r => r.data.message),

  // Call Frappe function: get_source_stats
  bySource: () =>
    apiClient.get<{ message: SourceStatsBySource }>('/api/method/warroom_app.api.get_source_stats')
      .then(r => r.data.message),

  // ==========================================
  // THE BRIDGE TO BID TRACKER
  // ==========================================
  pushToBidTracker: (id: string) =>
    apiClient.post<{ message: any }>('/api/method/warroom_app.api.pursue_tender', { tender_id: id })
      .then(r => r.data.message),
};