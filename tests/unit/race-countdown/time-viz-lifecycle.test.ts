import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultComposer,
  createDefaultFloor,
  createTimeVizScene,
  loadDefaultEnvironment,
  parseDigitInstanceColor,
} from '@/src/features/race-countdown/time-viz-scene';
import type {
  TimeVizComposer,
  TimeVizDependencies,
  TimeVizRenderer,
} from '@/src/features/race-countdown/time-viz-types';
import { countdownSnapshot } from '@/src/lib/test-observability';

function createFakeTimeVizDependencies() {
  const rendererDispose = vi.fn();
  const renderTargetDispose = vi.fn();
  const geometryDispose = vi.fn();
  const materialDispose = vi.fn();
  const floorDispose = vi.fn();
  const environmentDispose = vi.fn();
  const cancelAnimationFrame = vi.fn();
  const rendererSetPixelRatio = vi.fn();
  const composerSetPixelRatio = vi.fn();
  const composerSetSize = vi.fn();
  const composerRender = vi.fn();
  let pendingFrame: FrameRequestCallback | null = null;

  const geometry = new THREE.BoxGeometry();
  geometry.dispose = geometryDispose;
  const material = new THREE.MeshPhysicalMaterial();
  material.dispose = materialDispose;

  const dependencies: TimeVizDependencies = {
    createRenderer: () => ({
      dispose: rendererDispose,
      render: vi.fn(),
      setPixelRatio: rendererSetPixelRatio,
      setSize: vi.fn(),
    }),
    createComposer: () => ({
      dispose: renderTargetDispose,
      render: composerRender,
      setPixelRatio: composerSetPixelRatio,
      setSize: composerSetSize,
    }),
    createFloor: () => ({
      dispose: floorDispose,
      object: new THREE.Object3D(),
      resize: vi.fn(),
      update: vi.fn(),
    }),
    createGeometry: () => geometry,
    createMaterial: () => material,
    loadEnvironment: vi.fn().mockResolvedValue({
      dispose: environmentDispose,
      texture: new THREE.Texture(),
    }),
    now: () => 0,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 73;
    }),
    cancelAnimationFrame,
    selectQuality: () => ({
      bloomEnabled: true,
      level: 'high' as const,
      maxPixelRatio: 2,
      particleDensity: 1,
      reducedMotion: false,
      shadowsEnabled: true,
    }),
  };

  return {
    canvas: {} as HTMLCanvasElement,
    rendererDispose,
    renderTargetDispose,
    geometryDispose,
    materialDispose,
    floorDispose,
    environmentDispose,
    cancelAnimationFrame,
    rendererSetPixelRatio,
    composerSetPixelRatio,
    composerSetSize,
    composerRender,
    runAnimationFrame: (time = 16) => {
      if (!pendingFrame) throw new Error('No animation frame pending');
      const callback = pendingFrame;
      pendingFrame = null;
      callback(time);
    },
    dependencies,
  };
}

describe('createTimeVizScene lifecycle', () => {
  it('converts layout HSL colors into Three.js instance colors', () => {
    expect(parseDigitInstanceColor('hsl(120 100% 50%)').getHexString(THREE.SRGBColorSpace))
      .toBe('00ff00');
  });

  it('disposes every owned resource exactly once', async () => {
    const tracker = createFakeTimeVizDependencies();
    const scene = await createTimeVizScene({ canvas: tracker.canvas, dependencies: tracker.dependencies, mode: 'reference' });
    scene.dispose();
    scene.dispose();
    expect(tracker.rendererDispose).toHaveBeenCalledTimes(1);
    expect(tracker.renderTargetDispose).toHaveBeenCalledTimes(1);
    expect(tracker.geometryDispose).toHaveBeenCalledTimes(1);
    expect(tracker.materialDispose).toHaveBeenCalledTimes(1);
    expect(tracker.floorDispose).toHaveBeenCalledTimes(1);
    expect(tracker.environmentDispose).toHaveBeenCalledTimes(1);
    expect(tracker.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('keeps real countdown renderer, resources, and animation frame tracked until disposal', async () => {
    const tracker = createFakeTimeVizDependencies();
    const scene = await createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'countdown',
    });

    expect(countdownSnapshot()).toMatchObject({
      activeAnimationFrames: 1,
      composers: 1,
      environments: 1,
      floors: 1,
      geometries: 1,
      materials: 1,
      renderers: 1,
    });
    expect(countdownSnapshot().resourceCount).toBeGreaterThan(0);

    tracker.runAnimationFrame();
    expect(countdownSnapshot().activeAnimationFrames).toBe(1);

    scene.dispose();
    expect(countdownSnapshot()).toMatchObject({
      activeAnimationFrames: 0,
      composers: 0,
      environments: 0,
      floors: 0,
      geometries: 0,
      materials: 0,
      renderers: 0,
      resourceCount: 0,
    });
  });

  it('cleans renderer and geometry when material creation fails', async () => {
    const tracker = createFakeTimeVizDependencies();
    tracker.dependencies.createMaterial = () => {
      throw new Error('material failed');
    };

    await expect(createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
    })).rejects.toThrow('material failed');
    expect(tracker.geometryDispose).toHaveBeenCalledTimes(1);
    expect(tracker.rendererDispose).toHaveBeenCalledTimes(1);
  });

  it('cleans acquired scene resources when floor creation fails', async () => {
    const tracker = createFakeTimeVizDependencies();
    tracker.dependencies.createFloor = () => {
      throw new Error('floor failed');
    };

    await expect(createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
    })).rejects.toThrow('floor failed');
    expect(tracker.materialDispose).toHaveBeenCalledTimes(1);
    expect(tracker.geometryDispose).toHaveBeenCalledTimes(1);
    expect(tracker.rendererDispose).toHaveBeenCalledTimes(1);
  });

  it('cleans the floor and prior resources when composer creation fails', async () => {
    const tracker = createFakeTimeVizDependencies();
    tracker.dependencies.createComposer = () => {
      throw new Error('composer failed');
    };

    await expect(createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
    })).rejects.toThrow('composer failed');
    expect(tracker.floorDispose).toHaveBeenCalledTimes(1);
    expect(tracker.materialDispose).toHaveBeenCalledTimes(1);
    expect(tracker.geometryDispose).toHaveBeenCalledTimes(1);
    expect(tracker.rendererDispose).toHaveBeenCalledTimes(1);
  });

  it('publishes readiness only after the first composed frame', async () => {
    const tracker = createFakeTimeVizDependencies();
    const onReady = vi.fn();
    const scene = await createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
      onReady,
    });

    expect(scene.getSnapshot()).toMatchObject({
      frameCount: 0,
      ready: false,
      viewport: 'desktop',
    });
    expect(onReady).not.toHaveBeenCalled();

    tracker.runAnimationFrame();

    expect(tracker.composerRender).toHaveBeenCalledTimes(1);
    expect(scene.getSnapshot()).toMatchObject({
      frameCount: 1,
      ready: true,
      viewport: 'desktop',
    });
    expect(onReady).toHaveBeenCalledWith(scene.getSnapshot());
    expect(tracker.composerRender.mock.invocationCallOrder[0])
      .toBeLessThan(onReady.mock.invocationCallOrder[0]);
    scene.dispose();
  });

  it('cleans the loaded environment when first-frame readiness notification fails', async () => {
    const tracker = createFakeTimeVizDependencies();

    await createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
      onReady: () => {
        throw new Error('ready failed');
      },
    });
    expect(() => tracker.runAnimationFrame()).toThrow('ready failed');
    expect(tracker.environmentDispose).toHaveBeenCalledTimes(1);
    expect(tracker.floorDispose).toHaveBeenCalledTimes(1);
    expect(tracker.renderTargetDispose).toHaveBeenCalledTimes(1);
    expect(tracker.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('normalizes the isolated reference renderer to the source pixel density', async () => {
    const tracker = createFakeTimeVizDependencies();
    const scene = await createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
    });

    scene.resize(640, 360, 3);

    expect(tracker.rendererSetPixelRatio).toHaveBeenCalledWith(1);
    expect(tracker.composerSetPixelRatio).toHaveBeenCalledWith(1);
    expect(tracker.composerSetPixelRatio.mock.invocationCallOrder[0])
      .toBeLessThan(tracker.composerSetSize.mock.invocationCallOrder[0]);
    scene.dispose();
  });

  it('projects the desktop reference row into source-like viewport margins', async () => {
    const tracker = createFakeTimeVizDependencies();
    const createComposer = tracker.dependencies.createComposer;
    let renderedScene: THREE.Scene | null = null;
    let renderedCamera: THREE.PerspectiveCamera | null = null;
    tracker.dependencies.createGeometry = () => new THREE.BoxGeometry(0.16, 0.16, 0.36);
    tracker.dependencies.createComposer = (renderer, scene, camera, bloomEnabled) => {
      renderedScene = scene;
      renderedCamera = camera as THREE.PerspectiveCamera;
      return createComposer(renderer, scene, camera, bloomEnabled);
    };

    const scene = await createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
    });
    scene.setDigits(['8', '8', '8', '8', '8', '8']);
    scene.resize(1280, 720, 1);

    const camera = renderedCamera as THREE.PerspectiveCamera | null;
    const root = renderedScene as THREE.Scene | null;
    if (!camera || !root) throw new Error('Expected the scene and camera to reach the composer');
    camera.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    const digitMesh = root.getObjectByProperty('isInstancedMesh', true) as THREE.InstancedMesh | undefined;
    if (!digitMesh) throw new Error('Expected an instanced digit mesh');
    digitMesh.computeBoundingBox();
    const bounds = digitMesh.boundingBox?.clone().applyMatrix4(digitMesh.matrixWorld);
    if (!bounds) throw new Error('Expected digit bounds');

    const projected = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ].map((point) => point.project(camera));
    const left = (Math.min(...projected.map((point) => point.x)) + 1) * 640;
    const right = (Math.max(...projected.map((point) => point.x)) + 1) * 640;
    const top = (1 - Math.max(...projected.map((point) => point.y))) * 360;
    const bottom = (1 - Math.min(...projected.map((point) => point.y))) * 360;

    expect(left).toBeGreaterThanOrEqual(120);
    expect(left).toBeLessThanOrEqual(180);
    expect(right).toBeGreaterThanOrEqual(1100);
    expect(right).toBeLessThanOrEqual(1160);
    expect(top).toBeGreaterThanOrEqual(210);
    expect(top).toBeLessThanOrEqual(240);
    expect(bottom).toBeGreaterThanOrEqual(420);
    expect(bottom).toBeLessThanOrEqual(450);
    scene.dispose();
  });
});

describe('default composite factory ownership', () => {
  it('keeps static liquid distortion and uses foreground-growing horizontal Gaussian blur', () => {
    let shader: {
      vertexShader: string;
      fragmentShader: string;
      uniforms: Record<string, { value: unknown }>;
    } | undefined;
    const timeUniform = { value: 0 };
    const displacementUniform = { value: 0.075 };
    const resolutionUniform = { value: new THREE.Vector2() };
    const renderTarget = {
      dispose: vi.fn(),
      setSize: vi.fn(),
      texture: new THREE.Texture(),
    };
    const reflector = {
      dispose: vi.fn(),
      getRenderTarget: () => renderTarget,
      material: new THREE.ShaderMaterial({
        uniforms: {
          displacementStrength: displacementUniform,
          resolution: resolutionUniform,
          time: timeUniform,
        },
      }),
      position: new THREE.Vector3(),
      receiveShadow: false,
      rotation: new THREE.Euler(),
    };

    const floor = createDefaultFloor({} as TimeVizRenderer, 1280, 720, false, {
      createGeometry: () => new THREE.PlaneGeometry(),
      createReflector: (_geometry, options) => {
        shader = options.shader as typeof shader;
        return reflector as never;
      },
    });

    floor.update(12);

    expect(displacementUniform.value).toBeGreaterThan(0);
    expect(timeUniform.value).toBe(0);
    expect(shader?.vertexShader).toContain('depthWave');
    expect(shader?.fragmentShader).toContain('for (int x = -4; x <= 4; x += 1)');
    expect(shader?.fragmentShader).toContain('float foreground');
    expect(shader?.fragmentShader).toContain('radiusX');
    expect(shader?.fragmentShader).toContain('180.0');
    expect(shader?.fragmentShader).toContain('ax < 0.5 ? 0.06');
    expect(shader?.fragmentShader).toContain('/ resolution.x');
    expect(resolutionUniform.value.toArray()).toEqual([448, 251]);
    floor.dispose();
  });

  it('disposes the loaded HDR source when PMREM construction fails', async () => {
    const source = new THREE.Texture();
    const sourceDispose = vi.fn();
    source.dispose = sourceDispose;

    await expect(loadDefaultEnvironment({} as TimeVizRenderer, '/environment.hdr', {
      createPmremGenerator: () => {
        throw new Error('pmrem failed');
      },
      loadSource: vi.fn().mockResolvedValue(source),
    })).rejects.toThrow('pmrem failed');
    expect(sourceDispose).toHaveBeenCalledTimes(1);
  });

  it('disposes floor geometry when reflector construction fails', () => {
    const geometry = new THREE.PlaneGeometry();
    const geometryDispose = vi.fn();
    geometry.dispose = geometryDispose;

    expect(() => createDefaultFloor({} as TimeVizRenderer, 640, 360, true, {
      createGeometry: () => geometry,
      createReflector: () => {
        throw new Error('reflector failed');
      },
    })).toThrow('reflector failed');
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });

  it('disposes composer and render pass when bloom construction fails', () => {
    const composerDispose = vi.fn();
    const renderPassDispose = vi.fn();

    expect(() => createDefaultComposer(
      {} as TimeVizRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      true,
      {
        createBloomPass: () => {
          throw new Error('bloom failed');
        },
        createComposer: () => ({
          addPass: vi.fn(),
          dispose: composerDispose,
          render: vi.fn(),
          setPixelRatio: vi.fn(),
          setSize: vi.fn(),
        }),
        createOutputPass: vi.fn(),
        createRenderPass: () => ({ dispose: renderPassDispose }),
      },
    )).toThrow('bloom failed');
    expect(renderPassDispose).toHaveBeenCalledTimes(1);
    expect(composerDispose).toHaveBeenCalledTimes(1);
  });

  it('adds output conversion last and disposes every pass', () => {
    const addedPasses: object[] = [];
    const composerDispose = vi.fn();
    const composerSetPixelRatio = vi.fn();
    const renderPass = { dispose: vi.fn(), name: 'render' };
    const bloomPass = { dispose: vi.fn(), name: 'bloom' };
    const outputPass = { dispose: vi.fn(), name: 'output' };

    const pipeline = createDefaultComposer(
      {} as TimeVizRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      true,
      {
        createBloomPass: () => bloomPass,
        createComposer: () => ({
          addPass: (pass: object) => addedPasses.push(pass),
          dispose: composerDispose,
          render: vi.fn(),
          setPixelRatio: composerSetPixelRatio,
          setSize: vi.fn(),
        }),
        createOutputPass: () => outputPass,
        createRenderPass: () => renderPass,
      },
    ) as TimeVizComposer;

    expect(addedPasses).toEqual([renderPass, bloomPass, outputPass]);
    pipeline.setPixelRatio(1.5);
    expect(composerSetPixelRatio).toHaveBeenCalledWith(1.5);
    pipeline.dispose();
    pipeline.dispose();
    expect(outputPass.dispose).toHaveBeenCalledTimes(1);
    expect(bloomPass.dispose).toHaveBeenCalledTimes(1);
    expect(renderPass.dispose).toHaveBeenCalledTimes(1);
    expect(composerDispose).toHaveBeenCalledTimes(1);
  });

  it('adds output conversion directly after render when bloom is disabled', () => {
    const addedPasses: object[] = [];
    const renderPass = { dispose: vi.fn(), name: 'render' };
    const outputPass = { dispose: vi.fn(), name: 'output' };
    const createBloomPass = vi.fn();

    const pipeline = createDefaultComposer(
      {} as TimeVizRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      false,
      {
        createBloomPass,
        createComposer: () => ({
          addPass: (pass: object) => addedPasses.push(pass),
          dispose: vi.fn(),
          render: vi.fn(),
          setPixelRatio: vi.fn(),
          setSize: vi.fn(),
        }),
        createOutputPass: () => outputPass,
        createRenderPass: () => renderPass,
      },
    );

    expect(addedPasses).toEqual([renderPass, outputPass]);
    expect(createBloomPass).not.toHaveBeenCalled();
    pipeline.dispose();
  });
});
