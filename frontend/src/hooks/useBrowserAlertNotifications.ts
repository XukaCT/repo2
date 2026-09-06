import { useEffect, useRef } from 'react';
import { useAlerts } from './useAlerts';
import { useAuth } from './useAuth';
import { useNotificationPreferences } from './useNotificationPreferences';
import { getBrowserNotificationPermission, showBrowserNotification } from '../utils/browserNotifications';

export function useBrowserAlertNotifications() {
  const { user }        = useAuth();
  const { data: alerts } = useAlerts();
  const { prefs }       = useNotificationPreferences(user?.id);

  const knownAlertIds = useRef<Set<string>>(new Set());
  const hydrated      = useRef(false);

  useEffect(() => {
    const currentAlerts = alerts ?? [];
    const nextKnownIds  = new Set(currentAlerts.map((alert) => alert.id));

    if (!hydrated.current) {
      knownAlertIds.current = nextKnownIds;
      hydrated.current      = true;
      return;
    }

    if (!prefs.push || getBrowserNotificationPermission() !== 'granted') {
      knownAlertIds.current = nextKnownIds;
      return;
    }

    const freshUnreadAlerts = currentAlerts.filter(
      (alert) => !knownAlertIds.current.has(alert.id) && !alert.read,
    );

    freshUnreadAlerts.slice(0, 3).forEach((alert) => {
      const notification = showBrowserNotification(alert.title, {
        body: alert.description ?? 'Open War Room Alerts to review this update.',
        tag:  `alert-${alert.id}`,
      });
      if (notification) {
        notification.onclick = () => {
          window.focus();
          window.location.assign('/alerts');
        };
      }
    });

    knownAlertIds.current = nextKnownIds;
  }, [alerts, prefs.push]);
}