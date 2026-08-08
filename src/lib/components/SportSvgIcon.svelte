<script lang="ts">
  type SportId = 'football' | 'basketball' | 'tennis' | 'rally' | 'hockey' | 'instant-football' | 'instant-basketball' | 'vfootball' | 'baseball' | 'americanfootball' | 'rugby' | 'cricket' | 'mma' | 'volleyball' | 'predictor';

  let {
    sport = 'football' as SportId,
    size = 28,
    color = 'currentColor'
  }: {
    sport?: SportId;
    size?: number;
    color?: string;
  } = $props();
</script>

{#if sport === 'football'}
  <!-- Soccer/Football ball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="12" stroke={color} stroke-width="1.8" fill="none" opacity="0.3"/>
    <circle cx="14" cy="14" r="12" stroke={color} stroke-width="1.8" fill="none"/>
    <!-- Pentagon patch at center -->
    <polygon points="14,9 17.8,11.8 16.4,16.2 11.6,16.2 10.2,11.8" fill={color} opacity="0.9"/>
    <!-- Lines from pentagon to edge -->
    <line x1="14" y1="9" x2="14" y2="2.2" stroke={color} stroke-width="1.4"/>
    <line x1="17.8" y1="11.8" x2="23.8" y2="9.6" stroke={color} stroke-width="1.4"/>
    <line x1="16.4" y1="16.2" x2="21.2" y2="21.2" stroke={color} stroke-width="1.4"/>
    <line x1="11.6" y1="16.2" x2="6.8" y2="21.2" stroke={color} stroke-width="1.4"/>
    <line x1="10.2" y1="11.8" x2="4.2" y2="9.6" stroke={color} stroke-width="1.4"/>
  </svg>

{:else if sport === 'basketball'}
  <!-- Basketball with curved lines -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="12" stroke={color} stroke-width="1.8"/>
    <!-- Vertical line -->
    <line x1="14" y1="2" x2="14" y2="26" stroke={color} stroke-width="1.4"/>
    <!-- Horizontal line -->
    <line x1="2" y1="14" x2="26" y2="14" stroke={color} stroke-width="1.4"/>
    <!-- Left curve -->
    <path d="M14 2 Q6 8 6 14 Q6 20 14 26" stroke={color} stroke-width="1.4" fill="none"/>
    <!-- Right curve -->
    <path d="M14 2 Q22 8 22 14 Q22 20 14 26" stroke={color} stroke-width="1.4" fill="none"/>
  </svg>

{:else if sport === 'tennis'}
  <!-- Tennis racket + ball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <!-- Racket head (oval) -->
    <ellipse cx="11" cy="10" rx="8" ry="9" stroke={color} stroke-width="1.8" fill="none"/>
    <!-- Racket strings H -->
    <line x1="5" y1="8" x2="17" y2="8" stroke={color} stroke-width="1" opacity="0.6"/>
    <line x1="4" y1="11" x2="18" y2="11" stroke={color} stroke-width="1" opacity="0.6"/>
    <!-- Racket strings V -->
    <line x1="9" y1="2" x2="9" y2="19" stroke={color} stroke-width="1" opacity="0.6"/>
    <line x1="13" y1="2" x2="13" y2="19" stroke={color} stroke-width="1" opacity="0.6"/>
    <!-- Handle -->
    <line x1="17" y1="17" x2="25" y2="25" stroke={color} stroke-width="2.5" stroke-linecap="round"/>
    <!-- Ball -->
    <circle cx="22" cy="8" r="4" stroke={color} stroke-width="1.6" fill="none"/>
    <path d="M18.5 6 Q22 9 25.5 6" stroke={color} stroke-width="1.2" fill="none"/>
  </svg>

{:else if sport === 'rally'}
  <!-- Ping-pong paddle + ball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <!-- Paddle head circle -->
    <circle cx="11" cy="12" r="9" stroke={color} stroke-width="1.8" fill="none"/>
    <!-- Paddle centre line -->
    <line x1="2" y1="12" x2="20" y2="12" stroke={color} stroke-width="1.2" opacity="0.5"/>
    <!-- Handle -->
    <rect x="17" y="19" width="9" height="4" rx="2" fill={color} opacity="0.9"/>
    <!-- Ball -->
    <circle cx="22" cy="6" r="4" stroke={color} stroke-width="1.6" fill="none"/>
    <path d="M18.5 4.5 Q22 7 25.5 4.5" stroke={color} stroke-width="1.1" fill="none"/>
  </svg>

{:else if sport === 'hockey'}
  <!-- Ice hockey crossed sticks + puck -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M4 22 L20 4 M24 24 L22 22 L7 7" stroke={color} stroke-width="1.8" stroke-linecap="round"/>
    <line x1="5" y1="24" x2="23" y2="6" stroke={color} stroke-width="1.8" stroke-linecap="round"/>
    <!-- Puck -->
    <ellipse cx="14" cy="20" rx="5" ry="2.5" fill={color} opacity="0.9"/>
  </svg>

{:else if sport === 'predictor'}
  <!-- Sparkles: AI prediction -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M14 3 L16.5 10 L24 14 L16.5 18 L14 25 L11.5 18 L4 14 L11.5 10 Z" stroke={color} stroke-width="1.6" stroke-linejoin="round" fill={color} opacity="0.2"/>
    <path d="M14 3 L16.5 10 L24 14 L16.5 18 L14 25 L11.5 18 L4 14 L11.5 10 Z" stroke={color} stroke-width="1.6" stroke-linejoin="round" fill="none"/>
    <path d="M21 3 L22 6.5 L25.5 7.5 L22 8.5 L21 12 L20 8.5 L16.5 7.5 L20 6.5 Z" stroke={color} stroke-width="1.2" stroke-linejoin="round" fill={color}/>
    <path d="M7 17 L8 20 L11 21 L8 22 L7 25 L6 22 L3 21 L6 20 Z" stroke={color} stroke-width="1.2" stroke-linejoin="round" fill={color}/>
  </svg>

{:else if sport === 'americanfootball'}
  <!-- American football ball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <ellipse cx="14" cy="14" rx="12" ry="7" transform="rotate(-28 14 14)" stroke={color} stroke-width="1.8"/>
    <path d="M9 10 L6 4 M11 12 L7 8 M19 18 L22 24 M17 16 L21 20 M14 14 L9 9 M14 14 L19 19" stroke={color} stroke-width="1.2" opacity="0.7"/>
    <path d="M11 13 L6 12 M17 15 L22 16" stroke={color} stroke-width="1.4"/>
  </svg>

{:else if sport === 'rugby'}
  <!-- Rugby ball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <ellipse cx="14" cy="14" rx="9" ry="12" stroke={color} stroke-width="1.8"/>
    <path d="M14 2 L14 26" stroke={color} stroke-width="1.4" opacity="0.6"/>
    <path d="M9.5 4.5 Q5 14 9.5 23.5 M18.5 4.5 Q23 14 18.5 23.5" stroke={color} stroke-width="1.2" opacity="0.6"/>
  </svg>

{:else if sport === 'cricket'}
  <!-- Cricket bat + ball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M14 4 L24 14 L19 19 L9 9 Z" stroke={color} stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="9" y1="9" x2="3" y2="3" stroke={color} stroke-width="2.2" stroke-linecap="round"/>
    <line x1="4" y1="20" x2="12" y2="12" stroke={color} stroke-width="1.6" opacity="0.7"/>
    <circle cx="22" cy="7" r="4" stroke={color} stroke-width="1.6"/>
  </svg>

{:else if sport === 'mma'}
  <!-- MMA gloves -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M9 10 Q5 12 4.5 17 Q4 22 9 22 L9 12 Z" stroke={color} stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M19 10 Q23 12 23.5 17 Q24 22 19 22 L19 12 Z" stroke={color} stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="9" y1="16" x2="19" y2="16" stroke={color} stroke-width="1.4" opacity="0.7"/>
    <line x1="9" y1="20" x2="19" y2="20" stroke={color} stroke-width="1.4" opacity="0.7"/>
  </svg>

{:else if sport === 'volleyball'}
  <!-- Volleyball -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="11" stroke={color} stroke-width="1.8"/>
    <path d="M14 3 Q10 14 14 25 M6 8 Q13 12 22 6 M6 20 Q13 16 22 20" stroke={color} stroke-width="1.4"/>
  </svg>

{:else}
  <!-- Generic fallback: target/crosshair -->
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="11" stroke={color} stroke-width="1.8"/>
    <circle cx="14" cy="14" r="5"  stroke={color} stroke-width="1.8"/>
    <line x1="14" y1="2" x2="14" y2="7"  stroke={color} stroke-width="1.6"/>
    <line x1="14" y1="21" x2="14" y2="26" stroke={color} stroke-width="1.6"/>
    <line x1="2" y1="14"  x2="7" y2="14"  stroke={color} stroke-width="1.6"/>
    <line x1="21" y1="14" x2="26" y2="14" stroke={color} stroke-width="1.6"/>
  </svg>
{/if}
