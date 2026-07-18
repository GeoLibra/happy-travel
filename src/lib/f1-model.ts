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

export interface F1ExplodedPart {
  object: THREE.Object3D;
  assembledPosition: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  localBounds: THREE.Box3;
  delay: number;
}

const EXPLODE_DISTANCE = 0.72;
const EXPLODE_LIFT = 0.12;

const forEachBoxCorner = (
  bounds: THREE.Box3,
  visit: (corner: THREE.Vector3) => void,
): void => {
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        visit(new THREE.Vector3(x, y, z));
      }
    }
  }
};

export const getF1LocalBounds = (root: THREE.Object3D): THREE.Box3 => {
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3();
  const rootWorldInverse = root.matrixWorld.clone().invert();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.geometry.computeBoundingBox();
    const geometryBounds = object.geometry.boundingBox;
    if (!geometryBounds) return;

    const meshToRoot = rootWorldInverse.clone().multiply(object.matrixWorld);
    forEachBoxCorner(geometryBounds, (corner) => {
      bounds.expandByPoint(corner.applyMatrix4(meshToRoot));
    });
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

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    // GLB mesh nodes are the actual independently rendered car parts. Keeping
    // wrapper transforms untouched also preserves wheel-group animation.
    candidates.push(object);
  });

  return candidates.map((object, index) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const localBounds = mesh.geometry.boundingBox?.clone() ?? new THREE.Box3();
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
  const safeAmount = THREE.MathUtils.clamp(amount, 0, 1);
  const damping = 1 - Math.exp(-Math.max(0, delta) * 7.5);

  for (const part of parts) {
    const localAmount = THREE.MathUtils.smoothstep(
      safeAmount,
      part.delay,
      Math.min(1, part.delay + 0.62),
    );
    const target = part.assembledPosition.clone().addScaledVector(
      part.explodedOffset,
      localAmount,
    );
    part.object.position.lerp(target, damping);

    if (localAmount > 0 && options) {
      part.object.updateMatrixWorld(true);
      let worldMinY = Infinity;
      forEachBoxCorner(part.localBounds, (corner) => {
        worldMinY = Math.min(worldMinY, corner.applyMatrix4(part.object.matrixWorld).y);
      });

      const correction = Math.max(0, options.floorY + options.clearance - worldMinY);
      if (correction > 0 && part.object.parent) {
        const parentInverse = part.object.parent.matrixWorld.clone().invert();
        const localOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(parentInverse);
        const localLift = new THREE.Vector3(0, correction, 0)
          .applyMatrix4(parentInverse)
          .sub(localOrigin);
        part.object.position.add(localLift);
      }
    }
  }
};
