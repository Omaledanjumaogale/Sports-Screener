<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createVolleyballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="volleyball"
  sportShort="Volleyball"
  sportTitle="Volleyball Screener"
  accent="#0891b2"
  factory={createVolleyballScopes}
/>
