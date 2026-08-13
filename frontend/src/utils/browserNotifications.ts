export type BrowserNotificationPermissionState = NotificationPermission | 'unsupported';

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (getBrowserNotificationPermission() !== 'granted') {
    return null;
  }

  return new Notification(title, options);
}
