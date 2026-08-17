import { describe, expect, it } from 'vitest';

import { CountdownStackHeightfield } from '@/src/features/race-countdown/countdown-stack-heightfield';

describe('CountdownStackHeightfield', () => {
  it('initializes with zero height across the bounds', () => {
    const hf = new CountdownStackHeightfield();
    expect(hf.queryHeight(0, 0)).toBe(0);
    expect(hf.queryHeight(-5, 2)).toBe(0);
    expect(hf.queryHeight(100, 100)).toBe(0); // Out of bounds returns 0
  });

  it('deposits height and diffuses to neighbors', () => {
    const hf = new CountdownStackHeightfield();
    hf.deposit(0, 0, 0.1);

    const centerH = hf.queryHeight(0, 0);
    expect(centerH).toBeGreaterThan(0);
    expect(centerH).toBeCloseTo(0.1, 4);

    // Neighbor cells should have received diffused height
    const neighborH = hf.queryHeight(0.12, 0);
    expect(neighborH).toBeGreaterThan(0);
  });

  it('clamps deposited height to maxHeight', () => {
    const hf = new CountdownStackHeightfield();
    for (let i = 0; i < 50; i += 1) {
      hf.deposit(0, 0, 0.1);
    }
    expect(hf.queryHeight(0, 0)).toBeLessThanOrEqual(hf.maxHeight);
  });

  it('computes slope gradients pointing away from peaks', () => {
    const hf = new CountdownStackHeightfield();
    hf.deposit(0, 0, 0.3);

    // At +X side of peak (x = 0.12), height decreases towards positive X, so gx should be positive or negative
    // Gradient: (H(x+dx) - H(x-dx)) / 2dx
    // Since center (0, 0) is high and right (+0.24) is low, gx at 0.12 is (low - high) / 2dx < 0
    const gradRight = hf.queryGradient(0.12, 0);
    expect(gradRight.gx).toBeLessThan(0); // Slopes down to the right

    const gradLeft = hf.queryGradient(-0.12, 0);
    expect(gradLeft.gx).toBeGreaterThan(0); // Slopes down to the left
  });

  it('resets all heights to zero', () => {
    const hf = new CountdownStackHeightfield();
    hf.deposit(0, 0, 0.3);
    expect(hf.queryHeight(0, 0)).toBeGreaterThan(0);

    hf.reset();
    expect(hf.queryHeight(0, 0)).toBe(0);
  });
});
