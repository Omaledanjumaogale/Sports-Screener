<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createBaseballScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="baseball"
  sportShort="Baseball"
  sportTitle="Diamond Line — Baseball Enterprise Screener"
  accent="#8b5cf6"
  factory={createBaseballScopes}
/>
