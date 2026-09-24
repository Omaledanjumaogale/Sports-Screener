// Motion helpers — animated counters + small easing utilities shared by
// landing stat counters and predictor metric strips. All respect
// prefers-reduced-motion (the caller skips animation entirely).

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Luxury ease-out used across the design system. */
export const easeLux = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Animate a numeric value from `from` to `to`. Calls `onFrame` with the
 * interpolated value each rAF tick. Returns a cancel function.
 * Under prefers-reduced-motion it jumps straight to `to` in one frame.
 */
export function animateValue(
  from: number,
  to: number,
  durationMs: number,
  onFrame: (value: number) => void
): () => void {
  if (prefersReducedMotion() || durationMs <= 0 || from === to) {
    onFrame(to);
    return () => {};
  }

  let raf = 0;
  let cancelled = false;
  const start = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    onFrame(from + (to - from) * easeLux(t));
    if (t < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * Svelte-compatible animated counter store for `$:`-style usage.
 * Returns { value, set } where value is reactive; call set(target) to animate.
 */
export function createCounter(initial = 0, durationMs = 900) {
  let value = $state(initial);
  let cancel: (() => void) | null = null;

  return {
    get value() {
      return value;
    },
    set(target: number) {
      cancel?.();
      cancel = animateValue(value, target, durationMs, (v) => {
        value = v;
      });
    },
    dispose() {
      cancel?.();
      cancel = null;
    }
  };
}
