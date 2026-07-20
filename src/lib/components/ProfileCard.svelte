<script lang="ts">
  import type { Profile, Status } from '../engine';

  let { profile, accent = '#6366f1' }: { profile: Profile; accent?: string } = $props();

  const statusMap: Record<Status, string> = {
    green: 'Strong',
    amber: 'Borderline',
    red:   'Weak',
    empty: 'Waiting'
  };

  const statusGlow: Record<Status, string> = {
    green: 'rgba(74,222,128,',
    amber: 'rgba(251,191,36,',
    red:   'rgba(251,113,133,',
    empty: 'rgba(136,153,187,'
  };

  const pct = $derived(
    profile.top
      ? profile.top.probability.toFixed(1) + '%'
      : profile.completed
        ? Math.round(profile.ratio * 100) + '%'
        : '—'
  );

  const glow = $derived(statusGlow[profile.status] ?? 'rgba(99,102,241,');
</script>

<article
  class={`profile profile-card status-${profile.status}`}
  aria-labelledby={`profile-${profile.key}-title`}
  style={`--accent:${accent}; --glow:${glow}`}
>
  <!-- Status top edge -->
  <span class="status-edge" aria-hidden="true"></span>

  <!-- Header row -->
  <div class="card-head">
    <div class="head-left">
      {#if profile.tag}
        <span class="profile-tag">{profile.tag}</span>
      {/if}
      <h2 id={`profile-${profile.key}-title`}>{profile.title}</h2>
    </div>
    <div class="head-right">
      <strong class="score mono">{pct}</strong>
      <span class={`status-badge status-badge-${profile.status}`}>
        <span class="status-dot" aria-hidden="true"></span>
        {statusMap[profile.status]}
      </span>
    </div>
  </div>

  <!-- Top pick -->
  {#if profile.top}
    <div class="top-pick">
      <span class="top-pick-label">Top Pick</span>
      <p class="top-pick-text">
        <b>{profile.top.label}</b>
        <span class="top-pick-sep">·</span>
        <span>{profile.top.marketTitle}</span>
        <span class="top-pick-sep">·</span>
        <span class="mono">{profile.top.odds.toFixed(2)}</span>
        {#if profile.top.margin !== undefined}
          <span class="top-pick-sep">·</span>
          <span class="vig">vig {profile.top.margin.toFixed(1)}%</span>
        {/if}
      </p>
    </div>
  {/if}

  <!-- 5-lamp scoreboard -->
  {#if profile.checks.length}
    <div class="scoreboard" aria-label="5-lamp score indicator">
      {#each [0,1,2,3,4] as i}
        <span
          class={`lamp lamp-${profile.checks[i]?.status ?? 'empty'}`}
          aria-label={`Check ${i + 1}: ${profile.checks[i]?.title ?? 'empty'} — ${profile.checks[i]?.status ?? 'empty'}`}
          title={profile.checks[i]?.title ?? 'No data'}
        ></span>
      {/each}
    </div>

    <!-- Checks list -->
    <ul class="checks" aria-label="Profile checks">
      {#each profile.checks as check}
        <li class={`check check-${check.status}`}>
          <span class={`check-dot check-dot-${check.status}`} aria-hidden="true"></span>
          <div class="check-body">
            <b class="check-title">{check.title}</b>
            <small class="check-detail">{check.detail}</small>
          </div>
        </li>
      {/each}
    </ul>

  {:else}
    <!-- Empty state -->
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">📊</span>
      <p>Add market lines below to see profile results here.</p>
    </div>
  {/if}
</article>

<style>
  .profile-card {
    position: relative;
    overflow: hidden;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    transition:
      border-color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease),
      transform var(--t-base, 180ms ease);
    animation: scale-in 0.35s ease both;
  }

  .profile-card:hover { transform: translateY(-1px); }

  /* Status variants */
  .status-green {
    border-color: rgba(74, 222, 128, 0.22);
    background: linear-gradient(160deg, rgba(74,222,128,0.07), rgba(255,255,255,0.03));
    box-shadow: 0 4px 28px rgba(74, 222, 128, 0.09);
  }
  .status-green:hover { box-shadow: 0 8px 36px rgba(74, 222, 128, 0.16); }

  .status-amber {
    border-color: rgba(251, 191, 36, 0.22);
    background: linear-gradient(160deg, rgba(251,191,36,0.07), rgba(255,255,255,0.03));
    box-shadow: 0 4px 28px rgba(251, 191, 36, 0.09);
  }
  .status-amber:hover { box-shadow: 0 8px 36px rgba(251, 191, 36, 0.16); }

  .status-red {
    border-color: rgba(251, 113, 133, 0.22);
    background: linear-gradient(160deg, rgba(251,113,133,0.07), rgba(255,255,255,0.03));
    box-shadow: 0 4px 28px rgba(251, 113, 133, 0.09);
  }
  .status-red:hover { box-shadow: 0 8px 36px rgba(251, 113, 133, 0.16); }

  /* Top edge colour bar */
  .status-edge {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: rgba(255,255,255,0.08);
  }
  .status-green .status-edge { background: linear-gradient(90deg, #4ade80, transparent 70%); }
  .status-amber .status-edge { background: linear-gradient(90deg, #fbbf24, transparent 70%); }
  .status-red   .status-edge { background: linear-gradient(90deg, #fb7185, transparent 70%); }

  /* Header */
  .card-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .head-left { min-width: 0; flex: 1; }
  .head-right { text-align: right; flex-shrink: 0; }

  .profile-tag {
    display: inline-block;
    margin-bottom: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 18%, rgba(255,255,255,0.04));
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    color: var(--accent);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .card-head h2 {
    font-size: 14.5px;
    margin: 0;
    letter-spacing: -0.01em;
    color: var(--c-text, #f1f5ff);
    line-height: 1.25;
    font-weight: 800;
  }

  .score {
    display: block;
    font-size: 26px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    letter-spacing: -0.02em;
    line-height: 1;
    color: var(--c-text, #f1f5ff);
  }
  .status-green .score { color: #4ade80; }
  .status-amber .score { color: #fbbf24; }
  .status-red   .score { color: #fb7185; }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--c-muted, #8899bb);
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.04);
  }
  .status-badge-green { color: #86efac; border-color: rgba(74,222,128,0.2); }
  .status-badge-amber { color: #fde68a; border-color: rgba(251,191,36,0.2); }
  .status-badge-red   { color: #fecdd3; border-color: rgba(251,113,133,0.2); }

  .status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
  }
  .status-badge-green .status-dot { animation: dot-pulse 2s ease-in-out infinite; }

  /* Top pick */
  .top-pick {
    margin-top: 14px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-left: 3px solid var(--accent);
  }
  .top-pick-label {
    display: block;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    margin-bottom: 5px;
  }
  .top-pick-text {
    margin: 0;
    font-size: 12.5px;
    color: var(--c-text-2, #c8d6ee);
    line-height: 1.5;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .top-pick-text b { color: var(--c-text, #f1f5ff); font-weight: 800; }
  .top-pick-sep { color: var(--c-faint, #5a6e8a); }
  .vig { color: var(--c-muted, #8899bb); font-size: 11.5px; }
  .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }

  /* Scoreboard */
  .scoreboard {
    display: inline-flex;
    gap: 8px;
    margin-top: 16px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
  }

  .lamp {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
    transition: background 200ms, box-shadow 200ms;
  }
  .lamp-green {
    background: radial-gradient(circle at 30% 30%, #86efac, #22c55e 60%, #15803d);
    box-shadow: 0 0 10px rgba(74,222,128,0.7), 0 0 3px rgba(74,222,128,0.4) inset;
    border-color: rgba(74,222,128,0.3);
  }
  .lamp-amber {
    background: radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 60%, #b45309);
    box-shadow: 0 0 10px rgba(251,191,36,0.65), 0 0 3px rgba(251,191,36,0.4) inset;
    border-color: rgba(251,191,36,0.3);
  }
  .lamp-red {
    background: radial-gradient(circle at 30% 30%, #fecdd3, #fb7185 60%, #be123c);
    box-shadow: 0 0 10px rgba(251,113,133,0.6), 0 0 3px rgba(251,113,133,0.4) inset;
    border-color: rgba(251,113,133,0.3);
  }

  /* Checks */
  .checks {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: grid;
    gap: 9px;
  }
  .check {
    display: grid;
    grid-template-columns: 12px 1fr;
    gap: 10px;
    align-items: start;
    animation: fade-in 0.25s ease both;
  }
  .check-dot {
    width: 8px; height: 8px;
    margin-top: 5px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    flex-shrink: 0;
  }
  .check-dot-green { background: #4ade80; box-shadow: 0 0 7px rgba(74,222,128,0.6); }
  .check-dot-amber { background: #fbbf24; box-shadow: 0 0 7px rgba(251,191,36,0.6); }
  .check-dot-red   { background: #fb7185; box-shadow: 0 0 7px rgba(251,113,133,0.6); }
  .check-dot-empty { background: rgba(255,255,255,0.12); }

  .check-title {
    display: block;
    font-size: 13px;
    color: var(--c-text, #f1f5ff);
    font-weight: 700;
    line-height: 1.3;
  }
  .check-detail {
    display: block;
    color: var(--c-muted, #8899bb);
    line-height: 1.45;
    margin-top: 2px;
    font-size: 11.5px;
    font-weight: 500;
  }

  /* Empty state */
  .empty-state {
    margin-top: 14px;
    padding: 16px;
    text-align: center;
    border: 1px dashed rgba(255,255,255,0.1);
    border-radius: 12px;
    background: rgba(255,255,255,0.02);
  }
  .empty-icon { font-size: 22px; display: block; margin-bottom: 8px; opacity: 0.5; }
  .empty-state p {
    color: var(--c-muted, #8899bb);
    font-size: 12.5px;
    line-height: 1.5;
    font-style: italic;
    margin: 0;
  }
</style>
