export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1.0;
export const MIN_PLAYBACK_RATE = 0.5;
export const MAX_PLAYBACK_RATE = 2.0;

export interface AudioTarget {
  volume: number;
  playbackRate: number;
}

/**
 * Calculates clamped volume and playbackRate targets based on progress/intensity and speed.
 */
export function getAudioTarget(progressOrIntensity: number, speed: number = 1.0): AudioTarget {
  const intensity = Math.min(1, Math.max(0, progressOrIntensity));
  const volume = Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, intensity));

  const rawRate = speed * (0.8 + intensity * 0.4);
  const playbackRate = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rawRate));

  return { volume, playbackRate };
}

export interface ShowroomAudioEngineOptions {
  audioElement?: HTMLAudioElement | null;
  src?: string;
}

export class ShowroomAudioEngine {
  private audioElement: HTMLAudioElement | null = null;
  private isUserGestureStarted = false;
  private isDisposed = false;

  constructor(options: ShowroomAudioEngineOptions = {}) {
    if (options.audioElement) {
      this.audioElement = options.audioElement;
    } else if (options.src && typeof Audio !== 'undefined') {
      this.audioElement = new Audio(options.src);
    }
  }

  public get isStarted(): boolean {
    return this.isUserGestureStarted;
  }

  public get isEngineDisposed(): boolean {
    return this.isDisposed;
  }

  public get audio(): HTMLAudioElement | null {
    return this.audioElement;
  }

  /**
   * Must ONLY be invoked within a direct user gesture handler (e.g. pointerdown/click).
   */
  public start(): boolean {
    if (this.isDisposed || !this.audioElement) return false;
    this.isUserGestureStarted = true;
    try {
      this.audioElement.currentTime = 0;
      const promise = this.audioElement.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch {
      // Ignore autoplay/playback errors
    }
    return true;
  }

  public pause(): void {
    if (!this.audioElement || this.isDisposed) return;
    try {
      this.audioElement.pause();
    } catch {
      // Ignore pause errors
    }
  }

  public reset(): void {
    if (!this.audioElement || this.isDisposed) return;
    try {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    } catch {
      // Ignore reset errors
    }
  }

  public update(progressOrIntensity: number, speed: number = 1.0): void {
    if (this.isDisposed || !this.audioElement) return;
    const target = getAudioTarget(progressOrIntensity, speed);
    try {
      this.audioElement.volume = target.volume;
      this.audioElement.playbackRate = target.playbackRate;
    } catch {
      // Ignore property assignment errors
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.src = '';
      } catch {
        // Ignore errors on disposal
      }
      this.audioElement = null;
    }
    this.isUserGestureStarted = false;
  }
}
