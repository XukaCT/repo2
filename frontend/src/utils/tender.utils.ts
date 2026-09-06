export function normalizeTenderStatus(status: string): string {
    return status === 'open' ? 'active' : status;
  }

export function getStatusColor(status: string): string {
    const normalizedStatus = normalizeTenderStatus(status);
    if (normalizedStatus === 'active')   return 'badge-active';
    if (normalizedStatus === 'upcoming') return 'badge-upcoming';
    return 'badge-closed';
  }
  
  export function sectorLabel(sector: string | null): string {
    const map: Record<string, string> = {
      cleaning:            'Cleaning',
      construction:        'Construction',
      facility_management: 'Facility Mgmt',
      it_services:         'IT Services',
      healthcare:          'Healthcare',
      transportation:      'Transportation',
      other:               'Other',
    };
    return sector ? (map[sector] ?? sector) : '—';
  }
  
  export function stateLabel(state: string | null): string {
    return state ?? 'Federal';
  }
  
  export function sectorColor(sector: string | null): string {
    const map: Record<string, string> = {
      cleaning:            '#06B6D4',
      construction:        '#F59E0B',
      facility_management: '#8B5CF6',
      it_services:         '#3B82F6',
      healthcare:          '#10B981',
      transportation:      '#EC4899',
      other:               '#6B7280',
    };
    return sector ? (map[sector] ?? '#6B7280') : '#6B7280';
  }
