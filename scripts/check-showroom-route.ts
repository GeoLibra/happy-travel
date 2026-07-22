import assert from 'node:assert/strict';

import {
  distanceVector3D,
  interpolateRouteKeyframe,
  lerp,
  lerpVector3D,
  resampleRoutePoints,
  ShowroomRouteKeyframe,
} from '../src/lib/showroom-route.ts';

const assertNear = (actual: number, expected: number, eps = 1e-5) => {
  assert(
    Math.abs(actual - expected) < eps,
    `expected ${actual} to be near ${expected} (diff: ${Math.abs(actual - expected)})`,
  );
};

// 1. Vector Math Basics
assert.equal(lerp(0, 10, 0.5), 5);
const vLerp = lerpVector3D({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 0.5);
assert.deepEqual(vLerp, { x: 5, y: 10, z: 15 });

const dist = distanceVector3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
assert.equal(dist, 5);

// 2. Route Resampling
const originalPoints = [
  { position: { x: 0, y: 0, z: 0 } },
  { position: { x: 10, y: 0, z: 0 } },
];
const resampled = resampleRoutePoints(originalPoints, 5);
assert.equal(resampled.length, 5);

const expectedX = [0, 2.5, 5.0, 7.5, 10.0];
resampled.forEach((pt, idx) => {
  assertNear(pt.position.x, expectedX[idx]);
  assertNear(pt.position.y, 0);
  assertNear(pt.position.z, 0);
  assertNear(pt.distance ?? 0, expectedX[idx]);
});

// Edge case: Empty / single point
assert.deepEqual(resampleRoutePoints([], 5), []);
const singleResample = resampleRoutePoints([{ position: { x: 1, y: 2, z: 3 } }], 3);
assert.equal(singleResample.length, 3);
assert.deepEqual(singleResample[0].position, { x: 1, y: 2, z: 3 });

// 3. Keyframe Morph Interpolation
const keyframes: ShowroomRouteKeyframe[] = [
  { progress: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: -1 } },
  { progress: 0.5, position: { x: 10, y: 10, z: 10 }, lookAt: { x: 1, y: 1, z: 1 } },
  { progress: 1.0, position: { x: 20, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
];

// Midpoint between 0 and 0.5 -> progress 0.25
const midKeyframe = interpolateRouteKeyframe(keyframes, 0.25);
assert.equal(midKeyframe.progress, 0.25);
assertNear(midKeyframe.position.x, 5);
assertNear(midKeyframe.position.y, 5);
assertNear(midKeyframe.position.z, 5);
assertNear(midKeyframe.lookAt.x, 0.5);
assertNear(midKeyframe.lookAt.y, 0.5);
assertNear(midKeyframe.lookAt.z, 0);

// Out of bounds progress
const lowerKeyframe = interpolateRouteKeyframe(keyframes, -0.5);
assert.equal(lowerKeyframe.progress, 0);
assert.deepEqual(lowerKeyframe.position, keyframes[0].position);

const upperKeyframe = interpolateRouteKeyframe(keyframes, 1.5);
assert.equal(upperKeyframe.progress, 1.0);
assert.deepEqual(upperKeyframe.position, keyframes[2].position);

console.log('check:showroom-route passed cleanly.');
