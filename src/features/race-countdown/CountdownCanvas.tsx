import { useEffect, useRef, useState } from 'react';

import {
  countdownResourceSnapshot,
  registerScene,
  trackCountdownResource,
} from '@/src/lib/test-observability';

import { createTimeVizScene } from './time-viz-scene';
import type {
  CountdownCanvasProps,
  TimeVizScene,
  TimeVizSceneOptions,
  TimeVizSceneSnapshot,
} from './time-viz-types';

export type { CountdownCanvasProps } from './time-viz-types';

function initialReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export interface CountdownCanvasSceneRequest {
  factory?: (options: TimeVizSceneOptions) => Promise<TimeVizScene>;
  options: TimeVizSceneOptions;
  onScene(scene: TimeVizScene): void;
  onReady?: () => void;
  onFailure?: (error: Error) => void;
}

export function startCountdownCanvasSceneRequest({
  factory = createTimeVizScene,
  options,
  onScene,
  onReady,
  onFailure,
}: CountdownCanvasSceneRequest): () => void {
  let cancelled = false;
  let activeScene: TimeVizScene | null = null;

  void factory(options).then((scene) => {
    if (cancelled) {
      scene.dispose();
      return;
    }

    activeScene = scene;
    try {
      onScene(scene);
      onReady?.();
    } catch (error) {
      activeScene = null;
      scene.dispose();
      onFailure?.(toError(error));
    }
  }, (error: unknown) => {
    if (!cancelled) onFailure?.(toError(error));
  });

  return () => {
    if (cancelled) return;
    cancelled = true;
    activeScene?.dispose();
    activeScene = null;
  };
}

export function CountdownCanvas({
  digits,
  mode,
  seed,
  vehicle = null,
  onReady,
  onSnapshot,
  onWebGLFailure,
}: CountdownCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TimeVizScene | null>(null);
  const digitsRef = useRef(digits);
  const vehicleRef = useRef(vehicle);
  const onReadyRef = useRef(onReady);
  const onSnapshotRef = useRef(onSnapshot);
  const onWebGLFailureRef = useRef(onWebGLFailure);
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);

  digitsRef.current = digits;
  vehicleRef.current = vehicle;
  onReadyRef.current = onReady;
  onSnapshotRef.current = onSnapshot;
  onWebGLFailureRef.current = onWebGLFailure;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let createdScene: TimeVizScene | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unregisterCountdownScene: (() => void) | null = null;

    const handleContextLost = () => {
      onWebGLFailureRef.current?.(new Error('Countdown WebGL context lost'));
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    const releaseContextListener = mode === 'countdown'
      ? trackCountdownResource('listener')
      : () => {};

    const publishSnapshot = (snapshot: TimeVizSceneSnapshot) => {
      onSnapshotRef.current?.(snapshot);
    };

    const resize = (scene: TimeVizScene, width: number, height: number) => {
      scene.resize(width, height, window.devicePixelRatio || 1);
      publishSnapshot(scene.getSnapshot());
    };

    const cancelRequest = startCountdownCanvasSceneRequest({
      onFailure: (error) => onWebGLFailureRef.current?.(error),
      onScene: (scene) => {
        createdScene = scene;
        sceneRef.current = scene;
        if (mode === 'countdown') {
          unregisterCountdownScene = registerScene('race-countdown', () => {
            const snapshot = scene.getSnapshot();
            const resources = countdownResourceSnapshot();
            return {
              sceneId: 'race-countdown',
              phase: snapshot.ready ? 'ready' : 'initializing',
              geometries: resources.geometries,
              textures: resources.environments,
              programs: 0,
              activeAnimationFrames: resources.activeAnimationFrames,
              activeListeners: resources.activeListeners,
              activeRenderTargets: resources.composers + resources.floors,
              materials: resources.materials,
              details: { ...snapshot, resources },
            };
          });
        }
        scene.setDigits(digitsRef.current);
        scene.setVehicle(vehicleRef.current);

        const rect = canvas.getBoundingClientRect();
        resize(scene, rect.width || canvas.clientWidth, rect.height || canvas.clientHeight);

        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          resize(scene, entry.contentRect.width, entry.contentRect.height);
        });
        resizeObserver.observe(canvas);
      },
      options: {
        canvas,
        mode,
        onReady: (snapshot) => {
          publishSnapshot(snapshot);
          onReadyRef.current?.(snapshot);
        },
        seed,
        reducedMotion,
      },
    });

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      releaseContextListener();
      resizeObserver?.disconnect();
      try {
        cancelRequest();
      } finally {
        unregisterCountdownScene?.();
      }
      if (sceneRef.current === createdScene) sceneRef.current = null;
    };
  }, [mode, reducedMotion, seed]);

  useEffect(() => {
    sceneRef.current?.setDigits(digits);
  }, [digits]);

  useEffect(() => {
    sceneRef.current?.setVehicle(vehicle);
  }, [vehicle]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-time-viz-canvas
      style={{ display: 'block', height: '100%', width: '100%' }}
    />
  );
}
