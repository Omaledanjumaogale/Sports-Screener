<script lang="ts">
  // Self-contained inline SVG sport glyphs for the AI Predictor. No external
  // assets, no emoji — crisp at any size and themeable via the `color` prop.
  import type { PredictorSportId } from '$lib/predictorTypes';

  let {
    sport = 'football' as PredictorSportId,
    size = 22,
    color = 'currentColor',
    strokeWidth = 2
  }: {
    sport?: PredictorSportId;
    size?: number;
    color?: string;
    strokeWidth?: number;
  } = $props();

  const C = $derived.by<{
    fill: 'none';
    stroke: string;
    'stroke-width': number;
    'stroke-linecap': 'round';
    'stroke-linejoin': 'round';
  }>(() => ({
    fill: 'none', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  }));
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
  style={`color:${color}`}
>
  {#if sport === 'football'}
    <circle cx="12" cy="12" r="9" {...C} />
    <path d="M12 7l3.5 2.6-1.3 4.1h-4.4l-1.3-4.1z" {...C} />
    <path d="M12 12.5l3.9-6.4M12 12.5l2.2 4.9M12 12.5l-2.2 4.9M12 12.5l-3.9-2.6M15.9 6.1l-3.9 6.4-4 1.4M8.9 11.1l3.1 1.4 4-1.4M12 12.5l3.1 1.4-4 1.4-3.1-1.4z" {...C} />
  {:else if sport === 'basketball'}
    <circle cx="12" cy="12" r="9" {...C} />
    <path d="M4.5 8.5c4.7 1.3 6.8 4.3 10 9 M19.5 15.5c-4.7-1.3-6.8-4.3-10-9 M4 13.5c5 2 8.5 1 11-3 M20 10.5c-5-2-8.5-1-11 3" {...C} />
  {:else if sport === 'tennis'}
    <circle cx="12" cy="12" r="9" {...C} />
    <circle cx="12" cy="12" r="2.6" {...C} />
    <path d="M12 5.4V9.4M12 14.6v4M5.4 8.2l3.4 1.9M15.2 13.9l3.4 1.9M8.8 13.9l-3.4 1.9M15.2 10.1l3.4-1.9" {...C} />
  {:else if sport === 'rally'}
    <rect x="4.5" y="4.5" width="15" height="15" rx="3" {...C} />
    <path d="M8.5 8.5v7c0 1.1.9 2 2 2s2-.9 2-2v-7M12.5 12v3.5a2 2 0 0 0 3.4 1.4h.1" {...C} />
  {:else if sport === 'hockey'}
    <circle cx="7" cy="16" r="3" {...C} />
    <circle cx="17" cy="16" r="3" {...C} />
    <circle cx="12" cy="6" r="2.2" {...C} />
    <path d="M14.2 6h3.9l.6-2.2M9.8 6h-3.9l-.6-2.2" {...C} />
    <path d="M10 15h4M12 8.2V15" {...C} />
  {:else if sport === 'baseball'}
    <circle cx="12" cy="12" r="9" {...C} />
    <path d="M12 3c-2 3-2 15 0 18 M3 9c3 2.4 15 2.4 18 0 M3 15c3-2.4 15-2.4 18 0" {...C} />
  {:else}
    <circle cx="12" cy="12" r="9" {...C} />
    <path d="M8 12l3 3 5-6" {...C} />
  {/if}
</svg>