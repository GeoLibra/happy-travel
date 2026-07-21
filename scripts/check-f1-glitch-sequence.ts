import assert from 'node:assert/strict';
import {
  AUTO_EXPLODE_DELAY_MS,
  GLITCH_CLEAN_FRAME_MS,
  GLITCH_CLEAN_HOLD_MS,
  GLITCH_DURATION_MS,
  HOLOGRAM_REVEAL_MS,
  getF1GlitchProgress,
  getF1GlitchPulse,
} from '../src/lib/f1-glitch-sequence';

assert.equal(HOLOGRAM_REVEAL_MS, 4500);
assert.equal(GLITCH_CLEAN_HOLD_MS, 100);
assert.equal(GLITCH_DURATION_MS, 1200);
assert(GLITCH_CLEAN_FRAME_MS > 0);
assert.equal(
  AUTO_EXPLODE_DELAY_MS,
  HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + GLITCH_CLEAN_FRAME_MS,
);
assert.equal(getF1GlitchProgress(HOLOGRAM_REVEAL_MS + 99), null);
assert.equal(getF1GlitchProgress(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS), 0);
assert.equal(
  getF1GlitchProgress(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS / 2),
  0.5,
);
assert.equal(
  getF1GlitchProgress(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS),
  null,
);

const samples = Array.from({ length: 101 }, (_, index) => getF1GlitchPulse(index / 100));
const peaks = samples.filter((value, index) => (
  index > 0 && index < samples.length - 1 && value > samples[index - 1] && value >= samples[index + 1] && value > 0.9
));
assert.equal(peaks.length, 2, 'the glitch envelope must contain exactly two pronounced pulses');
assert(
  samples.filter((value) => value > 0.5).length >= 34,
  'the two pulses must stay broad enough to avoid rapid flicker',
);
assert(samples.every((value) => value >= 0 && value <= 1));
