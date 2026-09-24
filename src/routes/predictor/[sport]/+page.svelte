<script lang="ts">
  import PredictorPage from '$lib/components/PredictorPage.svelte';
  import { PREDICTOR_SPORTS, isPredictorSport, type PredictorSportId } from '$lib/predictorTypes';
  import { page } from '$app/state';

  const param = $derived(page.params.sport);
  const sportId: PredictorSportId | null = $derived(
    isPredictorSport(param) ? (param as PredictorSportId) : PREDICTOR_SPORTS[0]
  );

  const ACCENT: Record<PredictorSportId, string> = {
    football: '#34d399',
    basketball: '#fb923c',
    tennis: '#a3e635',
    rally: '#38bdf8',
    hockey: '#22d3ee',
    baseball: '#e11d48',
    americanfootball: '#f87171',
    rugby: '#a78bfa',
    cricket: '#fbbf24',
    mma: '#818cf8',
    volleyball: '#0891b2'
  };
</script>

<PredictorPage sportId={sportId} accent={ACCENT[sportId ?? PREDICTOR_SPORTS[0]]} />
