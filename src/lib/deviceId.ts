// ── Device identity ───────────────────────────────────────────────────────────
// A tester access code is bound to ONE device. This module produces the stable
// identifier that binding is keyed on.
//
// HONEST SCOPE: this is a persisted, browser-generated identifier — not hardware
// attestation. It survives reloads, restarts and logins, and it changes when the
// user clears site data or switches browser/device, which is exactly the
// behaviour the one-device tester rule needs. It is deliberately NOT derived
// from fingerprinting signals the user cannot reset.

const DEVICE_ID_KEY = 'pulseodds_device_id_v1';

function randomId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * The persistent device id for this browser. Generated once and stored; the
 * SAME value is reused on every login so a tester's bound device is recognised.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || id.length < 8) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled: fall back to an in-memory id so the
    // session still works, at the cost of not surviving a reload.
    if (!memoryId) memoryId = randomId();
    return memoryId;
  }
}

let memoryId = '';

/** A short human label for the admin console ("Chrome · Windows"). */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent || '';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
      : /OPR\//.test(ua) ? 'Opera'
        : /Chrome\//.test(ua) ? 'Chrome'
          : /Firefox\//.test(ua) ? 'Firefox'
            : /Safari\//.test(ua) ? 'Safari'
              : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows'
      : /Android/.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
          : /Mac OS X/.test(ua) ? 'macOS'
            : /Linux/.test(ua) ? 'Linux'
              : 'Unknown OS';
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window ? ' · touch' : '';
  return `${browser} · ${os}${touch}`;
}

/** Whether this browser already holds a device id (used for UI copy). */
export function hasDeviceId(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return !!memoryId;
  }
}
