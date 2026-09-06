export type AlertPriority = 'high' | 'medium' | 'low';
export type AlertType = 'tender' | 'bid' | 'system' | 'report';

export interface Alert {
  id: string;
  title: string;
  description: string;
  type: AlertType;
  priority: AlertPriority;
  timestamp: string;
  read: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: {
    sector?: string;
    state?: string;
    min_value?: number;
    max_value?: number;
    keywords?: string;
  };
  notifications: boolean;
  last_matched?: string;
}

export interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
}