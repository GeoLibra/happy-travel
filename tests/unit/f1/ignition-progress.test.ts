import { describe, expect, it } from 'vitest';

import { advanceIgnitionProgress } from '../../../src/lib/f1-ignition-progress';

describe('advanceIgnitionProgress', () => {
  it('preserves elapsed time across sub-cadence timer callbacks', () => {
    const first = advanceIgnitionProgress({ progress: 0, remainderMs: 0 }, 49);
    const second = advanceIgnitionProgress(first, 49);
    const third = advanceIgnitionProgress(second, 49);

    expect(first).toEqual({ progress: 0, remainderMs: 49 });
    expect(second).toEqual({ progress: 1, remainderMs: 48 });
    expect(third).toEqual({ progress: 2, remainderMs: 47 });
  });

  it('caps a delayed callback so a long frame cannot skip the visible cadence', () => {
    expect(advanceIgnitionProgress(
      { progress: 0, remainderMs: 0 },
      10_000,
    )).toEqual({ progress: 20, remainderMs: 0 });
  });

  it('caps progress at completion', () => {
    expect(advanceIgnitionProgress(
      { progress: 94, remainderMs: 0 },
      1_000,
    )).toEqual({ progress: 100, remainderMs: 0 });
  });
});
