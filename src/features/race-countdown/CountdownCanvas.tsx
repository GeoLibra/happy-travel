import { useEffect, useRef, useState } from 'react';

import { createTimeVizScene } from './time-viz-scene';
import type { CountdownCanvasProps, TimeVizScene } from './time-viz-types';

export type { CountdownCanvasProps } from './time-viz-types';

function initialReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function CountdownCanvas({
  digits,
  mode,
  vehicle = null,
  onReady,
  onWebGLFailure,
}: CountdownCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TimeVizScene | null>(null);
  const digitsRef = useRef(digits);
  const vehicleRef = useRef(vehicle);
  const onReadyRef = useRef(onReady);
  const onWebGLFailureRef = useRef(onWebGLFailure);
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);

  digitsRef.current = digits;
  vehicleRef.current = vehicle;
  onReadyRef.current = onReady;
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

    let cancelled = false;
    let createdScene: TimeVizScene | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const resize = (scene: TimeVizScene, width: number, height: number) => {
      scene.resize(width, height, window.devicePixelRatio || 1);
    };

    void createTimeVizScene({
      canvas,
      mode,
      onReady: () => onReadyRef.current?.(),
      reducedMotion,
    }).then((scene) => {
      if (cancelled) {
        scene.dispose();
        return;
      }

      createdScene = scene;
      sceneRef.current = scene;
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
    }).catch((error: unknown) => {
      if (!cancelled) onWebGLFailureRef.current?.(toError(error));
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      createdScene?.dispose();
      if (sceneRef.current === createdScene) sceneRef.current = null;
    };
  }, [mode, reducedMotion]);

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
      style={{ display: 'block', height: '100%', width: '100%' }}
    />
  );
}
