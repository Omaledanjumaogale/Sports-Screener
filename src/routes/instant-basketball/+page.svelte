<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createInstantBasketballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="instant-basketball"
  sportShort="Instant Basketball"
  sportTitle="Court Line — Instant Basketball Screener"
  accent="#f59e0b"
  factory={createInstantBasketballScopes}
/>
