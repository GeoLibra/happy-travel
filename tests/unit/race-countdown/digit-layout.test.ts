import { describe, expect, it } from 'vitest';

import { buildDigitInstances } from '@/src/features/race-countdown/digit-layout';

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

    expect(result).toHaveLength(9 * 10 * 7);
    expect(result.filter((item) => item.digitIndex === 1).every((item) => !item.visible)).toBe(true);
  });
});
