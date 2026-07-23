import { describe, expect, it } from 'vitest';
import {
  EMPTY_SHAKE_STATE,
  stepShakeDetection,
} from '../../../src/lib/shake-detection';

describe('Rose Shake Detection Contract', () => {
  it('initializes detector state on first sample without detecting shake', () => {
    const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);
    expect(first.detected).toBe(false);
    expect(first.state).toEqual({
      lastX: 1,
      lastY: 2,
      lastZ: 3,
      lastTime: 0,
      initialized: true,
    });
  });

  it('ignores samples at or below the 100ms interval and preserves state', () => {
    const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);

    const ignoredSub100 = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 50, false);
    expect(ignoredSub100.detected).toBe(false);
    expect(ignoredSub100.state).toEqual(first.state);

    const exact100 = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 100, false);
    expect(exact100.detected).toBe(false);
    expect(exact100.state).toEqual(first.state);
  });

  it('advances state at exact threshold without detecting shake', () => {
    const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);
    const exactThreshold = stepShakeDetection(first.state, { x: 21, y: 2, z: 3 }, 200, false);

    expect(exactThreshold.detected).toBe(false);
    expect(exactThreshold.state).toEqual({
      lastX: 21,
      lastY: 2,
      lastZ: 3,
      lastTime: 200,
      initialized: true,
    });
  });

  it('detects shake when delta exceeds threshold after interval', () => {
    const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);
    const detected = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 120, false);

    expect(detected.detected).toBe(true);
  });

  it('ignores incomplete coordinates and preserves state', () => {
    const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);
    const incomplete = stepShakeDetection(first.state, { x: null, y: 2, z: 3 }, 120, false);

    expect(incomplete.detected).toBe(false);
    expect(incomplete.state).toEqual(first.state);
  });

  it('suppresses shake detection when modal is open but advances detector state', () => {
    const first = stepShakeDetection(EMPTY_SHAKE_STATE, { x: 1, y: 2, z: 3 }, 0, false);
    const suppressed = stepShakeDetection(first.state, { x: 100, y: 100, z: 100 }, 120, true);

    expect(suppressed.detected).toBe(false);
    expect(suppressed.state).toEqual({
      lastX: 100,
      lastY: 100,
      lastZ: 100,
      lastTime: 120,
      initialized: true,
    });
  });
});
