<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Inbox } from '@lucide/svelte';

  let {
    icon,
    title,
    message,
    action
  }: {
    icon?: Snippet;
    title: string;
    message?: string;
    action?: Snippet;
  } = $props();
</script>

<div class="empty-state">
  <div class="empty-icon" aria-hidden="true">
    {#if icon}{@render icon()}{:else}<Inbox size={26} stroke-width={1.8} />{/if}
  </div>
  <h3 class="empty-title">{title}</h3>
  {#if message}<p class="empty-message">{message}</p>{/if}
  {#if action}<div class="empty-action">{@render action()}</div>{/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--sp-3);
    padding: var(--sp-8) var(--sp-5);
    border: 1px dashed var(--c-border-2);
    border-radius: var(--r-lg);
    background: var(--c-glass-sm);
  }
  .empty-icon {
    width: 56px;
    height: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--brand) 10%, transparent);
    color: var(--brand);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 22%, transparent);
  }
  .empty-title {
    font-size: var(--fs-h3);
    font-weight: 800;
    margin: 0;
    color: var(--c-text);
  }
  .empty-message {
    font-size: var(--fs-body);
    color: var(--c-muted);
    max-width: 44ch;
    margin: 0;
  }
  .empty-action { margin-top: var(--sp-2); }
</style>
