import * as THREE from 'three';

export interface F1WheelMotionState {
  velocity: number;
  angle: number;
  holdIntensity: number;
}

export const createF1WheelMotionState = (): F1WheelMotionState => ({
  velocity: 0,
  angle: 0,
  holdIntensity: 0,
});

export const getF1WheelRenderAngle = (
  arrivalAngle: number,
  holdAngle: number,
  reducedMotion: boolean,
): number => reducedMotion ? 0 : arrivalAngle + holdAngle;

export const stepF1WheelMotion = (
  state: F1WheelMotionState,
  held: boolean,
  rawDelta: number,
  reduced: boolean,
): void => {
  const delta = Math.min(Math.max(rawDelta, 0), 0.05);
  const targetHold = held ? 1 : 0;
  const holdRate = held ? 20 : 8.5;
  state.holdIntensity += (targetHold - state.holdIntensity) * (1 - Math.exp(-holdRate * delta));

  const targetVelocity = held && !reduced ? 13 : 0;
  const velocityRate = held ? 8 : 3.2;
  state.velocity += (targetVelocity - state.velocity) * (1 - Math.exp(-velocityRate * delta));
  state.angle = (state.angle + state.velocity * delta) % (Math.PI * 2);
};

export const applyF1WheelAngle = (wheels: THREE.Object3D[], angle: number): void => {
  for (const wheel of wheels) wheel.rotation.x = angle;
};
