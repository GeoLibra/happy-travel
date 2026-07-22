/**
 * Showroom Ignition & Chapter Story State Module
 * Pure logic for managing ignition state, showroom chapters, and frame-consistent story signals.
 */

export const IGNITION_HOLD_DURATION_MS = 2500;
export const RESET_THRESHOLD_PROGRESS = 0.3;
export const STORY_RESPONSE_RATE = 15; // Response rate in 1/s

export type IgnitionStatus = 'ready' | 'holding' | 'completing' | 'ignited';

export interface IgnitionState {
  status: IgnitionStatus;
  progress: number; // Clamped in [0, 1.0]
}

export type IgnitionEvent =
  | { type: 'press' }
  | { type: 'release' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'reset' };

export const INITIAL_IGNITION_STATE: IgnitionState = {
  status: 'ready',
  progress: 0,
};

/**
 * Pure reducer for ignition state transitions.
 */
export function reduceIgnition(
  state: IgnitionState = INITIAL_IGNITION_STATE,
  event: IgnitionEvent,
): IgnitionState {
  const currentProgress = Math.min(1.0, Math.max(0, state.progress));

  switch (event.type) {
    case 'reset':
      return { status: 'ready', progress: 0 };

    case 'press': {
      if (state.status === 'ignited') return state;
      return {
        status: 'holding',
        progress: currentProgress,
      };
    }

    case 'release': {
      if (state.status === 'ignited') return state;
      if (currentProgress < RESET_THRESHOLD_PROGRESS) {
        return { status: 'ready', progress: 0 };
      }
      return {
        status: 'completing',
        progress: currentProgress,
      };
    }

    case 'tick': {
      if (state.status === 'ready') {
        return state;
      }
      if (state.status === 'ignited') {
        return { status: 'ignited', progress: 1.0 };
      }

      const deltaMs = Math.max(0, event.deltaMs);
      const deltaProgress = deltaMs / IGNITION_HOLD_DURATION_MS;
      const nextProgress = Math.min(1.0, currentProgress + deltaProgress);

      if (nextProgress >= 1.0) {
        return { status: 'ignited', progress: 1.0 };
      }

      return {
        status: state.status,
        progress: nextProgress,
      };
    }

    default:
      return state;
  }
}

export type ShowroomChapterId = 'material' | 'aero' | 'power' | 'circuit' | 'weekend';

export interface ShowroomChapterDefinition {
  id: ShowroomChapterId;
  weightStart: number;
  weightEnd: number;
  title: string;
}

export const SHOWROOM_CHAPTERS: readonly ShowroomChapterDefinition[] = [
  { id: 'material', weightStart: 0, weightEnd: 0.18, title: 'Material Calibration' },
  { id: 'aero', weightStart: 0.18, weightEnd: 0.42, title: 'Aerodynamic Simulation' },
  { id: 'power', weightStart: 0.42, weightEnd: 0.62, title: 'Power Unit Dynamics' },
  { id: 'circuit', weightStart: 0.62, weightEnd: 0.82, title: 'Circuit Telemetry' },
  { id: 'weekend', weightStart: 0.82, weightEnd: 1.0, title: 'Race Weekend Ready' },
] as const;

export interface ShowroomChapterState {
  id: ShowroomChapterId;
  title: string;
  weightStart: number;
  weightEnd: number;
  globalProgress: number;
  localProgress: number; // Clamped in [0, 1.0]
}

/**
 * Returns the chapter state and localProgress for a given global progress value [0, 1.0].
 */
export function getShowroomChapter(progress: number): ShowroomChapterState {
  const globalProgress = Math.min(1.0, Math.max(0, progress));

  let matched: ShowroomChapterDefinition = SHOWROOM_CHAPTERS[SHOWROOM_CHAPTERS.length - 1];
  for (let i = 0; i < SHOWROOM_CHAPTERS.length; i += 1) {
    const chapter = SHOWROOM_CHAPTERS[i];
    if (globalProgress < chapter.weightEnd || i === SHOWROOM_CHAPTERS.length - 1) {
      matched = chapter;
      break;
    }
  }

  const range = matched.weightEnd - matched.weightStart;
  const rawLocal = range > 0 ? (globalProgress - matched.weightStart) / range : 1.0;
  const localProgress = Math.min(1.0, Math.max(0, rawLocal));

  return {
    id: matched.id,
    title: matched.title,
    weightStart: matched.weightStart,
    weightEnd: matched.weightEnd,
    globalProgress,
    localProgress,
  };
}

export interface StorySignal {
  targetProgress: number;
  currentProgress: number;
  smoothedProgress: number;
  velocity: number; // progress change rate (1/s)
  chapter: ShowroomChapterState;
}

export function createInitialStorySignal(initialProgress: number = 0): StorySignal {
  const p = Math.min(1.0, Math.max(0, initialProgress));
  return {
    targetProgress: p,
    currentProgress: p,
    smoothedProgress: p,
    velocity: 0,
    chapter: getShowroomChapter(p),
  };
}

/**
 * Steps the story progress signal in a frame-consistent, smooth manner.
 */
export function stepStorySignal(
  currentSignal: StorySignal,
  targetProgress: number,
  deltaMs: number,
): StorySignal {
  const clampedTarget = Math.min(1.0, Math.max(0, targetProgress));
  const validDeltaMs = Math.max(0, deltaMs);

  if (validDeltaMs === 0) {
    const currentSmoothed = currentSignal.smoothedProgress;
    return {
      ...currentSignal,
      targetProgress: clampedTarget,
      velocity: STORY_RESPONSE_RATE * (clampedTarget - currentSmoothed),
      chapter: getShowroomChapter(currentSmoothed),
    };
  }

  // Smooth exponential interpolation factor (delta-independent)
  const alpha = 1 - Math.exp(-validDeltaMs * 0.015);
  const nextSmoothed = currentSignal.smoothedProgress + (clampedTarget - currentSignal.smoothedProgress) * alpha;

  // Re-clamp smoothed progress tightly
  const finalSmoothed = Math.min(1.0, Math.max(0, nextSmoothed));
  const velocity = STORY_RESPONSE_RATE * (clampedTarget - finalSmoothed);

  return {
    targetProgress: clampedTarget,
    currentProgress: clampedTarget,
    smoothedProgress: finalSmoothed,
    velocity,
    chapter: getShowroomChapter(finalSmoothed),
  };
}
