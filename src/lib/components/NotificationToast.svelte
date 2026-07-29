<script lang="ts">
  import { notifications, dismissNotification, type ToastNotification } from '$lib/notificationStore';
  import { CheckCircle2, AlertTriangle, Info, X, ShieldAlert } from '@lucide/svelte';

  let toastList: ToastNotification[] = $state([]);

  notifications.subscribe((val) => {
    toastList = val;
  });
</script>

{#if toastList.length > 0}
  <div class="toast-container" role="region" aria-label="Notifications">
    {#each toastList as toast (toast.id)}
      <div class={`toast-item ${toast.type}`} role="alert">
        <div class="toast-icon">
          {#if toast.type === 'success'}
            <CheckCircle2 size={18} />
          {:else if toast.type === 'error'}
            <ShieldAlert size={18} />
          {:else if toast.type === 'warning'}
            <AlertTriangle size={18} />
          {:else}
            <Info size={18} />
          {/if}
        </div>

        <div class="toast-body">
          {#if toast.title}
            <strong class="toast-title">{toast.title}</strong>
          {/if}
          <p class="toast-msg">{toast.message}</p>
        </div>

        <button
          type="button"
          class="toast-close"
          onclick={() => dismissNotification(toast.id)}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 420px;
    width: calc(100vw - 40px);
    pointer-events: none;
  }

  .toast-item {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--c-surface-2, #182030);
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.1));
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(16px);
    color: var(--c-text, #f1f5ff);
    animation: toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .toast-item.success {
    border-color: color-mix(in srgb, var(--c-green, #22c55e) 40%, transparent);
    background: color-mix(in srgb, var(--c-green, #22c55e) 12%, var(--c-surface-2, #182030));
  }
  .toast-item.success .toast-icon { color: var(--c-green, #22c55e); }

  .toast-item.error {
    border-color: color-mix(in srgb, var(--c-red, #ef4444) 40%, transparent);
    background: color-mix(in srgb, var(--c-red, #ef4444) 12%, var(--c-surface-2, #182030));
  }
  .toast-item.error .toast-icon { color: var(--c-red, #ef4444); }

  .toast-item.warning {
    border-color: color-mix(in srgb, var(--c-orange, #f97316) 40%, transparent);
    background: color-mix(in srgb, var(--c-orange, #f97316) 12%, var(--c-surface-2, #182030));
  }
  .toast-item.warning .toast-icon { color: var(--c-orange, #f97316); }

  .toast-item.info {
    border-color: color-mix(in srgb, var(--c-rally, #38bdf8) 40%, transparent);
    background: color-mix(in srgb, var(--c-rally, #38bdf8) 12%, var(--c-surface-2, #182030));
  }
  .toast-item.info .toast-icon { color: var(--c-rally, #38bdf8); }

  .toast-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    display: block;
    font-size: 13.5px;
    font-weight: 800;
    margin-bottom: 2px;
    color: var(--c-text, #ffffff);
  }

  .toast-msg {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--c-text-2, #cbd5e1);
    font-weight: 500;
  }

  .toast-close {
    background: transparent;
    border: none;
    color: var(--c-muted, #8899bb);
    cursor: pointer;
    padding: 2px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 120ms;
    flex-shrink: 0;
  }

  .toast-close:hover {
    color: var(--c-text, #ffffff);
  }
</style>
