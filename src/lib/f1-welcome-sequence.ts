import {
  AUTO_EXPLODE_DELAY_MS,
  GLITCH_CLEAN_HOLD_MS,
  GLITCH_DURATION_MS,
  HOLOGRAM_REVEAL_MS,
  getF1GlitchProgress,
} from './f1-glitch-sequence';

export interface F1WelcomeSequenceCallbacks {
  requestAnimationFrame: (callback: (now: number) => void) => number;
  cancelAnimationFrame: (frame: number) => void;
  onGlitchProgress: (progress: number | null) => void;
  onExplode: () => void;
}

export interface F1WelcomeSequence {
  start: (startedAt: number) => boolean;
  cancel: () => void;
}

export const createF1WelcomeSequence = ({
  requestAnimationFrame,
  cancelAnimationFrame,
  onGlitchProgress,
  onExplode,
}: F1WelcomeSequenceCallbacks): F1WelcomeSequence => {
  let active = false;
  let hasStarted = false;
  let cleanFrameCommitted = false;
  let frame: number | null = null;
  let startedAt = 0;
  let generation = 0;

  const schedule = (callback: (now: number) => void) => {
    const callbackGeneration = generation;
    frame = requestAnimationFrame((now) => {
      frame = null;
      if (!active || callbackGeneration !== generation) return;
      callback(now);
    });
  };

  const update = (now: number) => {
    const elapsed = now - startedAt;
    const glitchProgress = getF1GlitchProgress(elapsed);

    if (glitchProgress !== null) {
      onGlitchProgress(glitchProgress);
      schedule(update);
      return;
    }

    const glitchHasCompleted = elapsed >= HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS;
    if (!glitchHasCompleted) {
      schedule(update);
      return;
    }

    if (!cleanFrameCommitted) {
      cleanFrameCommitted = true;
      onGlitchProgress(null);
      schedule(update);
      return;
    }

    if (elapsed < AUTO_EXPLODE_DELAY_MS) {
      schedule(update);
      return;
    }

    active = false;
    onExplode();
  };

  return {
    start: (nextStartedAt) => {
      if (hasStarted) return false;
      hasStarted = true;
      active = true;
      startedAt = nextStartedAt;
      schedule(update);
      return true;
    },
    cancel: () => {
      if (!active) return;
      active = false;
      generation += 1;
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      onGlitchProgress(null);
    },
  };
};
