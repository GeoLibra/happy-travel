import { describe, expect, it, vi } from 'vitest';
import { createF1WelcomeSequence } from '@/src/lib/f1-welcome-sequence';
import {
  AUTO_EXPLODE_DELAY_MS,
  GLITCH_CLEAN_HOLD_MS,
  GLITCH_DURATION_MS,
  HOLOGRAM_REVEAL_MS,
} from '@/src/lib/f1-glitch-sequence';

describe('F1 rAF Controller (Welcome Sequence)', () => {
  it('starts sequence and prevents duplicate initialization', () => {
    let animationCallback: ((now: number) => void) | null = null;
    const requestAnimationFrame = vi.fn((cb: (now: number) => void) => {
      animationCallback = cb;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();
    const onGlitchProgress = vi.fn();
    const onExplode = vi.fn();

    const controller = createF1WelcomeSequence({
      requestAnimationFrame,
      cancelAnimationFrame,
      onGlitchProgress,
      onExplode,
    });

    const firstStart = controller.start(1000);
    expect(firstStart).toBe(true);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    const secondStart = controller.start(1000);
    expect(secondStart).toBe(false);
  });

  it('advances through hologram reveal, glitch pulses, clean frame, and auto explode', () => {
    let frameId = 0;
    let pendingCallback: ((now: number) => void) | null = null;

    const requestAnimationFrame = vi.fn((cb: (now: number) => void) => {
      frameId += 1;
      pendingCallback = cb;
      return frameId;
    });
    const cancelAnimationFrame = vi.fn();
    const onGlitchProgress = vi.fn();
    const onExplode = vi.fn();

    const controller = createF1WelcomeSequence({
      requestAnimationFrame,
      cancelAnimationFrame,
      onGlitchProgress,
      onExplode,
    });

    const startedAt = 1000;
    controller.start(startedAt);

    // 1. Advance during glitch pulse phase (elapsed = 5,100ms > 4,600ms start)
    const glitchTime = startedAt + HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + 500;
    if (pendingCallback) (pendingCallback as (now: number) => void)(glitchTime);
    expect(onGlitchProgress).toHaveBeenCalledWith(expect.any(Number));

    // 2. Advance to clean frame phase (after glitch finishes)
    const cleanFrameTime = startedAt + HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + 50;
    if (pendingCallback) (pendingCallback as (now: number) => void)(cleanFrameTime);
    expect(onGlitchProgress).toHaveBeenCalledWith(null);

    // 3. Advance past auto explode delay
    const explodeTime = startedAt + AUTO_EXPLODE_DELAY_MS + 100;
    if (pendingCallback) (pendingCallback as (now: number) => void)(explodeTime);
    expect(onExplode).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled sequence and cleans up glitch progress', () => {
    let pendingCallback: ((now: number) => void) | null = null;
    const requestAnimationFrame = vi.fn((cb: (now: number) => void) => {
      pendingCallback = cb;
      return 42;
    });
    const cancelAnimationFrame = vi.fn();
    const onGlitchProgress = vi.fn();
    const onExplode = vi.fn();

    const controller = createF1WelcomeSequence({
      requestAnimationFrame,
      cancelAnimationFrame,
      onGlitchProgress,
      onExplode,
    });

    controller.start(1000);
    expect(requestAnimationFrame).toHaveBeenCalled();

    controller.cancel();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(onGlitchProgress).toHaveBeenCalledWith(null);

    if (pendingCallback) (pendingCallback as (now: number) => void)(2000);
    expect(onExplode).not.toHaveBeenCalled();
  });
});
