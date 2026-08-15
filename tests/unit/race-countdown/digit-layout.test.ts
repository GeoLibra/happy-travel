import { describe, expect, it } from 'vitest';

import { digit } from '@/src/components/digit';
import {
  buildDigitInstances,
  CELLS_PER_DIGIT,
  DIGIT_LATTICE_COLUMNS,
  DIGIT_LATTICE_ROWS,
} from '@/src/features/race-countdown/digit-layout';

describe('buildDigitInstances', () => {
  it('places six reference digits in one desktop row', () => {
    const result = buildDigitInstances({
      digits: ['1', '2', '3', '4', '5', '6'],
      mode: 'reference',
      viewport: 'desktop',
    });

    expect(new Set(result.map((item) => item.groupRow))).toEqual(new Set([0]));
  });

  it('places reference digits as three mobile pairs', () => {
    const result = buildDigitInstances({
      digits: ['1', '2', '3', '4', '5', '6'],
      mode: 'reference',
      viewport: 'mobile',
    });

    expect([...new Set(result.map((item) => item.groupRow))]).toEqual([0, 1, 2]);
  });

  it('returns stable colors for a fixed seed', () => {
    const a = buildDigitInstances({
      digits: ['8'], mode: 'reference', viewport: 'desktop', seed: 26,
    });
    const b = buildDigitInstances({
      digits: ['8'], mode: 'reference', viewport: 'desktop', seed: 26,
    });

    expect(a.map((item) => item.color)).toEqual(b.map((item) => item.color));
  });

  it('keeps a nine-digit countdown cube pool and hides unused slots', () => {
    const result = buildDigitInstances({
      digits: ['1'], mode: 'countdown', viewport: 'desktop', seed: 26,
    });

    expect(result).toHaveLength(9 * CELLS_PER_DIGIT);
    expect(result.filter((item) => item.digitIndex === 1).every((item) => !item.visible)).toBe(true);
  });

  it('supersamples each logical glyph cell into a dense 20 by 14 lattice', () => {
    const result = buildDigitInstances({
      digits: ['8'], mode: 'reference', viewport: 'desktop', seed: 26,
    }).filter((item) => item.digitIndex === 0);
    const logicalActiveCells = digit[8].flat().filter((cell) => cell === 1).length;

    expect(DIGIT_LATTICE_ROWS).toBe(20);
    expect(DIGIT_LATTICE_COLUMNS).toBe(14);
    expect(result).toHaveLength(280);
    expect(result.filter((item) => item.visible).length).toBeGreaterThan(logicalActiveCells * 4);
    expect(result.filter((item) => item.visible).length).toBeLessThan(logicalActiveCells * 9);
  });
});
