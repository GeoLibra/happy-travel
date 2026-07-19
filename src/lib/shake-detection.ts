export interface ShakeState {
  lastX: number;
  lastY: number;
  lastZ: number;
  lastTime: number;
  initialized: boolean;
}

export interface MotionSample {
  x: number | null;
  y: number | null;
  z: number | null;
}

export const SHAKE_SAMPLE_INTERVAL_MS = 100;
export const SHAKE_THRESHOLD = 1000;

export const EMPTY_SHAKE_STATE: ShakeState = {
  lastX: 0,
  lastY: 0,
  lastZ: 0,
  lastTime: 0,
  initialized: false,
};

export function stepShakeDetection(
  state: ShakeState,
  sample: MotionSample,
  now: number,
  modalOpen: boolean,
) {
  const { x, y, z } = sample;
  if (x === null || y === null || z === null) return { state, detected: false };

  if (!state.initialized) {
    return {
      state: { lastX: x, lastY: y, lastZ: z, lastTime: now, initialized: true },
      detected: false,
    };
  }

  const elapsed = now - state.lastTime;
  if (elapsed <= SHAKE_SAMPLE_INTERVAL_MS) return { state, detected: false };

  const speed = (
    (Math.abs(x - state.lastX) + Math.abs(y - state.lastY) + Math.abs(z - state.lastZ))
    / elapsed
  ) * 10000;

  return {
    state: { lastX: x, lastY: y, lastZ: z, lastTime: now, initialized: true },
    detected: speed > SHAKE_THRESHOLD && !modalOpen,
  };
}
