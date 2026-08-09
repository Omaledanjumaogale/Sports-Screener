<script lang="ts">
  import SEO from '$lib/components/SEO.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Activity, Inbox, ShieldCheck } from '@lucide/svelte';
  import PredictorMatchCard from '$lib/components/PredictorMatchCard.svelte';
  import PredictorVerdictPanel from '$lib/components/PredictorVerdictPanel.svelte';
  import PredictorSportIcon from '$lib/components/PredictorSportIcon.svelte';
  import { fetchPredictorMatchesInRange, analyzeCachedMatch, fetchPredictorVerdict, dayKeyFor } from '$lib/predictorClient';
  import { DEFAULT_CONFIDENCE_FLOOR, type PredictorMatch, type PredictorSportId } from '$lib/predictorTypes';
  import { buildPredictorInsights } from '$lib/predictorInsights';
  import { generateGreatMindsDebate } from '$lib/greatMindsEngine';
  import { AGENT_DEFS } from '$lib/agentUi';

  const ACCENT: Record<PredictorSportId, string> = {
    football: '#22c55e', basketball: '#f97316', tennis: '#a3e635', rally: '#38bdf8',
    hockey: '#6366f1', baseball: '#e11d48', americanfootball: '#dc2626', rugby: '#7c3aed',
    cricket: '#d97706', mma: '#1d4ed8', volleyball: '#0891b2'
  };

  const sport = $derived(page.params.sport as PredictorSportId);
  const matchId = $derived(page.params.matchId);
  const accent = $derived(ACCENT[sport] ?? '#6366f1');

  let match = $state<PredictorMatch | null>(null);
  let loading = $state(true);
  let error = $state('');
  let llmInsight = $state<Record<string, unknown> | null>(null);

  onMount(() => {
    void loadMatch();
  });

  async function loadMatch() {
    loading = true;
    error = '';
    try {
      // Search today → +6 window for the matchId (deterministic pick screen never needs more).
      for (let offset = 0; offset <= 6; offset++) {
        const dk = dayKeyFor(offset);
        const list = await fetchPredictorMatchesInRange(sport, dk, dk).catch(() => []);
        const hit = list.find((m) => m.matchId === matchId);
        if (hit) {
          match = hit;
          break;
        }
      }
      if (!match) {
        error = 'Match not found in the cached window.';
        return;
      }
      const verdict = await fetchPredictorVerdict(match.dayKey, match.matchId).catch(() => null);
      if (verdict?.aiReport && typeof verdict.aiReport === 'object') {
        llmInsight = verdict.aiReport;
      }
    } catch (err: any) {
      error = String(err?.message || err);
    } finally {
      loading = false;
    }
  }

  const analysis = $derived(match ? analyzeCachedMatch(match, DEFAULT_CONFIDENCE_FLOOR) : null);
  const greatMindsDebate = $derived(match && analysis ? generateGreatMindsDebate(match, analysis.analysis) : null);
  const insights = $derived(
    match && analysis
      ? (llmInsight as import('$lib/cloudflareAi').AiAnalysisResult['insights'] | null) ??
          buildPredictorInsights(match, analysis.qualifying)
      : null
  );
</script>

<svelte:head>
  <title>{match ? `${match.homeTeam} vs ${match.awayTeam} — Full AI Match Analysis | PulseOdds` : `Full AI Match Analysis | PulseOdds`}</title>
  <meta
    name="description"
    content={match
      ? `${match.homeTeam} vs ${match.awayTeam} (${match.league}). Full multi-agent analysis with ${DEFAULT_CONFIDENCE_FLOOR}%+ Real Win Chance selections, graded post-match.`
      : 'Full multi-agent match analysis with high-confidence selections.'}
  />
</svelte:head>

<SEO seo={page.data.seo} />

<div class="full-root" style={`--accent:${accent}`}>
  <div class="full-inner">
    <header class="full-head">
      <button class="icon-btn" aria-label="Back to predictor" onclick={() => void goto(`/predictor/${sport}`)} type="button">
        <ArrowLeft size={20} stroke-width={2.5} />
      </button>
      <div class="full-title">
        <span class="eyebrow">Eze Ugo &amp; the Agent Team</span>
        <h1>Full Match Analysis</h1>
        <span class="full-sport" style={`color:${accent}`}><PredictorSportIcon sport={sport} size={20} strokeWidth={2} /></span>
      </div>
      <span class="head-shield"><ShieldCheck size={20} stroke-width={2} style={`color:${accent}`} /></span>
    </header>

    {#if loading}
      <div class="placeholder">
        <span class="ph-icon"><Activity size={22} stroke-width={1.8} /></span>
        Loading full analysis for this match…
      </div>
    {:else if error}
      <div class="empty-state">
        <div class="empty-ic"><Inbox size={30} stroke-width={1.8} /></div>
        <p>{error}</p>
        <button class="cta secondary" type="button" onclick={() => goto(`/predictor/${sport}`)}>Back to {sport} matches</button>
      </div>
    {:else if match && analysis}
      <PredictorMatchCard
        match={match}
        analysis={analysis.analysis}
        qualifying={analysis.qualifying}
        insight={insights}
        expanded
        finished={!!(match.finalScore || match.oddsSnapshot?.finalScore || match.status === 'finished')}
        finalScore={match.finalScore ?? match.oddsSnapshot?.finalScore}
        showFullCta={false}
        {accent}
      />
      <PredictorVerdictPanel
        insight={insights}
        greatMindsDebate={greatMindsDebate}
        picks={analysis.qualifying}
        metrics={analysis.analysis?.metrics}
        agentsRun={AGENT_DEFS.map((a) => a.name)}
        {accent}
        finalScore={match.finalScore ?? match.oddsSnapshot?.finalScore}
      />
      <div class="full-foot">
        <p>
          Full analysis for {match.homeTeam} vs {match.awayTeam} ({match.league}). Selections clear the
          {DEFAULT_CONFIDENCE_FLOOR}% Real Win Chance floor and are re-checked after the final whistle.
          All match times shown in West Africa Time (WAT). Always gamble responsibly.
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .full-root { min-height: 100vh; background: var(--c-surface, #0b1120); }
  .full-inner { max-width: 680px; margin: 0 auto; padding: 14px 16px 40px; }

  .full-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 0 16px;
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--c-surface-2);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid var(--c-border);
  }

  .icon-btn {
    width: 46px;
    height: 46px;
    border: 1px solid var(--c-border-md);
    border-radius: 14px;
    background: var(--c-glass-sm);
    color: var(--c-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--t-base, 180ms ease), border-color var(--t-base, 180ms ease), transform 80ms ease;
    cursor: pointer;
  }
  .icon-btn:hover { background: var(--c-glass-hover); border-color: var(--c-border-2); }
  .icon-btn:active { transform: scale(0.93); }

  .full-title { text-align: center; }
  .eyebrow {
    display: block;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 10px;
    font-weight: 800;
  }
  .full-title h1 { font-size: 20px; margin: 2px 0 0; letter-spacing: -0.02em; font-weight: 900; }
  .full-sport { display: inline-flex; margin-top: 3px; }

  .head-shield { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)); }

  .placeholder {
    padding: 40px 0;
    text-align: center;
    color: var(--c-text-dim, var(--c-text));
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .ph-icon { display: inline-flex; color: var(--accent); animation: ph-pulse 1.8s ease-in-out infinite; }
  @keyframes ph-pulse {
    0%, 100% { opacity: 0.45; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.12); }
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    border: 1px dashed var(--c-border-md);
    border-radius: 16px;
    color: var(--c-text-dim, var(--c-text));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .empty-ic {
    width: 60px;
    height: 60px;
    border-radius: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--accent);
  }
  .empty-state p { margin: 0; font-size: 13px; }

  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: 300px;
    width: 100%;
    padding: 12px 20px;
    border-radius: 14px;
    border: 1px solid var(--c-border-md);
    background: var(--c-glass-sm);
    color: var(--c-text);
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    transition: box-shadow var(--t-base, 180ms ease), transform 80ms ease;
    text-decoration: none;
  }
  .cta:hover { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }

  .full-foot { margin-top: 28px; padding-top: 14px; border-top: 1px solid var(--c-border); }
  .full-foot p { font-size: 11px; color: var(--c-text-dim, var(--c-text)); line-height: 1.6; text-align: center; }
</style>