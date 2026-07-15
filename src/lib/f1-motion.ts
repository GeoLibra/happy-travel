const SPEED_RESPONSE = 5.5;
const MAX_WHEEL_ANGULAR_SPEED = 85;
const TWO_PI = Math.PI * 2;

export interface F1MotionState {
  speed: number;
  wheelAngle: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const getF1Depth = (progress: number): number =>
  -150 + clamp01(progress / 100) * 150;

export const getTargetSpeed = (progress: number, isPressing: boolean): number => {
  const normalizedProgress = clamp01(progress / 100);

  if (
    normalizedProgress <= 0 ||
    normalizedProgress >= 1 ||
    (!isPressing && progress < 30)
  ) {
    return 0;
  }

  return normalizedProgress * normalizedProgress * (3 - 2 * normalizedProgress);
};

export const stepF1Motion = (
  state: F1MotionState,
  targetSpeed: number,
  delta: number,
): F1MotionState => {
  const safeDelta = Math.min(0.1, Math.max(0, delta));
  const target = clamp01(targetSpeed);
  const previousSpeed = clamp01(state.speed);
  const decay = Math.exp(-SPEED_RESPONSE * safeDelta);
  const nextSpeed = target + (previousSpeed - target) * decay;

  const integratedSpeed =
    target * safeDelta +
    ((previousSpeed - target) * (1 - decay)) / SPEED_RESPONSE;

  state.speed = nextSpeed < 1e-6 ? 0 : nextSpeed;
  state.wheelAngle =
    (state.wheelAngle + integratedSpeed * MAX_WHEEL_ANGULAR_SPEED) % TWO_PI;

  return state;
};
