import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { createIdempotentDisposer } from '@/src/components/showroom/showroom-resource-lifecycle';
import {
  selectShowroomQuality,
  type ShowroomQualityOptions,
} from '@/src/lib/showroom-quality';
import {
  trackCountdownResource,
  type CountdownResourceKind,
} from '@/src/lib/test-observability';

import {
  buildDigitInstances,
  CELLS_PER_DIGIT,
  getTimeVizLayout,
  type ViewportKind,
} from './digit-layout';
import { applyCountdownVehiclePose } from './countdown-vehicle';
import type {
  TimeVizComposer,
  TimeVizDependencies,
  TimeVizEnvironment,
  TimeVizFloor,
  TimeVizRenderer,
  TimeVizScene,
  TimeVizSceneOptions,
} from './time-viz-types';
import { createTslTimeVizScene } from './time-viz-tsl';

const ENVIRONMENT_URL = '/environments/lythwood_room_1k.hdr';
const MOBILE_BREAKPOINT = 768;
const INITIAL_WIDTH = 1280;
const INITIAL_HEIGHT = 720;
const REFLECTION_RESOLUTION_SCALE = 0.35;
const MIN_REFLECTION_SIZE = 128;

interface DisposableResource {
  dispose(): void;
}

interface TimeVizPostPass extends DisposableResource {}

interface TimeVizComposerCore extends TimeVizComposer {
  addPass(pass: TimeVizPostPass): void;
}

export interface TimeVizComposerResourceFactories {
  createComposer(renderer: THREE.WebGLRenderer): TimeVizComposerCore;
  createRenderPass(scene: THREE.Scene, camera: THREE.Camera): TimeVizPostPass;
  createBloomPass(): TimeVizPostPass;
  createOutputPass(): TimeVizPostPass;
}

export interface TimeVizFloorResourceFactories {
  createGeometry(): THREE.PlaneGeometry;
  createReflector(
    geometry: THREE.PlaneGeometry,
    options: ConstructorParameters<typeof Reflector>[1],
  ): Reflector;
}

interface TimeVizPmremRenderTarget extends DisposableResource {
  texture: THREE.Texture;
}

interface TimeVizPmremGenerator extends DisposableResource {
  compileEquirectangularShader(): void;
  fromEquirectangular(source: THREE.Texture): TimeVizPmremRenderTarget;
}

export interface TimeVizEnvironmentResourceFactories {
  loadSource(url: string): Promise<THREE.Texture>;
  createPmremGenerator(renderer: THREE.WebGLRenderer): TimeVizPmremGenerator;
}

const floorShader = {
  name: 'TimeVizLiquidReflector',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    time: { value: 0 },
    displacementStrength: { value: 0.075 },
    resolution: { value: new THREE.Vector2(
      reflectionSize(INITIAL_WIDTH, 1),
      reflectionSize(INITIAL_HEIGHT, 1),
    ) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    uniform float time;
    uniform float displacementStrength;
    varying vec4 vUv;
    varying vec2 vPlaneCoord;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vec3 displaced = position;
      float depthWave = sin(position.y * 0.38 + time * 0.22)
        + sin(position.y * 0.95 - position.x * 0.04 - time * 0.16) * 0.35;
      displaced.z += depthWave * displacementStrength;

      vPlaneCoord = position.xy;
      vUv = textureMatrix * vec4(displaced, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);

      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    varying vec4 vUv;
    varying vec2 vPlaneCoord;

    #include <logdepthbuf_pars_fragment>

    void main() {
      #include <logdepthbuf_fragment>

      vec2 p = vPlaneCoord;
      vec2 uv = vUv.xy / max(vUv.w, 0.0001);
      float band0 = sin(p.y * 0.65 + time * 0.30);
      float band1 = sin(p.y * 1.35 + p.x * 0.12 - time * 0.22);
      float band2 = sin(p.y * 2.45 - p.x * 0.05 + time * 0.15);
      uv.x += 0.035 * band0 + 0.014 * band1 + 0.005 * band2;
      uv.y += 0.008 * cos(p.y * 0.85 + time * 0.22)
        + 0.004 * cos(p.y * 1.75 + p.x * 0.10 - time * 0.16);

      float foreground = smoothstep(1.0, 16.0, -p.y);
      uv.y = mix(uv.y, 0.5 + (uv.y - 0.5) * 0.24, foreground);
      float radiusX = mix(24.0, 180.0, foreground) / resolution.x;
      float radiusY = mix(2.0, 6.0, foreground) / resolution.y;
      vec3 blurred = vec3(0.0);

      for (int x = -4; x <= 4; x += 1) {
        float ax = float(abs(x));
        float weightX = ax < 0.5 ? 0.06
          : ax < 1.5 ? 0.13
          : ax < 2.5 ? 0.14
          : ax < 3.5 ? 0.11
          : 0.09;
        for (int y = -1; y <= 1; y += 1) {
          float weightY = y == 0 ? 0.5 : 0.25;
          vec2 offset = vec2(float(x) * radiusX * 0.5, float(y) * radiusY);
          blurred += texture2D(tDiffuse, uv + offset).rgb * weightX * weightY;
        }
      }

      float energy = max(blurred.r, max(blurred.g, blurred.b));
      float mask = smoothstep(0.001, 0.06, energy);
      float gain = mix(0.92, 0.55, foreground);
      float lowFrequencyNoise = 0.5 + 0.5 * sin(p.y * 0.23 + sin(p.x * 0.10));
      float depthBand = 0.5 + 0.5 * sin(
        p.y * 1.1 + sin(p.x * 0.22) * 1.5 + sin(p.y * 0.31 - p.x * 0.11) * 0.6
      );
      float poolMask = smoothstep(0.25, 0.75, depthBand);
      vec3 floorBase = vec3(0.003, 0.004, 0.008) + lowFrequencyNoise * 0.002;
      vec3 liquidColor = mix(floorBase, blurred * 1.15, mask * gain * mix(0.12, 1.0, poolMask));
      gl_FragColor = vec4(liquidColor, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

function createDefaultRenderer(
  canvas: HTMLCanvasElement,
  quality: ReturnType<typeof selectShowroomQuality>,
): TimeVizRenderer {
  const renderer = new THREE.WebGLRenderer({
    alpha: false,
    antialias: quality.level !== 'low',
    canvas,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = quality.shadowsEnabled;
  renderer.setClearColor(0x05060a, 1);
  return renderer;
}

const defaultComposerResourceFactories: TimeVizComposerResourceFactories = {
  createBloomPass: () => new UnrealBloomPass(
    new THREE.Vector2(INITIAL_WIDTH, INITIAL_HEIGHT),
    0.22,
    0.25,
    0.78,
  ),
  createComposer: (renderer) => new EffectComposer(renderer) as unknown as TimeVizComposerCore,
  createOutputPass: () => new OutputPass(),
  createRenderPass: (scene, camera) => new RenderPass(scene, camera),
};

function disposeConstructionFailure(
  error: unknown,
  resources: ReadonlyArray<DisposableResource>,
): never {
  try {
    createIdempotentDisposer([...resources].reverse())();
  } catch {
    // Preserve the construction error after attempting every acquired cleanup.
  }
  throw error;
}

export function createDefaultComposer(
  rendererLike: TimeVizRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  bloomEnabled: boolean,
  factories: TimeVizComposerResourceFactories = defaultComposerResourceFactories,
): TimeVizComposer {
  const resources: DisposableResource[] = [];

  try {
    const composer = factories.createComposer(rendererLike as THREE.WebGLRenderer);
    resources.push(composer);
    const renderPass = factories.createRenderPass(scene, camera);
    resources.push(renderPass);
    composer.addPass(renderPass);

    if (bloomEnabled) {
      const bloomPass = factories.createBloomPass();
      resources.push(bloomPass);
      composer.addPass(bloomPass);
    }

    const outputPass = factories.createOutputPass();
    resources.push(outputPass);
    composer.addPass(outputPass);
    const dispose = createIdempotentDisposer([...resources].reverse());

    return {
      dispose,
      render: (deltaTime) => composer.render(deltaTime),
      setPixelRatio: (pixelRatio) => composer.setPixelRatio(pixelRatio),
      setSize: (width, height) => composer.setSize(width, height),
    };
  } catch (error) {
    return disposeConstructionFailure(error, resources);
  }
}

function reflectionSize(value: number, pixelRatio: number): number {
  return Math.max(MIN_REFLECTION_SIZE, Math.floor(value * pixelRatio * REFLECTION_RESOLUTION_SCALE));
}

const defaultFloorResourceFactories: TimeVizFloorResourceFactories = {
  createGeometry: () => new THREE.PlaneGeometry(60, 60, 128, 128),
  createReflector: (geometry, options) => new Reflector(geometry, options),
};

export function createDefaultFloor(
  rendererLike: TimeVizRenderer,
  width: number,
  height: number,
  animated: boolean,
  factories: TimeVizFloorResourceFactories = defaultFloorResourceFactories,
): TimeVizFloor {
  void rendererLike;
  const resources: DisposableResource[] = [];

  try {
    const geometry = factories.createGeometry();
    resources.push(geometry);
    const reflector = factories.createReflector(geometry, {
      clipBias: 0.002,
      color: 0x171b2a,
      multisample: 0,
      shader: floorShader,
      textureHeight: reflectionSize(height, 1),
      textureWidth: reflectionSize(width, 1),
    });
    resources.push(reflector);
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -2.45;
    reflector.position.z = -1.25;
    reflector.receiveShadow = true;
    reflector.renderOrder = -1;

    const renderTarget = reflector.getRenderTarget();
    renderTarget.texture.generateMipmaps = true;
    renderTarget.texture.magFilter = THREE.LinearFilter;
    renderTarget.texture.minFilter = THREE.LinearMipmapLinearFilter;

    const material = reflector.material as THREE.ShaderMaterial;
    material.depthWrite = false;
    const timeUniform = material.uniforms.time;
    const resolutionUniform = material.uniforms.resolution;
    resolutionUniform.value.set(
      reflectionSize(width, 1),
      reflectionSize(height, 1),
    );
    const dispose = createIdempotentDisposer([...resources].reverse());

    return {
      object: reflector,
      resize: (nextWidth, nextHeight, pixelRatio) => {
        const targetWidth = reflectionSize(nextWidth, pixelRatio);
        const targetHeight = reflectionSize(nextHeight, pixelRatio);
        renderTarget.setSize(targetWidth, targetHeight);
        resolutionUniform.value.set(targetWidth, targetHeight);
      },
      update: (elapsedSeconds) => {
        if (animated) timeUniform.value = elapsedSeconds;
      },
      dispose,
    };
  } catch (error) {
    return disposeConstructionFailure(error, resources);
  }
}

const defaultEnvironmentResourceFactories: TimeVizEnvironmentResourceFactories = {
  createPmremGenerator: (renderer) => new THREE.PMREMGenerator(renderer),
  loadSource: (url) => new RGBELoader().loadAsync(url),
};

export async function loadDefaultEnvironment(
  rendererLike: TimeVizRenderer,
  url: string,
  factories: TimeVizEnvironmentResourceFactories = defaultEnvironmentResourceFactories,
): Promise<TimeVizEnvironment> {
  const renderer = rendererLike as THREE.WebGLRenderer;
  const source = await factories.loadSource(url);
  let pmrem: TimeVizPmremGenerator | null = null;

  try {
    pmrem = factories.createPmremGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const renderTarget = pmrem.fromEquirectangular(source);
    return {
      texture: renderTarget.texture,
      dispose: () => renderTarget.dispose(),
    };
  } finally {
    source.dispose();
    pmrem?.dispose();
  }
}

function browserQualityOptions(reducedMotion: boolean): ShowroomQualityOptions {
  const width = typeof window === 'undefined' ? INITIAL_WIDTH : window.innerWidth;
  const navigatorWithMemory = typeof navigator === 'undefined'
    ? undefined
    : navigator as Navigator & { deviceMemory?: number };

  return {
    deviceMemory: navigatorWithMemory?.deviceMemory,
    hardwareConcurrency: navigatorWithMemory?.hardwareConcurrency,
    mobile: width < MOBILE_BREAKPOINT,
    prefersReducedMotion: reducedMotion,
  };
}

const defaultVoxelUniforms = {
  uTime: { value: 0 },
  uColor0: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
  uColor1: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
  uColor2: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
  uColor3: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
};

function createVoxelPhysicalMaterial(): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.68,
    clearcoatRoughness: 0.12,
    color: 0xffffff,
    metalness: 0.85,
    roughness: 0.18,
    emissive: 0x000000,
    emissiveIntensity: 0.55,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = defaultVoxelUniforms.uTime;
    shader.uniforms.uColor0 = defaultVoxelUniforms.uColor0;
    shader.uniforms.uColor1 = defaultVoxelUniforms.uColor1;
    shader.uniforms.uColor2 = defaultVoxelUniforms.uColor2;
    shader.uniforms.uColor3 = defaultVoxelUniforms.uColor3;

    shader.vertexShader = `
      varying vec3 vVoxelWorldPos;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vVoxelWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vVoxelWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif
      `
    );

    shader.fragmentShader = `
      uniform float uTime;
      uniform vec3 uColor0;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      varying vec3 vVoxelWorldPos;

      vec3 getVoxelPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
        return a + b * cos(6.28318530718 * (c * t + d));
      }

      vec3 adjustVoxelSat(vec3 col, float sat) {
        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        return mix(vec3(gray), col, sat);
      }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float voxelSpatial = vVoxelWorldPos.x * 0.14 + vVoxelWorldPos.y * 0.24 - vVoxelWorldPos.z * 0.16;
      float voxelWave = sin(vVoxelWorldPos.x * 0.09 + vVoxelWorldPos.y * 0.14) * 0.4;
      float voxelT = fract((voxelSpatial + voxelWave) * 0.36 + uTime * 0.22);
      vec3 voxelDynColor = adjustVoxelSat(getVoxelPalette(voxelT, uColor0, uColor1, uColor2, uColor3), 0.94);
      diffuseColor.rgb = voxelDynColor;
      totalEmissiveRadiance = voxelDynColor * 0.52;
      `
    );
  };

  return material;
}

const defaultDependencies: TimeVizDependencies = {
  cancelAnimationFrame: (frameId) => window.cancelAnimationFrame(frameId),
  createComposer: createDefaultComposer,
  createFloor: createDefaultFloor,
  createGeometry: () => new RoundedBoxGeometry(0.155, 0.155, 0.34, 3, 0.02),
  createMaterial: createVoxelPhysicalMaterial,
  createRenderer: createDefaultRenderer,
  loadEnvironment: loadDefaultEnvironment,
  now: () => performance.now(),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  selectQuality: selectShowroomQuality,
};

function viewportForWidth(width: number): ViewportKind {
  return width < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}

function normalizedDigits(digits: string[], capacity: number): string[] {
  return Array.from({ length: capacity }, (_, index) => {
    const value = digits[index];
    return value && (/^\d$/.test(value) || /^[A-Za-z:]$/.test(value)) ? value : '';
  });
}

export function parseDigitInstanceColor(value: string): THREE.Color {
  const hsl = /^hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)$/.exec(value);
  if (!hsl) return new THREE.Color(value);

  return new THREE.Color().setHSL(
    Number(hsl[1]) / 360,
    Number(hsl[2]) / 100,
    Number(hsl[3]) / 100,
    THREE.SRGBColorSpace,
  );
}

export async function createTimeVizScene(options: TimeVizSceneOptions): Promise<TimeVizScene> {
  if (!options.dependencies) {
    return createTslTimeVizScene(options);
  }
  const dependencies = options.dependencies ?? defaultDependencies;
  const quality = dependencies.selectQuality(browserQualityOptions(Boolean(options.reducedMotion)));
  const ownedResources: DisposableResource[] = [];
  const ownResource = <T extends DisposableResource>(
    resource: T,
    kind: CountdownResourceKind,
  ): T => {
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
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  const camera = new THREE.PerspectiveCamera(36, INITIAL_WIDTH / INITIAL_HEIGHT, 0.1, 120);
  const digitGroup = new THREE.Group();
  digitGroup.position.y = -1.05;
  const vehicleGroup = new THREE.Group();
  scene.add(digitGroup, vehicleGroup);

  let renderer: TimeVizRenderer | undefined;
  let composer: TimeVizComposer | undefined;
  let floor: TimeVizFloor | undefined;
  let cellGeometry: THREE.BufferGeometry | undefined;
  let cellMaterial: THREE.Material | undefined;
  let cellMesh: THREE.InstancedMesh | undefined;
  let environment: TimeVizEnvironment | null = null;
  let animationFrameId: number | null = null;
  let disposed = false;
  let ready = false;
  let frameCount = 0;
  let resourceCount = 0;
  let viewport: ViewportKind = 'desktop';
  let currentDigits = normalizedDigits([], getTimeVizLayout(options.mode, viewport).digitCapacity);
  let currentVehicle: THREE.Object3D | null = null;
  let previousFrameTime = dependencies.now();
  const animationStartedAt = previousFrameTime;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const instanceColor = new THREE.Color();
  quaternion.setFromEuler(new THREE.Euler(0, 0.28, 0));

  let controls: OrbitControls | null = null;
  if (typeof window !== 'undefined' && options.canvas) {
    controls = new OrbitControls(camera, options.canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minPolarAngle = 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 65;
    controls.target.set(0, -0.6, 0);
  }

  const cleanupAfterFailure = (error: unknown): never => {
    const dispose = createIdempotentDisposer([...ownedResources].reverse());
    dispose();
    throw error;
  };

  const getSnapshot = () => ({
    frameCount,
    mode: options.mode,
    ready: ready && !disposed,
    resourceCount: disposed ? 0 : resourceCount,
    viewport,
  });

  const updateCameraFraming = () => {
    const mobile = viewport === 'mobile';
    const countdown = options.mode === 'countdown';
    camera.position.set(0.5, mobile && countdown ? 0.25 : 0.4, mobile ? (countdown ? 32 : 27.5) : (countdown ? 25 : 19.2));
    camera.lookAt(0, mobile && countdown ? 0.2 : -1.2, 0);
    if (controls) {
      controls.target.set(0, mobile && countdown ? 0.2 : -0.6, 0);
      controls.update();
    }
    digitGroup.position.y = mobile ? -1.15 : -0.65;
    if (currentVehicle) applyCountdownVehiclePose(currentVehicle, viewport);
    if (floor) {
      floor.object.position.y = mobile ? (countdown ? -11.2 : -6.9) : -1.85;
      floor.object.position.z = -1.25;
    }
  };

  const applyDigits = (digits: string[], forceAll = false) => {
    if (!cellMesh) return;
    const capacity = getTimeVizLayout(options.mode, viewport).digitCapacity;
    const nextDigits = normalizedDigits(digits, capacity);
    const instances = buildDigitInstances({
      digits: nextDigits,
      mode: options.mode,
      seed: options.seed,
      viewport,
    });
    let changed = false;

    for (let digitIndex = 0; digitIndex < capacity; digitIndex += 1) {
      if (!forceAll && nextDigits[digitIndex] === currentDigits[digitIndex]) continue;
      changed = true;
      const firstCell = digitIndex * CELLS_PER_DIGIT;

      for (let cellOffset = 0; cellOffset < CELLS_PER_DIGIT; cellOffset += 1) {
        const instanceIndex = firstCell + cellOffset;
        const instance = instances[instanceIndex];
        position.set(instance.position[0], instance.position[1], instance.position[2]);
        scale.setScalar(instance.visible ? 0.95 : 0.0001);
        matrix.compose(position, quaternion, scale);
        cellMesh.setMatrixAt(instanceIndex, matrix);
      }
    }

    if (changed) cellMesh.instanceMatrix.needsUpdate = true;
    currentDigits = nextDigits;
  };

  try {
    renderer = ownResource(
      dependencies.createRenderer(options.canvas, quality),
      'renderer',
    );

    cellGeometry = ownResource(dependencies.createGeometry(), 'geometry');
    cellMaterial = ownResource(dependencies.createMaterial(), 'material');

    const capacity = getTimeVizLayout(options.mode, viewport).digitCapacity;
    const instanceCount = capacity * CELLS_PER_DIGIT;
    cellMesh = new THREE.InstancedMesh(cellGeometry, cellMaterial, instanceCount);
    cellMesh.castShadow = quality.shadowsEnabled;
    cellMesh.receiveShadow = true;
    cellMesh.frustumCulled = false;
    cellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    digitGroup.add(cellMesh);

    const initialInstances = buildDigitInstances({
      digits: currentDigits,
      mode: options.mode,
      seed: options.seed,
      viewport,
    });
    for (let index = 0; index < initialInstances.length; index += 1) {
      instanceColor.copy(parseDigitInstanceColor(initialInstances[index].color));
      cellMesh.setColorAt(index, instanceColor);
    }
    if (cellMesh.instanceColor) cellMesh.instanceColor.needsUpdate = true;
    applyDigits(currentDigits, true);

    scene.add(new THREE.HemisphereLight(0x8da6d8, 0x08090d, 1.1));
    const keyLight = new THREE.DirectionalLight(0xfff4e8, 3.8);
    keyLight.position.set(4.5, 8, 7);
    keyLight.castShadow = quality.shadowsEnabled;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x55ccff, 26, 28, 1.5);
    rimLight.position.set(-7, 2.5, 5);
    scene.add(rimLight);

    const rimLight2 = new THREE.PointLight(0xff55aa, 18, 25, 1.6);
    rimLight2.position.set(7, 2.5, 5);
    scene.add(rimLight2);

    floor = ownResource(
      dependencies.createFloor(
        renderer,
        INITIAL_WIDTH,
        INITIAL_HEIGHT,
        !quality.reducedMotion && quality.level !== 'low',
      ),
      'floor',
    );
    scene.add(floor.object);

    composer = ownResource(
      dependencies.createComposer(renderer, scene, camera, quality.bloomEnabled),
      'composer',
    );

    try {
      environment = await dependencies.loadEnvironment(renderer, ENVIRONMENT_URL);
    } catch {
      environment = null;
    }
    if (environment) {
      scene.environment = environment.texture;
      ownResource(environment, 'environment');
    }

    let disposeOwned: (() => void) | null = null;
    let releaseAnimationFrame: (() => void) | null = null;
    let renderFrame: FrameRequestCallback;
    const scheduleAnimationFrame = () => {
      animationFrameId = dependencies.requestAnimationFrame(renderFrame);
      if (options.mode === 'countdown') {
        releaseAnimationFrame = trackCountdownResource('animationFrame');
      }
    };
    renderFrame = (time) => {
      if (disposed || !composer || !floor) return;
      releaseAnimationFrame?.();
      releaseAnimationFrame = null;
      try {
        const deltaTime = Math.max(0, Math.min((time - previousFrameTime) / 1000, 0.1));
        previousFrameTime = time;
        floor.update((time - animationStartedAt) / 1000);
        defaultVoxelUniforms.uTime.value = (time - animationStartedAt) / 1000;
        controls?.update();
        composer.render(deltaTime);
        frameCount += 1;
        if (!ready) {
          ready = true;
          options.onReady?.(getSnapshot());
        }
        scheduleAnimationFrame();
      } catch (error) {
        ready = false;
        disposed = true;
        disposeOwned?.();
        throw error;
      }
    };

    scheduleAnimationFrame();
    const animationResource: DisposableResource = {
      dispose: () => {
        if (animationFrameId === null) return;
        dependencies.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        releaseAnimationFrame?.();
        releaseAnimationFrame = null;
      },
    };
    ownedResources.push(animationResource);
    resourceCount = ownedResources.length;
    updateCameraFraming();

    disposeOwned = createIdempotentDisposer([
      animationResource,
      {
        dispose: () => {
          controls?.dispose();
          controls = null;
          if (currentVehicle) vehicleGroup.remove(currentVehicle);
          currentVehicle = null;
          digitGroup.clear();
          scene.clear();
          scene.environment = null;
        },
      },
      ...ownedResources.slice(0, -1).reverse(),
    ]);

    const api: TimeVizScene = {
      setDigits: (digits) => {
        if (!disposed) applyDigits(digits);
      },
      setVehicle: (vehicle) => {
        if (disposed || vehicle === currentVehicle) return;
        if (currentVehicle) vehicleGroup.remove(currentVehicle);
        currentVehicle = vehicle;
        if (vehicle) {
          applyCountdownVehiclePose(vehicle, viewport);
          vehicleGroup.add(vehicle);
        }
      },
      resize: (width, height, pixelRatio) => {
        if (disposed || width <= 0 || height <= 0 || !renderer || !composer || !floor) return;
        const nextViewport = viewportForWidth(width);
        const cappedPixelRatio = options.mode === 'reference'
          ? 1
          : Math.max(0.5, Math.min(pixelRatio, quality.maxPixelRatio));
        renderer.setPixelRatio(cappedPixelRatio);
        renderer.setSize(width, height, false);
        composer.setPixelRatio(cappedPixelRatio);
        composer.setSize(width, height);
        floor.resize(width, height, cappedPixelRatio);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (nextViewport !== viewport) {
          viewport = nextViewport;
          updateCameraFraming();
          applyDigits(currentDigits, true);
        }
      },
      getSnapshot,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        ready = false;
        disposeOwned?.();
      },
    };
    return api;
  } catch (error) {
    return cleanupAfterFailure(error);
  }
}
