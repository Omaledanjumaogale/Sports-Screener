<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createBasketballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="basketball"
  sportShort="Basketball"
  sportTitle="Basketball MET Screener"
  accent="#f97316"
  factory={createBasketballScopes}
/>
