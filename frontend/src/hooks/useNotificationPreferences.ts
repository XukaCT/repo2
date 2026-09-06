import { useEffect, useState } from 'react';
import { loadPref, savePref } from '../utils/storage';

export interface NotificationPreferences {
  email: boolean;
  sms:   boolean;
  push:  boolean;
}

const PREF_EVENT = 'war-room:notif-prefs-changed';
const DEFAULT_PREFS: NotificationPreferences = { email: true, sms: false, push: true };

function prefKey(userId: string): string {
  return `wr_${userId}_notif_prefs`;
}

export function getNotificationPreferences(userId: string): NotificationPreferences {
  return loadPref(prefKey(userId), DEFAULT_PREFS);
}

export function setNotificationPreferences(userId: string, next: NotificationPreferences): void {
  savePref(prefKey(userId), next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ userId: string; prefs: NotificationPreferences }>(PREF_EVENT, {
        detail: { userId, prefs: next },
      })
    );
  }
}

export function useNotificationPreferences(userId?: string) {
  const uid = userId ?? 'default';

  const [prefs, setPrefsState] = useState<NotificationPreferences>(
    () => getNotificationPreferences(uid)
  );

  useEffect(() => {
    setPrefsState(getNotificationPreferences(uid));
  }, [uid]);

  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === prefKey(uid)) {
        setPrefsState(getNotificationPreferences(uid));
      }
    };
    const handleCustomSync = (event: Event) => {
      const { userId: eventUid, prefs: eventPrefs } =
        (event as CustomEvent<{ userId: string; prefs: NotificationPreferences }>).detail ?? {};
      if (eventUid === uid) {
        setPrefsState(eventPrefs ?? getNotificationPreferences(uid));
      }
    };
    window.addEventListener('storage', handleStorageSync);
    window.addEventListener(PREF_EVENT, handleCustomSync as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener(PREF_EVENT, handleCustomSync as EventListener);
    };
  }, [uid]);

  const setPrefs = (
    updater: NotificationPreferences | ((prev: NotificationPreferences) => NotificationPreferences)
  ) => {
    setPrefsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setNotificationPreferences(uid, next);
      return next;
    });
  };

  return { prefs, setPrefs };
}