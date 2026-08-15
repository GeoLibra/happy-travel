import * as THREE from 'three';
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

import { buildDigitInstances, getTimeVizLayout, type ViewportKind } from './digit-layout';
import type {
  TimeVizComposer,
  TimeVizDependencies,
  TimeVizEnvironment,
  TimeVizFloor,
  TimeVizRenderer,
  TimeVizScene,
  TimeVizSceneOptions,
} from './time-viz-types';

const ENVIRONMENT_URL = '/environments/lythwood_room_1k.hdr';
const CELLS_PER_DIGIT = 70;
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
    displacementStrength: { value: 0.055 },
    blurAmount: { value: 0.0025 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    uniform float time;
    uniform float displacementStrength;
    varying vec4 vUv;
    varying vec2 vWaveNormal;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vec3 displaced = position;
      float xPhase = position.x * 0.72 + time * 0.35;
      float yPhase = position.y * 0.92 - time * 0.28;
      float wave = sin(xPhase) * cos(yPhase);
      displaced.z += wave * displacementStrength;

      float dx = cos(xPhase) * cos(yPhase) * 0.72;
      float dy = -sin(xPhase) * sin(yPhase) * 0.92;
      vWaveNormal = vec2(dx, dy) * displacementStrength;
      vUv = textureMatrix * vec4(displaced, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);

      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float blurAmount;
    varying vec4 vUv;
    varying vec2 vWaveNormal;

    #include <logdepthbuf_pars_fragment>

    float blendOverlay(float base, float blend) {
      return base < 0.5
        ? 2.0 * base * blend
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    }

    vec3 blendOverlay(vec3 base, vec3 blend) {
      return vec3(
        blendOverlay(base.r, blend.r),
        blendOverlay(base.g, blend.g),
        blendOverlay(base.b, blend.b)
      );
    }

    void main() {
      #include <logdepthbuf_fragment>

      vec4 projectedUv = vUv;
      projectedUv.xy += vWaveNormal * projectedUv.w * 0.14;
      vec2 blur = vec2(blurAmount * projectedUv.w);
      vec4 reflected = texture2DProj(tDiffuse, projectedUv) * 0.40;
      reflected += texture2DProj(tDiffuse, projectedUv + vec4(blur.x, 0.0, 0.0, 0.0)) * 0.15;
      reflected += texture2DProj(tDiffuse, projectedUv - vec4(blur.x, 0.0, 0.0, 0.0)) * 0.15;
      reflected += texture2DProj(tDiffuse, projectedUv + vec4(0.0, blur.y, 0.0, 0.0)) * 0.15;
      reflected += texture2DProj(tDiffuse, projectedUv - vec4(0.0, blur.y, 0.0, 0.0)) * 0.15;

      gl_FragColor = vec4(blendOverlay(reflected.rgb, color), 0.92);

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
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = quality.shadowsEnabled;
  renderer.setClearColor(0x05060a, 1);
  return renderer;
}

const defaultComposerResourceFactories: TimeVizComposerResourceFactories = {
  createBloomPass: () => new UnrealBloomPass(
    new THREE.Vector2(INITIAL_WIDTH, INITIAL_HEIGHT),
    1.1,
    0.72,
    0.16,
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
  createGeometry: () => new THREE.PlaneGeometry(34, 24, 96, 64),
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

    const renderTarget = reflector.getRenderTarget();
    renderTarget.texture.generateMipmaps = true;
    renderTarget.texture.magFilter = THREE.LinearFilter;
    renderTarget.texture.minFilter = THREE.LinearMipmapLinearFilter;

    const material = reflector.material as THREE.ShaderMaterial;
    const timeUniform = material.uniforms.time;
    const displacementUniform = material.uniforms.displacementStrength;
    if (!animated) displacementUniform.value = 0;
    const dispose = createIdempotentDisposer([...resources].reverse());

    return {
      object: reflector,
      resize: (nextWidth, nextHeight, pixelRatio) => {
        renderTarget.setSize(
          reflectionSize(nextWidth, pixelRatio),
          reflectionSize(nextHeight, pixelRatio),
        );
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

const defaultDependencies: TimeVizDependencies = {
  cancelAnimationFrame: (frameId) => window.cancelAnimationFrame(frameId),
  createComposer: createDefaultComposer,
  createFloor: createDefaultFloor,
  createGeometry: () => new RoundedBoxGeometry(0.27, 0.27, 0.34, 3, 0.055),
  createMaterial: () => new THREE.MeshPhysicalMaterial({
    clearcoat: 0.42,
    clearcoatRoughness: 0.18,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.72,
    metalness: 0.12,
    roughness: 0.22,
    vertexColors: true,
  }),
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
    return value && /^\d$/.test(value) ? value : '';
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
  const dependencies = options.dependencies ?? defaultDependencies;
  const quality = dependencies.selectQuality(browserQualityOptions(Boolean(options.reducedMotion)));
  const ownedResources: DisposableResource[] = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  const camera = new THREE.PerspectiveCamera(36, INITIAL_WIDTH / INITIAL_HEIGHT, 0.1, 120);
  const digitGroup = new THREE.Group();
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

  const cleanupAfterFailure = (error: unknown): never => {
    const dispose = createIdempotentDisposer([...ownedResources].reverse());
    dispose();
    throw error;
  };

  const updateCameraFraming = () => {
    const mobile = viewport === 'mobile';
    const countdown = options.mode === 'countdown';
    camera.position.set(0, mobile && countdown ? 0.25 : 0.4, mobile ? (countdown ? 28 : 20) : (countdown ? 25 : 18));
    camera.lookAt(0, mobile && countdown ? 0.2 : 0.35, 0);
  };

  const applyDigits = (digits: string[], forceAll = false) => {
    if (!cellMesh) return;
    const capacity = getTimeVizLayout(options.mode, viewport).digitCapacity;
    const nextDigits = normalizedDigits(digits, capacity);
    const instances = buildDigitInstances({
      digits: nextDigits,
      mode: options.mode,
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
        scale.setScalar(instance.visible ? 1 : 0.0001);
        matrix.compose(position, quaternion, scale);
        cellMesh.setMatrixAt(instanceIndex, matrix);
      }
    }

    if (changed) cellMesh.instanceMatrix.needsUpdate = true;
    currentDigits = nextDigits;
  };

  try {
    renderer = dependencies.createRenderer(options.canvas, quality);
    ownedResources.push(renderer);

    cellGeometry = dependencies.createGeometry();
    ownedResources.push(cellGeometry);
    cellMaterial = dependencies.createMaterial();
    ownedResources.push(cellMaterial);

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
      viewport,
    });
    for (let index = 0; index < initialInstances.length; index += 1) {
      instanceColor.copy(parseDigitInstanceColor(initialInstances[index].color));
      cellMesh.setColorAt(index, instanceColor);
    }
    if (cellMesh.instanceColor) cellMesh.instanceColor.needsUpdate = true;
    applyDigits(currentDigits, true);

    scene.add(new THREE.HemisphereLight(0x8da6d8, 0x08090d, 1.1));
    const keyLight = new THREE.DirectionalLight(0xfff4e8, 3.6);
    keyLight.position.set(4.5, 8, 7);
    keyLight.castShadow = quality.shadowsEnabled;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x779cff, 22, 24, 1.6);
    rimLight.position.set(-5, 2.5, 5);
    scene.add(rimLight);

    floor = dependencies.createFloor(
      renderer,
      INITIAL_WIDTH,
      INITIAL_HEIGHT,
      !quality.reducedMotion && quality.level !== 'low',
    );
    ownedResources.push(floor);
    scene.add(floor.object);

    composer = dependencies.createComposer(renderer, scene, camera, quality.bloomEnabled);
    ownedResources.push(composer);

    try {
      environment = await dependencies.loadEnvironment(renderer, ENVIRONMENT_URL);
    } catch {
      environment = null;
    }
    if (environment) {
      scene.environment = environment.texture;
      ownedResources.push(environment);
    }

    const renderFrame: FrameRequestCallback = (time) => {
      if (disposed || !composer || !floor) return;
      const deltaTime = Math.max(0, Math.min((time - previousFrameTime) / 1000, 0.1));
      previousFrameTime = time;
      floor.update((time - animationStartedAt) / 1000);
      composer.render(deltaTime);
      frameCount += 1;
      animationFrameId = dependencies.requestAnimationFrame(renderFrame);
    };

    animationFrameId = dependencies.requestAnimationFrame(renderFrame);
    const animationResource: DisposableResource = {
      dispose: () => {
        if (animationFrameId === null) return;
        dependencies.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      },
    };
    ownedResources.push(animationResource);
    resourceCount = ownedResources.length;
    ready = true;
    updateCameraFraming();

    const disposeOwned = createIdempotentDisposer([
      animationResource,
      {
        dispose: () => {
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
        if (vehicle) vehicleGroup.add(vehicle);
      },
      resize: (width, height, pixelRatio) => {
        if (disposed || width <= 0 || height <= 0 || !renderer || !composer || !floor) return;
        const nextViewport = viewportForWidth(width);
        const cappedPixelRatio = Math.max(0.5, Math.min(pixelRatio, quality.maxPixelRatio));
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
      getSnapshot: () => ({
        frameCount,
        mode: options.mode,
        ready: ready && !disposed,
        resourceCount: disposed ? 0 : resourceCount,
      }),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        ready = false;
        disposeOwned();
      },
    };

    options.onReady?.();
    return api;
  } catch (error) {
    return cleanupAfterFailure(error);
  }
}
