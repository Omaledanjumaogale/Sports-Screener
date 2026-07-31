<script lang="ts">
  import type { ScopeState } from '../engine';

  let {
    scope,
    sportId,
    onChange = () => {}
  }: {
    scope: ScopeState;
    sportId: 'football' | 'basketball' | 'tennis' | 'rally' | 'hockey' | 'instant-football' | 'instant-basketball' | 'vfootball' | 'baseball';
    onChange?: () => void;
  } = $props();

  const footballPresets = [
    { v: 'balanced',    l: 'Balanced League' },
    { v: 'lowScoring',  l: 'Low-Scoring League' },
    { v: 'highScoring', l: 'High-Scoring League' },
    { v: 'cup',         l: 'Cup / Knockout' }
  ];
  const tennisSurfaces = [
    { v: 'hard',   l: 'Hard Court' },
    { v: 'clay',   l: 'Clay' },
    { v: 'grass',  l: 'Grass' },
    { v: 'carpet', l: 'Carpet / Indoor' }
  ];
  const tennisFormats = [
    { v: 'bo3', l: 'Best of 3 Sets' },
    { v: 'bo5', l: 'Best of 5 Sets (Grand Slam)' }
  ];

  const isRacket = $derived(sportId === 'tennis' || sportId === 'rally');
</script>

<section class="team-inputs" aria-label="Match context" style={`--accent:var(--c-${sportId}, #6366f1)`}>

  <!-- VS row -->
  <div class="name-fields">
    <label class="field-label">
      <span>{isRacket ? 'Player A' : 'Home / Team 1'}</span>
      <input
        type="text"
        autocomplete="off"
        placeholder={sportId === 'tennis' ? 'e.g. Djokovic' : sportId === 'rally' ? 'Player A' : 'Home team'}
        bind:value={scope.teamA}
        oninput={onChange}
        aria-label={isRacket ? 'Player A name' : 'Home team name'}
        class="text-input"
      />
    </label>

    <div class="vs-chip" aria-hidden="true">
      <span>VS</span>
      <span class="vs-dot" aria-hidden="true"></span>
    </div>

    <label class="field-label">
      <span>{isRacket ? 'Player B' : 'Away / Team 2'}</span>
      <input
        type="text"
        autocomplete="off"
        placeholder={sportId === 'tennis' ? 'e.g. Alcaraz' : sportId === 'rally' ? 'Player B' : 'Away team'}
        bind:value={scope.teamB}
        oninput={onChange}
        aria-label={isRacket ? 'Player B name' : 'Away team name'}
        class="text-input"
      />
    </label>
  </div>

  <!-- Context selects -->
  {#if sportId === 'football'}
    <div class="context-fields">
      <label class="field-label">
        <span>League profile</span>
        <select bind:value={scope.leaguePreset} onchange={onChange} aria-label="League profile preset">
          {#each footballPresets as p}
            <option value={p.v}>{p.l}</option>
          {/each}
        </select>
      </label>
    </div>
  {:else if sportId === 'tennis'}
    <div class="context-fields">
      <label class="field-label">
        <span>Court surface</span>
        <select bind:value={scope.surface} onchange={onChange} aria-label="Court surface">
          {#each tennisSurfaces as s}
            <option value={s.v}>{s.l}</option>
          {/each}
        </select>
      </label>
      <label class="field-label">
        <span>Match format</span>
        <select bind:value={scope.format} onchange={onChange} aria-label="Match format">
          {#each tennisFormats as f}
            <option value={f.v}>{f.l}</option>
          {/each}
        </select>
      </label>
    </div>
  {/if}
</section>

<style>
  .team-inputs {
    padding: 16px;
    border: 1px solid var(--c-border-md);
    background: var(--c-glass-sm);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border-radius: 16px;
    display: grid;
    gap: 14px;
    transition: border-color var(--t-base, 180ms ease);
  }
  .team-inputs:focus-within {
    border-color: color-mix(in srgb, var(--accent, #f97316) 28%, var(--c-border-md));
  }

  /* Name row */
  .name-fields {
    display: grid;
    grid-template-columns: 1fr 44px 1fr;
    gap: 10px;
    align-items: end;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--c-muted, #8899bb);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Text inputs */
  .text-input {
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    background: var(--c-input-bg);
    border: 1px solid var(--c-input-border);
    border-radius: 12px;
    color: var(--c-input-text);
    font-weight: 600;
    font-size: 13.5px;
    font-family: var(--font-brand, 'Outfit', system-ui);
    transition:
      border-color var(--t-base, 180ms ease),
      background var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease);
    backdrop-filter: blur(8px);
  }
  .text-input:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--accent, #f97316) 60%, transparent);
    background: var(--c-glass-hover);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #f97316) 12%, transparent);
  }
  .text-input::placeholder { color: var(--c-faint); font-weight: 500; }

  /* VS chip */
  .vs-chip {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 44px;
    height: 46px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent, #f97316) 14%, var(--c-glass-sm));
    border: 1px solid color-mix(in srgb, var(--accent, #f97316) 28%, var(--c-border-md));
    color: var(--accent, #f97316);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.08em;
    justify-self: center;
    margin-bottom: 0;
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent, #f97316) 10%, transparent);
  }
  .vs-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
    animation: dot-pulse 2s ease-in-out infinite;
  }

  /* Selects */
  .context-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }

  .context-fields select {
    width: 100%;
    min-height: 46px;
    padding: 0 32px 0 14px;
    background: var(--c-input-bg);
    border: 1px solid var(--c-input-border);
    border-radius: 12px;
    color: var(--c-input-text);
    font-weight: 600;
    font-size: 13.5px;
    font-family: var(--font-brand, 'Outfit', system-ui);
    appearance: none;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition:
      border-color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease),
      background var(--t-base, 180ms ease);
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%238899bb'><path d='M5.5 7.5L10 12l4.5-4.5z'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 14px;
  }
  .context-fields select:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--accent, #f97316) 60%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #f97316) 12%, transparent);
    background-color: var(--c-glass-hover);
  }
  .context-fields select option { background: var(--c-option-bg); color: var(--c-option-text); }

  /* Responsive */
  @media (max-width: 440px) {
    .name-fields { grid-template-columns: 1fr; gap: 8px; }
    .vs-chip { display: none; }
  }
</style>
