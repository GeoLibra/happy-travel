import assert from 'node:assert/strict';

import {
  createInitialStorySignal,
  getShowroomChapter,
  IGNITION_HOLD_DURATION_MS,
  INITIAL_IGNITION_STATE,
  reduceIgnition,
  RESET_THRESHOLD_PROGRESS,
  SHOWROOM_CHAPTERS,
  stepStorySignal,
} from '../src/lib/showroom-story.ts';

// 1. Verify Ignition Reducer
assert.equal(IGNITION_HOLD_DURATION_MS, 2500, 'hold duration must be 2.5s');
assert.equal(RESET_THRESHOLD_PROGRESS, 0.3, 'reset threshold must be 30%');

// Ready -> Press (holding)
let state = reduceIgnition(INITIAL_IGNITION_STATE, { type: 'press' });
assert.equal(state.status, 'holding');
assert.equal(state.progress, 0);

// Tick 1250ms (halfway = 0.5)
state = reduceIgnition(state, { type: 'tick', deltaMs: 1250 });
assert.equal(state.status, 'holding');
assert.equal(state.progress, 0.5);

// Release < 30% threshold reset test
const earlyState = reduceIgnition({ status: 'holding', progress: 0.2 }, { type: 'release' });
assert.equal(earlyState.status, 'ready', 'release < 30% must reset to ready');
assert.equal(earlyState.progress, 0, 'release < 30% must reset progress to 0');

// Release >= 30% threshold completing test
const completingState = reduceIgnition({ status: 'holding', progress: 0.4 }, { type: 'release' });
assert.equal(completingState.status, 'completing', 'release >= 30% must transition to completing');
assert.equal(completingState.progress, 0.4);

// Tick completing state to 100% (ignited)
const ignitedState = reduceIgnition(completingState, { type: 'tick', deltaMs: 1500 });
assert.equal(ignitedState.status, 'ignited', 'reaching 100% must set status to ignited');
assert.equal(ignitedState.progress, 1.0);

// Ignited state remains ignited
const postIgnited = reduceIgnition(ignitedState, { type: 'tick', deltaMs: 1000 });
assert.equal(postIgnited.status, 'ignited');
assert.equal(postIgnited.progress, 1.0);

// Reset event clears any state to ready
const resetState = reduceIgnition(completingState, { type: 'reset' });
assert.equal(resetState.status, 'ready');
assert.equal(resetState.progress, 0);

// Fallback for unhandled event
// @ts-expect-error Testing fallback
const fallbackState = reduceIgnition(state, { type: 'unknown' });
assert.equal(fallbackState.status, state.status);

// 2. Verify Showroom Chapters & localProgress
assert.equal(SHOWROOM_CHAPTERS.length, 5);

const assertNear = (actual: number, expected: number, eps = 1e-4) => {
  assert(
    Math.abs(actual - expected) < eps,
    `expected ${actual} to be near ${expected} (diff: ${Math.abs(actual - expected)})`,
  );
};

// Material (0 - 0.18)
const chMaterial = getShowroomChapter(0.09);
assert.equal(chMaterial.id, 'material');
assertNear(chMaterial.localProgress, 0.5);

const chMaterialStart = getShowroomChapter(0);
assert.equal(chMaterialStart.id, 'material');
assert.equal(chMaterialStart.localProgress, 0);

// Aero (0.18 - 0.42)
const chAeroStart = getShowroomChapter(0.18);
assert.equal(chAeroStart.id, 'aero');
assert.equal(chAeroStart.localProgress, 0);

const chAeroMid = getShowroomChapter(0.30);
assert.equal(chAeroMid.id, 'aero');
assertNear(chAeroMid.localProgress, 0.5);

// Power (0.42 - 0.62)
const chPowerStart = getShowroomChapter(0.42);
assert.equal(chPowerStart.id, 'power');
assert.equal(chPowerStart.localProgress, 0);

const chPowerMid = getShowroomChapter(0.52);
assert.equal(chPowerMid.id, 'power');
assertNear(chPowerMid.localProgress, 0.5);

// Circuit (0.62 - 0.82)
const chCircuitStart = getShowroomChapter(0.62);
assert.equal(chCircuitStart.id, 'circuit');
assert.equal(chCircuitStart.localProgress, 0);

const chCircuitMid = getShowroomChapter(0.72);
assert.equal(chCircuitMid.id, 'circuit');
assertNear(chCircuitMid.localProgress, 0.5);

// Weekend (0.82 - 1.0)
const chWeekendStart = getShowroomChapter(0.82);
assert.equal(chWeekendStart.id, 'weekend');
assert.equal(chWeekendStart.localProgress, 0);

const chWeekendEnd = getShowroomChapter(1.0);
assert.equal(chWeekendEnd.id, 'weekend');
assert.equal(chWeekendEnd.localProgress, 1.0);

// Clamp checks
const chClampedNeg = getShowroomChapter(-0.5);
assert.equal(chClampedNeg.id, 'material');
assert.equal(chClampedNeg.localProgress, 0);

const chClampedOver = getShowroomChapter(1.5);
assert.equal(chClampedOver.id, 'weekend');
assert.equal(chClampedOver.localProgress, 1.0);

// 3. Verify StorySignal stepping & frame consistency
let signal = createInitialStorySignal(0);
assert.equal(signal.smoothedProgress, 0);
assert.equal(signal.chapter.id, 'material');

// Zero deltaMs safety
const zeroStep = stepStorySignal(signal, 0.5, 0);
assert.equal(zeroStep.smoothedProgress, 0);

// Stepping with 1 big step (100ms)
const singleStepSignal = stepStorySignal(signal, 1.0, 100);
assert(singleStepSignal.smoothedProgress > 0 && singleStepSignal.smoothedProgress <= 1.0);
assert(Number.isFinite(singleStepSignal.velocity));

// Stepping with 10 small steps (10ms each = 100ms total)
let multiStepSignal = createInitialStorySignal(0);
for (let i = 0; i < 10; i += 1) {
  multiStepSignal = stepStorySignal(multiStepSignal, 1.0, 10);
  assert(multiStepSignal.smoothedProgress >= 0 && multiStepSignal.smoothedProgress <= 1.0);
  assert(Number.isFinite(multiStepSignal.velocity));
}

// Frame-consistency assertions: 1x100ms and 10x10ms must match for BOTH smoothedProgress and velocity
assertNear(singleStepSignal.smoothedProgress, multiStepSignal.smoothedProgress, 1e-4);
assertNear(singleStepSignal.velocity, multiStepSignal.velocity, 1e-4);

console.log('check:showroom-story passed cleanly.');
