// src/lib/notificationStore.ts
import { writable } from 'svelte/store';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  duration?: number;
}

export const notifications = writable<ToastNotification[]>([]);

export function notify(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  title?: string,
  duration = 4500
) {
  const id = 'toast_' + Math.random().toString(36).slice(2, 9);
  const toast: ToastNotification = { id, message, type, title, duration };

  notifications.update((list) => [...list, toast]);

  if (duration > 0) {
    setTimeout(() => {
      dismissNotification(id);
    }, duration);
  }

  return id;
}

export function dismissNotification(id: string) {
  notifications.update((list) => list.filter((t) => t.id !== id));
}
