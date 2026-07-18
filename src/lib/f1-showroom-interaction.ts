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

export interface CarGestureBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface MutableRefValue<T> {
  current: T;
}

export interface ShowroomPointerLayerInput {
  carHit: boolean;
  interactiveUiHit: boolean;
}

export const classifyShowroomPointerLayer = ({
  carHit,
  interactiveUiHit,
}: ShowroomPointerLayerInput): 'car' | 'ui' | 'background' => {
  if (carHit) return 'car';
  if (interactiveUiHit) return 'ui';
  return 'background';
};

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

export const isAdditionalCarGesturePointer = (
  activePointerId: number | null,
  incomingPointerId: number,
): boolean => activePointerId !== null && activePointerId !== incomingPointerId;

export const isPointInsideCarGestureBounds = (
  clientX: number,
  clientY: number,
  bounds: CarGestureBounds,
): boolean => (
  clientX >= bounds.left
  && clientX <= bounds.right
  && clientY >= bounds.top
  && clientY <= bounds.bottom
);

export const markF1ManualInteraction = <Timer>(
  hasManualInteraction: MutableRefValue<boolean>,
  pendingAutoExplosion: MutableRefValue<Timer | null>,
  clearTimer: (timer: Timer) => void,
): void => {
  hasManualInteraction.current = true;
  if (pendingAutoExplosion.current === null) return;
  clearTimer(pendingAutoExplosion.current);
  pendingAutoExplosion.current = null;
};

export const classifyCarRelease = (
  input: CarGestureInput & { holdStarted: boolean },
): 'toggle' | 'end-hold' | 'ignore' => {
  if (input.holdStarted) return 'end-hold';
  if (
    !input.startedOnCar
    || !input.stopped
    || input.travelPx > CAR_DRAG_TOLERANCE_PX
  ) return 'ignore';
  if (input.exploded) {
    return input.elapsedMs < CAR_HOLD_DELAY_MS ? 'toggle' : 'ignore';
  }
  return input.elapsedMs >= CAR_HOLD_DELAY_MS ? 'end-hold' : 'toggle';
};
