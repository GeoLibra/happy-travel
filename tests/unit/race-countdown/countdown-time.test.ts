import { describe, expect, it } from 'vitest';

import {
  formatCountdownDigits,
  splitRemainingTime,
} from '@/src/features/race-countdown/countdown-time';

describe('splitRemainingTime', () => {
  it('keeps three day digits and two digits for other units', () => {
    const parts = splitRemainingTime(
      Date.parse('2027-03-15T07:00:00Z'),
      Date.parse('2026-08-15T07:00:00Z'),
    );

    expect(formatCountdownDigits(parts)).toEqual(['2', '1', '2', '0', '0', '0', '0', '0', '0']);
  });

  it('clamps elapsed countdowns to zero', () => {
    expect(splitRemainingTime(100, 101)).toEqual({
      days: 0, hours: 0, minutes: 0, seconds: 0, elapsed: true,
    });
  });

  it('keeps an exact target instant active at zero', () => {
    expect(splitRemainingTime(100, 100)).toEqual({
      days: 0, hours: 0, minutes: 0, seconds: 0, elapsed: false,
    });
  });
});
