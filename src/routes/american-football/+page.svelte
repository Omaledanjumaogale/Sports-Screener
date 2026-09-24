<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createAmericanFootballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="americanfootball"
  sportShort="Am. Football"
  sportTitle="American Football Screener"
  accent="#f87171"
  factory={createAmericanFootballScopes}
/>
