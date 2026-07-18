import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/WelcomePage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /const hasManuallyToggledRef = React\.useRef\(false\);/,
  'WelcomePage must remember the first manual exploded-view toggle',
);
assert.match(
  source,
  /const autoExplodeTimerRef = React\.useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
  'WelcomePage must retain the pending auto-explode timer',
);
assert.match(
  source,
  /const toggleExplodedView = useCallback\(\(\) => \{[\s\S]*?hasManuallyToggledRef\.current = true;[\s\S]*?clearTimeout\(autoExplodeTimerRef\.current\);[\s\S]*?setIsCarExploded\(\(value\) => !value\);/,
  'the first manual toggle must cancel pending auto-explode before changing state',
);
assert.match(
  source,
  /if \(progress < 100 \|\| isTransitioning \|\| hasManuallyToggledRef\.current\) return;/,
  'auto-explode must remain cancelled after the first manual toggle',
);
assert.match(
  source,
  /onCarClick=\{toggleExplodedView\}/,
  'canvas car clicks must preserve the same exploded-view toggle behavior',
);
assert.doesNotMatch(source, /\{\/\* Exploded view toggle \*\/\}/);
assert.doesNotMatch(source, /CLICK CAR TO REASSEMBLE/);
assert.match(source, /onCarClick=\{toggleExplodedView\}/);
