<script lang="ts">
  import PredictorPage from '$lib/components/PredictorPage.svelte';
  import { PREDICTOR_SPORTS, isPredictorSport, type PredictorSportId } from '$lib/predictorTypes';
  import { page } from '$app/state';

  const param = $derived(page.params.sport);
  const sportId: PredictorSportId | null = $derived(
    isPredictorSport(param) ? (param as PredictorSportId) : PREDICTOR_SPORTS[0]
  );

  const ACCENT: Record<PredictorSportId, string> = {
    football: '#22c55e',
    basketball: '#f97316',
    tennis: '#a3e635',
    rally: '#38bdf8',
    hockey: '#6366f1',
    baseball: '#e11d48',
    americanfootball: '#dc2626',
    rugby: '#7c3aed',
    cricket: '#d97706',
    mma: '#1d4ed8',
    volleyball: '#0891b2'
  };
</script>

<PredictorPage sportId={sportId} accent={ACCENT[sportId ?? PREDICTOR_SPORTS[0]]} />
