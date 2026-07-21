import assert from 'node:assert/strict';

import {
  ARRIVAL_HOLD_MS,
  ARRIVAL_SETTLED_FRAMES,
  createF1ArrivalState,
  dampF1ArrivalValue,
  getF1ScreenStableOrbitTarget,
  getF1ArrivalRotationTargets,
  stepF1ArrivalState,
} from '../src/lib/f1-arrival-motion';
import * as THREE from 'three';

assert.equal(ARRIVAL_SETTLED_FRAMES, 4);
assert.equal(ARRIVAL_HOLD_MS, 120);

const first = dampF1ArrivalValue(-2, 0, 1 / 60, 8);
assert(first > -2 && first < 0, 'arrival damping must approach without snapping');
assert.equal(dampF1ArrivalValue(1, 3, 0, 8), 1, 'zero delta must preserve the current value');
assert.equal(getF1ArrivalRotationTargets(100, 1, 12).x, 0, 'stopped arrival must flatten pitch');
assert.equal(getF1ArrivalRotationTargets(100, 1, 12).z, 0, 'stopped arrival must clear transient roll');
assert.equal(getF1ArrivalRotationTargets(80, 0.5, 12).z !== 0, true, 'in-flight arrival may retain a subtle lean');

const cameraPosition = new THREE.Vector3(0, 0, 50);
const originalViewTarget = new THREE.Vector3(0, 0, 0);
const carCenter = new THREE.Vector3(8, -10, -4);
const stableOrbitTarget = getF1ScreenStableOrbitTarget(
  cameraPosition,
  originalViewTarget,
  carCenter,
  new THREE.Vector3(),
);
const originalViewDirection = originalViewTarget.clone().sub(cameraPosition).normalize();
const committedViewDirection = stableOrbitTarget.clone().sub(cameraPosition).normalize();
assert(originalViewDirection.distanceTo(committedViewDirection) < 1e-9, 'orbit target commit must preserve the arrival view direction');
assert.equal(stableOrbitTarget.x, 0, 'screen-stable orbit target must stay on the existing view ray');
assert.equal(stableOrbitTarget.y, 0, 'screen-stable orbit target must not lift the stopped car in screen space');

const state = createF1ArrivalState();
for (let frame = 0; frame < ARRIVAL_SETTLED_FRAMES - 1; frame += 1) {
  assert.equal(stepF1ArrivalState(state, true, true, 1 / 60), false);
}
assert.equal(stepF1ArrivalState(state, true, true, 1 / 60), false, 'four settled frames start the hold');
for (let frame = 0; frame < 6; frame += 1) {
  assert.equal(stepF1ArrivalState(state, true, true, 1 / 60), false);
}
assert.equal(stepF1ArrivalState(state, true, true, 1 / 60), true, '120 ms hold unlocks the studio');
assert.equal(state.ready, true);

const resetState = createF1ArrivalState();
stepF1ArrivalState(resetState, true, true, 1 / 60);
stepF1ArrivalState(resetState, false, false, 1 / 60);
assert.equal(resetState.settledFrames, 0);
assert.equal(resetState.holdSeconds, 0);
assert.equal(resetState.ready, false);

console.log('PASS: F1 arrival settles for four frames and holds before studio reveal');
