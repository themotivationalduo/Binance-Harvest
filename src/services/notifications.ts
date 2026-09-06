/**
 * Reusable service for managing standard browser push notifications
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function hasNotificationPermission(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn("Notifications are not supported in this browser.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

interface PushNotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
}

export function sendPushNotification(title: string, options?: PushNotificationOptions) {
  if (!isNotificationSupported()) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: options?.body,
        icon: options?.icon || 'https://binance.com/favicon.ico',
        tag: options?.tag,
      });
    } catch (e) {
      // In some sandboxed iframe runtimes, direct new Notification might fail.
      // Fallback: Use service worker or ignore silently to avoid breaking the application flow.
      console.warn("Notification error:", e);
    }
  }
}
