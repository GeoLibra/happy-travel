import * as THREE from 'three';

export const F1_WHEEL_NODE_NAMES = [
  'WheelSpin_FL',
  'WheelSpin_FR',
  'WheelSpin_RL',
  'WheelSpin_RR',
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

export interface F1ExplodedPart {
  object: THREE.Object3D;
  assembledPosition: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  localBounds: THREE.Box3;
  localCorners: readonly THREE.Vector3[];
  scratch: {
    targetPosition: THREE.Vector3;
    worldCorner: THREE.Vector3;
    parentInverse: THREE.Matrix4;
    localOrigin: THREE.Vector3;
    localLift: THREE.Vector3;
  };
  settledFloorGuard: {
    amount: 0 | 1 | null;
    floorY: number;
    clearance: number;
    position: THREE.Vector3;
    parentMatrixWorld: THREE.Matrix4;
  };
  delay: number;
}

const EXPLODE_DISTANCE = 0.72;
const EXPLODE_LIFT = 0.12;
const EXPLODE_AMOUNT_SETTLED_EPSILON = 1e-4;
const POSITION_SETTLED_EPSILON_SQ = 1e-10;
const POSITION_SETTLED_EPSILON = Math.sqrt(POSITION_SETTLED_EPSILON_SQ);

const createBoxCorners = (bounds: THREE.Box3): THREE.Vector3[] => {
  const corners: THREE.Vector3[] = [];
  for (let xIndex = 0; xIndex < 2; xIndex += 1) {
    for (let yIndex = 0; yIndex < 2; yIndex += 1) {
      for (let zIndex = 0; zIndex < 2; zIndex += 1) {
        corners.push(new THREE.Vector3(
          xIndex === 0 ? bounds.min.x : bounds.max.x,
          yIndex === 0 ? bounds.min.y : bounds.max.y,
          zIndex === 0 ? bounds.min.z : bounds.max.z,
        ));
      }
    }
  }
  return corners;
};

export const getF1LocalBounds = (root: THREE.Object3D): THREE.Box3 => {
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3();
  const rootWorldInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.geometry.computeBoundingBox();
    const geometryBounds = object.geometry.boundingBox;
    if (!geometryBounds) return;

    const meshToRoot = new THREE.Matrix4().copy(rootWorldInverse).multiply(object.matrixWorld);
    for (const corner of createBoxCorners(geometryBounds)) {
      bounds.expandByPoint(corner.applyMatrix4(meshToRoot));
    }
  });

  return bounds;
};

const getObjectLocalBounds = (root: THREE.Object3D): THREE.Box3 => {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const rootWorldInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    const meshToRoot = new THREE.Matrix4().copy(rootWorldInverse).multiply(object.matrixWorld);
    for (const corner of createBoxCorners(object.geometry.boundingBox)) {
      bounds.expandByPoint(corner.applyMatrix4(meshToRoot));
    }
  });
  return bounds;
};

/**
 * Captures the model's assembled pose and calculates a stable, parent-local
 * exploded pose for every independently movable mesh node.
 */
export const createF1ExplodedParts = (root: THREE.Object3D): F1ExplodedPart[] => {
  root.updateMatrixWorld(true);

  const rootBox = new THREE.Box3().setFromObject(root);
  const rootCenterWorld = rootBox.getCenter(new THREE.Vector3());
  const candidates: THREE.Object3D[] = [];

  const collectCandidates = (object: THREE.Object3D): void => {
    if (object !== root && object.name === 'RearBodyAssembly') {
      candidates.push(object);
      return;
    }
    if (object instanceof THREE.Mesh) {
      candidates.push(object);
      return;
    }
    for (const child of object.children) collectCandidates(child);
  };
  collectCandidates(root);

  return candidates.map((object, index) => {
    // Semantic assemblies (notably the rear wing + Hard Rock panel) move as
    // one exploded-view part; ordinary mesh nodes remain independently movable.
    const localBounds = getObjectLocalBounds(object);
    const localCorners = createBoxCorners(localBounds);
    const partCenterWorld = new THREE.Box3()
      .setFromObject(object)
      .getCenter(new THREE.Vector3());
    const directionWorld = partCenterWorld.sub(rootCenterWorld);

    // The car is much longer than it is tall. Boost lateral/vertical movement
    // so the exploded silhouette remains legible from the default camera.
    directionWorld.x *= 1.35;
    directionWorld.y = Math.max(EXPLODE_LIFT, directionWorld.y * 1.8 + EXPLODE_LIFT);
    directionWorld.z *= 0.72;
    if (directionWorld.lengthSq() < 1e-6) {
      const angle = (index / Math.max(1, candidates.length)) * Math.PI * 2;
      directionWorld.set(Math.cos(angle), 0.35, Math.sin(angle));
    }
    directionWorld.normalize().multiplyScalar(EXPLODE_DISTANCE);

    const parent = object.parent;
    const offsetLocal = directionWorld.clone();
    if (parent) {
      const parentWorldRotation = new THREE.Quaternion();
      parent.getWorldQuaternion(parentWorldRotation);
      offsetLocal.applyQuaternion(parentWorldRotation.invert());
      const parentWorldScale = new THREE.Vector3();
      parent.getWorldScale(parentWorldScale);
      offsetLocal.set(
        offsetLocal.x / Math.max(Math.abs(parentWorldScale.x), 1e-6),
        offsetLocal.y / Math.max(Math.abs(parentWorldScale.y), 1e-6),
        offsetLocal.z / Math.max(Math.abs(parentWorldScale.z), 1e-6),
      );
    }

    return {
      object,
      assembledPosition: object.position.clone(),
      explodedOffset: offsetLocal,
      localBounds,
      localCorners,
      scratch: {
        targetPosition: new THREE.Vector3(),
        worldCorner: new THREE.Vector3(),
        parentInverse: new THREE.Matrix4(),
        localOrigin: new THREE.Vector3(),
        localLift: new THREE.Vector3(),
      },
      settledFloorGuard: {
        amount: null,
        floorY: Number.NaN,
        clearance: Number.NaN,
        position: new THREE.Vector3(),
        parentMatrixWorld: new THREE.Matrix4(),
      },
      delay: index / Math.max(1, candidates.length - 1) * 0.22,
    };
  });
};

export const updateF1ExplodedParts = (
  parts: F1ExplodedPart[],
  amount: number,
  delta: number,
  options?: { floorY: number; clearance: number },
): void => {
  const clampedAmount = THREE.MathUtils.clamp(amount, 0, 1);
  const safeAmount = clampedAmount <= EXPLODE_AMOUNT_SETTLED_EPSILON
    ? 0
    : clampedAmount >= 1 - EXPLODE_AMOUNT_SETTLED_EPSILON
      ? 1
      : clampedAmount;
  const damping = 1 - Math.exp(-Math.max(0, delta) * 7.5);

  for (const part of parts) {
    const localAmount = THREE.MathUtils.smoothstep(
      safeAmount,
      part.delay,
      Math.min(1, part.delay + 0.62),
    );
    const endpointAmount: 0 | 1 | null = localAmount === 0 || localAmount === 1
      ? localAmount
      : null;
    const parent = part.object.parent;
    const settledGuard = part.settledFloorGuard;
    if (
      options
      && endpointAmount !== null
      && settledGuard.amount === endpointAmount
      && settledGuard.floorY === options.floorY
      && settledGuard.clearance === options.clearance
      && part.object.position.distanceToSquared(settledGuard.position)
        <= POSITION_SETTLED_EPSILON_SQ
      && (!parent || parent.matrixWorld.equals(settledGuard.parentMatrixWorld))
    ) {
      continue;
    }
    settledGuard.amount = null;

    const target = part.scratch.targetPosition.copy(part.assembledPosition).addScaledVector(
      part.explodedOffset,
      localAmount,
    );
    if (part.object.position.distanceToSquared(target) <= POSITION_SETTLED_EPSILON_SQ) {
      part.object.position.copy(target);
    } else {
      part.object.position.lerp(target, damping);
    }

    let correction = 0;
    if (localAmount > 0 && options) {
      part.object.updateMatrixWorld(true);
      let worldMinY = Infinity;
      for (const corner of part.localCorners) {
        worldMinY = Math.min(
          worldMinY,
          part.scratch.worldCorner.copy(corner).applyMatrix4(part.object.matrixWorld).y,
        );
      }

      correction = Math.max(0, options.floorY + options.clearance - worldMinY);
      if (correction > 0 && parent) {
        part.scratch.parentInverse.copy(parent.matrixWorld).invert();
        part.scratch.localOrigin
          .set(0, 0, 0)
          .applyMatrix4(part.scratch.parentInverse);
        part.scratch.localLift
          .set(0, correction, 0)
          .applyMatrix4(part.scratch.parentInverse)
          .sub(part.scratch.localOrigin);
        part.object.position.add(part.scratch.localLift);
      }
    }

    const endpointPositionSettled = endpointAmount !== null
      && Math.abs(part.object.position.x - target.x) <= POSITION_SETTLED_EPSILON
      && Math.abs(part.object.position.z - target.z) <= POSITION_SETTLED_EPSILON
      && (
        correction > 0
        || Math.abs(part.object.position.y - target.y) <= POSITION_SETTLED_EPSILON
      );
    if (options && endpointAmount !== null && endpointPositionSettled) {
      settledGuard.amount = endpointAmount;
      settledGuard.floorY = options.floorY;
      settledGuard.clearance = options.clearance;
      settledGuard.position.copy(part.object.position);
      if (parent) settledGuard.parentMatrixWorld.copy(parent.matrixWorld);
    }
  }
};
