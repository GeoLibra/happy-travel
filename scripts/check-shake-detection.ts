import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EMPTY_SHAKE_STATE,
  stepShakeDetection,
} from '../src/lib/shake-detection';

const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);
assert.equal(first.detected, false, 'the first sample should only initialize detector state');
assert.deepEqual(first.state, {
  lastX: 1,
  lastY: 2,
  lastZ: 3,
  lastTime: 0,
  initialized: true,
});

const ignored = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 50, false);
assert.equal(ignored.detected, false, 'samples at or below the interval should be ignored');
assert.deepEqual(ignored.state, first.state, 'ignored samples should preserve state');

const exactInterval = stepShakeDetection(
  first.state,
  { x: 100, y: 100, z: 100 },
  100,
  false,
);
assert.equal(exactInterval.detected, false, 'a sample at exactly 100 ms should be ignored');
assert.deepEqual(exactInterval.state, first.state, 'the exact-boundary sample should preserve state');

const exactThreshold = stepShakeDetection(first.state, { x: 21, y: 2, z: 3 }, 200, false);
assert.equal(exactThreshold.detected, false, 'speed at exactly the 1000 threshold should not detect');
assert.deepEqual(
  exactThreshold.state,
  { lastX: 21, lastY: 2, lastZ: 3, lastTime: 200, initialized: true },
  'an accepted threshold-boundary sample should advance state',
);

const detected = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 120, false);
assert.equal(detected.detected, true, 'a sufficiently large delta after the interval should detect');

const incomplete = stepShakeDetection(first.state, { x: null, y: 2, z: 3 }, 120, false);
assert.equal(incomplete.detected, false, 'incomplete coordinates should not detect');
assert.deepEqual(incomplete.state, first.state, 'incomplete coordinates should preserve state');

const suppressed = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 120, true);
assert.equal(suppressed.detected, false, 'an open modal should suppress detection');
assert.deepEqual(
  suppressed.state,
  { lastX: 100, lastY: 100, lastZ: 100, lastTime: 120, initialized: true },
  'a modal-suppressed accepted sample should still advance detector state',
);

const appSource = readFileSync(resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
const welcomeSource = readFileSync(resolve(import.meta.dirname, '../src/components/WelcomePage.tsx'), 'utf8');

assert.match(
  appSource,
  /event\.acceleration\s*\?\?\s*event\.accelerationIncludingGravity/,
  'the App adapter should fall back to accelerationIncludingGravity',
);
assert.match(
  welcomeSource,
  /const hasStartedEntryRef = React\.useRef\(false\);/,
  'WelcomePage should use a synchronous ref guard for repeated ENTER clicks',
);
assert.match(
  welcomeSource,
  /if \(progress < 100 \|\| hasStartedEntryRef\.current\) return;[\s\S]*?hasStartedEntryRef\.current = true;[\s\S]*?onPrepareEnter\?\.\(\)[\s\S]*?enterAfterReassembly\(\);/,
  'ENTER should synchronously guard, prepare permission, and start reassembly exactly once',
);
assert.match(
  welcomeSource,
  /if \(preparation\) \{[\s\S]*?preparation\.catch\([\s\S]*?enterAfterReassembly\(\);/,
  'a rejected permission preparation must not block reassembly',
);
assert.doesNotMatch(
  appSource,
  /onEnter=\{async \(\) => \{[\s\S]*requestMotionPermission/,
  'permission must not wait for the delayed onEnter callback',
);

console.log('Shake detection and permission wiring checks passed.');
