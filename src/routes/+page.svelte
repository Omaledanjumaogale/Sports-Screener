<script lang="ts">
  import { goto } from '$app/navigation';
  import { Activity, BarChart3, Dumbbell, Goal } from '@lucide/svelte';
  import SportCard from '$lib/components/SportCard.svelte';

  export const ssr = false;
  export const prerender = false;

  const sports = [
    {
      id: 'football' as const,
      short: 'Football',
      title: 'Football Matchday Screener',
      description: '1H / 2H / FT threshold profiles with correct-score cluster, BTTS, result fallbacks and 5-lamp scoreboards.',
      accent: '#22c55e',
      icon: Goal,
      path: '/football'
    },
    {
      id: 'basketball' as const,
      short: 'Basketball',
      title: 'Basketball MET Screener',
      description: 'FT / Q1 / H1 Market Expected Total line analysis, team-total consistency, spread ranking.',
      accent: '#f97316',
      icon: Dumbbell,
      path: '/basketball'
    },
    {
      id: 'tennis' as const,
      short: 'Tennis',
      title: 'Tennis MEG Screener',
      description: 'RT / S1 Market Expected Games, correct-score CSI (sweep, 4/5 set, tiebreak) and surface/format context.',
      accent: '#e879f9',
      icon: Activity,
      path: '/tennis'
    },
    {
      id: 'rally' as const,
      short: 'Rally / TT',
      title: 'Rally Line Table Tennis Screener',
      description: 'Full Match + 1st Set multi-market screener with safest pick, margin rank, sweep and set-shape metrics.',
      accent: '#38bdf8',
      icon: BarChart3,
      path: '/rally'
    }
  ];

  function nav(p: string) { void goto(p); }
</script>

<div class="landing-root">
  <main class="landing-inner">
    <section class="hero" aria-label="Sports Screener hero">
      <p class="eyebrow">Offline-first odds intelligence</p>
      <h1>Sports Screener</h1>
      <p class="hero-copy">
        A unified mobile workspace for football, basketball, tennis and rally / table-tennis
        match screening. Pick a sport, drop market lines via dropdown, adjust decimal odds
        with stepper controls, and read the live profile verdict. All data stays on your
        device — saved automatically per sport.
      </p>
      <ul class="bullet-row" aria-label="Key features">
        <li>Decimal odds pickers + nudgers, no typing</li>
        <li>Odd-count line groups: 5 / 7 rows</li>
        <li>5-lamp scoreboard per profile</li>
        <li>Local storage persistence</li>
      </ul>
    </section>

    <section aria-label="Choose a sport" class="sport-section">
      <h2 class="section-title">Select sport</h2>
      <div class="sport-grid">
        {#each sports as s}
          <SportCard
            icon={s.icon}
            short={s.short}
            title={s.title}
            description={s.description}
            accent={s.accent}
            onClick={() => nav(s.path)}
          />
        {/each}
      </div>
    </section>

    <footer class="foot">
      <div>
        <strong>Sports Screener</strong> · SvelteKit static build · Offline functional · Enterprise mobile UI (320px – 2560px)
      </div>
    </footer>
  </main>
</div>

<style>
  :root { color-scheme: dark; }
  .landing-root {
    width: 100%;
    min-height: 100vh;
    background:
      radial-gradient(1400px 500px at 90% -5%, rgba(56,189,248,0.12), transparent 55%),
      radial-gradient(900px 500px at -10% 10%, rgba(34,197,94,0.10), transparent 55%),
      #080b12;
  }
  .landing-inner {
    width: min(100%, 960px);
    margin: 0 auto;
    padding: max(22px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    min-width: 320px;
  }
  .hero {
    padding: 28px 0 18px;
    min-height: 34vh;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .eyebrow {
    margin: 0 0 10px;
    color: #9fb2cc;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 12px;
    font-weight: 800;
  }
  h1 {
    margin: 0 0 14px;
    font-size: clamp(34px, 11vw, 62px);
    line-height: 0.95;
    letter-spacing: -0.02em;
    background: linear-gradient(120deg, #ffffff 0%, #c7d7ee 70%, #9fb2cc 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .hero-copy {
    margin: 0;
    color: #c9d6e8;
    line-height: 1.6;
    max-width: 760px;
    font-size: clamp(14px, 2.7vw, 16px);
  }
  .bullet-row {
    list-style: none;
    padding: 0;
    margin: 20px 0 0;
    display: grid;
    gap: 8px 14px;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
  .bullet-row li {
    position: relative;
    padding-left: 22px;
    color: #b8c6da;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.45;
  }
  .bullet-row li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 5px;
    width: 13px;
    height: 13px;
    border-radius: 4px;
    background: linear-gradient(135deg, #22c55e, #38bdf8);
    box-shadow: 0 0 0 3px rgba(56,189,248,0.08);
  }
  .sport-section {
    margin-top: 8px;
  }
  .section-title {
    font-size: 13px;
    color: #9fb2cc;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 800;
    margin: 28px 0 14px;
  }
  .sport-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
  .foot {
    margin-top: 36px;
    padding: 22px 6px 4px;
    color: #6f84a5;
    font-size: 12px;
    line-height: 1.5;
    border-top: 1px solid #1a253b;
  }
  .foot strong { color: #9fb2cc; font-weight: 800; letter-spacing: 0.02em; }

  @media (max-width: 380px) {
    .landing-inner { padding-left: 10px; padding-right: 10px; }
    .bullet-row { grid-template-columns: 1fr; }
  }
  @media (min-width: 1400px) {
    .landing-inner { width: min(100%, 1100px); }
  }
  @media (min-width: 2000px) {
    .landing-inner { width: min(100%, 1280px); }
  }
</style>
