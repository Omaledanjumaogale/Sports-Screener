<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createCricketScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="cricket"
  sportShort="Cricket"
  sportTitle="Cricket Screener"
  accent="#d97706"
  factory={createCricketScopes}
/>
