<script lang="ts">
  // Hero 3D moment — lazy Three.js "odds constellation" with hard guards:
  //   • bundle is dynamic-import()ed after idle, never blocking first paint
  //   • static gradient fallback for reduced-motion / no WebGL / low-end
  //   • rotation pauses when the canvas scrolls offscreen (rAF self-throttles
  //     in hidden tabs), DPR capped at 1.5, particle count scaled by device
  import { onMount } from 'svelte';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic
  // import type loses prop typing through svelte2tsx; the component contract
  // is a single `active: boolean` prop (see HeroSceneCanvas.svelte).
  let canvasModule: any = $state(null);
  let show3d = $state(false);
  let inView = $state(true);

  onMount(() => {
    // The 3D hero is the product centerpiece — it renders on ALL devices
    // (product-owner requirement), including desktops whose OS reports
    // reduced motion. Battery/pause guards remain: offscreen IO pause in the
    // inner scene + rAF self-throttling in hidden tabs.

    const load = async () => {
      try {
        // WebGL support probe — cheap and synchronous.
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
        if (!gl) return;
        const mod = await import('./HeroSceneCanvas.svelte');
        canvasModule = mod;
        show3d = true;
      } catch {
        /* fallback stays */
      }
    };

    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(() => void load(), { timeout: 2000 });
    } else {
      setTimeout(() => void load(), 300);
    }

    // Pause rotation when offscreen — resume on re-entry.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView = e.isIntersecting;
      },
      { threshold: 0.05 }
    );
    io.observe(watchEl ?? undefined!);
    return () => io.disconnect();
  });

  let watchEl: HTMLElement | null = $state(null);
</script>

<div class="hero-scene" bind:this={watchEl} aria-hidden="true">
  {#if canvasModule && show3d}
    <canvasModule.default active={inView} />
  {:else}
    <!-- Static fallback: brand gradient + orbit rings, zero JS -->
    <div class="scene-fallback">
      <span class="fb-ring fb-r1"></span>
      <span class="fb-ring fb-r2"></span>
      <span class="fb-ring fb-r3"></span>
      <span class="fb-core"></span>
    </div>
  {/if}
</div>

<style>
  .hero-scene {
    position: relative;
    width: 100%;
    max-width: 880px;
    aspect-ratio: 16 / 9;
    margin: var(--sp-6) auto 0;
    border-radius: var(--r-xl);
    overflow: hidden;
    border: 1px solid var(--c-border);
    background:
      radial-gradient(ellipse 70% 60% at 70% 20%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
      radial-gradient(ellipse 60% 55% at 20% 85%, color-mix(in srgb, var(--accent2) 9%, transparent), transparent 65%),
      var(--c-bg-2);
    box-shadow: var(--shadow-2);
    contain: content;
  }

  .hero-scene :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  /* ── Static fallback ─────────────────────────────────────── */
  .scene-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fb-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent2) 22%, transparent);
  }
  .fb-r1 { width: 46%; aspect-ratio: 1; }
  .fb-r2 {
    width: 68%; aspect-ratio: 1;
    border-color: color-mix(in srgb, var(--brand) 26%, transparent);
    border-style: dashed;
  }
  .fb-r3 { width: 90%; aspect-ratio: 1; opacity: 0.5; }
  .fb-core {
    width: 12%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, var(--brand-hover), var(--accent2));
    box-shadow: 0 0 42px color-mix(in srgb, var(--brand) 40%, transparent);
  }

  @media (max-width: 640px) {
    .hero-scene { aspect-ratio: 4 / 3; margin-top: var(--sp-5); }
  }
</style>
