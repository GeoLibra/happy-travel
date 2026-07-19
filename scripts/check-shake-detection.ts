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

const detected = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 120, false);
assert.equal(detected.detected, true, 'a sufficiently large delta after the interval should detect');

const incomplete = stepShakeDetection(first.state, { x: null, y: 2, z: 3 }, 120, false);
assert.equal(incomplete.detected, false, 'incomplete coordinates should not detect');
assert.deepEqual(incomplete.state, first.state, 'incomplete coordinates should preserve state');

const suppressed = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 120, true);
assert.equal(suppressed.detected, false, 'an open modal should suppress detection');

const appSource = readFileSync(resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
const welcomeSource = readFileSync(resolve(import.meta.dirname, '../src/components/WelcomePage.tsx'), 'utf8');

assert.match(
  appSource,
  /event\.acceleration\s*\?\?\s*event\.accelerationIncludingGravity/,
  'the App adapter should fall back to accelerationIncludingGravity',
);
assert.match(
  welcomeSource,
  /onClick=\{\(\) => \{[\s\S]*?onPrepareEnter\?\.\(\);[\s\S]*?enterAfterReassembly\(\);[\s\S]*?\}\}/,
  'ENTER should begin the permission request before starting reassembly',
);
assert.doesNotMatch(
  appSource,
  /onEnter=\{async \(\) => \{[\s\S]*requestMotionPermission/,
  'permission must not wait for the delayed onEnter callback',
);

console.log('Shake detection and permission wiring checks passed.');
