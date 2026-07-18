import assert from 'node:assert/strict';
import {
  CAR_DRAG_TOLERANCE_PX,
  CAR_HOLD_DELAY_MS,
  canStartCarHold,
  classifyCarRelease,
  stepStudioReveal,
} from '../src/lib/f1-showroom-interaction';

let reveal = 0;
for (let index = 0; index < 36; index += 1) reveal = stepStudioReveal(reveal, true, 1 / 60);
assert(reveal > 0.98, 'floor must finish its 600 ms reveal');
for (let index = 0; index < 36; index += 1) reveal = stepStudioReveal(reveal, false, 1 / 60);
assert(reveal < 0.02, 'floor must hide before the stopped state');

const base = {
  elapsedMs: CAR_HOLD_DELAY_MS,
  travelPx: 0,
  startedOnCar: true,
  stopped: true,
  exploded: false,
};
assert.equal(canStartCarHold(base), true);
assert.equal(canStartCarHold({ ...base, exploded: true }), false);
assert.equal(canStartCarHold({ ...base, travelPx: CAR_DRAG_TOLERANCE_PX + 1 }), false);
assert.equal(classifyCarRelease({ ...base, holdStarted: true }), 'end-hold');
assert.equal(classifyCarRelease({ ...base, elapsedMs: 100, holdStarted: false }), 'toggle');
assert.equal(classifyCarRelease({ ...base, travelPx: CAR_DRAG_TOLERANCE_PX + 1, holdStarted: false }), 'ignore');
