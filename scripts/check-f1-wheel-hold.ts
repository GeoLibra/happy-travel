import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyF1WheelAngle, createF1WheelMotionState, stepF1WheelMotion } from '../src/lib/f1-wheel-motion';

const state = createF1WheelMotionState();
for (let i = 0; i < 60; i++) stepF1WheelMotion(state, true, 1 / 60, false);
assert(state.velocity > 4);
assert(state.holdIntensity > 0.95);
const releaseVelocity = state.velocity;
for (let i = 0; i < 30; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < releaseVelocity && state.velocity > 0);
for (let i = 0; i < 180; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < 0.02);
assert(state.holdIntensity < 0.02);

const wheel = new THREE.Group();
wheel.position.set(1, 2, 3);
wheel.rotation.set(0.1, 0.2, 0.3);
applyF1WheelAngle([wheel], 1.25);
assert.deepEqual(wheel.position.toArray(), [1, 2, 3]);
assert.equal(wheel.rotation.x, 1.25);
assert.equal(wheel.rotation.y, 0.2);
assert.equal(wheel.rotation.z, 0.3);
