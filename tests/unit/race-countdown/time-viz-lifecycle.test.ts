import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultComposer,
  createDefaultFloor,
  createTimeVizScene,
  parseDigitInstanceColor,
} from '@/src/features/race-countdown/time-viz-scene';
import type {
  TimeVizComposer,
  TimeVizDependencies,
  TimeVizRenderer,
} from '@/src/features/race-countdown/time-viz-types';

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
      render: vi.fn(),
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
    requestAnimationFrame: vi.fn().mockReturnValue(73),
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

  it('cleans the loaded environment when readiness notification fails', async () => {
    const tracker = createFakeTimeVizDependencies();

    await expect(createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
      onReady: () => {
        throw new Error('ready failed');
      },
    })).rejects.toThrow('ready failed');
    expect(tracker.environmentDispose).toHaveBeenCalledTimes(1);
    expect(tracker.floorDispose).toHaveBeenCalledTimes(1);
    expect(tracker.renderTargetDispose).toHaveBeenCalledTimes(1);
    expect(tracker.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('forwards the selected pixel-ratio cap to renderer and composer before sizing', async () => {
    const tracker = createFakeTimeVizDependencies();
    const scene = await createTimeVizScene({
      canvas: tracker.canvas,
      dependencies: tracker.dependencies,
      mode: 'reference',
    });

    scene.resize(640, 360, 3);

    expect(tracker.rendererSetPixelRatio).toHaveBeenCalledWith(2);
    expect(tracker.composerSetPixelRatio).toHaveBeenCalledWith(2);
    expect(tracker.composerSetPixelRatio.mock.invocationCallOrder[0])
      .toBeLessThan(tracker.composerSetSize.mock.invocationCallOrder[0]);
    scene.dispose();
  });
});

describe('default composite factory ownership', () => {
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
