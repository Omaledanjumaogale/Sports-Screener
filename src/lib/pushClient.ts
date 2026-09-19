// src/lib/pushClient.ts
// Web-push plumbing (client): permission + subscription management wired to
// the backend pushSubscriptions module. Delivery (VAPID sender) can be enabled
// later without schema changes — the storage and preference layer is complete.

import { api, callConvex } from './convexClient';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Whether this browser supports push at all. */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Ask permission and register the subscription with the backend. VAPID_PUBLIC_KEY
 * is optional for now — when unset we only persist the preference so the UI
 * toggle still works and delivery can be enabled without another migration.
 */
export async function enablePush(): Promise<{ ok: boolean; message: string }> {
  if (!pushSupported()) return { ok: false, message: 'Push is not supported in this browser.' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, message: 'Notification permission was not granted.' };

    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub && vapid) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource
      });
    }

    if (sub) {
      const json = sub.toJSON();
      await callConvex(api.push.saveSubscription, {
        endpoint: String(json.endpoint || ''),
        keys: (json.keys as any) ?? {}
      });
    }

    await callConvex(api.push.setEnabled, { enabled: true });
    return { ok: true, message: 'Notifications enabled.' };
  } catch (err: any) {
    return { ok: false, message: String(err?.message || err) };
  }
}

/** Disable notifications: unsubscribe where possible + clear the preference. */
export async function disablePush(): Promise<{ ok: boolean; message: string }> {
  try {
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe().catch(() => {});
      if (endpoint) await callConvex(api.push.removeSubscription, { endpoint }).catch(() => {});
    }
    await callConvex(api.push.setEnabled, { enabled: false });
    return { ok: true, message: 'Notifications disabled.' };
  } catch (err: any) {
    return { ok: false, message: String(err?.message || err) };
  }
}
