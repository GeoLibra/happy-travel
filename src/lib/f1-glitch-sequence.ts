export const HOLOGRAM_REVEAL_MS = 4500;
export const GLITCH_CLEAN_HOLD_MS = 100;
export const GLITCH_DURATION_MS = 1800;
export const GLITCH_CLEAN_FRAME_MS = 34;
export const AUTO_EXPLODE_DELAY_MS =
  HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + GLITCH_CLEAN_FRAME_MS;

export function getF1GlitchProgress(elapsedSinceProgressCompleteMs: number): number | null {
  const start = HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS;
  const elapsed = elapsedSinceProgressCompleteMs - start;
  if (elapsed < 0 || elapsed >= GLITCH_DURATION_MS) return null;
  return Math.min(1, Math.max(0, elapsed / GLITCH_DURATION_MS));
}

function triangularPulse(progress: number, center: number, halfWidth: number): number {
  return Math.max(0, 1 - Math.abs(progress - center) / halfWidth);
}

export function getF1GlitchPulse(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.max(
    triangularPulse(clamped, 0.16, 0.08),
    triangularPulse(clamped, 0.50, 0.10),
    triangularPulse(clamped, 0.82, 0.09),
  );
}
