/**
 * Theme management for PulseOdds (Dark / Light Mode)
 * Persists user preference in localStorage and syncs data-theme attribute on <html>
 */

export type Theme = 'dark' | 'light';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('pulseodds-theme') as Theme | null;
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('pulseodds-theme', theme);
  } catch (_) { /* ignore */ }
}

export function toggleTheme(): Theme {
  const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
