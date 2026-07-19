import assert from 'node:assert/strict';
import {
  CAR_DRAG_TOLERANCE_PX,
  CAR_HOLD_DELAY_MS,
  canStartCarHold,
  classifyCarRelease,
  classifyShowroomPointerLayer,
  isAdditionalCarGesturePointer,
  isPointInsideCarGestureBounds,
  stepStudioReveal,
} from '../src/lib/f1-showroom-interaction';

assert.equal(
  classifyShowroomPointerLayer({ carHit: true, interactiveUiHit: true }),
  'car',
  'a visible car ray hit must win over welcome UI beneath it',
);
assert.equal(
  classifyShowroomPointerLayer({ carHit: false, interactiveUiHit: true }),
  'ui',
  'an exposed welcome control must remain operable when the car ray misses',
);
assert.equal(
  classifyShowroomPointerLayer({ carHit: false, interactiveUiHit: false }),
  'background',
  'empty canvas space must remain available to OrbitControls',
);

let reveal = 0;
for (let index = 0; index < 42; index += 1) reveal = stepStudioReveal(reveal, true, 1 / 60);
assert(reveal > 0.98, 'floor must finish its 700 ms reveal');
for (let index = 0; index < 42; index += 1) reveal = stepStudioReveal(reveal, false, 1 / 60);
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
assert.equal(
  classifyCarRelease({ ...base, holdStarted: false }),
  'end-hold',
  'an exact-deadline release must resolve as a completed hold even before its timer callback',
);
assert.equal(
  classifyCarRelease({ ...base, elapsedMs: CAR_HOLD_DELAY_MS - 0.001, holdStarted: false }),
  'toggle',
  'a release just before the hold deadline remains a tap',
);
assert.equal(classifyCarRelease({ ...base, elapsedMs: 100, holdStarted: false }), 'toggle');
assert.equal(classifyCarRelease({ ...base, travelPx: CAR_DRAG_TOLERANCE_PX + 1, holdStarted: false }), 'ignore');
assert.equal(
  classifyCarRelease({ ...base, elapsedMs: 100, exploded: false, holdStarted: false }),
  'toggle',
  'an assembled-car short press must toggle into the exploded view',
);
assert.equal(
  classifyCarRelease({ ...base, elapsedMs: 100, exploded: true, holdStarted: false }),
  'toggle',
  'an exploded-car short press must toggle back into the assembled view',
);
assert.equal(
  canStartCarHold({ ...base, elapsedMs: CAR_HOLD_DELAY_MS + 100, exploded: true }),
  false,
  'an exploded-car long press must never start wheel or airflow hold behavior',
);
assert.equal(
  classifyCarRelease({
    ...base,
    elapsedMs: CAR_HOLD_DELAY_MS + 100,
    exploded: true,
    holdStarted: false,
  }),
  'ignore',
  'an exploded-car long press must remain inert instead of becoming airflow or a delayed tap',
);

assert.equal(isAdditionalCarGesturePointer(null, 2), false);
assert.equal(isAdditionalCarGesturePointer(2, 2), false);
assert.equal(
  isAdditionalCarGesturePointer(2, 3),
  true,
  'an additional pointer must atomically invalidate the custom car gesture',
);

const canvasBounds = { left: 10, top: 20, right: 110, bottom: 220 };
assert.equal(isPointInsideCarGestureBounds(10, 20, canvasBounds), true);
assert.equal(isPointInsideCarGestureBounds(110, 220, canvasBounds), true);
assert.equal(isPointInsideCarGestureBounds(9.999, 20, canvasBounds), false);
assert.equal(isPointInsideCarGestureBounds(10, 220.001, canvasBounds), false);
