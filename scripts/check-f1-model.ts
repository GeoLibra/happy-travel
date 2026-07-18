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

const bounds = getF1LocalBounds(root);
assert(bounds.min.x < bounds.max.x && bounds.min.y < bounds.max.y && bounds.min.z < bounds.max.z);

const parts = createF1ExplodedParts(root);
for (const part of parts) assert(part.explodedOffset.y >= 0, 'exploded offset must not point downward');
for (let index = 0; index < 120; index += 1) {
  updateF1ExplodedParts(parts, 1, 1 / 60, { floorY: -0.01, clearance: 0.01 });
  root.updateMatrixWorld(true);
}
for (const part of parts) {
  assert(new THREE.Box3().setFromObject(part.object).min.y >= -1e-4, 'part must stay above floor');
}
