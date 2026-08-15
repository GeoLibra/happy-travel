import { digit as digitMatrices } from '@/src/components/digit';

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

const LAYOUTS: Record<ViewportKind, Omit<LayoutMetrics, 'columns' | 'rows' | 'digitCapacity'>> = {
  desktop: {
    cubeSpacing: 0.17,
    digitSpacing: 2.4,
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

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const microRow = row + rowOffset;
      const microColumn = column + columnOffset;
      if (microRow < 0 || microColumn < 0) continue;
      if (glyph[Math.floor(microRow / 2)]?.[Math.floor(microColumn / 2)] === 1) return true;
    }
  }

  return false;
}

export function getTimeVizLayout(mode: TimeVizMode, viewport: ViewportKind): LayoutMetrics {
  const capacity = digitCapacity(mode);
  const columns = viewport === 'desktop' ? capacity : 2;

  return {
    ...LAYOUTS[viewport],
    columns,
    rows: Math.ceil(capacity / columns),
    digitCapacity: capacity,
  };
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

  for (let digitIndex = 0; digitIndex < layout.digitCapacity; digitIndex += 1) {
    const groupColumn = digitIndex % layout.columns;
    const groupRow = Math.floor(digitIndex / layout.columns);
    const glyph = digitMatrices[Number(digits[digitIndex])];
    const originX = viewport === 'desktop' && mode === 'reference'
      ? (Math.floor(digitIndex / 2) - 1) * 6.1 + ((digitIndex % 2) - 0.5) * layout.digitSpacing
      : (groupColumn - (layout.columns - 1) / 2) * layout.digitSpacing;
    const originY = ((layout.rows - 1) / 2 - groupRow) * layout.rowSpacing;
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
