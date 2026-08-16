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
const DESKTOP_CAMERA = { x: 0, y: 0.5, z: 20, targetY: 0.5 } as const;
const MOBILE_CAMERA = { x: -30, y: 2, z: 50, targetY: 2.5 } as const;
const MASK_DURATION_MS = 800;
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

function createDigitTextureBanks(): { ping: THREE.DataTexture[]; pong: THREE.DataTexture[] } {
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
  for (let digit = 0; digit < 10; digit += 1) {
    const glyph = sdf.draw(String(digit));
    ping.push(makeSdfTexture(glyph));
    pong.push(makeSdfTexture(glyph));
  }
  return { ping, pong };
}

function digitFieldWidth(digitCount: number): number {
  return digitCount;
}

function pairCountForDigits(digitCount: number): number {
  return Math.max(1, Math.round(digitCount / 2));
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

  const scene = new Scene();
  const bgDark = uniform(vec3(0.03, 0.03, 0.03));
  const bgBlack = uniform(vec3(0, 0, 0));
  (scene as unknown as { background: unknown }).background = screenUV.distance(0.5).remap(0, 1).mix(bgDark, bgBlack);
  scene.environmentIntensity = 1;

  const camera = new PerspectiveCamera(15, 1280 / 720, 0.1, 100);
  camera.position.set(DESKTOP_CAMERA.x, DESKTOP_CAMERA.y, DESKTOP_CAMERA.z);

  const controls = options.canvas
    ? new OrbitControls(camera, options.canvas)
    : null;
  if (controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.target.set(0, DESKTOP_CAMERA.targetY, 0);
    controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    controls.update();
  }

  const digitCount = getTimeVizLayout(options.mode, 'desktop').digitCapacity;
  const fieldWidth = digitFieldWidth(digitCount);
  const pairs = pairCountForDigits(digitCount);
  const cell = 1 / SUBDIVISIONS;
  const cubeSize = cell * 0.95;
  const xCount = Math.round(fieldWidth * SUBDIVISIONS);
  const yCount = Math.round(FIELD_HEIGHT * SUBDIVISIONS);
  const zCount = Math.round(FIELD_DEPTH * SUBDIVISIONS);
  const instanceCount = xCount * yCount * zCount;

  const geometry = ownResource(
    new RoundedBoxGeometry(cubeSize, cubeSize, cubeSize, 1, 0.01),
    'geometry',
  );
  const material = ownResource(new MeshStandardNodeMaterial(), 'material');

  const mesh = new InstancedMesh(geometry, material, instanceCount);
  mesh.frustumCulled = false;
  mesh.position.y = FIELD_HEIGHT / 2;
  mesh.rotation.x = Math.PI / 2;

  const dummy = new Object3D();
  const gapped: number[] = [];
  const ungapped: number[] = [];
  const xHalf = fieldWidth / 2 - cell / 2;
  const yHalf = FIELD_HEIGHT / 2 - cell / 2;
  let instanceIndex = 0;

  for (let x = 0; x < xCount; x += 1) {
    const cellsPerPair = xCount / pairs;
    const pairOffset = Math.floor(x / cellsPerPair) * PAIR_GAP;
    const gappedX = (x / xCount) * fieldWidth + pairOffset - xHalf - PAIR_GAP;
    const ungappedX = (x / xCount) * fieldWidth - xHalf;
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
  [...digitMaps.ping, ...digitMaps.pong].forEach((map) => {
    ownedResources.push(map);
  });

  const currentNodes = digitMaps.ping.slice(0, digitCount).map((map) => texture(map));
  const previousNodes = digitMaps.pong.slice(0, digitCount).map((map) => texture(map));
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
    nodes: ReturnType<typeof texture>[],
  ) => Fn(() => {
    const uv = digitUvNode();
    const localU = fract(uv.x.mul(digitCount));
    const localUv = vec2(localU, uv.y);
    const index = floor(uv.x.mul(digitCount));
    const result = color(0, 0, 0).toVar();
    for (let digit = 0; digit < digitCount; digit += 1) {
      const active = index.equal(float(digit));
      const sample = float(1).sub(texture(nodes[digit], localUv).r);
      result.assign(result.add(active.select(sample, float(0))));
    }
    return result;
  });

  const currentMask = sampleBank(currentNodes);
  const previousMask = sampleBank(previousNodes);
  const blendedMask = Fn(() => mix(previousMask(), currentMask(), maskUniform));
  const cubeScale = Fn(() => remapClamp(blendedMask().mul(3).r, 0, 0.5, 1, 0));

  const mobileOffset = Fn(() => {
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

  const colorNode = Fn(() => {
    const t = noiseNode().mod(1).mul(remapClamp(cubeScale(), 0, 1, 0, 1));
    const rainbow = cosinePalette(t);
    return saturateColor(rainbow, 0.8);
  });

  material.colorNode = colorNode();
  material.metalnessNode = float(1);
  material.positionNode = positionGeometry.mul(cubeScale()).add(mix(vec3(0), mobileOffset(), mobileUniform));

  scene.add(mesh);

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
  let maskFrom = 0;
  let maskTo = 0;
  let maskStartedAt = 0;
  let disposed = false;
  let ready = false;
  let frameCount = 0;
  let animationFrameId: number | null = null;
  let releaseAnimationFrame: (() => void) | null = null;
  let disposeOwned: (() => void) | null = null;

  const applyTextures = (digits: string[], bank: typeof currentNodes, maps: THREE.DataTexture[]) => {
    for (let i = 0; i < digitCount; i += 1) {
      const parsed = Number.parseInt(digits[i] ?? '0', 10);
      const index = Number.isFinite(parsed) ? Math.min(9, Math.max(0, parsed)) : 0;
      bank[i].value = maps[index];
    }
  };

  const startMaskTween = (nextDigits: string[]) => {
    const asNumber = Number(nextDigits.join(''));
    if (asNumber % 2 === 0) {
      applyTextures(nextDigits, currentNodes, digitMaps.ping);
      maskFrom = 0;
      maskTo = 1;
    } else {
      applyTextures(nextDigits, previousNodes, digitMaps.pong);
      maskFrom = 0;
      maskTo = 0;
    }
    maskStartedAt = performance.now();
    currentDigits = nextDigits.slice(0, digitCount);
  };

  applyTextures(currentDigits, currentNodes, digitMaps.ping);
  applyTextures(currentDigits, previousNodes, digitMaps.pong);

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
    if (layoutChanged) {
      layoutMobile = mobile;
      if (mobile) {
        camera.position.set(MOBILE_CAMERA.x, MOBILE_CAMERA.y, MOBILE_CAMERA.z);
        controls?.target.set(0, MOBILE_CAMERA.targetY, 0);
      } else {
        camera.position.set(DESKTOP_CAMERA.x, DESKTOP_CAMERA.y, DESKTOP_CAMERA.z);
        controls?.target.set(0, DESKTOP_CAMERA.targetY, 0);
      }
      if (currentVehicle) {
        applyCountdownVehiclePose(currentVehicle, mobile ? 'mobile' : 'desktop');
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
    controls?.update();
    void renderer.render(scene, camera);
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
      const next = Array.from({ length: digitCount }, (_, index) => (
        /^\d$/.test(digits[index] ?? '') ? digits[index] : '0'
      ));
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
