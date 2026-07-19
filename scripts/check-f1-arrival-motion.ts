import assert from 'node:assert/strict';

import {
  ARRIVAL_HOLD_MS,
  ARRIVAL_SETTLED_FRAMES,
  createF1ArrivalState,
  dampF1ArrivalValue,
  getF1ArrivalCameraBlend,
  stepF1ArrivalState,
} from '../src/lib/f1-arrival-motion';

assert.equal(ARRIVAL_SETTLED_FRAMES, 4);
assert.equal(ARRIVAL_HOLD_MS, 120);

const first = dampF1ArrivalValue(-2, 0, 1 / 60, 8);
assert(first > -2 && first < 0, 'arrival damping must approach without snapping');
assert.equal(dampF1ArrivalValue(1, 3, 0, 8), 1, 'zero delta must preserve the current value');

assert.equal(getF1ArrivalCameraBlend(82), 0, 'camera retargeting must begin before the stop');
assert.equal(getF1ArrivalCameraBlend(91), 0.5, 'camera retargeting must be halfway before completion');
assert.equal(getF1ArrivalCameraBlend(100), 1, 'camera target must already be final at the stop');
assert.equal(getF1ArrivalCameraBlend(120), 1, 'camera retargeting must clamp above completion');

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
