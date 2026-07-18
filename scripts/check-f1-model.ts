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
const cachedPartResources = parts.map((part) => {
  const cachedPart = part as typeof part & {
    localCorners?: readonly THREE.Vector3[];
    scratch?: object;
  };
  assert.equal(
    cachedPart.localCorners?.length,
    8,
    'each exploded part must cache its eight local bounds corners once',
  );
  assert(cachedPart.scratch, 'each exploded part must cache per-frame scratch math objects');
  return {
    corners: cachedPart.localCorners,
    scratch: cachedPart.scratch,
  };
});
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

const clearance = 0.01;
const floorY = new THREE.Box3().setFromObject(root).min.y - clearance;
const assertEveryPartClearsFloor = (phase: string, frame: number): void => {
  root.updateMatrixWorld(true);
  for (const part of parts) {
    assert(
      new THREE.Box3().setFromObject(part.object).min.y >= floorY + clearance - 1e-4,
      `${phase} frame ${frame}: every part must retain floor clearance`,
    );
  }
};

for (let frame = 0; frame <= 120; frame += 1) {
  updateF1ExplodedParts(parts, frame / 120, 1 / 60, { floorY, clearance });
  assertEveryPartClearsFloor('explosion', frame);
}
for (let frame = 0; frame <= 120; frame += 1) {
  updateF1ExplodedParts(parts, 1 - frame / 120, 1 / 60, { floorY, clearance });
  assertEveryPartClearsFloor('reassembly', frame);
}

parts.forEach((part, index) => {
  const cachedPart = part as typeof part & {
    localCorners?: readonly THREE.Vector3[];
    scratch?: object;
  };
  assert.equal(
    cachedPart.localCorners,
    cachedPartResources[index].corners,
    'animation must reuse the same cached bounds-corner array',
  );
  assert.equal(
    cachedPart.scratch,
    cachedPartResources[index].scratch,
    'animation must reuse the same per-part scratch objects',
  );
});
