import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

// Types
export interface AlertItem {
  id:          string;
  title:       string;
  description: string | null;
  type:        string;
  priority:    string;
  read:        boolean | number;
  created_at:  string;
}

export interface SavedSearchItem {
  id:            string;
  name:          string;
  sector:        string | null;
  state:         string | null;
  min_value:     number;
  max_value:     number;
  notifications: boolean | number;
  match_count:   number;
  last_matched:  string | null;
  created_at:    string;
}

export interface CreateAlertPayload {
  title:        string;
  description?: string;
  type?:        string;
  priority?:    string;
}

export interface CreateSavedSearchPayload {
  name:          string;
  sector?:       string;
  state?:        string;
  min_value?:    number;
  max_value?:    number;
  notifications: boolean;
}

// Alerts hooks
export function useAlerts() {
  return useQuery<AlertItem[]>({
    queryKey:  ['alerts'],
    queryFn:   async () => {
      const res = await apiClient.get('warroom_app.api.get_alerts');
      return res.data.message;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAlertPayload) => {
      const res = await apiClient.post('warroom_app.api.create_alert', payload);
      return res.data.message;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiClient.post('warroom_app.api.mark_read', { id: alertId });
      return res.data.message;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('warroom_app.api.mark_all_read');
      return res.data.message;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      await apiClient.post('warroom_app.api.delete_alert', { id: alertId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

// Saved searches hooks
export function useSavedSearches() {
  return useQuery<SavedSearchItem[]>({
    queryKey:  ['saved-searches'],
    queryFn:   async () => {
      const res = await apiClient.get('warroom_app.api.get_saved_searches');
      return res.data.message;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSavedSearchPayload) => {
      const res = await apiClient.post('warroom_app.api.create_saved_search', payload);
      return res.data.message;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (searchId: string) => {
      await apiClient.post('warroom_app.api.delete_saved_search', { id: searchId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });
}

export function useToggleSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (searchId: string) => {
      const res = await apiClient.post('warroom_app.api.toggle_saved_search', { id: searchId });
      return res.data.message;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });
}