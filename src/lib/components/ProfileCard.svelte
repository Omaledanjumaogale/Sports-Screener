<script lang="ts">
  import type { Profile, Status } from '../engine';

  let { profile, accent = '#22c55e' }: { profile: Profile; accent?: string } = $props();

  const statusMap: Record<Status, string> = {
    green: 'Strong fit',
    amber: 'Borderline',
    red: 'Weak fit',
    empty: 'Awaiting data'
  };
</script>

<article class={`profile status-${profile.status}`} aria-labelledby={`profile-${profile.key}-title`} style={`--accent:${accent}`}>
  <div class="profile-head">
    <div class="profile-title-wrap">
      {#if profile.tag}
        <span class="profile-tag">{profile.tag}</span>
      {/if}
      <h2 id={`profile-${profile.key}-title`}>{profile.title}</h2>
    </div>
    <div class="profile-score">
      <strong>{profile.top ? profile.top.probability.toFixed(1) + '%' : profile.completed ? Math.round(profile.ratio * 100) + '%' : '—'}</strong>
      <span class="status-badge">{statusMap[profile.status]}</span>
    </div>
  </div>

  {#if profile.top}
    <p class="top-pick">
      <b>{profile.top.label}</b>
      <span> · {profile.top.marketTitle}</span>
      <span> · odds {profile.top.odds.toFixed(2)}</span>
      {#if profile.top.margin !== undefined}
        <span> · vig {profile.top.margin.toFixed(1)}%</span>
      {/if}
    </p>
  {/if}

  {#if profile.checks.length}
    <div class="scoreboard" aria-label="5-lamp scoreboard">
      {#each [0,1,2,3,4] as i}
        <span
          class={`lamp lamp-${profile.checks[i]?.status ?? 'empty'}`}
          aria-label={`Lamp ${i + 1}: ${profile.checks[i]?.title ?? 'empty'} — ${profile.checks[i]?.status ?? 'empty'}`}
          title={profile.checks[i]?.title ?? 'No data'}
        ></span>
      {/each}
    </div>
    <ul class="checks" aria-label="Profile criteria checks">
      {#each profile.checks as check}
        <li class={`check check-${check.status}`}>
          <span class={`dot dot-${check.status}`} aria-hidden="true"></span>
          <div class="check-text">
            <b>{check.title}</b>
            <small>{check.detail}</small>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="profile-empty">Ranking updates as related markets are filled. Add line + odds pairs below.</p>
  {/if}
</article>

<style>
  .profile {
    padding: 16px 16px 14px;
    border: 1px solid #223047;
    background: #0f1726;
    border-radius: 14px;
    transition: border-color 160ms, background 160ms;
  }
  .profile.status-green { border-color: rgba(34,197,94,0.32); background: linear-gradient(180deg, rgba(34,197,94,0.08), #0f1726 60%); }
  .profile.status-amber { border-color: rgba(245,158,11,0.32); background: linear-gradient(180deg, rgba(245,158,11,0.07), #0f1726 60%); }
  .profile.status-red   { border-color: rgba(251,113,133,0.28); background: linear-gradient(180deg, rgba(251,113,133,0.06), #0f1726 60%); }

  .profile-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .profile-title-wrap { min-width: 0; flex: 1; }
  .profile-tag {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 8px;
    background: color-mix(in srgb, var(--accent) 20%, #111c2f);
    color: var(--accent);
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .profile-title-wrap h2 {
    font-size: 15px;
    margin: 0;
    letter-spacing: -0.005em;
    color: #eaf3ff;
    line-height: 1.25;
  }
  .profile-score { text-align: right; min-width: 0; }
  .profile-score strong {
    display: block;
    font-size: 22px;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    line-height: 1;
  }
  .status-badge {
    display: inline-block;
    margin-top: 6px;
    font-size: 10.5px;
    font-weight: 700;
    color: #9fb2cc;
    letter-spacing: 0.02em;
  }

  .top-pick {
    margin: 12px 0 0;
    color: #c7d7ee;
    font-size: 12.5px;
    line-height: 1.5;
    font-weight: 500;
    background: #111c2f;
    padding: 10px 12px;
    border-radius: 10px;
    border-left: 3px solid var(--accent);
  }
  .top-pick b { color: #eaf3ff; font-weight: 800; }

  .scoreboard {
    display: inline-flex;
    gap: 7px;
    margin-top: 14px;
    padding: 7px 10px;
    background: #0a111d;
    border-radius: 10px;
    border: 1px solid #1c2941;
  }
  .lamp {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #1e2b44;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.4);
    transition: background 200ms, box-shadow 200ms;
  }
  .lamp-green { background: radial-gradient(circle at 30% 30%, #86efac, #22c55e 65%, #15803d); box-shadow: 0 0 8px rgba(34,197,94,0.55); }
  .lamp-amber { background: radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 65%, #b45309); box-shadow: 0 0 8px rgba(245,158,11,0.5); }
  .lamp-red   { background: radial-gradient(circle at 30% 30%, #fecdd3, #fb7185 65%, #be123c); box-shadow: 0 0 8px rgba(251,113,133,0.5); }
  .lamp-empty { background: #1e2b44; }

  .checks {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: grid;
    gap: 8px;
  }
  .check {
    display: grid;
    grid-template-columns: 11px 1fr;
    gap: 10px;
    align-items: start;
  }
  .dot {
    width: 9px;
    height: 9px;
    margin-top: 6px;
    border-radius: 50%;
    background: #475569;
  }
  .dot-green { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
  .dot-amber { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.4); }
  .dot-red   { background: #fb7185; box-shadow: 0 0 6px rgba(251,113,133,0.4); }
  .dot-empty { background: #334155; }
  .check-text b {
    display: block;
    font-size: 13px;
    color: #eaf3ff;
    font-weight: 700;
    line-height: 1.3;
  }
  .check-text small {
    display: block;
    color: #9fb2cc;
    line-height: 1.45;
    margin-top: 2px;
    font-size: 12px;
  }

  .profile-empty {
    margin: 12px 0 0;
    color: #8ea3c3;
    font-style: italic;
    font-size: 13px;
    padding: 10px 12px;
    background: #111c2f;
    border-radius: 10px;
    border: 1px dashed #233550;
  }
</style>
