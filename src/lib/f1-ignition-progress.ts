export const IGNITION_PROGRESS_CADENCE_MS = 50;
export const IGNITION_MAX_CATCH_UP_MS = 1_000;

export interface IgnitionProgressState {
  progress: number;
  remainderMs: number;
}

export const advanceIgnitionProgress = (
  state: IgnitionProgressState,
  elapsedMs: number,
): IgnitionProgressState => {
  const boundedElapsed = Math.min(
    IGNITION_MAX_CATCH_UP_MS,
    Math.max(0, elapsedMs),
  );
  const accumulatedMs = state.remainderMs + boundedElapsed;
  const progressDelta = Math.floor(
    accumulatedMs / IGNITION_PROGRESS_CADENCE_MS,
  );
  const progress = Math.min(100, state.progress + progressDelta);

  return {
    progress,
    remainderMs: progress >= 100
      ? 0
      : accumulatedMs - progressDelta * IGNITION_PROGRESS_CADENCE_MS,
  };
};
