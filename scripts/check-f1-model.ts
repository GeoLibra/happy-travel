import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createF1ExplodedParts,
  getF1LocalBounds,
  updateF1ExplodedParts,
} from '../src/lib/f1-model';

const root = new THREE.Group();
const upper = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2));
upper.position.set(0.8, 1.2, 0);
const lower = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1));
lower.position.set(-0.8, 0.25, 0);
root.add(upper, lower);
root.rotation.z = 0.08;
root.scale.setScalar(3);
root.updateMatrixWorld(true);

const assertApproximatelyEqual = (actual: number, expected: number, message: string): void => {
  assert(Math.abs(actual - expected) <= 1e-6, `${message}: expected ${expected}, received ${actual}`);
};

const bounds = getF1LocalBounds(root);
const expectedMin = new THREE.Vector3(-1.3, 0.05, -1);
const expectedMax = new THREE.Vector3(1.3, 1.7, 1);
for (const axis of ['x', 'y', 'z'] as const) {
  assertApproximatelyEqual(bounds.min[axis], expectedMin[axis], `root-local minimum ${axis}`);
  assertApproximatelyEqual(bounds.max[axis], expectedMax[axis], `root-local maximum ${axis}`);
}

const parts = createF1ExplodedParts(root);
for (const part of parts) {
  assert(part.object.parent, 'fixture mesh must have a parent');
  const explodedPosition = part.assembledPosition.clone().add(part.explodedOffset);
  const parentLocalOffset = explodedPosition.sub(part.assembledPosition);
  const parentWorldLinearTransform = new THREE.Matrix3().setFromMatrix4(
    part.object.parent.matrixWorld,
  );
  const worldOffset = parentLocalOffset.applyMatrix3(parentWorldLinearTransform);
  assert(worldOffset.y >= -1e-9, 'exploded offset must not point downward in world space');
}
for (let index = 0; index < 120; index += 1) {
  updateF1ExplodedParts(parts, 1, 1 / 60, { floorY: -0.01, clearance: 0.01 });
  root.updateMatrixWorld(true);
}
for (const part of parts) {
  assert(new THREE.Box3().setFromObject(part.object).min.y >= -1e-4, 'part must stay above floor');
}
