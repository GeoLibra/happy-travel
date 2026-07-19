export const ARRIVAL_SETTLED_FRAMES = 4;
export const ARRIVAL_HOLD_MS = 120;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const getF1ArrivalCameraBlend = (progress: number): number => {
  const t = clamp01((progress - 82) / 18);
  return t * t * (3 - 2 * t);
};

export interface F1ArrivalState {
  settledFrames: number;
  holdSeconds: number;
  ready: boolean;
}

export const createF1ArrivalState = (): F1ArrivalState => ({
  settledFrames: 0,
  holdSeconds: 0,
  ready: false,
});

export const dampF1ArrivalValue = (
  current: number,
  target: number,
  rawDelta: number,
  smoothing: number,
): number => {
  const delta = Math.min(0.1, Math.max(0, rawDelta));
  return current + (target - current) * (1 - Math.exp(-Math.max(0, smoothing) * delta));
};

export const stepF1ArrivalState = (
  state: F1ArrivalState,
  stopped: boolean,
  poseSettled: boolean,
  rawDelta: number,
): boolean => {
  if (!stopped || !poseSettled) {
    state.settledFrames = 0;
    state.holdSeconds = 0;
    state.ready = false;
    return false;
  }

  state.settledFrames = Math.min(ARRIVAL_SETTLED_FRAMES, state.settledFrames + 1);
  if (state.settledFrames >= ARRIVAL_SETTLED_FRAMES) {
    state.holdSeconds += Math.min(0.1, Math.max(0, rawDelta));
  }
  state.ready = state.holdSeconds * 1000 >= ARRIVAL_HOLD_MS;
  return state.ready;
};
