<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createHockeyScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="hockey"
  sportShort="Ice Hockey"
  sportTitle="Ice Hockey Matchday Screener"
  accent="#06b6d4"
  factory={createHockeyScopes}
/>
