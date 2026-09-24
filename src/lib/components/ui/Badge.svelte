<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  let {
    tone = 'neutral',
    children
  }: {
    tone?: Tone;
    children: Snippet;
  } = $props();
</script>

<span class="badge badge-{tone}">{@render children()}</span>
