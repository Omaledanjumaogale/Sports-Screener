<script lang="ts">
  import PredictorPage from '$lib/components/PredictorPage.svelte';
  import type { PredictorSportId } from '$lib/predictorTypes';
</script>

<PredictorPage sportId={null as PredictorSportId | null} accent="#6366f1" />
