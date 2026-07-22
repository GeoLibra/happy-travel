import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getAudioTarget,
  MAX_PLAYBACK_RATE,
  MAX_VOLUME,
  MIN_PLAYBACK_RATE,
  MIN_VOLUME,
  ShowroomAudioEngine,
} from '../src/components/showroom/audio-engine.ts';

// Dummy HTMLAudioElement mock for Node environment testing
class MockAudioElement {
  public src = '';
  public currentTime = 0;
  public volume = 1;
  public playbackRate = 1;
  public isPaused = true;
  public playCount = 0;
  public pauseCount = 0;

  public async play(): Promise<void> {
    this.playCount += 1;
    this.isPaused = false;
  }

  public pause(): void {
    this.pauseCount += 1;
    this.isPaused = true;
  }
}

// Global Audio mock for Node.js
if (typeof globalThis.Audio === 'undefined') {
  // @ts-expect-error Mocking Audio for Node check script
  globalThis.Audio = MockAudioElement;
}

// 1. Verify getAudioTarget clamping
const minTarget = getAudioTarget(-0.5, 0.1);
assert.equal(minTarget.volume, MIN_VOLUME, 'volume must be clamped to MIN_VOLUME');
assert.equal(minTarget.playbackRate, MIN_PLAYBACK_RATE, 'playbackRate must be clamped to MIN_PLAYBACK_RATE');

const maxTarget = getAudioTarget(2.5, 10.0);
assert.equal(maxTarget.volume, MAX_VOLUME, 'volume must be clamped to MAX_VOLUME');
assert.equal(maxTarget.playbackRate, MAX_PLAYBACK_RATE, 'playbackRate must be clamped to MAX_PLAYBACK_RATE');

const normalTarget = getAudioTarget(0.5, 1.0);
assert(normalTarget.volume >= MIN_VOLUME && normalTarget.volume <= MAX_VOLUME);
assert(normalTarget.playbackRate >= MIN_PLAYBACK_RATE && normalTarget.playbackRate <= MAX_PLAYBACK_RATE);

// 2. Verify ShowroomAudioEngine autoplay protection
const mockAudio = new MockAudioElement() as unknown as HTMLAudioElement;
const engine = new ShowroomAudioEngine({ audioElement: mockAudio });

assert.equal(engine.isStarted, false, 'engine must not start audio automatically on construction');
assert.equal((mockAudio as unknown as MockAudioElement).playCount, 0, 'audio play must not be called on construction');

// Verify start() via user gesture
const startResult = engine.start();
assert.equal(startResult, true, 'start() should return true when active');
assert.equal(engine.isStarted, true, 'isStarted must be true after start()');
assert.equal((mockAudio as unknown as MockAudioElement).playCount, 1, 'play() must be called on start()');
assert.equal((mockAudio as unknown as MockAudioElement).currentTime, 0, 'currentTime must reset to 0 on start()');

// Verify update()
engine.update(0.75, 1.2);
assert.equal((mockAudio as unknown as MockAudioElement).volume, getAudioTarget(0.75, 1.2).volume);
assert.equal((mockAudio as unknown as MockAudioElement).playbackRate, getAudioTarget(0.75, 1.2).playbackRate);

// Verify reset()
engine.reset();
assert.equal((mockAudio as unknown as MockAudioElement).currentTime, 0);

// Verify dispose()
engine.dispose();
assert.equal(engine.isEngineDisposed, true, 'isEngineDisposed must be true after dispose()');
assert.equal(engine.isStarted, false, 'isStarted must be false after dispose()');
assert.equal(engine.audio, null, 'audio reference must be cleared on dispose()');

// 3. Source code anti-regression checks on WelcomePage.tsx
const welcomePagePath = join(process.cwd(), 'src', 'components', 'WelcomePage.tsx');
const welcomeSource = readFileSync(welcomePagePath, 'utf8');

assert.match(
  welcomeSource,
  /import\s+.*ShowroomAudioEngine.*from\s+['"].\/showroom\/audio-engine['"]/,
  'WelcomePage.tsx must import ShowroomAudioEngine',
);

assert.match(
  welcomeSource,
  /audioEngineRef\.current\?\.start\(\)/,
  'WelcomePage.tsx must call start() on user gesture path',
);

assert.match(
  welcomeSource,
  /audioEngineRef\.current\?\.dispose\(\)/,
  'WelcomePage.tsx must call dispose() on cleanup/unmount',
);

// Ensure no direct loose autoplay on mount
assert.doesNotMatch(
  welcomeSource,
  /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*\.play\(\)/,
  'WelcomePage.tsx must not auto-play audio in useEffect mount',
);

console.log('check:showroom-audio passed cleanly.');
