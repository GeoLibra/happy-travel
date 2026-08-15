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

const DIGIT_ROWS = 10;
const DIGIT_COLUMNS = 7;
const REFERENCE_DIGIT_CAPACITY = 6;
const COUNTDOWN_DIGIT_CAPACITY = 9;
const DEFAULT_SEED = 26;

const LAYOUTS: Record<ViewportKind, Omit<LayoutMetrics, 'columns' | 'rows' | 'digitCapacity'>> = {
  desktop: {
    cubeSpacing: 0.34,
    digitSpacing: 2.83,
    rowSpacing: 4.1,
  },
  mobile: {
    cubeSpacing: 0.28,
    digitSpacing: 2.34,
    rowSpacing: 3.35,
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

function pastelColor(random: () => number): string {
  const hue = Math.floor(random() * 360);
  const saturation = 68 + Math.floor(random() * 13);
  const lightness = 70 + Math.floor(random() * 11);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
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
    const originX = (groupColumn - (layout.columns - 1) / 2) * layout.digitSpacing;
    const originY = ((layout.rows - 1) / 2 - groupRow) * layout.rowSpacing;

    for (let row = 0; row < DIGIT_ROWS; row += 1) {
      for (let column = 0; column < DIGIT_COLUMNS; column += 1) {
        instances.push({
          key: `${digitIndex}:${row}:${column}`,
          digitIndex,
          groupRow,
          position: [
            originX + (column - (DIGIT_COLUMNS - 1) / 2) * layout.cubeSpacing,
            originY + ((DIGIT_ROWS - 1) / 2 - row) * layout.cubeSpacing,
            0,
          ],
          color: pastelColor(random),
          visible: glyph?.[row]?.[column] === 1,
        });
      }
    }
  }

  return instances;
}
