<script lang="ts">
  import type { ScopeState } from '../engine';

  let {
    scope,
    sportId,
    onChange = () => {}
  }: {
    scope: ScopeState;
    sportId: 'football' | 'basketball' | 'tennis' | 'rally';
    onChange?: () => void;
  } = $props();

  const footballPresets = [
    { v: 'balanced', l: 'Balanced League' },
    { v: 'lowScoring', l: 'Low-Scoring League' },
    { v: 'highScoring', l: 'High-Scoring League' },
    { v: 'cup', l: 'Cup / Knockout' }
  ];
  const tennisSurfaces = [
    { v: 'hard', l: 'Hard Court' },
    { v: 'clay', l: 'Clay' },
    { v: 'grass', l: 'Grass' },
    { v: 'carpet', l: 'Carpet / Indoor' }
  ];
  const tennisFormats = [
    { v: 'bo3', l: 'Best of 3 Sets' },
    { v: 'bo5', l: 'Best of 5 Sets (Grand Slam)' }
  ];
</script>

<section class="team-inputs" aria-label="Match context">
  <div class="name-fields">
    <label>
      <span>{sportId === 'tennis' || sportId === 'rally' ? 'Player A' : 'Home / Team 1'}</span>
      <input
        type="text"
        autocomplete="off"
        placeholder={sportId === 'tennis' ? 'e.g. Djokovic' : sportId === 'rally' ? 'Player A name' : 'Home team'}
        bind:value={scope.teamA}
        oninput={onChange}
        aria-label={sportId === 'tennis' || sportId === 'rally' ? 'Player A name' : 'Home team name'}
      />
    </label>
    <div class="vs" aria-hidden="true">VS</div>
    <label>
      <span>{sportId === 'tennis' || sportId === 'rally' ? 'Player B' : 'Away / Team 2'}</span>
      <input
        type="text"
        autocomplete="off"
        placeholder={sportId === 'tennis' ? 'e.g. Alcaraz' : sportId === 'rally' ? 'Player B name' : 'Away team'}
        bind:value={scope.teamB}
        oninput={onChange}
        aria-label={sportId === 'tennis' || sportId === 'rally' ? 'Player B name' : 'Away team name'}
      />
    </label>
  </div>

  {#if sportId === 'football'}
    <div class="context-fields">
      <label>
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
      <label>
        <span>Surface</span>
        <select bind:value={scope.surface} onchange={onChange} aria-label="Court surface">
          {#each tennisSurfaces as s}
            <option value={s.v}>{s.l}</option>
          {/each}
        </select>
      </label>
      <label>
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
    padding: 14px;
    border: 1px solid #223047;
    background: #0f1726;
    border-radius: 12px;
    display: grid;
    gap: 12px;
  }
  .name-fields {
    display: grid;
    grid-template-columns: 1fr 32px 1fr;
    gap: 8px;
    align-items: end;
  }
  .name-fields label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: #9fb2cc;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .name-fields input {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    background: #111c2f;
    border: 1px solid #2a3a55;
    border-radius: 10px;
    color: #eaf3ff;
    font-weight: 600;
    font-size: 13px;
    transition: border-color 120ms, background 120ms;
  }
  .name-fields input:focus, .name-fields input:active {
    outline: none;
    border-color: var(--accent, #22c55e);
    background: #132342;
  }
  .name-fields input::placeholder { color: #5a6e8e; font-weight: 500; }
  .vs {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #1a2944;
    color: var(--accent, #22c55e);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.05em;
    justify-self: center;
    margin-bottom: 5px;
  }
  .context-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }
  .context-fields label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: #9fb2cc;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .context-fields select {
    width: 100%;
    min-height: 42px;
    padding: 0 32px 0 12px;
    background: #111c2f;
    border: 1px solid #2a3a55;
    border-radius: 10px;
    color: #eaf3ff;
    font-weight: 600;
    font-size: 13px;
    appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239fb2cc'><path d='M5.5 7.5L10 12l4.5-4.5z'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 14px;
  }
  .context-fields select:focus { outline: none; border-color: var(--accent, #22c55e); }

  @media (max-width: 420px) {
    .name-fields { grid-template-columns: 1fr; gap: 6px; }
    .vs { display: none; }
  }
</style>
