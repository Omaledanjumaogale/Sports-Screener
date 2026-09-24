<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    elevated = true,
    interactive = false,
    padding = true,
    role,
    ariaLabel,
    onclick,
    children
  }: {
    elevated?: boolean;
    interactive?: boolean;
    padding?: boolean;
    role?: string;
    ariaLabel?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="card"
  class:card-elevated={elevated}
  class:card-flat={!elevated}
  class:card-interactive={interactive}
  class:card-pad={padding}
  role={interactive ? 'button' : role}
  aria-label={ariaLabel}
  onclick={onclick}
  onkeydown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick?.(e as unknown as MouseEvent); } } : undefined}
  tabindex={interactive ? 0 : undefined}
>
  {@render children()}
</div>

<style>
  .card { min-width: 0; }
  .card-flat {
    background: transparent;
    border: 1px solid var(--c-border-sm);
    border-radius: var(--r-lg);
  }
  .card-pad { padding: var(--sp-5); }
  .card-interactive { cursor: pointer; }
  .card-interactive:active { transform: translateY(0) scale(0.99); }
  @media (max-width: 640px) {
    .card-pad { padding: var(--sp-4); }
  }
</style>
