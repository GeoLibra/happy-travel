import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  getF1Depth,
  getTargetSpeed,
  stepF1Motion,
  type F1MotionState,
} from '../src/lib/f1-motion';
import { resolveF1WheelNodes } from '../src/lib/f1-model';

assert.equal(getTargetSpeed(0, false), 0, 'idle progress must target zero');
assert.equal(getTargetSpeed(10, false), 0, 'an abandoned short press must stop');
assert.ok(getTargetSpeed(50, false) > 0, 'auto-completing progress must keep racing');
assert.ok(getTargetSpeed(50, true) > 0, 'an active press must accelerate');
assert.equal(getTargetSpeed(100, true), 0, 'completion must target zero');

assert.equal(getF1Depth(0), -150, 'car must begin deep in the scene');
assert.equal(getF1Depth(50), -75, 'car depth must track progress linearly');
assert.equal(getF1Depth(100), 0, 'car must finish at the hero depth');
assert.equal(getF1Depth(-10), -150, 'car depth must clamp low progress');
assert.equal(getF1Depth(120), 0, 'car depth must clamp high progress');

const accelerating: F1MotionState = { speed: 0, wheelAngle: 0 };
let previousSpeed = accelerating.speed;
for (let index = 0; index < 10; index += 1) {
  const returned = stepF1Motion(accelerating, 1, 0.016);
  assert.equal(returned, accelerating, 'motion updates must not allocate per frame');
  assert.ok(accelerating.speed > previousSpeed, 'acceleration must be monotonic');
  previousSpeed = accelerating.speed;
}

for (let index = 0; index < 120; index += 1) {
  stepF1Motion(accelerating, 0, 0.016);
}
assert.ok(accelerating.speed < 0.001, 'stopping must converge smoothly to zero');

const oneLargeStep: F1MotionState = { speed: 0.2, wheelAngle: 0 };
const twoSmallSteps: F1MotionState = { speed: 0.2, wheelAngle: 0 };
stepF1Motion(oneLargeStep, 0.9, 0.032);
stepF1Motion(twoSmallSteps, 0.9, 0.016);
stepF1Motion(twoSmallSteps, 0.9, 0.016);

assert.ok(
  Math.abs(oneLargeStep.speed - twoSmallSteps.speed) < 1e-8,
  'speed damping must be frame-rate independent',
);
assert.ok(
  Math.abs(oneLargeStep.wheelAngle - twoSmallSteps.wheelAngle) < 1e-6,
  'wheel-angle integration must be frame-rate independent',
);

const completeCar = new THREE.Group();
for (const name of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
  const wheel = new THREE.Object3D();
  wheel.name = name;
  completeCar.add(wheel);
}
const completeWarnings: string[] = [];
assert.equal(
  resolveF1WheelNodes(completeCar, (message) => completeWarnings.push(message))
    .length,
  4,
  'all exported wheel nodes must resolve',
);
assert.deepEqual(completeWarnings, [], 'a complete model must not warn');

const incompleteWarnings: string[] = [];
const incompleteCar = new THREE.Group();
const partialWheel = new THREE.Object3D();
partialWheel.name = 'Wheel_FL';
incompleteCar.add(partialWheel);
assert.equal(
  resolveF1WheelNodes(incompleteCar, (message) => incompleteWarnings.push(message))
    .length,
  1,
  'available wheels must remain usable when other nodes are missing',
);
assert.equal(incompleteWarnings.length, 1, 'missing nodes must produce one warning');
assert.match(incompleteWarnings[0], /Wheel_FR.*Wheel_RL.*Wheel_RR/);

console.log('PASS: F1 motion is smooth and frame-rate independent');
