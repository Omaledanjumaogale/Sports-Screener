<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createVirtualFootballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="vfootball"
  sportShort="Virtual Football"
  sportTitle="Pulse Line — Virtual Football Screener"
  accent="#06b6d4"
  factory={createVirtualFootballScopes}
/>
