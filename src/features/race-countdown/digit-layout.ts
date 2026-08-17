import { getGlyph } from '@/src/components/digit';

export type ViewportKind = 'desktop' | 'mobile';
export type TimeVizMode = 'reference' | 'countdown';

export interface DigitLayoutInput {
  digits: string[];
  mode: TimeVizMode;
  viewport: ViewportKind;
  seed?: number;
}

export interface DigitInstance {
  key: string;
  digitIndex: number;
  groupRow: number;
  position: readonly [number, number, number];
  color: string;
  visible: boolean;
}

export interface LayoutMetrics {
  columns: number;
  rows: number;
  digitCapacity: number;
  cubeSpacing: number;
  digitSpacing: number;
  rowSpacing: number;
}

const LOGICAL_DIGIT_ROWS = 10;
const LOGICAL_DIGIT_COLUMNS = 7;
export const DIGIT_LATTICE_ROWS = LOGICAL_DIGIT_ROWS * 2;
export const DIGIT_LATTICE_COLUMNS = LOGICAL_DIGIT_COLUMNS * 2;
export const CELLS_PER_DIGIT = DIGIT_LATTICE_ROWS * DIGIT_LATTICE_COLUMNS;
const REFERENCE_DIGIT_CAPACITY = 6;
const COUNTDOWN_DIGIT_CAPACITY = 9;
const DEFAULT_SEED = 26;
const MOBILE_COUNTDOWN_ROW_STARTS = [0, 3, 5, 7] as const;
const MOBILE_COUNTDOWN_ROW_LENGTHS = [3, 2, 2, 2] as const;

const LAYOUTS: Record<ViewportKind, Omit<LayoutMetrics, 'columns' | 'rows' | 'digitCapacity'>> = {
  desktop: {
    cubeSpacing: 0.17,
    digitSpacing: 2.45,
    rowSpacing: 4.1,
  },
  mobile: {
    cubeSpacing: 0.17,
    digitSpacing: 2.3,
    rowSpacing: 4.95,
  },
};

function digitCapacity(mode: TimeVizMode): number {
  return mode === 'countdown' ? COUNTDOWN_DIGIT_CAPACITY : REFERENCE_DIGIT_CAPACITY;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pastelColor(
  random: () => number,
  digitIndex: number,
  row: number,
  column: number,
): string {
  const jitter = (random() - 0.5) * 16;
  const spatialHue = digitIndex * 47 + row * 26 - column * 21 + jitter;
  const hue = Math.floor((spatialHue + 360) % 360);
  const saturation = 70 + Math.floor(random() * 14);
  const lightness = 58 + Math.floor(random() * 12);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function isGlyphCellVisible(glyph: number[][] | undefined, row: number, column: number): boolean {
  if (!glyph) return false;
  const glyphRow = Math.floor(row / 2);
  const glyphCol = Math.floor(column / 2);
  return glyph[glyphRow]?.[glyphCol] === 1;
}

export function getTimeVizLayout(mode: TimeVizMode, viewport: ViewportKind): LayoutMetrics {
  const capacity = digitCapacity(mode);
  const mobileCountdown = viewport === 'mobile' && mode === 'countdown';
  const columns = viewport === 'desktop' ? capacity : mobileCountdown ? 3 : 2;

  return {
    ...LAYOUTS[viewport],
    ...(mobileCountdown ? { rowSpacing: 4.2 } : {}),
    columns,
    rows: mobileCountdown ? MOBILE_COUNTDOWN_ROW_LENGTHS.length : Math.ceil(capacity / columns),
    digitCapacity: capacity,
  };
}

function mobileCountdownPlacement(digitIndex: number): {
  column: number;
  row: number;
  rowLength: number;
} {
  const row = MOBILE_COUNTDOWN_ROW_STARTS.findIndex((start, index) => (
    digitIndex >= start
    && digitIndex < start + MOBILE_COUNTDOWN_ROW_LENGTHS[index]
  ));
  const safeRow = Math.max(0, row);
  return {
    column: digitIndex - MOBILE_COUNTDOWN_ROW_STARTS[safeRow],
    row: safeRow,
    rowLength: MOBILE_COUNTDOWN_ROW_LENGTHS[safeRow],
  };
}

function desktopShanghaiOriginX(digitIndex: number, digitSpacing = 2.85, wordGap = 1.6): number {
  const centers: number[] = [];
  let curr = 0;
  for (let i = 0; i < 8; i++) {
    if (i > 0) {
      curr += digitSpacing;
      // Distinct word break between SHANG (0..4) and HAI (5..7)
      if (i === 5) {
        curr += wordGap;
      }
    }
    centers.push(curr);
  }
  const mid = (centers[0] + centers[7]) / 2;
  return centers[digitIndex] - mid;
}

function desktopCountdownOriginX(digitIndex: number, digitSpacing: number, totalDigits = 9, groupGap = 1.15): number {
  if (totalDigits <= 6) {
    const centers: number[] = [];
    let curr = 0;
    for (let i = 0; i < 6; i++) {
      if (i > 0) {
        curr += digitSpacing;
        // Gap between Hours (0..1), Mins (2..3), Secs (4..5)
        if (i === 2 || i === 4) {
          curr += groupGap;
        }
      }
      centers.push(curr);
    }
    const mid = (centers[0] + centers[5]) / 2;
    return centers[digitIndex] - mid;
  }

  const centers: number[] = [];
  let curr = 0;
  for (let i = 0; i < 9; i++) {
    if (i > 0) {
      curr += digitSpacing;
      // Add gap between Days (0..2) and Hours (3..4), Hours and Mins (5..6), Mins and Secs (7..8)
      if (i === 3 || i === 5 || i === 7) {
        curr += groupGap;
      }
    }
    centers.push(curr);
  }
  const mid = (centers[0] + centers[8]) / 2;
  return centers[digitIndex] - mid;
}

export function buildDigitInstances({
  digits,
  mode,
  viewport,
  seed = DEFAULT_SEED,
}: DigitLayoutInput): DigitInstance[] {
  const layout = getTimeVizLayout(mode, viewport);
  const random = createRandom(seed);
  const instances: DigitInstance[] = [];
  const activeDigits = digits.filter((char) => char !== '' && char !== undefined);
  const hasLetters = activeDigits.some((char) => typeof char === 'string' && /[A-Za-z]/.test(char));
  const is6DigitCountdown = mode === 'countdown' && !hasLetters && activeDigits.length === 6;

  for (let digitIndex = 0; digitIndex < layout.digitCapacity; digitIndex += 1) {
    const semanticMobilePlacement = mode === 'countdown' && viewport === 'mobile' && !hasLetters
      ? (is6DigitCountdown
          ? { row: Math.floor(digitIndex / 2), column: digitIndex % 2, rowLength: 2 }
          : mobileCountdownPlacement(digitIndex))
      : null;
    const groupColumn = semanticMobilePlacement?.column ?? digitIndex % layout.columns;
    const groupRow = semanticMobilePlacement?.row ?? Math.floor(digitIndex / layout.columns);
    const rowLength = semanticMobilePlacement?.rowLength ?? layout.columns;
    const glyph = getGlyph(digits[digitIndex]);

    let originX: number;
    let originY: number;

    if (viewport === 'desktop' && mode === 'reference') {
      originX = (Math.floor(digitIndex / 2) - 1) * 6.1 + ((digitIndex % 2) - 0.5) * layout.digitSpacing;
      originY = ((layout.rows - 1) / 2 - groupRow) * layout.rowSpacing;
    } else if (viewport === 'desktop' && mode === 'countdown') {
      if (hasLetters) {
        originX = desktopShanghaiOriginX(digitIndex);
      } else {
        originX = desktopCountdownOriginX(digitIndex, layout.digitSpacing, is6DigitCountdown ? 6 : 9);
      }
      originY = ((layout.rows - 1) / 2 - groupRow) * layout.rowSpacing;
    } else if (viewport === 'mobile' && hasLetters) {
      // 8 letters on mobile: SHANG (row 0), HAI (row 1)
      if (digitIndex < 5) {
        originX = (digitIndex - 2) * 2.3;
        originY = 2.4;
      } else {
        originX = (digitIndex - 5 - 1) * 2.6;
        originY = -2.4;
      }
    } else if (viewport === 'mobile' && is6DigitCountdown) {
      originX = (groupColumn - 0.5) * layout.digitSpacing;
      originY = ((3 - 1) / 2 - groupRow) * layout.rowSpacing;
    } else {
      originX = (groupColumn - (rowLength - 1) / 2) * layout.digitSpacing;
      originY = ((layout.rows - 1) / 2 - groupRow) * layout.rowSpacing;
    }

    const verticalCubeSpacing = viewport === 'mobile' ? 0.212 : 0.176;

    for (let row = 0; row < DIGIT_LATTICE_ROWS; row += 1) {
      for (let column = 0; column < DIGIT_LATTICE_COLUMNS; column += 1) {
        instances.push({
          key: `${digitIndex}:${row}:${column}`,
          digitIndex,
          groupRow,
          position: [
            originX + (column - (DIGIT_LATTICE_COLUMNS - 1) / 2) * layout.cubeSpacing,
            originY + ((DIGIT_LATTICE_ROWS - 1) / 2 - row) * verticalCubeSpacing,
            0,
          ],
          color: pastelColor(random, digitIndex, row, column),
          visible: isGlyphCellVisible(glyph, row, column),
        });
      }
    }
  }

  return instances;
}
