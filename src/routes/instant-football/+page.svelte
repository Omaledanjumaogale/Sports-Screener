<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createInstantFootballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="instant-football"
  sportShort="Instant Football"
  sportTitle="Flash Line — Instant Football Screener"
  accent="#10b981"
  factory={createInstantFootballScopes}
/>
