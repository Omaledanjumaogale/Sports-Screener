<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';

  let {
    open = false,
    title = '',
    onclose,
    children
  }: {
    open?: boolean;
    title?: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  // Bottom-sheet on mobile (<768px), centered glass-l3 dialog on desktop.
  // Escape closes; backdrop tap closes; focus ring stays visible.
  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  });
</script>

<svelte:window />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={onclose} role="presentation">
    <div
      class="modal-panel glass-l3"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="modal-head">
        <h2 class="modal-title">{title}</h2>
        <button class="modal-close" type="button" aria-label="Close dialog" onclick={onclose}>
          <X size={18} stroke-width={2.4} />
        </button>
      </header>
      <div class="modal-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(2, 4, 10, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-4);
    animation: fade-in 180ms ease;
  }

  .modal-panel {
    width: 100%;
    max-width: 520px;
    max-height: min(85dvh, 720px);
    display: flex;
    flex-direction: column;
    border-radius: var(--r-xl);
    animation: modal-in 240ms cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
  }

  .sheet-grabber { display: none; }

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-5);
    border-bottom: 1px solid var(--c-border-sm);
  }
  .modal-title {
    font-size: var(--fs-h3);
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .modal-close {
    width: 44px;
    height: 44px;
    margin-right: -8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--c-muted);
    border-radius: var(--r-btn);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .modal-close:hover { background: var(--c-glass-sm); color: var(--c-text); }

  .modal-body { padding: var(--sp-5); overflow-y: auto; }

  @media (max-width: 767px) {
    .modal-backdrop {
      align-items: flex-end;
      padding: 0;
    }
    .modal-panel {
      max-width: 100%;
      max-height: 88dvh;
      border-radius: var(--r-xl) var(--r-xl) 0 0;
      border-bottom: none;
      animation: sheet-in 280ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sheet-grabber {
      display: block;
      width: 40px;
      height: 4px;
      border-radius: 999px;
      background: var(--c-border-2);
      margin: 10px auto 0;
    }
  }

  @keyframes sheet-in {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
