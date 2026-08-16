import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import {
  BoxGeometry,
  DataTexture,
  EquirectangularReflectionMapping,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardNodeMaterial,
  Object3D,
  PerspectiveCamera,
  RedFormat,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';
import {
  Fn,
  If,
  cos,
  float,
  floor,
  fract,
  instancedBufferAttribute,
  mix,
  mx_noise_float,
  mx_noise_vec3,
  positionGeometry,
  color,
  rangeFogFactor,
  reflector,
  remapClamp,
  screenUV,
  texture,
  textureBicubic,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

import { createIdempotentDisposer } from '@/src/components/showroom/showroom-resource-lifecycle';
import { selectShowroomQuality } from '@/src/lib/showroom-quality';
import {
  trackCountdownResource,
  type CountdownResourceKind,
} from '@/src/lib/test-observability';

import { applyCountdownVehiclePose } from './countdown-vehicle';
import { CountdownFireworksSystem } from './countdown-fireworks-tsl';
import { CountdownRapierPhysics } from './countdown-rapier-physics';
import { getTimeVizLayout } from './digit-layout';
import { TinySDF } from './tiny-sdf';
import type {
  TimeVizScene,
  TimeVizSceneOptions,
  TimeVizSceneSnapshot,
} from './time-viz-types';

const ENVIRONMENT_URL = '/environments/lythwood_room_1k.hdr';
const FONT_URL = '/fonts/RussoOne-Regular.ttf';
const FONT_FAMILY = 'Russo One';
const MOBILE_ASPECT = 1.2;
const FIELD_HEIGHT = 1.5;
const FIELD_DEPTH = 0.25;
const PAIR_GAP = 0.5;
const SUBDIVISIONS = 12;
const DESKTOP_CAMERA_REFERENCE = { x: 0, y: 0.5, z: 20, targetY: 0.5 } as const;
const MOBILE_CAMERA_REFERENCE = { x: -30, y: 2, z: 50, targetY: 2.5 } as const;

const DESKTOP_CAMERA_COUNTDOWN = { x: 0, y: 1.15, z: 23.5, targetY: 1.05 } as const;
const MOBILE_CAMERA_COUNTDOWN = { x: -18, y: 3.8, z: 26, targetY: 1.2 } as const;

const MASK_DURATION_MS = 800;
const FALL_GRAVITY = 14;
const FALL_RESTITUTION = 0.32;
const FALL_SETTLE_SPEED = 0.55;
const FALL_FADE_SECONDS = 0.4;
const FALL_GROUND_DWELL_SECONDS = 60.0;
const FALL_DT_CLAMP = 0.05;
const FALL_HORIZONTAL_SPEED = 0.7;
const FALL_DEPTH_SPEED = 0.28;
const PALETTE = {
  a: new THREE.Color(0.5, 0.5, 0.5),
  b: new THREE.Color(0.5, 0.5, 0.5),
  c: new THREE.Color(1, 1, 1),
  d: new THREE.Color(0, 0.33, 0.67),
} as const;

interface DisposableResource {
  dispose(): void;
}

function circularInOut(value: number): number {
  let t = value * 2;
  if (t < 1) return -0.5 * (Math.sqrt(1 - t * t) - 1);
  t -= 2;
  return 0.5 * (Math.sqrt(1 - t * t) + 1);
}

function remapRangeClamp(
  value: number,
  inLow: number,
  inHigh: number,
  outLow: number,
  outHigh: number,
): number {
  if (inHigh === inLow) return outLow;
  const t = (value - inLow) / (inHigh - inLow);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return outLow + (outHigh - outLow) * clamped;
}

/** Matches countdown `mobileOffset()` local X. */
function countdownMobileLocalX(digitIndex: number): number {
  if (digitIndex < 3) return 2.6;
  if (digitIndex < 5) return 0.9;
  if (digitIndex < 7) return -0.9;
  return -2.6;
}

/** Matches countdown `mobileOffset()` local Z after the shared (0,0,-1.8) add. */
function countdownMobileLocalZ(digitIndex: number): number {
  if (digitIndex < 3) return -5.4;
  if (digitIndex < 5) return -3.6;
  if (digitIndex < 7) return -1.8;
  return 0;
}

function sampleGlyphInside(
  glyph: ReturnType<TinySDF['draw']>,
  localU: number,
  v: number,
): boolean {
  if (glyph.width <= 0 || glyph.height <= 0) return false;
  const x = Math.min(glyph.width - 1, Math.max(0, Math.floor(localU * glyph.width)));
  // DataTexture default flipY=true: GPU v=0 samples the last CPU row.
  const y = Math.min(glyph.height - 1, Math.max(0, Math.floor((1 - v) * glyph.height)));
  const r = glyph.data[y * glyph.width + x] / 255;
  return (1 - r) * 3 < 0.5;
}

async function loadRussoOne(): Promise<void> {
  if (typeof document === 'undefined') return;
  const href = 'https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Anton&family=Audiowide&family=Russo+One&display=swap';
  if (!document.querySelector(`link[data-time-viz-font="russo"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.timeVizFont = 'russo';
    document.head.appendChild(link);
    await new Promise<void>((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Russo One stylesheet failed'));
    }).catch(async () => {
      if (typeof FontFace === 'undefined') return;
      const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`, { weight: 'normal' });
      document.fonts.add(await face.load());
    });
  }
  await document.fonts.load(`512px "${FONT_FAMILY}"`);
  await document.fonts.ready;
}

function makeSdfTexture(glyph: ReturnType<TinySDF['draw']>): THREE.DataTexture {
  const map = new DataTexture(glyph.data, glyph.width, glyph.height, RedFormat);
  map.needsUpdate = true;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  return map;
}

function createDigitTextureBanks(): {
  ping: THREE.DataTexture[];
  pong: THREE.DataTexture[];
  empty: THREE.DataTexture;
  glyphs: ReturnType<TinySDF['draw']>[];
} {
  const sdf = new TinySDF({
    fontSize: 512,
    buffer: 18,
    radius: 128,
    cutoff: 0,
    fontFamily: FONT_FAMILY,
    fontWeight: 'normal',
  });

  const ping: THREE.DataTexture[] = [];
  const pong: THREE.DataTexture[] = [];
  const glyphs: ReturnType<TinySDF['draw']>[] = [];
  for (let digit = 0; digit < 10; digit += 1) {
    const glyph = sdf.draw(String(digit));
    glyphs.push(glyph);
    ping.push(makeSdfTexture(glyph));
    pong.push(makeSdfTexture(glyph));
  }
  const empty = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
  empty.needsUpdate = true;
  return { ping, pong, empty, glyphs };
}

function digitFieldWidth(digitCount: number): number {
  return digitCount;
}

function getGroupGapCount(digitIndex: number, digitCount: number): number {
  if (digitCount === 9) {
    if (digitIndex < 3) return 0;
    if (digitIndex < 5) return 1;
    if (digitIndex < 7) return 2;
    return 3;
  }
  if (digitCount === 8) {
    return digitIndex < 5 ? 0 : 1;
  }
  return Math.floor(digitIndex / 2);
}

export async function createTslTimeVizScene(
  options: TimeVizSceneOptions,
): Promise<TimeVizScene> {
  const quality = selectShowroomQuality({
    deviceMemory: typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency,
    mobile: typeof window === 'undefined' ? false : window.innerWidth < 768,
    prefersReducedMotion: Boolean(options.reducedMotion),
  });

  const ownedResources: DisposableResource[] = [];
  const ownResource = <T extends DisposableResource>(resource: T, kind: CountdownResourceKind): T => {
    if (options.mode !== 'countdown') {
      ownedResources.push(resource);
      return resource;
    }
    const release = trackCountdownResource(kind);
    let disposed = false;
    ownedResources.push({
      dispose: () => {
        if (disposed) return;
        resource.dispose();
        disposed = true;
        release();
      },
    });
    return resource;
  };

  await loadRussoOne();

  const renderer = new WebGPURenderer({
    antialias: true,
    canvas: options.canvas,
    powerPreference: 'high-performance',
  });
  await renderer.init();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = false;
  ownResource(renderer, 'renderer');

  ownResource({
    dispose: () => undefined,
  }, 'composer');

  const isCountdown = options.mode === 'countdown';
  const desktopCamera = isCountdown ? DESKTOP_CAMERA_COUNTDOWN : DESKTOP_CAMERA_REFERENCE;

  const scene = new Scene();
  const bgDark = uniform(vec3(0.03, 0.03, 0.03));
  const bgBlack = uniform(vec3(0, 0, 0));
  scene.background = new THREE.Color(0x05060a);
  (scene as unknown as { backgroundNode?: unknown }).backgroundNode = screenUV.distance(0.5).remap(0, 1).mix(bgDark, bgBlack);
  scene.environmentIntensity = 1;

  const camera = new PerspectiveCamera(15, 1280 / 720, 0.1, 100);
  camera.position.set(desktopCamera.x, desktopCamera.y, desktopCamera.z);

  const controls = options.canvas
    ? new OrbitControls(camera, options.canvas)
    : null;
  if (controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.target.set(0, desktopCamera.targetY, 0);
    controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = 5;
    controls.maxDistance = isCountdown ? 75 : 25;
    controls.update();
  }

  const digitCount = getTimeVizLayout(options.mode, 'desktop').digitCapacity;
  const fieldWidth = digitFieldWidth(digitCount);
  const cell = 1 / SUBDIVISIONS;
  const cubeSize = cell * 0.95;
  const xCount = Math.round(fieldWidth * SUBDIVISIONS);
  const yCount = Math.round(FIELD_HEIGHT * SUBDIVISIONS);
  const zCount = Math.round(FIELD_DEPTH * SUBDIVISIONS);
  const instanceCount = xCount * yCount * zCount;

  const totalGaps = getGroupGapCount(digitCount - 1, digitCount);
  const totalFieldWidth = fieldWidth + totalGaps * PAIR_GAP;
  const xHalf = (totalFieldWidth - cell) / 2;
  const ungappedXHalf = (fieldWidth - cell) / 2;
  const yHalf = FIELD_HEIGHT / 2 - cell / 2;

  const geometry = ownResource(
    new RoundedBoxGeometry(cubeSize, cubeSize, cubeSize, 1, 0.01),
    'geometry',
  );
  const material = ownResource(new MeshStandardNodeMaterial(), 'material');

  const mesh = new InstancedMesh(geometry, material, instanceCount);
  mesh.frustumCulled = false;
  mesh.position.y = isCountdown ? (FIELD_HEIGHT / 2 + 0.5) : (FIELD_HEIGHT / 2);
  mesh.rotation.x = Math.PI / 2;

  const dummy = new Object3D();
  const gapped: number[] = [];
  const ungapped: number[] = [];
  let instanceIndex = 0;

  for (let x = 0; x < xCount; x += 1) {
    const digitIndex = Math.floor(x / SUBDIVISIONS);
    const cellInDigit = x % SUBDIVISIONS;
    const gapCount = getGroupGapCount(digitIndex, digitCount);
    const pairOffset = gapCount * PAIR_GAP;
    const gappedX = digitIndex * 1.0 + cellInDigit * cell + pairOffset - xHalf;
    const ungappedX = (x / xCount) * fieldWidth - ungappedXHalf;
    for (let y = 0; y < yCount; y += 1) {
      for (let z = 0; z < zCount; z += 1) {
        const depth = (z / zCount) * FIELD_DEPTH;
        const height = (y / yCount) * FIELD_HEIGHT - yHalf;
        dummy.position.set(gappedX, depth, height);
        dummy.updateMatrix();
        mesh.setMatrixAt(instanceIndex, dummy.matrix);
        gapped.push(gappedX, depth, height);
        ungapped.push(ungappedX, depth, height);
        instanceIndex += 1;
      }
    }
  }

  const gappedAttr = new InstancedBufferAttribute(new Float32Array(gapped), 3);
  const ungappedAttr = new InstancedBufferAttribute(new Float32Array(ungapped), 3);
  const gappedNode = instancedBufferAttribute(gappedAttr) as ReturnType<typeof vec3>;
  const ungappedNode = instancedBufferAttribute(ungappedAttr) as ReturnType<typeof vec3>;

  const digitMaps = createDigitTextureBanks();
  [...digitMaps.ping, digitMaps.empty].forEach((map) => {
    ownedResources.push(map);
  });

  const glyphNodes = digitMaps.ping.map((map) => texture(map));
  const currentIds = Array.from({ length: digitCount }, () => uniform(0));
  const previousIds = Array.from({ length: digitCount }, () => uniform(0));
  const maskUniform = uniform(0);
  const mobileUniform = uniform(0);
  const timeMul = uniform(0.2);
  const texScale = uniform(1);
  const color0 = uniform(vec3(PALETTE.a.r, PALETTE.a.g, PALETTE.a.b));
  const color1 = uniform(vec3(PALETTE.b.r, PALETTE.b.g, PALETTE.b.b));
  const color2 = uniform(vec3(PALETTE.c.r, PALETTE.c.g, PALETTE.c.b));
  const color3 = uniform(vec3(PALETTE.d.r, PALETTE.d.g, PALETTE.d.b));

  const cosinePalette = (t: ReturnType<typeof float>) => {
    const theta = color2.mul(t).add(color3).mul(6.28318530718);
    return color0.add(color1.mul(vec3(cos(theta.x), cos(theta.y), cos(theta.z))));
  };

  const saturateColor = (col: ReturnType<typeof vec3>, amount: number) => {
    const gray = col.dot(vec3(0.299, 0.587, 0.114));
    return mix(vec3(gray), col, float(amount));
  };

  const digitUvNode = Fn(() => {
    const u = remapClamp(ungappedNode.x, fieldWidth / -2, fieldWidth / 2, 0, 1);
    const v = remapClamp(ungappedNode.z, FIELD_HEIGHT / -2, FIELD_HEIGHT / 2, 0, 1);
    return vec2(u, v);
  });

  const sampleBank = (
    ids: ReturnType<typeof uniform>[],
  ) => Fn(() => {
    const uv = digitUvNode();
    const localU = fract(uv.x.mul(digitCount));
    const localUv = vec2(localU, uv.y);
    const slot = floor(uv.x.mul(digitCount));
    const activeId = float(-1).toVar();
    for (let index = 0; index < digitCount; index += 1) {
      activeId.assign(slot.equal(float(index)).select(ids[index], activeId));
    }
    const result = float(0).toVar();
    for (let glyph = 0; glyph < 10; glyph += 1) {
      const sample = float(1).sub(texture(glyphNodes[glyph], localUv).r);
      result.assign(result.add(activeId.equal(float(glyph)).select(sample, float(0))));
    }
    return result;
  });

  const currentMask = sampleBank(currentIds);
  const previousMask = sampleBank(previousIds);
  const blendedMask = Fn(() => mix(previousMask(), currentMask(), maskUniform));
  const cubeScale = Fn(() => remapClamp(blendedMask().mul(3).r, 0, 0.5, 1, 0));
  let stepFallPhysics: (dt: number) => void = () => undefined;
  let syncOccupancyOnTween: (nextDigits: string[]) => void = () => undefined;
  let lastPhysicsNow = 0;

  const mobileOffset = isCountdown ? Fn(() => {
    const index = floor(digitUvNode().x.mul(digitCount));
    const offset = vec3(0, 0, 0).toVar();
    If(index.lessThan(float(3)), () => {
      offset.assign(vec3(2.6, 0, -3.6));
    }).ElseIf(index.lessThan(float(5)), () => {
      offset.assign(vec3(0.9, 0, -1.8));
    }).ElseIf(index.lessThan(float(7)), () => {
      offset.assign(vec3(-0.9, 0, 0.0));
    }).Else(() => {
      offset.assign(vec3(-2.6, 0, 1.8));
    });
    offset.assign(offset.add(vec3(0, 0, -1.8)));
    return offset;
  }) : Fn(() => {
    const index = floor(digitUvNode().x.mul(digitCount));
    const offset = vec3(0, 0, 0).toVar();
    If(index.lessThan(float(2)), () => {
      offset.assign(vec3(2 + PAIR_GAP, 0, -1.8));
    }).ElseIf(index.greaterThan(float(3)), () => {
      offset.assign(vec3(-2 - PAIR_GAP, 0, 1.8));
    });
    offset.assign(offset.add(vec3(0, 0, -1.8)));
    return offset;
  });

  const noiseNode = Fn(() => {
    const noise = mx_noise_float(gappedNode.mul(texScale), 0.75, 0.5);
    return remapClamp(noise, 0, 1, 0, 1).add(time.mul(timeMul));
  });

  material.positionNode = positionGeometry
    .mul(cubeScale())
    .add(mix(vec3(0), mobileOffset(), mobileUniform));
  material.colorNode = Fn(() => {
    const t = noiseNode().mod(1).mul(remapClamp(cubeScale(), 0, 1, 0, 1));
    const rainbow = cosinePalette(t);
    return saturateColor(rainbow, 0.8);
  })();
  material.metalnessNode = float(1);
  scene.add(mesh);
  let fallingMesh: InstancedMesh | null = null;
  let fireworks: CountdownFireworksSystem | null = null;
  let rapierPhysics: CountdownRapierPhysics | null = null;

  if (isCountdown) {
    const ungappedPositions = new Float32Array(ungapped);
    const gappedPositions = new Float32Array(gapped);
    const instanceHeight = new Float32Array(instanceCount);
    const instanceSlot = new Int16Array(instanceCount);
    for (let i = 0; i < instanceCount; i += 1) {
      const ungappedX = ungappedPositions[i * 3];
      instanceHeight[i] = ungappedPositions[i * 3 + 2];
      const u = remapRangeClamp(ungappedX, fieldWidth / -2, fieldWidth / 2, 0, 1);
      instanceSlot[i] = Math.floor(u * digitCount);
    }

    const MAX_FALL_PARTICLES = CountdownRapierPhysics.DEFAULT_MAX_PARTICLES;
    try {
      rapierPhysics = await CountdownRapierPhysics.create({
        maxParticles: MAX_FALL_PARTICLES,
        cubeSize,
      });
      ownedResources.push(rapierPhysics);
    } catch {
      rapierPhysics = null;
    }

    const fallScaleAttr = new InstancedBufferAttribute(new Float32Array(MAX_FALL_PARTICLES), 1);
    const fallNoiseAttr = new InstancedBufferAttribute(new Float32Array(MAX_FALL_PARTICLES * 3), 3);

    const fallScaleNode = instancedBufferAttribute(fallScaleAttr) as ReturnType<typeof float>;
    const fallNoiseNode = instancedBufferAttribute(fallNoiseAttr) as ReturnType<typeof vec3>;

    const fallingMaterial = new MeshStandardNodeMaterial();
    ownedResources.push(fallingMaterial);

    const fallingNoise = Fn(() => {
      const noise = mx_noise_float(fallNoiseNode.mul(texScale), 0.75, 0.5);
      return remapClamp(noise, 0, 1, 0, 1).add(time.mul(timeMul));
    });

    fallingMaterial.colorNode = Fn(() => {
      const t = fallingNoise().mod(1).mul(remapClamp(fallScaleNode, 0, 1, 0, 1));
      const rainbow = cosinePalette(t);
      return saturateColor(rainbow, 0.8);
    })();

    fallingMaterial.metalnessNode = float(1);

    fallingMesh = new InstancedMesh(geometry, fallingMaterial, MAX_FALL_PARTICLES);
    fallingMesh.frustumCulled = false;
    fallingMesh.position.set(0, 0, 0);
    fallingMesh.rotation.set(0, 0, 0);
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_FALL_PARTICLES; i += 1) {
      fallingMesh.setMatrixAt(i, zeroMat);
    }
    fallingMesh.instanceMatrix.needsUpdate = true;
    scene.add(fallingMesh);

    fireworks = new CountdownFireworksSystem();
    scene.add(fireworks.points);
    ownedResources.push(fireworks);

    if (options.canvas) {
      const targetCanvas = options.canvas;
      const onPointerDown = (e: MouseEvent | PointerEvent) => {
        if (e.button === 0) {
          fireworks?.launchFestivalDisplay();
        }
      };
      targetCanvas.addEventListener('pointerdown', onPointerDown);
      ownedResources.push({
        dispose: () => targetCanvas.removeEventListener('pointerdown', onPointerDown),
      });
    }

    const occupancy = new Uint8Array(instanceCount);
    const nextOccupancy = new Uint8Array(instanceCount);
    let occupancySeeded = false;

    const instanceInsideGlyph = (index: number, digits: string[]): boolean => {
      const slot = instanceSlot[index];
      if (slot < 0 || slot >= digitCount) return false;
      const char = digits[slot] ?? ' ';
      if (char === ' ') return false;
      const parsed = Number.parseInt(char, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9) return false;
      const glyph = digitMaps.glyphs[parsed];
      if (!glyph) return false;
      const ungappedX = ungappedPositions[index * 3];
      const height = instanceHeight[index];
      const u = remapRangeClamp(ungappedX, fieldWidth / -2, fieldWidth / 2, 0, 1);
      const v = remapRangeClamp(height, FIELD_HEIGHT / -2, FIELD_HEIGHT / 2, 0, 1);
      const localU = u * digitCount - slot;
      return sampleGlyphInside(glyph, localU, v);
    };

    const fillOccupancy = (digits: string[], out: Uint8Array) => {
      for (let i = 0; i < instanceCount; i += 1) {
        out[i] = instanceInsideGlyph(i, digits) ? 1 : 0;
      }
    };

    syncOccupancyOnTween = (nextDigits: string[]) => {
      const isMobile = mobileUniform.value > 0.5;
      if (!occupancySeeded) {
        fillOccupancy(nextDigits, occupancy);
        occupancySeeded = true;
        return;
      }
      fillOccupancy(nextDigits, nextOccupancy);
      if (!rapierPhysics) return;

      for (let i = 0; i < instanceCount; i += 1) {
        const wasInside = occupancy[i] === 1;
        const nowInside = nextOccupancy[i] === 1;
        if (wasInside && !nowInside) {
          const slot = instanceSlot[i];
          const gx = gappedPositions[i * 3];
          const gy = gappedPositions[i * 3 + 1];
          const gz = gappedPositions[i * 3 + 2];
          const mobX = isMobile ? countdownMobileLocalX(slot) : 0;
          const mobZ = isMobile ? countdownMobileLocalZ(slot) : 0;
          const worldX = gx + mobX + (mesh.position.x || 0);
          const worldY = mesh.position.y - gz - mobZ;
          const worldZ = gy;
          rapierPhysics.spawnCube(worldX, worldY, worldZ, [gx, gy, gz]);
        }
      }
      occupancy.set(nextOccupancy);
    };

    stepFallPhysics = (dt: number) => {
      if (dt <= 0 || !rapierPhysics || !fallingMesh) return;
      rapierPhysics.step(dt);
      rapierPhysics.syncToInstancedMesh(fallingMesh, fallScaleAttr, fallNoiseAttr);
    };
  }

  const reflection = reflector({
    bounces: false,
    generateMipmaps: true,
    resolutionScale: 0.5,
  });
  reflection.target.rotateX(-Math.PI / 2);

  const liquidNoise = mx_noise_vec3(positionGeometry.mul(1.5).add(time.mul(0.25)), 0.8, 0.5);
  const floorMaterial = new MeshStandardNodeMaterial();
  ownedResources.push(floorMaterial);
  floorMaterial.transparent = true;
  floorMaterial.metalness = 1;
  floorMaterial.roughnessNode = float(0);
  floorMaterial.depthWrite = false;
  const floorColor = Fn(() => {
    const sampled = textureBicubic(reflection, liquidNoise.r.mul(0.8));
    const fade = rangeFogFactor(7, 50).oneMinus();
    return vec4(sampled.rgb, fade);
  })();
  floorMaterial.colorNode = floorColor;
  floorMaterial.outputNode = floorColor;

  const floorMesh = new Mesh(new BoxGeometry(50, 0.001, 50), floorMaterial);
  floorMesh.position.set(0, 0, 0);
  floorMesh.renderOrder = -1;
  scene.add(reflection.target, floorMesh);
  ownResource({ dispose: () => reflection.dispose() }, 'floor');

  try {
    const hdr = await new RGBELoader().loadAsync(ENVIRONMENT_URL);
    hdr.mapping = EquirectangularReflectionMapping;
    scene.environment = hdr;
    ownResource({ dispose: () => hdr.dispose() }, 'environment');
  } catch {
    scene.environment = null;
  }

  const vehicleGroup = new THREE.Group();
  scene.add(vehicleGroup);
  let currentVehicle: THREE.Object3D | null = null;

  let currentDigits = Array.from({ length: digitCount }, () => '0');
  let activeBank: 'ping' | 'pong' = 'ping';
  let maskFrom = 1;
  let maskTo = 1;
  let maskStartedAt = 0;
  let disposed = false;
  let ready = false;
  let frameCount = 0;
  let animationFrameId: number | null = null;
  let releaseAnimationFrame: (() => void) | null = null;
  let disposeOwned: (() => void) | null = null;

  const applyIds = (digits: string[], ids: typeof currentIds) => {
    for (let i = 0; i < digitCount; i += 1) {
      const char = digits[i] ?? ' ';
      if (char === ' ') {
        ids[i].value = -1;
        continue;
      }
      const parsed = Number.parseInt(char, 10);
      ids[i].value = Number.isFinite(parsed) ? Math.min(9, Math.max(0, parsed)) : -1;
    }
  };

  const startMaskTween = (nextDigits: string[]) => {
    if (activeBank === 'ping') {
      applyIds(nextDigits, previousIds);
      maskFrom = 1;
      maskTo = 0;
      activeBank = 'pong';
    } else {
      applyIds(nextDigits, currentIds);
      maskFrom = 0;
      maskTo = 1;
      activeBank = 'ping';
    }
    maskStartedAt = performance.now();
    currentDigits = nextDigits.slice(0, digitCount);
    syncOccupancyOnTween(nextDigits);
  };

  applyIds(currentDigits, currentIds);
  applyIds(currentDigits, previousIds);
  maskUniform.value = 1;

  const getSnapshot = (): TimeVizSceneSnapshot => ({
    frameCount,
    mode: options.mode,
    ready: ready && !disposed,
    resourceCount: disposed ? 0 : ownedResources.length,
    viewport: mobileUniform.value ? 'mobile' : 'desktop',
  });

  let layoutMobile: boolean | null = null;
  const applyCamera = (width: number, height: number) => {
    const mobile = height > 0 && width / height < MOBILE_ASPECT;
    const layoutChanged = layoutMobile !== mobile;
    mobileUniform.value = mobile ? 1 : 0;
    const desktopCam = isCountdown ? DESKTOP_CAMERA_COUNTDOWN : DESKTOP_CAMERA_REFERENCE;
    const mobileCam = isCountdown ? MOBILE_CAMERA_COUNTDOWN : MOBILE_CAMERA_REFERENCE;
    if (layoutChanged) {
      layoutMobile = mobile;
      if (mobile) {
        camera.position.set(mobileCam.x, mobileCam.y, mobileCam.z);
        controls?.target.set(0, mobileCam.targetY, 0);
      } else {
        camera.position.set(desktopCam.x, desktopCam.y, desktopCam.z);
        controls?.target.set(0, desktopCam.targetY, 0);
      }
      if (currentVehicle) {
        applyCountdownVehiclePose(currentVehicle, mobile ? 'mobile' : 'desktop');
        rapierPhysics?.updateVehicleCollider(
          { x: currentVehicle.position.x, y: currentVehicle.position.y + 0.35, z: currentVehicle.position.z },
          { x: 1.1, y: 0.35, z: 2.2 },
        );
      }
    }
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    controls?.update();
  };

  const scheduleAnimationFrame = (): void => {
    animationFrameId = window.requestAnimationFrame(renderFrame);
    if (options.mode === 'countdown') {
      releaseAnimationFrame = trackCountdownResource('animationFrame');
    }
  };

  const renderFrame: FrameRequestCallback = (now) => {
    if (disposed) return;
    releaseAnimationFrame?.();
    releaseAnimationFrame = null;
    const elapsed = now - maskStartedAt;
    const t = Math.min(1, Math.max(0, elapsed / MASK_DURATION_MS));
    const eased = options.reducedMotion ? 1 : circularInOut(t);
    maskUniform.value = maskFrom + (maskTo - maskFrom) * eased;
    if (isCountdown) {
      const dt = lastPhysicsNow === 0
        ? 0
        : Math.min(FALL_DT_CLAMP, Math.max(0, (now - lastPhysicsNow) / 1000));
      lastPhysicsNow = now;
      try {
        stepFallPhysics(dt);
        fireworks?.update(now / 1000, dt);
      } catch (err) {
        console.error('Error during countdown physics update:', err);
      }
    }
    controls?.update();
    try {
      void renderer.render(scene, camera);
    } catch (err) {
      console.error('Error during countdown scene render:', err);
    }
    frameCount += 1;
    if (!ready) {
      ready = true;
      options.onReady?.(getSnapshot());
    }
    scheduleAnimationFrame();
  };

  applyCamera(1280, 720);
  scheduleAnimationFrame();

  const animationResource: DisposableResource = {
    dispose: () => {
      if (animationFrameId === null) return;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      releaseAnimationFrame?.();
      releaseAnimationFrame = null;
    },
  };
  ownedResources.push(animationResource);

  disposeOwned = createIdempotentDisposer([
    animationResource,
    {
      dispose: () => {
        controls?.dispose();
        if (currentVehicle) vehicleGroup.remove(currentVehicle);
        currentVehicle = null;
        scene.clear();
        scene.environment = null;
      },
    },
    ...ownedResources.slice(0, -1).reverse(),
  ]);

  return {
    setDigits: (digits) => {
      if (disposed) return;
      const is6 = isCountdown && digits.length === 6;
      const normalized = is6 ? [' ', ' ', ' ', ...digits] : digits;
      mesh.position.x = is6 ? -1.75 : 0;
      const next = Array.from({ length: digitCount }, (_, index) => {
        const char = normalized[index];
        if (char === ' ') return ' ';
        return /^\d$/.test(char ?? '') ? (char as string) : '0';
      });
      if (next.join('') === currentDigits.join('')) return;
      startMaskTween(next);
    },
    setVehicle: (vehicle) => {
      if (disposed || vehicle === currentVehicle) return;
      if (currentVehicle) vehicleGroup.remove(currentVehicle);
      currentVehicle = vehicle;
      if (vehicle) {
        applyCountdownVehiclePose(vehicle, mobileUniform.value ? 'mobile' : 'desktop');
        vehicleGroup.add(vehicle);
        rapierPhysics?.updateVehicleCollider(
          { x: vehicle.position.x, y: vehicle.position.y + 0.35, z: vehicle.position.z },
          { x: 1.1, y: 0.35, z: 2.2 },
        );
      } else {
        rapierPhysics?.removeVehicleCollider();
      }
    },
    resize: (width, height, pixelRatio) => {
      if (disposed || width <= 0 || height <= 0) return;
      if (options.mode !== 'reference') {
        renderer.setPixelRatio(Math.max(0.5, Math.min(pixelRatio, quality.maxPixelRatio)));
      }
      renderer.setSize(width, height, false);
      applyCamera(width, height);
    },
    getSnapshot,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ready = false;
      disposeOwned?.();
    },
  };
}
