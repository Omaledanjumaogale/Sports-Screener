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

  useTask((delta) => {
    if (!active || !points) return;
    points.rotation.y += delta * 0.06;
    points.rotation.x = Math.sin(Date.now() * 0.00008) * 0.12;
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0.6, 5.4]} fov={46} />
<T.Points bind:ref={points} geometry={geometry}>
  <T.PointsMaterial
    size={0.022}
    sizeAttenuation
    vertexColors
    transparent
    opacity={0.85}
    depthWrite={false}
    blending={THREE.AdditiveBlending}
  />
</T.Points>
