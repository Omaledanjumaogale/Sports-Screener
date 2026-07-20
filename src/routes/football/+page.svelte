<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createFootballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="football"
  sportShort="Football"
  sportTitle="Football Matchday Screener"
  accent="#22c55e"
  factory={createFootballScopes}
/>
