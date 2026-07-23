import { describe, expect, it } from 'vitest';
import { resolveImpact } from '../../../scripts/ci/resolve-impact.mjs';

describe('Impact Resolver', () => {
  it('resolves F1 source changes to F1 suites', () => {
    const result = resolveImpact({
      files: ['src/lib/f1-motion.ts', 'src/components/WelcomePage.tsx'],
      map: null,
    });

    expect(result.full).toBe(false);
    expect(result.unit).toContain('tests/unit/f1');
    expect(result.assets).toContain('f1');
    expect(result.e2e).toContain('f1');
    expect(result.memory).toContain('f1');
  });

  it('resolves Rose changes to Rose suites', () => {
    const result = resolveImpact({
      files: ['src/lib/rose-animation.ts', 'src/components/ThreeRose.tsx'],
      map: null,
    });

    expect(result.full).toBe(false);
    expect(result.unit).toContain('tests/unit/rose');
    expect(result.assets).toContain('rose');
    expect(result.e2e).toContain('rose');
    expect(result.memory).toContain('rose');
  });

  it('resolves Particle changes to Particle suites', () => {
    const result = resolveImpact({
      files: ['src/components/ParticleBackground.tsx'],
      map: null,
    });

    expect(result.full).toBe(false);
    expect(result.unit).toContain('tests/unit/particles');
    expect(result.e2e).toContain('itinerary-particles');
    expect(result.memory).toContain('particles');
  });

  it('resolves i18n changes to i18n suites', () => {
    const result = resolveImpact({
      files: ['src/i18n/index.ts', 'src/data/itinerary.json'],
      map: null,
    });

    expect(result.full).toBe(false);
    expect(result.unit).toContain('tests/unit/i18n');
    expect(result.e2e).toContain('smoke');
  });

  it('fails open to all suites when an unknown file changes', () => {
    const result = resolveImpact({
      files: ['src/unknown/new-feature.ts'],
      map: null,
    });

    expect(result.full).toBe(true);
    expect(result.unit).toEqual(expect.arrayContaining(['tests/unit/f1', 'tests/unit/rose', 'tests/unit/particles', 'tests/unit/i18n', 'tests/unit/ci']));
    expect(result.assets).toContain('all');
    expect(result.e2e).toEqual(expect.arrayContaining(['f1', 'itinerary-particles', 'rose', 'smoke']));
    expect(result.memory).toEqual(expect.arrayContaining(['f1', 'particles', 'rose']));
    expect(result.reasons.some((r) => r.includes('Unmatched path'))).toBe(true);
  });

  it('fails open to all suites when explicit --all is requested', () => {
    const result = resolveImpact({ all: true, map: null });

    expect(result.full).toBe(true);
    expect(result.reasons).toContain('Explicit --all requested');
  });
});
