import * as THREE from 'three';
import {
  COLORS,
  CPU_PARTICLE_COUNT,
  SPEED_LINE_COUNT,
  TRAIL_COUNT,
  TRAIL_SEGMENTS,
} from './showroom-constants';
import {
  createIdempotentDisposer,
  createShowroomResource,
  notifySetupCheckpoint,
  type ShowroomFactoryOptions,
} from './showroom-resource-lifecycle';

export interface CpuParticleField {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  phases: Float32Array;
  positions: Float32Array;
  material: THREE.ShaderMaterial;
  dispose: () => void;
}

export const createCpuParticleField = (
  pixelRatio: number,
  options?: ShowroomFactoryOptions,
): CpuParticleField => {
  return createShowroomResource((own) => {
  const geometry = own(new THREE.BufferGeometry());
  notifySetupCheckpoint(options, 'geometry-ready');
  const positions = new Float32Array(CPU_PARTICLE_COUNT * 3);
  const colors = new Float32Array(CPU_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(CPU_PARTICLE_COUNT);
  const phases = new Float32Array(CPU_PARTICLE_COUNT);

  const colorOptions = [COLORS.red, COLORS.yellow, COLORS.white, COLORS.white];

  for (let i = 0; i < CPU_PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 200;
    positions[i3 + 1] = (Math.random() - 0.5) * 150;
    positions[i3 + 2] = (Math.random() - 0.5) * 160;

    const c = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b;

    sizes[i] = Math.random() * 2.5 + 0.5;
    phases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = own(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
          attribute float size;
          attribute vec3 color;
          uniform float uTime;
          uniform float uPixelRatio;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float dist = length(mvPosition.xyz);
          vAlpha = smoothstep(80.0, 20.0, dist) * 0.8;
            gl_PointSize = size * uPixelRatio * (50.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
    fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            gl_FragColor = vec4(vColor, vec3(pow(1.0 - smoothstep(0.0, 0.5, d), 1.5)) * vAlpha);
          }
        `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  notifySetupCheckpoint(options, 'material-ready');

  const points = new THREE.Points(geometry, material);
  notifySetupCheckpoint(options, 'object-ready');
  const dispose = createIdempotentDisposer([geometry, material]);
  notifySetupCheckpoint(options, 'setup-complete');

  return { points, phases, positions, material, dispose };
  });
};

export interface TrailField {
  geometry: THREE.BufferGeometry;
  positionAttribute: THREE.BufferAttribute;
  alphaAttribute: THREE.BufferAttribute;
  material: THREE.ShaderMaterial;
  dispose: () => void;
}

export const createTrailField = (options?: ShowroomFactoryOptions): TrailField => {
  return createShowroomResource((own) => {
  const geometry = own(new THREE.BufferGeometry());
  notifySetupCheckpoint(options, 'geometry-ready');
  const positions = new Float32Array(TRAIL_COUNT * TRAIL_SEGMENTS * 3);
  const colors = new Float32Array(TRAIL_COUNT * TRAIL_SEGMENTS * 3);
  const alphas = new Float32Array(TRAIL_COUNT * TRAIL_SEGMENTS);

  for(let i=0; i<TRAIL_COUNT; i++) {
      const color = Math.random() < 0.4 ? COLORS.red : Math.random() < 0.7 ? COLORS.yellow : COLORS.white;
      for(let j=0; j<TRAIL_SEGMENTS; j++) {
          const idx = (i * TRAIL_SEGMENTS + j);
          colors[idx * 3] = color.r;
          colors[idx * 3 + 1] = color.g;
          colors[idx * 3 + 2] = color.b;
          alphas[idx] = 1.0 - (j / TRAIL_SEGMENTS);
      }
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('alpha', alphaAttribute);

  const material = own(new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
        attribute vec3 color;
        attribute float alpha;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = alpha;
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha * 0.6);
        }
      `
  }));
  notifySetupCheckpoint(options, 'material-ready');

  const dispose = createIdempotentDisposer([geometry, material]);
  notifySetupCheckpoint(options, 'setup-complete');

  return { geometry, positionAttribute, alphaAttribute, material, dispose };
  });
};

export interface SpeedLineField {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  speeds: Float32Array;
  material: THREE.ShaderMaterial;
  dispose: () => void;
}

export const createSpeedLineField = (options?: ShowroomFactoryOptions): SpeedLineField => {
  return createShowroomResource((own) => {
  const geometry = own(new THREE.BufferGeometry());
  notifySetupCheckpoint(options, 'geometry-ready');
  const positions = new Float32Array(SPEED_LINE_COUNT * 3);
  const speeds = new Float32Array(SPEED_LINE_COUNT);
  const colors = new Float32Array(SPEED_LINE_COUNT * 3);
  const sizes = new Float32Array(SPEED_LINE_COUNT);

  for (let i = 0; i < SPEED_LINE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 100;
    positions[i3 + 1] = (Math.random() - 0.5) * 60;
    positions[i3 + 2] = Math.random() * -100;
    speeds[i] = Math.random() * 0.8 + 0.3;

    const color = Math.random() < 0.3 ? COLORS.red : Math.random() < 0.5 ? COLORS.yellow : COLORS.white;
    colors[i3] = color.r; colors[i3 + 1] = color.g; colors[i3 + 2] = color.b;

    sizes[i] = Math.random() * 3 + 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = own(new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 1.0 } },
    vertexShader: `
        attribute float size;
        attribute vec3 color;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = -mvPosition.z;
          vAlpha = smoothstep(100.0, 10.0, depth) * 0.7;
          gl_PointSize = size * uPixelRatio * (80.0 / depth);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
    fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uOpacity;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(vec2(uv.x * 0.3, uv.y));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, vec3(pow(1.0 - smoothstep(0.0, 0.5, d), 2.0)) * vAlpha * uOpacity);
        }
      `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  notifySetupCheckpoint(options, 'material-ready');

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  notifySetupCheckpoint(options, 'object-ready');
  const dispose = createIdempotentDisposer([geometry, material]);
  notifySetupCheckpoint(options, 'setup-complete');

  return { points, geometry, positions, speeds, material, dispose };
  });
};
