<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createRallyScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="rally"
  sportShort="Table Tennis"
  sportTitle="Table Tennis Screener"
  accent="#38bdf8"
  factory={createRallyScopes}
/>
