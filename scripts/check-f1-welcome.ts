import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAR_HOLD_DELAY_MS,
  markF1ManualInteraction,
} from '../src/lib/f1-showroom-interaction';

const source = readFileSync(
  new URL('../src/components/WelcomePage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /const hasManualInteractionRef = React\.useRef\(false\);/,
  'WelcomePage must remember any accepted manual car interaction',
);
assert.match(
  source,
  /const autoExplodeTimerRef = React\.useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
  'WelcomePage must retain the pending auto-explode timer',
);
assert.match(
  source,
  /const handleCarManualInteraction = useCallback\(\(\) => \{[\s\S]*?markF1ManualInteraction\([\s\S]*?hasManualInteractionRef,[\s\S]*?autoExplodeTimerRef,[\s\S]*?clearTimeout,[\s\S]*?\);[\s\S]*?\}, \[\]\);/,
  'WelcomePage must expose one focused manual-interaction cancellation callback',
);
assert.match(
  source,
  /const toggleExplodedView = useCallback\(\(\) => \{[\s\S]*?handleCarManualInteraction\(\);[\s\S]*?setIsCarExploded\(\(value\) => !value\);/,
  'manual toggles must cancel pending auto-explode before changing state',
);
assert.match(
  source,
  /if \(progress < 100 \|\| isTransitioning \|\| hasManualInteractionRef\.current\) return;/,
  'auto-explode must remain cancelled after any accepted manual interaction',
);
assert.match(
  source,
  /onCarClick=\{toggleExplodedView\}/,
  'canvas car clicks must preserve the same exploded-view toggle behavior',
);
assert.match(
  source,
  /onCarManualInteraction=\{handleCarManualInteraction\}/,
  'accepted car holds must notify WelcomePage without toggling exploded state',
);
assert.doesNotMatch(source, /\{\/\* Exploded view toggle \*\/\}/);
assert.doesNotMatch(source, /CLICK CAR TO REASSEMBLE/);

type FakeTimer = number;

class FakeScheduler {
  now = 0;
  private nextId = 1;
  private readonly tasks = new Map<FakeTimer, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): FakeTimer {
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  clearTimeout(id: FakeTimer): void {
    this.tasks.delete(id);
  }

  advanceBy(deltaMs: number): void {
    const target = this.now + deltaMs;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if (!next) break;
      const [id, task] = next;
      this.tasks.delete(id);
      this.now = task.at;
      task.callback();
    }
    this.now = target;
  }
}

const AUTO_EXPLODE_DELAY_MS = 4600;

const untouchedScheduler = new FakeScheduler();
let untouchedExploded = false;
untouchedScheduler.setTimeout(() => {
  untouchedExploded = true;
}, AUTO_EXPLODE_DELAY_MS);
untouchedScheduler.advanceBy(AUTO_EXPLODE_DELAY_MS);
assert.equal(untouchedExploded, true, 'automatic explosion must still run without interaction');

const heldScheduler = new FakeScheduler();
let heldExploded = false;
const hasManualInteraction = { current: false };
const pendingAutoExplosion: { current: FakeTimer | null } = {
  current: heldScheduler.setTimeout(() => {
    heldExploded = true;
  }, AUTO_EXPLODE_DELAY_MS),
};

heldScheduler.advanceBy(AUTO_EXPLODE_DELAY_MS - CAR_HOLD_DELAY_MS - 40);
heldScheduler.setTimeout(() => {
  markF1ManualInteraction(
    hasManualInteraction,
    pendingAutoExplosion,
    (timer) => heldScheduler.clearTimeout(timer),
  );
}, CAR_HOLD_DELAY_MS);
heldScheduler.advanceBy(CAR_HOLD_DELAY_MS + 80);

assert.equal(hasManualInteraction.current, true, 'accepted first hold must mark manual interaction');
assert.equal(pendingAutoExplosion.current, null, 'accepted first hold must clear the auto timer');
assert.equal(
  heldExploded,
  false,
  'a first hold spanning the original 4.6-second deadline must not explode the car',
);
