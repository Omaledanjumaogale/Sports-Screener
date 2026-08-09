<script lang="ts">
  // Premium animated SVG agent orbit — fully self-contained, no external assets.
  // All agent nodes are guaranteed visible within the viewBox with generous padding.
  import { AGENT_DEFS } from '$lib/agentUi';

  let {
    core = 'Eze Ugo',
    coreRole = 'Orchestrator',
    accent = '#6366f1',
    height = 360
  }: {
    core?: string;
    coreRole?: string;
    accent?: string;
    height?: number;
  } = $props();

  // Safe viewBox size — 440×440 so orbit nodes (r=20) at R=152 never clip.
  const VW = 440;
  const VH = 440;
  const CX = VW / 2;   // 220
  const CY = VH / 2;   // 220
  const R_OUTER = 152;  // outer orbit radius for agent nodes
  const R_INNER = 76;   // inner orbit radius for scheduler node

  // All agents except Emeka orbit the outer ring
  const ORBIT_AGENTS = AGENT_DEFS.filter((a) => a.id !== 'emeka');
  const TOTAL = ORBIT_AGENTS.length;

  const AGENTS = ORBIT_AGENTS.map((a, i) => {
    const angle = (i / TOTAL) * Math.PI * 2 - Math.PI / 2;
    return {
      id: a.id,
      firstName: a.name.split(' ')[0],
      role: a.role,
      x: CX + R_OUTER * Math.cos(angle),
      y: CY + R_OUTER * Math.sin(angle),
      delay: `${((i / TOTAL) * -8).toFixed(1)}s`
    };
  });

  // Emeka on the inner ring at bottom
  const emekaAngle = Math.PI / 2;
  const EMEKA = {
    x: CX + R_INNER * Math.cos(emekaAngle),
    y: CY + R_INNER * Math.sin(emekaAngle)
  };

  function roleTag(id: string): string {
    const map: Record<string, string> = {
      tunde: 'FIX', kunle: 'ODD', ngozi: 'VOL',
      bolanle: 'RES', chinedu: 'NRM', amara: 'PRB',
      zainab: 'RSK', adaeze: 'RPT'
    };
    return map[id] ?? 'AGT';
  }

  // Unique ID prefix to avoid gradient conflicts when multiple SVGs are on page
  const uid = Math.random().toString(36).slice(2, 7);
</script>

<div
  class="orbit-wrap"
  style={`--accent:${accent}`}
  role="img"
  aria-label={`${core} ${coreRole} leading the PulseOdds SMOA agent team: ${AGENTS.map((a) => a.firstName).join(', ')} and Emeka.`}
>
  <svg
    class="agent-orbit-svg"
    viewBox="0 0 440 440"
    width="100%"
    height={height}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <radialGradient id={`${uid}-core`} cx="50%" cy="40%" r="65%">
        <stop offset="0%" stop-color={accent} stop-opacity="1" />
        <stop offset="60%" stop-color={accent} stop-opacity="0.75" />
        <stop offset="100%" stop-color={accent} stop-opacity="0.35" />
      </radialGradient>
      <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color={accent} stop-opacity="0.18" />
        <stop offset="100%" stop-color={accent} stop-opacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-node`} cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color={accent} stop-opacity="0.28" />
        <stop offset="100%" stop-color={accent} stop-opacity="0.05" />
      </radialGradient>
    </defs>

    <!-- Ambient glow -->
    <circle cx={CX} cy={CY} r="200" fill={`url(#${uid}-glow)`} />

    <!-- Outer orbit ring (slow clockwise) -->
    <circle
      class="ring-outer"
      cx={CX} cy={CY} r={R_OUTER}
      fill="none"
      stroke={accent}
      stroke-opacity="0.28"
      stroke-width="1.5"
      stroke-dasharray="6 9"
    />

    <!-- Inner orbit ring (counter-clockwise) -->
    <circle
      class="ring-inner"
      cx={CX} cy={CY} r={R_INNER}
      fill="none"
      stroke={accent}
      stroke-opacity="0.20"
      stroke-width="1.2"
      stroke-dasharray="4 8"
    />

    <!-- Connector lines from each agent to core (ambient, subtle) -->
    {#each AGENTS as a}
      <line
        x1={CX} y1={CY}
        x2={a.x} y2={a.y}
        stroke={accent}
        stroke-opacity="0.11"
        stroke-width="0.9"
        stroke-dasharray="3 6"
      />
    {/each}

    <!-- Orbiting specialist agent nodes -->
    {#each AGENTS as a, i}
      <g
        class="agent-node"
        transform={`translate(${a.x} ${a.y})`}
        style={`animation-delay: ${a.delay}`}
      >
        <circle r="21" fill={accent} fill-opacity="0.07" />
        <circle r="17" fill="var(--c-surface-3, #0d1117)" stroke={accent} stroke-width="1.7" stroke-opacity="0.68" />
        <circle r="17" fill={`url(#${uid}-node)`} />
        <!-- First name (top) -->
        <text
          y="-1.5"
          x="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-family="var(--font-mono, 'JetBrains Mono', monospace)"
          font-size="7.5"
          font-weight="900"
          fill={accent}
          fill-opacity="0.92"
        >{a.firstName.slice(0, 5)}</text>
        <!-- Role tag (bottom) -->
        <text
          y="9"
          x="0"
          text-anchor="middle"
          font-family="var(--font-mono, 'JetBrains Mono', monospace)"
          font-size="5.5"
          font-weight="700"
          fill="rgba(255,255,255,0.48)"
        >{roleTag(a.id)}</text>
      </g>
    {/each}

    <!-- Inner scheduler node (Emeka) -->
    <g class="emeka-node" transform={`translate(${EMEKA.x} ${EMEKA.y})`}>
      <circle r="15" fill={accent} fill-opacity="0.1" />
      <circle r="12" fill="var(--c-surface-3, #0d1117)" stroke={accent} stroke-width="1.5" stroke-opacity="0.6" />
      <text
        y="0"
        x="0"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        font-size="6.5"
        font-weight="900"
        fill={accent}
        fill-opacity="0.82"
      >Emeka</text>
    </g>

    <!-- Orchestrator core — dual pulsing rings -->
    <circle class="pulse-ring-1" cx={CX} cy={CY} r="42" fill="none" stroke={accent} stroke-width="1.5" stroke-opacity="0.6" />
    <circle class="pulse-ring-2" cx={CX} cy={CY} r="42" fill="none" stroke={accent} stroke-width="1.5" stroke-opacity="0.35" />
    <!-- Core disc -->
    <circle cx={CX} cy={CY} r="35" fill={`url(#${uid}-core)`} />
    <circle cx={CX} cy={CY} r="35" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1" />
    <!-- Core name -->
    <text
      x={CX} y={CY - 5}
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="var(--font-brand, 'Outfit', system-ui)"
      font-size="10.5"
      font-weight="900"
      fill="#ffffff"
      letter-spacing="-0.02em"
    >{core.split(' ')[0]}</text>
    <!-- Core role -->
    <text
      x={CX} y={CY + 9}
      text-anchor="middle"
      font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      font-size="6"
      font-weight="700"
      fill="rgba(255,255,255,0.75)"
      letter-spacing="0.06em"
    >{coreRole.toUpperCase()}</text>
  </svg>

  <!-- Legend -->
  <div class="orbit-legend" aria-hidden="true">
    <span class="leg-dot" style={`background:${accent}; box-shadow: 0 0 8px ${accent}`}></span>
    <span class="leg-core">{core}</span>
    <span class="leg-sep">·</span>
    <span class="leg-text">8 specialists + scheduler</span>
  </div>
</div>

<style>
  .orbit-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
    overflow: visible;
  }

  .agent-orbit-svg {
    display: block;
    width: 100%;
    max-width: 440px;
    overflow: visible;
  }

  /* Outer ring — slow clockwise spin (transform-origin matches viewBox center 220 220) */
  .ring-outer {
    transform-origin: 220px 220px;
    animation: spin-cw 32s linear infinite;
  }
  /* Inner ring — counter-clockwise */
  .ring-inner {
    transform-origin: 220px 220px;
    animation: spin-ccw 20s linear infinite;
  }

  /* Agent nodes float subtly, staggered via animation-delay set inline */
  .agent-node {
    animation: node-float 5.5s ease-in-out infinite;
  }

  /* Emeka pulses on inner ring */
  .emeka-node {
    animation: node-float 3.8s ease-in-out infinite reverse;
  }

  /* Dual pulse rings on orchestrator core */
  .pulse-ring-1 {
    transform-origin: 220px 220px;
    animation: core-pulse 3s ease-out infinite;
  }
  .pulse-ring-2 {
    transform-origin: 220px 220px;
    animation: core-pulse 3s ease-out infinite;
    animation-delay: -1.5s;
  }

  @keyframes spin-cw {
    to { transform: rotate(360deg); }
  }
  @keyframes spin-ccw {
    to { transform: rotate(-360deg); }
  }
  @keyframes core-pulse {
    0%   { transform: scale(0.65); opacity: 0.9; }
    60%  { opacity: 0.35; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  @keyframes node-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-4px); }
  }

  /* Legend strip */
  .orbit-legend {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 800;
    color: var(--c-muted, #64748b);
    letter-spacing: 0.025em;
  }
  .leg-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .leg-core { color: var(--accent, #6366f1); font-weight: 900; }
  .leg-sep  { opacity: 0.45; }
  .leg-text { opacity: 0.7; }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    .ring-outer, .ring-inner, .agent-node, .emeka-node,
    .pulse-ring-1, .pulse-ring-2 {
      animation: none;
    }
  }
</style>