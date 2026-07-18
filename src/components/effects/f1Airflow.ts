import * as THREE from 'three';

export type AirflowTier = 'low' | 'mid' | 'high';

export interface F1AirflowUpdate {
  time: number;
  holdIntensity: number;
  reducedMotion: boolean;
}

export interface F1AirflowEffect {
  group: THREE.Group;
  material: THREE.ShaderMaterial | null;
  update: (input: F1AirflowUpdate) => void;
  dispose: () => void;
}

export interface F1AirflowFactoryOptions {
  bounds?: THREE.Box3;
  createGeometry?: (
    path: THREE.Curve<THREE.Vector3>,
    tubularSegments: number,
    radius: number,
    radialSegments: number,
    closed: boolean,
  ) => THREE.BufferGeometry;
  createMaterial?: (parameters: THREE.ShaderMaterialParameters) => THREE.ShaderMaterial;
  warn?: (...data: unknown[]) => void;
}

const MAX_AIRFLOW_DELTA = 0.1;
const AIRFLOW_VISIBILITY_THRESHOLD = 0.05;
let didWarnAboutCreationFailure = false;

export const advanceF1AirflowTime = (time: number, rawDelta: number): number =>
  time + Math.min(MAX_AIRFLOW_DELTA, Math.max(0, rawDelta));

const DEFAULT_F1_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-2, -0.5, -4),
  new THREE.Vector3(2, 1.5, 4),
);

type NormalizedAirflowPoint = readonly [x: number, y: number, z: number];

// Left-side silhouette families: nose shoulder, front wing, sidepod,
// cockpit, engine cover, floor edge, and outer wake.
const LEFT_AIRFLOW_FAMILIES: readonly (readonly NormalizedAirflowPoint[])[] = [
  [[-0.35, 0.24, 0.01], [-0.62, 0.26, 0.18], [-0.78, 0.32, 0.42], [-0.65, 0.38, 0.72], [-0.48, 0.42, 1.16]],
  [[-0.82, 0.12, 0.03], [-1.18, 0.13, 0.16], [-1.28, 0.18, 0.36], [-1.08, 0.25, 0.70], [-0.82, 0.32, 1.16]],
  [[-0.54, 0.18, 0.04], [-0.76, 0.23, 0.25], [-1.02, 0.35, 0.48], [-0.88, 0.43, 0.76], [-0.66, 0.46, 1.16]],
  [[-0.24, 0.24, 0.02], [-0.38, 0.40, 0.26], [-0.50, 0.62, 0.48], [-0.40, 0.70, 0.74], [-0.26, 0.62, 1.16]],
  [[-0.14, 0.30, 0.03], [-0.22, 0.54, 0.28], [-0.30, 0.76, 0.52], [-0.26, 0.78, 0.78], [-0.18, 0.66, 1.16]],
  [[-0.62, 0.12, 0.04], [-0.88, 0.12, 0.26], [-1.12, 0.14, 0.50], [-1.04, 0.17, 0.78], [-0.90, 0.22, 1.16]],
  [[-1.12, 0.20, 0.06], [-1.42, 0.25, 0.28], [-1.46, 0.34, 0.52], [-1.30, 0.40, 0.80], [-1.08, 0.44, 1.16]],
];

export const createF1AirflowPaths = (bounds: THREE.Box3): THREE.Vector3[][] => {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const bodyHalfWidth = size.x * 0.34;
  const floorY = center.y - size.y * 0.5;
  const noseZ = center.z - size.z * 0.5;

  return LEFT_AIRFLOW_FAMILIES.flatMap((family) => {
    const createSide = (mirror: number): THREE.Vector3[] => family.map(([x, y, z]) => (
      new THREE.Vector3(
        center.x + x * bodyHalfWidth * mirror,
        floorY + Math.max(0.12, y) * size.y,
        noseZ + z * size.z,
      )
    ));
    return [createSide(1), createSide(-1)];
  });
};

const pathCountForTier = (tier: AirflowTier): number => {
  if (tier === 'low') return 8;
  if (tier === 'mid') return 11;
  return 14;
};

export const createF1Airflow = (
  tier: AirflowTier,
  options: F1AirflowFactoryOptions = {},
): F1AirflowEffect => {
  const group = new THREE.Group();
  group.visible = false;
  const geometries = new Set<THREE.BufferGeometry>();
  let material: THREE.ShaderMaterial | null = null;

  try {
    const createMaterial = options.createMaterial ?? ((parameters) => new THREE.ShaderMaterial(parameters));
    const createGeometry = options.createGeometry ?? ((...parameters) => new THREE.TubeGeometry(...parameters));

    material = createMaterial({
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

    const paths = createF1AirflowPaths(options.bounds ?? DEFAULT_F1_BOUNDS);
    for (const points of paths.slice(0, pathCountForTier(tier))) {
      const geometry = createGeometry(
        new THREE.CatmullRomCurve3(points),
        72,
        Math.max(
          0.004,
          options.bounds ? options.bounds.getSize(new THREE.Vector3()).x * 0.0018 : 0.006,
        ),
        tier === 'high' ? 5 : 3,
        false,
      );
      geometries.add(geometry);
      group.add(new THREE.Mesh(geometry, material));
    }
  } catch (error) {
    group.clear();
    for (const geometry of geometries) geometry.dispose();
    geometries.clear();
    material?.dispose();
    material = null;

    if (!didWarnAboutCreationFailure) {
      didWarnAboutCreationFailure = true;
      (options.warn ?? console.warn)('[F1 airflow] Disabled after resource allocation failed.', error);
    }

    return {
      group,
      material: null,
      update: () => {},
      dispose: () => {},
    };
  }

  const activeMaterial = material;
  let disposed = false;
  return {
    group,
    material: activeMaterial,
    update: ({ time, holdIntensity, reducedMotion }) => {
      const opacity = THREE.MathUtils.clamp(holdIntensity, 0, 1);
      group.visible = opacity > AIRFLOW_VISIBILITY_THRESHOLD;
      if (!reducedMotion) activeMaterial.uniforms.uTime.value = time;
      activeMaterial.uniforms.uOpacity.value = opacity;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      group.clear();
      for (const geometry of geometries) geometry.dispose();
      geometries.clear();
      activeMaterial.dispose();
    },
  };
};
