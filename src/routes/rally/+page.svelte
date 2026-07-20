<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createRallyScopes } from '$lib/engine';

  export const ssr = false;
  export const prerender = false;
</script>

<ScreenerPage
  sportId="rally"
  sportShort="Rally / TT"
  sportTitle="Rally Line Table Tennis Screener"
  accent="#38bdf8"
  factory={createRallyScopes}
/>
