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

const toggleStart = source.indexOf('{/* Exploded view toggle */}');
assert(toggleStart >= 0, 'WelcomePage must render a dedicated exploded-view toggle');
const toggleSource = source.slice(toggleStart, toggleStart + 2_000);
assert.match(toggleSource, /<button/, 'the exploded-view control must be a native button');
assert.match(toggleSource, /type="button"/, 'the exploded-view button must have an explicit type');
assert.match(toggleSource, /onClick=\{toggleExplodedView\}/, 'the button must support keyboard activation');
assert.match(toggleSource, /aria-label=\{explodedToggleLabel\}/, 'the button must have an accessible name');
assert.match(toggleSource, /aria-pressed=\{isCarExploded\}/, 'the button must expose its toggle state');
assert.match(toggleSource, /disabled=\{isTransitioning\}/, 'the button must be disabled during reassembly');
assert.match(toggleSource, /pointer-events-auto/, 'the visible toggle must accept pointer input');
assert.match(toggleSource, /\bfixed\b/, 'the visible toggle must escape the content stacking context');
assert.match(toggleSource, /z-\[90\]/, 'the visible toggle must render above the z-75 Three.js canvas');
