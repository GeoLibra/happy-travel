import assert from 'node:assert/strict';

import {
  selectShowroomQuality,
  ShowroomFrameBudgetMonitor,
  stepDownQualityLevel,
} from '../src/lib/showroom-quality.ts';

// 1. Test selectShowroomQuality defaults and options
const defaultProfile = selectShowroomQuality();
assert.equal(defaultProfile.level, 'high');
assert.equal(defaultProfile.maxPixelRatio, 2.0);
assert.equal(defaultProfile.shadowsEnabled, true);
assert.equal(defaultProfile.bloomEnabled, true);
assert.equal(defaultProfile.reducedMotion, false);

// Mobile option
const mobileProfile = selectShowroomQuality({ mobile: true });
assert.equal(mobileProfile.level, 'medium');
assert.equal(mobileProfile.maxPixelRatio, 1.5);

// Reduced motion
const reducedMotionProfile = selectShowroomQuality({ prefersReducedMotion: true });
assert.equal(reducedMotionProfile.reducedMotion, true);
assert.equal(reducedMotionProfile.shadowsEnabled, false);
assert.equal(reducedMotionProfile.bloomEnabled, false);

// Low hardware specs
const lowSpecProfile = selectShowroomQuality({ deviceMemory: 2, hardwareConcurrency: 2 });
assert.equal(lowSpecProfile.level, 'low');
assert.equal(lowSpecProfile.maxPixelRatio, 1.0);

// Force level override
const forcedProfile = selectShowroomQuality({ forceLevel: 'low' });
assert.equal(forcedProfile.level, 'low');

// 2. Test stepDownQualityLevel
assert.equal(stepDownQualityLevel('high'), 'medium');
assert.equal(stepDownQualityLevel('medium'), 'low');
assert.equal(stepDownQualityLevel('low'), 'low');

// 3. Test ShowroomFrameBudgetMonitor
const monitor = new ShowroomFrameBudgetMonitor({
  targetFps: 60,
  thresholdConsecutiveSlowFrames: 5,
  initialOptions: { forceLevel: 'high' },
});

assert.equal(monitor.currentProfile.level, 'high');

// Fast frames (16.6ms) should not step down
for (let i = 0; i < 10; i += 1) {
  const result = monitor.recordFrame(16.6);
  assert.equal(result.steppedDown, false);
  assert.equal(result.profile.level, 'high');
}

// 4 slow frames (under threshold 5) should not step down yet
for (let i = 0; i < 4; i += 1) {
  const result = monitor.recordFrame(45.0);
  assert.equal(result.steppedDown, false);
}

// 5th consecutive slow frame triggers step-down to medium
const stepDownResult1 = monitor.recordFrame(45.0);
assert.equal(stepDownResult1.steppedDown, true);
assert.equal(stepDownResult1.profile.level, 'medium');

// 5 consecutive slow frames from medium triggers step-down to low
for (let i = 0; i < 4; i += 1) {
  monitor.recordFrame(45.0);
}
const stepDownResult2 = monitor.recordFrame(45.0);
assert.equal(stepDownResult2.steppedDown, true);
assert.equal(stepDownResult2.profile.level, 'low');

// Slow frames when already low should remain at low without further step-down
for (let i = 0; i < 10; i += 1) {
  const result = monitor.recordFrame(45.0);
  assert.equal(result.steppedDown, false);
  assert.equal(result.profile.level, 'low');
}

console.log('check:showroom-quality passed cleanly.');
