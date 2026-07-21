import * as THREE from 'three';

export const ARRIVAL_SETTLED_FRAMES = 4;
export const ARRIVAL_HOLD_MS = 120;

export const getF1ScreenStableOrbitTarget = (
  cameraPosition: THREE.Vector3,
  currentViewTarget: THREE.Vector3,
  subjectCenter: THREE.Vector3,
  target: THREE.Vector3,
): THREE.Vector3 => {
  const viewDirection = currentViewTarget.clone().sub(cameraPosition);
  if (viewDirection.lengthSq() < 1e-9) return target.copy(currentViewTarget);

  viewDirection.normalize();
  const subjectDistance = Math.max(
    0.1,
    subjectCenter.clone().sub(cameraPosition).dot(viewDirection),
  );
  return target.copy(cameraPosition).addScaledVector(viewDirection, subjectDistance);
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

export const getF1ArrivalRotationTargets = (
  progress: number,
  racingSpeed: number,
  time: number,
): { x: number; y: number; z: number } => {
  const progressFactor = Math.min(1, Math.max(0, progress / 100));
  const turnFactor = Math.min(1, progressFactor * 1.25);
  return {
    x: 0,
    y: turnFactor * (Math.PI * 0.25),
    z: progress >= 100
      ? 0
      : turnFactor * 0.05
        + Math.sin(time * 10) * 0.008 * racingSpeed
        + Math.sin(time * 26) * 0.004 * racingSpeed,
  };
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
