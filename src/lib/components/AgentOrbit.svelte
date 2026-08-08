<script lang="ts">
  // Animated SVG "agent orbit" for the AI Predictor section. Purely decorative —
  // a ring of agent nodes circling an orchestrator core, drawn with inline SVG so
  // no network assets or JS animation libs are needed. Exposed to assistive tech
  // via an accessible label; the SVG itself is decorative.
  import { AGENT_DEFS } from '$lib/agentUi';

  let {
    core = 'Eze Ugo',
    coreRole = 'Orchestrator',
    accent = '#6366f1',
    height = 300
  }: {
    core?: string;
    coreRole?: string;
    accent?: string;
    height?: number;
  } = $props();

  // 8 orbiting agents (Emeka stays as the inner scheduler node).
  const ORBIT_AGENTS = AGENT_DEFS.filter((a) => a.id !== 'emeka');
  const R = 110;
  const CX = 180;
  const CY = 180;
  const AGENTS = ORBIT_AGENTS.map((a, i) => {
    const angle = (i / ORBIT_AGENTS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      name: a.name.split(' ')[0],
      role: a.role,
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle)
    };
  });
</script>

<div
  class="orbit-wrap"
  style={`--accent:${accent}`}
  role="img"
  aria-label={`${core} ${coreRole} orchestrating the PulseOdds AI agent team: ${AGENTS.map((a) => a.name).join(', ')}.`}
>
  <svg
    class="agent-orbit"
    viewBox="0 0 360 360"
    width="100%"
    height={height}
    aria-hidden="true"
    focusable="false"
  >
  <defs>
    <radialGradient id="orbitCore" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="{accent}" stop-opacity="0.45" />
    </radialGradient>
    <radialGradient id="orbitGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="{accent}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Outer glow -->
  <circle cx={CX} cy={CY} r="150" fill="url(#orbitGlow)" />

  <!-- Orbit rings -->
  <circle class="ring ring-a" cx={CX} cy={CY} r={R} fill="none" stroke="{accent}" stroke-opacity="0.3" stroke-width="1.4" stroke-dasharray="4 6" />
  <circle class="ring ring-b" cx={CX} cy={CY} r="70" fill="none" stroke="{accent}" stroke-opacity="0.22" stroke-width="1.2" stroke-dasharray="3 7" />

  <!-- Orbiting agents -->
  {#each AGENTS as a}
    <g class="agent-node" transform="translate({a.x} {a.y})">
      <circle r="17" fill="var(--c-surface-3, #0f172a)" stroke="{accent}" stroke-width="1.6" stroke-opacity="0.6" />
      <circle r="17" fill="{accent}" fill-opacity="0.16" />
      <text
        y="15"
        x="0"
        style="text-anchor: middle;"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        font-size="8"
        font-weight="800"
        fill="currentColor"
      >
        {a.name}
      </text>
    </g>
  {/each}

  <!-- Inner scheduler node -->
  <g transform="translate({CX} {CY + 56})">
    <circle r="15" fill="var(--c-surface-3, #0f172a)" stroke="{accent}" stroke-width="1.5" />
    <circle r="15" fill="{accent}" fill-opacity="0.2" />
    <text y="3" text-anchor="middle" font-family="var(--font-mono, 'JetBrains Mono', monospace)" font-size="7.5" font-weight="800" fill="currentColor">Emeka</text>
  </g>

  <!-- Orchestrator core -->
  <g class="core-pulse">
    <circle class="pulse-ring" cx={CX} cy={CY} r="36" fill="none" stroke="{accent}" stroke-width="1.6" />
    <circle cx={CX} cy={CY} r="31" fill="url(#orbitCore)" />
    <circle cx={CX} cy={CY} r="31" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1" />
    <text
      x={CX}
      y={CY - 3}
      text-anchor="middle"
      font-family="var(--font-brand, 'Outfit', system-ui)"
      font-size="10.5"
      font-weight="900"
      fill="#fff"
    >
      {core.split(' ')[0]}
    </text>
    <text x={CX} y={CY + 12} text-anchor="middle" font-family="var(--font-mono, 'JetBrains Mono', monospace)" font-size="7" font-weight="700" fill="rgba(255,255,255,0.85)">{coreRole}</text>
  </g>
</svg>

  <div class="orbit-legend" aria-hidden="true">
    <span class="leg-core"><span class="dot" style={`background:${accent}`}></span>{core}</span>
    <span class="leg-sep">·</span>
    <span class="leg-text">7 specialists + scheduler orbit nightly scopes</span>
  </div>
</div>

<style>
  .orbit-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    max-width: 380px;
    margin: 0 auto;
    overflow: visible;
  }

  .agent-orbit { display: block; width: 100%; max-width: 380px; }

  .ring-a { transform-origin: 180px 180px; animation: orbit-spin 26s linear infinite; }
  .ring-b { transform-origin: 180px 180px; animation: orbit-spin 18s linear infinite reverse; }

  .core-pulse .pulse-ring { transform-origin: 180px 180px; animation: core-pulse 2.6s ease-out infinite; }

  .agent-node text { color: var(--c-text, #f1f5ff); }
  .agent-node { animation: node-float 4.5s ease-in-out infinite; }

  .orbit-legend { display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 800; color: var(--c-muted, #94a3b8); letter-spacing: 0.02em; }
  .leg-sep { opacity: 0.5; }
  .leg-text { opacity: 0.75; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: middle; box-shadow: 0 0 8px rgba(255,255,255,0.25); }

  @keyframes orbit-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes core-pulse {
    0% { transform: scale(0.72); opacity: 0.85; }
    100% { transform: scale(1.35); opacity: 0; }
  }

  @keyframes node-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
</style>