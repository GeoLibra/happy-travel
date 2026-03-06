/**
 * Audio Visualization — Web Audio API Frequency Analysis
 *
 * Connects to an existing <audio> element and extracts frequency data
 * in real-time, exposing reactive band values (bass, mid, treble, overall)
 * that drive particle behavior.
 */

export interface AudioBands {
  bass: number;     // 0–1: Low frequencies (20-250Hz) → particle size pulsation
  mid: number;      // 0–1: Mid frequencies (250-2000Hz) → particle speed
  treble: number;   // 0–1: High frequencies (2000-20000Hz) → god ray intensity
  overall: number;  // 0–1: Overall energy → force field turbulence
}

const EMPTY_BANDS: AudioBands = { bass: 0, mid: 0, treble: 0, overall: 0 };

export class AudioVisualizer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array = new Uint8Array(0);
  private connected = false;
  private smoothBands: AudioBands = { ...EMPTY_BANDS };

  // Smoothing factor for temporal averaging (0 = instant, 1 = frozen)
  private smoothing = 0.7;

  /**
   * Connect to an HTML audio element.
   * Must be called after a user gesture (e.g., button press) to satisfy
   * browser autoplay policies.
   */
  connect(audioElement: HTMLAudioElement): boolean {
    if (this.connected) return true;

    try {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256; // 128 frequency bins — good balance
      this.analyser.smoothingTimeConstant = 0.8;

      this.source = this.context.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination); // Still output audio

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.connected = true;

      return true;
    } catch (e) {
      console.warn('AudioVisualizer: Failed to connect', e);
      return false;
    }
  }

  /**
   * Resume AudioContext if it's suspended (required after page load).
   */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Get current frequency band values. Call once per frame.
   * Returns smoothed values in range [0, 1].
   */
  getBands(): AudioBands {
    if (!this.connected || !this.analyser) return EMPTY_BANDS;

    this.analyser.getByteFrequencyData(this.dataArray);

    const binCount = this.dataArray.length; // 128 bins
    const sampleRate = this.context!.sampleRate;
    const binWidth = sampleRate / (this.analyser.fftSize); // Hz per bin

    // Frequency band boundaries (in bin indices)
    const bassBins = Math.min(Math.floor(250 / binWidth), binCount);
    const midBins = Math.min(Math.floor(2000 / binWidth), binCount);

    // Average each band
    let bassSum = 0, midSum = 0, trebleSum = 0;
    let bassCount = 0, midCount = 0, trebleCount = 0;

    for (let i = 0; i < binCount; i++) {
      const val = this.dataArray[i] / 255; // Normalize to 0-1
      if (i < bassBins) {
        bassSum += val;
        bassCount++;
      } else if (i < midBins) {
        midSum += val;
        midCount++;
      } else {
        trebleSum += val;
        trebleCount++;
      }
    }

    const rawBass = bassCount > 0 ? bassSum / bassCount : 0;
    const rawMid = midCount > 0 ? midSum / midCount : 0;
    const rawTreble = trebleCount > 0 ? trebleSum / trebleCount : 0;
    const rawOverall = (rawBass * 0.5 + rawMid * 0.3 + rawTreble * 0.2);

    // Smooth with exponential moving average
    const s = this.smoothing;
    this.smoothBands.bass = this.smoothBands.bass * s + rawBass * (1 - s);
    this.smoothBands.mid = this.smoothBands.mid * s + rawMid * (1 - s);
    this.smoothBands.treble = this.smoothBands.treble * s + rawTreble * (1 - s);
    this.smoothBands.overall = this.smoothBands.overall * s + rawOverall * (1 - s);

    return { ...this.smoothBands };
  }

  /**
   * Check if already connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Clean up all Web Audio nodes.
   */
  dispose(): void {
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
      this.context?.close();
    } catch {
      // Ignore errors during cleanup
    }
    this.source = null;
    this.analyser = null;
    this.context = null;
    this.connected = false;
    this.smoothBands = { ...EMPTY_BANDS };
  }
}
