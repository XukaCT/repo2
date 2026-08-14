import apiClient from '../client';
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
  const res = await apiClient.get('warroom_app.api.get_tenders', { params });
  // Frappe wraps your return dictionary in 'message'
  return res.data.message; 
};

// Pass the ID to your get_tender_by_id Python function
export const getTenderById = async (id: string) => {
  const res = await apiClient.get('warroom_app.api.get_tender_by_id', { params: { id } });
  return res.data.message;
};

export const tendersApi = {
  // Call Frappe function: get_tenders
  list: (filters: TenderFilters = {}) =>
    apiClient.get<{ message: TenderListResponse }>('warroom_app.api.get_tenders', { params: filters })
      .then(r => r.data.message),

  // Call Frappe function: get_tender_by_id (Frappe requires passing the ID as a parameter)
  get: (id: string) =>
    apiClient.get<{ message: any }>('warroom_app.api.get_tender_by_id', { params: { id } })
      .then(r => r.data.message),

  // Call Frappe function: get_overview_stats
  overview: () =>
    apiClient.get<{ message: OverviewStats }>('warroom_app.api.get_overview_stats')
      .then(r => r.data.message),

  // Call Frappe function: get_sector_stats
  bySector: () =>
    apiClient.get<{ message: SectorStat[] }>('warroom_app.api.get_sector_stats')
      .then(r => r.data.message),

  // Call Frappe function: get_state_stats
  byState: () =>
    apiClient.get<{ message: StateStat[] }>('warroom_app.api.get_state_stats')
      .then(r => r.data.message),

  // Call Frappe function: get_source_stats
  bySource: () =>
    apiClient.get<{ message: SourceStatsBySource }>('warroom_app.api.get_source_stats')
      .then(r => r.data.message),
};