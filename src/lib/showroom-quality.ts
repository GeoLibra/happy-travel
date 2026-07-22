/**
 * Showroom Quality & Frame-Budget Selection Module
 * Pure logic for device quality tiers, reduced-motion/mobile fallbacks, and frame-budget step-downs.
 */

export type ShowroomQualityLevel = 'high' | 'medium' | 'low';

export interface ShowroomQualityOptions {
  mobile?: boolean;
  prefersReducedMotion?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  forceLevel?: ShowroomQualityLevel;
}

export interface ShowroomQualityProfile {
  level: ShowroomQualityLevel;
  maxPixelRatio: number;
  shadowsEnabled: boolean;
  bloomEnabled: boolean;
  particleDensity: number;
  reducedMotion: boolean;
}

export function selectShowroomQuality(options: ShowroomQualityOptions = {}): ShowroomQualityProfile {
  const {
    mobile = false,
    prefersReducedMotion = false,
    deviceMemory,
    hardwareConcurrency,
    forceLevel,
  } = options;

  let level: ShowroomQualityLevel = 'high';

  if (forceLevel) {
    level = forceLevel;
  } else if (mobile) {
    level = 'medium';
  } else if ((deviceMemory && deviceMemory < 4) || (hardwareConcurrency && hardwareConcurrency < 4)) {
    level = 'low';
  }

  // Apply profile parameters based on level & fallbacks
  const reducedMotion = Boolean(prefersReducedMotion);

  switch (level) {
    case 'high':
      return {
        level: 'high',
        maxPixelRatio: mobile ? 1.5 : 2.0,
        shadowsEnabled: !reducedMotion,
        bloomEnabled: !reducedMotion,
        particleDensity: 1.0,
        reducedMotion,
      };

    case 'medium':
      return {
        level: 'medium',
        maxPixelRatio: 1.5,
        shadowsEnabled: false,
        bloomEnabled: !reducedMotion,
        particleDensity: 0.6,
        reducedMotion,
      };

    case 'low':
    default:
      return {
        level: 'low',
        maxPixelRatio: 1.0,
        shadowsEnabled: false,
        bloomEnabled: false,
        particleDensity: 0.3,
        reducedMotion,
      };
  }
}

export function stepDownQualityLevel(currentLevel: ShowroomQualityLevel): ShowroomQualityLevel {
  switch (currentLevel) {
    case 'high':
      return 'medium';
    case 'medium':
    case 'low':
    default:
      return 'low';
  }
}

export interface FrameBudgetMonitorOptions {
  targetFps?: number;
  thresholdConsecutiveSlowFrames?: number;
  initialOptions?: ShowroomQualityOptions;
}

export class ShowroomFrameBudgetMonitor {
  private profile: ShowroomQualityProfile;
  private consecutiveSlowFrames = 0;
  private slowFrameThresholdMs: number;
  private maxSlowFrames: number;

  constructor(options: FrameBudgetMonitorOptions = {}) {
    const targetFps = options.targetFps ?? 60;
    this.slowFrameThresholdMs = 1000 / (targetFps * 0.7); // slow if FPS dropped by > 30%
    this.maxSlowFrames = options.thresholdConsecutiveSlowFrames ?? 5;
    this.profile = selectShowroomQuality(options.initialOptions);
  }

  public get currentProfile(): ShowroomQualityProfile {
    return this.profile;
  }

  public recordFrame(deltaMs: number): { profile: ShowroomQualityProfile; steppedDown: boolean } {
    if (deltaMs > this.slowFrameThresholdMs) {
      this.consecutiveSlowFrames += 1;
    } else {
      this.consecutiveSlowFrames = 0;
    }

    if (this.consecutiveSlowFrames >= this.maxSlowFrames) {
      const nextLevel = stepDownQualityLevel(this.profile.level);
      if (nextLevel !== this.profile.level) {
        this.profile = selectShowroomQuality({
          forceLevel: nextLevel,
          prefersReducedMotion: this.profile.reducedMotion,
        });
        this.consecutiveSlowFrames = 0;
        return { profile: this.profile, steppedDown: true };
      }
    }

    return { profile: this.profile, steppedDown: false };
  }
}
