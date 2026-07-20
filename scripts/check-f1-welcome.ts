import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTO_EXPLODE_DELAY_MS,
  GLITCH_CLEAN_FRAME_MS,
  GLITCH_CLEAN_HOLD_MS,
  GLITCH_DURATION_MS,
  HOLOGRAM_REVEAL_MS,
} from '../src/lib/f1-glitch-sequence';
import { createF1WelcomeSequence } from '../src/lib/f1-welcome-sequence';

const source = readFileSync(
  new URL('../src/components/WelcomePage.tsx', import.meta.url),
  'utf8',
);
const particleSource = readFileSync(
  new URL('../src/components/ParticleBackground.tsx', import.meta.url),
  'utf8',
);
const agentGuidance = readFileSync(
  new URL('../AGENTS.md', import.meta.url),
  'utf8',
);

assert.match(
  particleSource,
  /zIndex:\s*95/,
  'the transparent car canvas must render above ordinary welcome UI',
);
assert.match(
  particleSource,
  /forwardPointerToUnderlyingWelcomeUi/,
  'the foreground canvas must forward exposed-control clicks when the car ray misses',
);
assert.match(
  particleSource,
  /document\s*\.elementsFromPoint/,
  'underlying welcome controls must be resolved from the real layered DOM',
);
assert.match(source, /data-f1-welcome-action="enter"/);
assert.match(
  source,
  /className="[^"]*select-none[^"]*touch-none[^"]*"/,
  'the entire welcome scene must opt out of native text selection during a car hold',
);
assert.match(
  source,
  /WebkitTouchCallout:\s*'none'/,
  'iOS must not show its native long-press callout over the showroom',
);
assert.match(source, /z-\[70\][^\n]*StartLights|StartLights[\s\S]*?z-\[70\]/);
assert.match(source, /z-\[100\]/, 'intentional modal overlays may remain above the car');
assert.match(source, /z-\[110\]/, 'the blocking loader must remain above the car');

for (const phrase of [
  'car canvas stays above ordinary welcome UI',
  'WheelSpin_FL',
  'versioned GLB',
  'desktop and mobile',
  'arrival timeline',
]) {
  assert.match(agentGuidance, new RegExp(phrase), `AGENTS.md must contain: ${phrase}`);
}

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
assert.match(source, /const \[glitchProgress, setGlitchProgress\] = useState<number \| null>\(null\)/);
assert.match(source, /const glitchFrameRef = React\.useRef<number \| null>\(null\)/);
assert.match(source, /cancelAutomaticShowroomSequence/);
assert.match(source, /cancelAnimationFrame\(glitchFrameRef\.current\)/);
assert.match(source, /glitchProgress=\{glitchProgress\}/);
assert.match(source, /setIsCarExploded\(true\)/);
assert.match(source, /createF1WelcomeSequence/);
assert.match(source, /automaticSequenceRef/);
assert.doesNotMatch(
  source,
  /autoExplodeTimerRef\.current\s*=\s*setTimeout/,
  'automatic explosion must be animation-frame owned, never timeout owned',
);
assert.match(
  source,
  /const hasStartedEntryRef = React\.useRef\(false\);/,
  'WelcomePage must synchronously reject repeated ENTER activation',
);
assert.match(
  source,
  /const handleCarManualInteraction = useCallback\(\(\) => \{[\s\S]*?markF1ManualInteraction\([\s\S]*?hasManualInteractionRef,[\s\S]*?autoExplodeTimerRef,[\s\S]*?clearTimeout,[\s\S]*?\);[\s\S]*?cancelAutomaticShowroomSequence\(\);[\s\S]*?\}\, \[cancelAutomaticShowroomSequence\]\);/,
  'WelcomePage must expose one focused manual-interaction cancellation callback',
);
assert.match(
  source,
  /const toggleExplodedView = useCallback\(\(\) => \{[\s\S]*?handleCarManualInteraction\(\);[\s\S]*?setIsCarExploded\(\(value\) => !value\);/,
  'manual toggles must cancel pending auto-explode before changing state',
);
assert.match(
  source,
  /progress < 100[\s\S]*?\|\| isTransitioning[\s\S]*?\|\| hasManualInteractionRef\.current[\s\S]*?\|\| automaticSequenceRef\.current/,
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
assert.match(
  particleSource,
  /tier:\s*prefersReducedMotion\s*\?\s*'fallback'\s*:\s*'reflective'/,
  'mobile viewports must retain the reflective tier unless reduced motion is requested',
);

type FakeFrame = number;

class FakeAnimationFrames {
  now = 0;
  private nextId = 1;
  private readonly callbacks = new Map<FakeFrame, (now: number) => void>();
  private readonly allCallbacks = new Map<FakeFrame, (now: number) => void>();

  requestAnimationFrame(callback: (now: number) => void): FakeFrame {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    this.allCallbacks.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id: FakeFrame): void {
    this.callbacks.delete(id);
  }

  runNext(now: number): FakeFrame {
    const next = this.callbacks.entries().next().value as [FakeFrame, (time: number) => void] | undefined;
    assert(next, 'expected an animation frame to be scheduled');
    const [id, callback] = next;
    this.callbacks.delete(id);
    this.now = now;
    callback(now);
    return id;
  }

  runStale(id: FakeFrame, now: number): void {
    const callback = this.allCallbacks.get(id);
    assert(callback, `expected frame ${id} to exist`);
    this.now = now;
    callback(now);
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }
}

const createSequenceHarness = () => {
  const frames = new FakeAnimationFrames();
  const events: Array<string | number | null> = [];
  const sequence = createF1WelcomeSequence({
    requestAnimationFrame: (callback) => frames.requestAnimationFrame(callback),
    cancelAnimationFrame: (frame) => frames.cancelAnimationFrame(frame),
    onGlitchProgress: (value) => events.push(value),
    onExplode: () => events.push('explode'),
  });
  return { events, frames, sequence };
};

const hasExplosion = (events: ReadonlyArray<number | string | null>): boolean =>
  events.some((event) => event === 'explode');

const cleanFrameSequence = createSequenceHarness();
assert.equal(cleanFrameSequence.sequence.start(0), true, 'the automatic sequence must start once');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS - 1);
assert.deepEqual(cleanFrameSequence.events, [], 'glitch state must remain clean before the active window');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS);
assert.deepEqual(cleanFrameSequence.events, [0], 'glitch progress must start at zero on the exact boundary');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS / 2);
assert.equal(cleanFrameSequence.events.at(-1), 0.5, 'glitch progress must reach the deterministic midpoint');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS);
assert.deepEqual(
  cleanFrameSequence.events.slice(-2),
  [0.5, null],
  'glitch completion must commit a clean assembled frame before explosion',
);
assert.equal(hasExplosion(cleanFrameSequence.events), false, 'completion frame must not explode the car');
cleanFrameSequence.frames.runNext(AUTO_EXPLODE_DELAY_MS - 1);
assert.equal(
  hasExplosion(cleanFrameSequence.events),
  false,
  'the second post-glitch frame must not explode before the complete clean-frame delay',
);
cleanFrameSequence.frames.runNext(AUTO_EXPLODE_DELAY_MS);
assert.equal(cleanFrameSequence.events.at(-1), 'explode', 'only the later animation frame may explode the car');
assert.equal(cleanFrameSequence.frames.pendingCount, 0, 'explosion must stop the frame loop');
assert.equal(cleanFrameSequence.sequence.start(AUTO_EXPLODE_DELAY_MS + 1), false, 'a completed sequence instance must never restart');

const preGlitchCancellation = createSequenceHarness();
assert.equal(preGlitchCancellation.sequence.start(0), true);
const preGlitchFrame = preGlitchCancellation.frames.runNext(100);
preGlitchCancellation.sequence.cancel();
assert.equal(preGlitchCancellation.frames.pendingCount, 0, 'pre-glitch cancellation must remove the pending frame');
preGlitchCancellation.frames.runStale(preGlitchFrame, AUTO_EXPLODE_DELAY_MS + 100);
assert.deepEqual(preGlitchCancellation.events, [null], 'a stale pre-glitch callback must not restart or explode');
assert.equal(preGlitchCancellation.sequence.start(200), false, 'a cancelled sequence instance must never restart');

const activeGlitchCancellation = createSequenceHarness();
assert.equal(activeGlitchCancellation.sequence.start(0), true);
activeGlitchCancellation.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + 200);
const activeGlitchFrame = activeGlitchCancellation.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + 400);
activeGlitchCancellation.sequence.cancel();
assert.equal(activeGlitchCancellation.frames.pendingCount, 0, 'active-glitch cancellation must remove the pending frame');
activeGlitchCancellation.frames.runStale(activeGlitchFrame, AUTO_EXPLODE_DELAY_MS + 100);
assert.equal(activeGlitchCancellation.events.at(-1), null, 'active-glitch cancellation must clear the visual state');
assert.equal(hasExplosion(activeGlitchCancellation.events), false, 'stale active-glitch callbacks must not explode the car');

assert.equal(
  AUTO_EXPLODE_DELAY_MS,
  HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + GLITCH_CLEAN_FRAME_MS,
  'the controller must use the complete timing contract',
);
