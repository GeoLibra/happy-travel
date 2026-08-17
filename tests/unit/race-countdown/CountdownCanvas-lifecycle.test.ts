import { describe, expect, it, vi } from 'vitest';

import { startCountdownCanvasSceneRequest } from '@/src/features/race-countdown/CountdownCanvas';
import type { TimeVizScene } from '@/src/features/race-countdown/time-viz-types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function fakeScene(): TimeVizScene {
  return {
    dispose: vi.fn(),
    getSnapshot: () => ({
      frameCount: 0,
      mode: 'reference',
      ready: true,
      resourceCount: 1,
      viewport: 'desktop',
    }),
    resize: vi.fn(),
    setDigits: vi.fn(),
    setVehicle: vi.fn(),
  };
}

describe('CountdownCanvas async scene lifecycle', () => {
  it('disposes a deferred scene without firing readiness after unmount cancellation', async () => {
    const pending = deferred<TimeVizScene>();
    const scene = fakeScene();
    const onReady = vi.fn();
    const cancel = startCountdownCanvasSceneRequest({
      factory: vi.fn().mockReturnValue(pending.promise),
      onReady,
      onScene: vi.fn(),
      options: { canvas: {} as HTMLCanvasElement, mode: 'reference' },
    });

    cancel();
    pending.resolve(scene);
    await pending.promise;
    await Promise.resolve();

    expect(onReady).not.toHaveBeenCalled();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it('ignores stale readiness when configuration starts a replacement request', async () => {
    const stalePending = deferred<TimeVizScene>();
    const currentPending = deferred<TimeVizScene>();
    const staleScene = fakeScene();
    const currentScene = fakeScene();
    const onReady = vi.fn();
    const onScene = vi.fn();

    const cancelStale = startCountdownCanvasSceneRequest({
      factory: vi.fn().mockReturnValue(stalePending.promise),
      onReady,
      onScene,
      options: { canvas: {} as HTMLCanvasElement, mode: 'reference' },
    });
    cancelStale();
    const cancelCurrent = startCountdownCanvasSceneRequest({
      factory: vi.fn().mockReturnValue(currentPending.promise),
      onReady,
      onScene,
      options: { canvas: {} as HTMLCanvasElement, mode: 'countdown' },
    });

    stalePending.resolve(staleScene);
    currentPending.resolve(currentScene);
    await Promise.all([stalePending.promise, currentPending.promise]);
    await Promise.resolve();

    expect(staleScene.dispose).toHaveBeenCalledTimes(1);
    expect(onScene).toHaveBeenCalledTimes(1);
    expect(onScene).toHaveBeenCalledWith(currentScene);
    expect(onReady).toHaveBeenCalledTimes(1);
    cancelCurrent();
    expect(currentScene.dispose).toHaveBeenCalledTimes(1);
  });
});
