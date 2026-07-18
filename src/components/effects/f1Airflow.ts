import * as THREE from 'three';

export type AirflowTier = 'low' | 'mid' | 'high';

export interface F1AirflowUpdate {
  time: number;
  holdIntensity: number;
  reducedMotion: boolean;
}

export interface F1AirflowEffect {
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  update: (input: F1AirflowUpdate) => void;
  dispose: () => void;
}

// These paths are authored in the F1 model's local coordinate system. They
// travel from the nose (negative z) through the sidepods to beyond the rear wing.
const AIRFLOW_PATHS: readonly (readonly THREE.Vector3[])[] = [
  // Low family
  [new THREE.Vector3(-1.25, -0.15, -3.6), new THREE.Vector3(-1.45, -0.1, -2.7), new THREE.Vector3(-1.58, 0.02, -1.6), new THREE.Vector3(-1.52, 0.16, -0.4), new THREE.Vector3(-1.32, 0.3, 0.95), new THREE.Vector3(-1.12, 0.42, 2.25), new THREE.Vector3(-1.02, 0.5, 3.55)],
  [new THREE.Vector3(1.25, -0.15, -3.6), new THREE.Vector3(1.45, -0.1, -2.7), new THREE.Vector3(1.58, 0.02, -1.6), new THREE.Vector3(1.52, 0.16, -0.4), new THREE.Vector3(1.32, 0.3, 0.95), new THREE.Vector3(1.12, 0.42, 2.25), new THREE.Vector3(1.02, 0.5, 3.55)],
  [new THREE.Vector3(-0.8, -0.22, -3.55), new THREE.Vector3(-0.96, -0.18, -2.55), new THREE.Vector3(-1.08, -0.06, -1.35), new THREE.Vector3(-1.02, 0.08, -0.1), new THREE.Vector3(-0.86, 0.22, 1.2), new THREE.Vector3(-0.72, 0.34, 3.5)],
  [new THREE.Vector3(0.8, -0.22, -3.55), new THREE.Vector3(0.96, -0.18, -2.55), new THREE.Vector3(1.08, -0.06, -1.35), new THREE.Vector3(1.02, 0.08, -0.1), new THREE.Vector3(0.86, 0.22, 1.2), new THREE.Vector3(0.72, 0.34, 3.5)],
  [new THREE.Vector3(-1.62, 0.02, -3.4), new THREE.Vector3(-1.84, 0.1, -2.35), new THREE.Vector3(-1.9, 0.22, -1.1), new THREE.Vector3(-1.72, 0.3, 0.25), new THREE.Vector3(-1.48, 0.4, 1.75), new THREE.Vector3(-1.32, 0.5, 3.65)],
  [new THREE.Vector3(1.62, 0.02, -3.4), new THREE.Vector3(1.84, 0.1, -2.35), new THREE.Vector3(1.9, 0.22, -1.1), new THREE.Vector3(1.72, 0.3, 0.25), new THREE.Vector3(1.48, 0.4, 1.75), new THREE.Vector3(1.32, 0.5, 3.65)],
  [new THREE.Vector3(-0.38, -0.12, -3.65), new THREE.Vector3(-0.5, -0.04, -2.45), new THREE.Vector3(-0.58, 0.1, -1.1), new THREE.Vector3(-0.5, 0.24, 0.4), new THREE.Vector3(-0.4, 0.38, 1.9), new THREE.Vector3(-0.34, 0.48, 3.6)],
  [new THREE.Vector3(0.38, -0.12, -3.65), new THREE.Vector3(0.5, -0.04, -2.45), new THREE.Vector3(0.58, 0.1, -1.1), new THREE.Vector3(0.5, 0.24, 0.4), new THREE.Vector3(0.4, 0.38, 1.9), new THREE.Vector3(0.34, 0.48, 3.6)],
  // Mid family
  [new THREE.Vector3(-1.15, 0.15, -3.45), new THREE.Vector3(-1.32, 0.36, -2.35), new THREE.Vector3(-1.36, 0.62, -1.05), new THREE.Vector3(-1.16, 0.78, 0.3), new THREE.Vector3(-0.94, 0.82, 1.75), new THREE.Vector3(-0.8, 0.78, 3.6)],
  [new THREE.Vector3(1.15, 0.15, -3.45), new THREE.Vector3(1.32, 0.36, -2.35), new THREE.Vector3(1.36, 0.62, -1.05), new THREE.Vector3(1.16, 0.78, 0.3), new THREE.Vector3(0.94, 0.82, 1.75), new THREE.Vector3(0.8, 0.78, 3.6)],
  [new THREE.Vector3(0, 0.18, -3.7), new THREE.Vector3(0, 0.45, -2.55), new THREE.Vector3(0, 0.7, -1.2), new THREE.Vector3(0, 0.9, 0.25), new THREE.Vector3(0, 0.98, 1.8), new THREE.Vector3(0, 0.9, 3.7)],
  // High family
  [new THREE.Vector3(-0.62, 0.25, -3.55), new THREE.Vector3(-0.78, 0.56, -2.4), new THREE.Vector3(-0.84, 0.94, -1.1), new THREE.Vector3(-0.7, 1.16, 0.32), new THREE.Vector3(-0.5, 1.18, 1.9), new THREE.Vector3(-0.4, 1.06, 3.68)],
  [new THREE.Vector3(0.62, 0.25, -3.55), new THREE.Vector3(0.78, 0.56, -2.4), new THREE.Vector3(0.84, 0.94, -1.1), new THREE.Vector3(0.7, 1.16, 0.32), new THREE.Vector3(0.5, 1.18, 1.9), new THREE.Vector3(0.4, 1.06, 3.68)],
  [new THREE.Vector3(0, 0.32, -3.55), new THREE.Vector3(0, 0.75, -2.35), new THREE.Vector3(0, 1.15, -0.95), new THREE.Vector3(0, 1.38, 0.55), new THREE.Vector3(0, 1.35, 2.1), new THREE.Vector3(0, 1.2, 3.75)],
];

const pathCountForTier = (tier: AirflowTier): number => {
  if (tier === 'low') return 8;
  if (tier === 'mid') return 11;
  return AIRFLOW_PATHS.length;
};

export const createF1Airflow = (tier: AirflowTier): F1AirflowEffect => {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#dff6ff') },
      uSpeed: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uSpeed;
      void main() {
        float phase = fract(vUv.x * 2.4 - uTime * uSpeed);
        float pulse = smoothstep(0.04, 0.20, phase) * (1.0 - smoothstep(0.64, 0.94, phase));
        float alpha = uOpacity * mix(0.28, 1.0, pulse);
        gl_FragColor = vec4(uColor * mix(0.65, 1.6, pulse), alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const geometries = new Set<THREE.BufferGeometry>();
  for (const points of AIRFLOW_PATHS.slice(0, pathCountForTier(tier))) {
    const geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([...points]),
      72,
      tier === 'high' ? 0.006 : 0.009,
      tier === 'high' ? 5 : 3,
      false,
    );
    geometries.add(geometry);
    group.add(new THREE.Mesh(geometry, material));
  }

  let disposed = false;
  return {
    group,
    material,
    update: ({ time, holdIntensity, reducedMotion }) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uOpacity.value = reducedMotion
        ? 0
        : THREE.MathUtils.clamp(holdIntensity, 0, 1);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
    },
  };
};
