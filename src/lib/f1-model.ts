import * as THREE from 'three';

export const F1_WHEEL_NODE_NAMES = [
  'Wheel_FL',
  'Wheel_FR',
  'Wheel_RL',
  'Wheel_RR',
] as const;

export const resolveF1WheelNodes = (
  root: THREE.Object3D,
  warn: (message: string) => void = console.warn,
): THREE.Object3D[] => {
  const wheels: THREE.Object3D[] = [];
  const missing: string[] = [];

  for (const name of F1_WHEEL_NODE_NAMES) {
    const wheel = root.getObjectByName(name);
    if (wheel) {
      wheels.push(wheel);
    } else {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    warn(`[F1] Missing wheel nodes: ${missing.join(', ')}`);
  }

  return wheels;
};
