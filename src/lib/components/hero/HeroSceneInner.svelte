<script lang="ts">
  // Inner scene — MUST be mounted as a child of <Canvas> (useTask context).
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';

  let { active = true }: { active?: boolean } = $props();

  const COUNT = (() => {
    if (typeof navigator === 'undefined') return 1800;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const narrow = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches;
    if (narrow || mem <= 2) return 1200;
    return 3200;
  })();

  // Sphere-shell constellation + a tilted "odds board" disc.
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  {
    const volt = [0.64, 0.9, 0.21];
    const cyan = [0.13, 0.83, 0.93];
    for (let i = 0; i < COUNT; i++) {
      const disc = i % 3 === 0;
      let x: number, y: number, z: number;
      if (disc) {
        const r = 1.4 + Math.random() * 2.2;
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = (Math.random() - 0.5) * 0.22;
      } else {
        const r = 2.1 + Math.random() * 1.3;
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = Math.random() * Math.PI * 2;
        x = r * Math.sin(theta) * Math.cos(phi);
        y = r * Math.cos(theta) * 0.6;
        z = r * Math.sin(theta) * Math.sin(phi);
      }
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const c = i % 5 === 0 ? cyan : volt;
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  let points: THREE.Points | undefined = $state<THREE.Points | undefined>(undefined);

  // Theme-aware rendering. The constellation is ADDITIVE (volts + cyan glowing
  // against near-black) — additive blending on a LIGHT background adds to white
  // and disappears, so the scene looked "motionless/empty" on light desktops.
  // In light mode the same geometry renders with normal blending and a dark
  // material tint (three.js multiplies material colour × vertex colour), which
  // keeps the constellation and the orbiting sport emoji visible on every
  // device, at every theme — including desktops whose OS reports reduced motion
  // (there is no reduced-motion opt-out any more; only the offscreen/hidden-tab
  // pauses below).
  let lightMode = $state(false);
  $effect(() => {
    const read = () => {
      const attr = document.documentElement.getAttribute('data-theme');
      lightMode = attr === 'light';
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  const pointsMaterial = $derived(
    lightMode
      ? { opacity: 0.6, blending: THREE.NormalBlending, color: '#1f2d12' }
      : { opacity: 0.85, blending: THREE.AdditiveBlending, color: '#ffffff' }
  );

  // ── Floating sports emoji sprites (⚽🏀🎾🏓🏒⚾) ─────────────────────────────
  // Each emoji renders onto a canvas → texture → THREE.Sprite. They orbit the
  // core on individual inclined paths with a gentle bob, always camera-facing.
  const EMOJIS = ['⚽', '🏀', '🎾', '🏓', '🏒', '⚾'];
  // Radii are deliberately INSIDE the constellation shell and the sprite sizes
  // modest: a sprite that swings toward the camera at z≈+3 looms enormous in
  // perspective, which read as emoji "stuck to the bottom of the canvas".
  const EMOJI_ORBITS = [
    { r: 2.0, speed: 0.24, tilt: 0.5, phase: 0.0, size: 0.4 },
    { r: 2.35, speed: -0.17, tilt: -0.35, phase: 1.1, size: 0.46 },
    { r: 1.85, speed: 0.29, tilt: 0.95, phase: 2.2, size: 0.38 },
    { r: 2.6, speed: -0.13, tilt: 0.2, phase: 3.0, size: 0.44 },
    { r: 2.2, speed: 0.19, tilt: -0.75, phase: 4.1, size: 0.42 },
    { r: 2.75, speed: 0.15, tilt: 0.65, phase: 5.0, size: 0.5 }
  ];

  function emojiTexture(glyph: string): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${size * 0.72}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Soft glow behind the glyph so it pops against dark space.
    ctx.shadowColor = 'rgba(163, 230, 53, 0.55)';
    ctx.shadowBlur = 18;
    ctx.fillText(glyph, size / 2, size / 2 + size * 0.04);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const emojiSprites: { sprite: THREE.Sprite; cfg: (typeof EMOJI_ORBITS)[number] }[] = [];
  for (let i = 0; i < EMOJIS.length; i++) {
    const tex = emojiTexture(EMOJIS[i]);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(EMOJI_ORBITS[i].size);
    emojiSprites.push({ sprite, cfg: EMOJI_ORBITS[i] });
  }

  let spriteGroup: THREE.Group | undefined = $state<THREE.Group | undefined>(undefined);

  useTask((delta) => {
    if (!active || !points) return;
    const t = Date.now() * 0.001;
    points.rotation.y += delta * 0.06;
    points.rotation.x = Math.sin(t * 0.08) * 0.12;
    for (let i = 0; i < emojiSprites.length; i++) {
      const { sprite, cfg } = emojiSprites[i];
      const a = cfg.phase + t * cfg.speed;
      const x = Math.cos(a) * cfg.r;
      const z = Math.sin(a) * cfg.r;
      const y = Math.sin(a * 1.7 + cfg.phase) * cfg.r * Math.sin(cfg.tilt) * 0.55 + Math.sin(t * 0.9 + i) * 0.08;
      sprite.position.set(x, y, z);
      // Depth-attenuated size: sprites on the near side of the orbit shrink so
      // they keep the same on-screen weight as the ones behind the core.
      const depth = THREE.MathUtils.clamp((3.4 - z) / 6.4, 0.55, 1.15);
      sprite.scale.setScalar(cfg.size * depth * (1 + Math.sin(t * 1.3 + i * 2) * 0.06));
    }
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0.6, 5.4]} fov={46} />
<T.Points bind:ref={points} geometry={geometry}>
  <T.PointsMaterial
    size={0.022}
    sizeAttenuation
    vertexColors
    transparent
    opacity={pointsMaterial.opacity}
    color={pointsMaterial.color}
    depthWrite={false}
    blending={pointsMaterial.blending}
  />
</T.Points>
<T.Group bind:ref={spriteGroup}>
  {#each emojiSprites as es (es.cfg.phase)}
    <T is={es.sprite} />
  {/each}
</T.Group>
