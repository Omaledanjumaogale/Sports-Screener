<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'ghost';
  type Size = 'sm' | 'md' | 'lg';

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    href,
    disabled = false,
    loading = false,
    full = false,
    ariaLabel,
    onclick,
    children
  }: {
    variant?: Variant;
    size?: Size;
    type?: 'button' | 'submit';
    href?: string;
    disabled?: boolean;
    loading?: boolean;
    full?: boolean;
    ariaLabel?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();

  const sizeClass = $derived(size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '');
</script>

{#if href && !disabled}
  <a
    class="btn btn-{variant} {sizeClass}"
    class:btn-full={full}
    href={href}
    aria-label={ariaLabel}
    onclick={onclick}
  >{@render children()}</a>
{:else}
  <button
    class="btn btn-{variant} {sizeClass}"
    class:btn-full={full}
    type={type}
    disabled={disabled || loading}
    aria-label={ariaLabel}
    aria-busy={loading}
    onclick={onclick}
  >
    {#if loading}<span class="btn-spinner" aria-hidden="true"></span>{/if}
    {@render children()}
  </button>
{/if}

<style>
  .btn-sm { min-height: 36px; padding: 6px 14px; font-size: var(--fs-sm); }
  .btn-lg { min-height: 52px; padding: 14px 28px; font-size: 1.0625rem; }
  .btn-full { width: 100%; }
  .btn { min-width: 44px; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: btn-spin 0.7s linear infinite;
  }
  @keyframes btn-spin { to { transform: rotate(360deg); } }
</style>
