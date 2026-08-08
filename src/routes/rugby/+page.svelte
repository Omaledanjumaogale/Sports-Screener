<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createRugbyScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="rugby"
  sportShort="Rugby"
  sportTitle="Rugby Screener"
  accent="#7c3aed"
  factory={createRugbyScopes}
/>
