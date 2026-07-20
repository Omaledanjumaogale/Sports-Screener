<script lang="ts">
  import ScreenerPage from '$lib/components/ScreenerPage.svelte';
  import { createTennisScopes } from '$lib/engine';
</script>

<ScreenerPage
  sportId="tennis"
  sportShort="Tennis"
  sportTitle="Tennis MEG Screener"
  accent="#e879f9"
  factory={createTennisScopes}
/>
