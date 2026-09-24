<script lang="ts">
  // Canvas wrapper — dynamically imported by HeroScene.svelte. The inner
  // scene component carries the useTask rotation (must live under <Canvas>).
  import { Canvas } from '@threlte/core';
  import HeroSceneInner from './HeroSceneInner.svelte';

  let { active = true }: { active?: boolean } = $props();
</script>

<Canvas dpr={[1, 1.5]}>
  <HeroSceneInner {active} />
</Canvas>
