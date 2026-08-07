<script lang="ts">
  // Animated SVG "agent orbit" for the AI Predictor section. Purely decorative
  // (aria-hidden) — a ring of agent nodes circling an orchestrator core, drawn
  // with inline SVG so no network assets or JS animation libs are needed.
  import { AGENT_DEFS } from '$lib/agentUi';

  let {
    core = 'Eze Ugo',
    coreRole = 'Orchestrator',
    accent = '#6366f1',
    height = 320
  }: {
    core?: string;
    coreRole?: string;
    accent?: string;
    height?: number;
  } = $props();

  // 8 orbiting agents (Emeka stays as the inner scheduler node).
  const ORBIT_AGENTS = AGENT_DEFS.filter((a) => a.id !== 'emeka');
  const R = 88;
  const CX = 150;
  const CY = 150;
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

<svg
  class="agent-orbit"
  viewBox="0 0 300 300"
  width="100%"
  height={height}
  aria-hidden="true"
  focusable="false"
  style={`--accent:${accent}`}
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
  <circle cx={CX} cy={CY} r="118" fill="url(#orbitGlow)" />

  <!-- Orbit rings -->
  <circle class="ring ring-a" cx={CX} cy={CY} r={R} fill="none" stroke="{accent}" stroke-opacity="0.3" stroke-width="1.4" stroke-dasharray="4 6" />
  <circle class="ring ring-b" cx={CX} cy={CY} r="58" fill="none" stroke="{accent}" stroke-opacity="0.22" stroke-width="1.2" stroke-dasharray="3 7" />

  <!-- Orbiting agents -->
  {#each AGENTS as a}
    <g class="agent-node" transform="translate({a.x} {a.y})">
      <circle r="16" fill="var(--c-surface-3, #0f172a)" stroke="{accent}" stroke-width="1.6" stroke-opacity="0.6" />
      <circle r="16" fill="{accent}" fill-opacity="0.16" />
      <text
        y="3.5"
        text-anchor="middle"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        font-size="9"
        font-weight="800"
        fill="currentColor"
      >
        {a.name}
      </text>
    </g>
  {/each}

  <!-- Inner scheduler node -->
  <g transform="translate({CX} {CY + 40})">
    <circle r="13" fill="var(--c-surface-3, #0f172a)" stroke="{accent}" stroke-width="1.5" />
    <circle r="13" fill="{accent}" fill-opacity="0.2" />
    <text y="3" text-anchor="middle" font-family="var(--font-mono, 'JetBrains Mono', monospace)" font-size="8.5" font-weight="800" fill="currentColor">Emeka</text>
  </g>

  <!-- Orchestrator core -->
  <g class="core-pulse">
    <circle class="pulse-ring" cx={CX} cy={CY} r="30" fill="none" stroke="{accent}" stroke-width="1.6" />
    <circle cx={CX} cy={CY} r="26" fill="url(#orbitCore)" />
    <circle cx={CX} cy={CY} r="26" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1" />
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
    <text x={CX} y={CY + 10} text-anchor="middle" font-family="var(--font-mono, 'JetBrains Mono', monospace)" font-size="6.5" font-weight="700" fill="rgba(255,255,255,0.85)">{coreRole}</text>
  </g>
</svg>

<style>
  .agent-orbit { display: block; margin: 0 auto; max-width: 320px; }

  .ring-a { transform-origin: 150px 150px; animation: orbit-spin 26s linear infinite; }
  .ring-b { transform-origin: 150px 150px; animation: orbit-spin 18s linear infinite reverse; }

  .core-pulse .pulse-ring { transform-origin: 150px 150px; animation: core-pulse 2.6s ease-out infinite; }

  .agent-node text { color: var(--c-text, #f1f5ff); }
  .agent-node { animation: node-float 4.5s ease-in-out infinite; }

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