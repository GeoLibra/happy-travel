export const STUDIO_REVEAL_MS = 600;
export const CAR_HOLD_DELAY_MS = 260;
export const CAR_DRAG_TOLERANCE_PX = 8;

export interface CarGestureInput {
  elapsedMs: number;
  travelPx: number;
  startedOnCar: boolean;
  stopped: boolean;
  exploded: boolean;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const stepStudioReveal = (
  current: number,
  stopped: boolean,
  rawDelta: number,
): number => {
  const delta = Math.min(0.1, Math.max(0, rawDelta));
  const step = delta / (STUDIO_REVEAL_MS / 1000);
  return clamp01(current + (stopped ? step : -step));
};

export const canStartCarHold = (input: CarGestureInput): boolean =>
  input.startedOnCar
  && input.stopped
  && !input.exploded
  && input.elapsedMs >= CAR_HOLD_DELAY_MS
  && input.travelPx <= CAR_DRAG_TOLERANCE_PX;

export const classifyCarRelease = (
  input: CarGestureInput & { holdStarted: boolean },
): 'toggle' | 'end-hold' | 'ignore' => {
  if (input.holdStarted) return 'end-hold';
  if (
    input.startedOnCar
    && input.stopped
    && input.travelPx <= CAR_DRAG_TOLERANCE_PX
    && input.elapsedMs < CAR_HOLD_DELAY_MS
  ) return 'toggle';
  return 'ignore';
};
