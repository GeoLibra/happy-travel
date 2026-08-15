import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  createTimeVizScene,
  parseDigitInstanceColor,
} from '@/src/features/race-countdown/time-viz-scene';

function createFakeTimeVizDependencies() {
  const rendererDispose = vi.fn();
  const renderTargetDispose = vi.fn();
  const geometryDispose = vi.fn();
  const materialDispose = vi.fn();
  const cancelAnimationFrame = vi.fn();

  const geometry = new THREE.BoxGeometry();
  geometry.dispose = geometryDispose;
  const material = new THREE.MeshPhysicalMaterial();
  material.dispose = materialDispose;

  return {
    canvas: {} as HTMLCanvasElement,
    rendererDispose,
    renderTargetDispose,
    geometryDispose,
    materialDispose,
    cancelAnimationFrame,
    dependencies: {
      createRenderer: () => ({
        dispose: rendererDispose,
        outputColorSpace: THREE.SRGBColorSpace,
        render: vi.fn(),
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
        shadowMap: { enabled: false },
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }),
      createComposer: () => ({
        dispose: renderTargetDispose,
        render: vi.fn(),
        setSize: vi.fn(),
      }),
      createFloor: () => ({
        dispose: vi.fn(),
        object: new THREE.Object3D(),
        resize: vi.fn(),
        update: vi.fn(),
      }),
      createGeometry: () => geometry,
      createMaterial: () => material,
      loadEnvironment: vi.fn().mockResolvedValue(null),
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
    },
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
    expect(tracker.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
