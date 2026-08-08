<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createMmaScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="mma"
  sportShort="MMA"
  sportTitle="MMA Screener"
  accent="#1d4ed8"
  factory={createMmaScopes}
/>
