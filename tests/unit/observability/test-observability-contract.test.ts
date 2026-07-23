import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Contract test: test-observability.ts must never expose __HAPPY_TRAVEL_TEST__
 * unconditionally in production builds. This prevents the `|| true` regression
 * and ensures the gate uses compile-time-eliminable checks.
 */
describe('test-observability production gate contract', () => {
  const filePath = path.resolve(__dirname, '../../../src/lib/test-observability.ts');
  const source = fs.readFileSync(filePath, 'utf-8');

  it('must not contain unconditional true in gate logic', () => {
    // Match patterns like `|| true` that would bypass env checks
    const hasDangerousTrue = /\|\|\s*true\b/.test(source);
    expect(
      hasDangerousTrue,
      'test-observability.ts must not contain `|| true` — this leaks the test API to production builds',
    ).toBe(false);
  });

  it('must gate on import.meta.env.PROD for compile-time dead-code elimination', () => {
    expect(source).toContain('import.meta.env.PROD');
  });

  it('must support VITE_TEST_OBSERVABILITY opt-in for CI builds', () => {
    expect(source).toContain('VITE_TEST_OBSERVABILITY');
  });

  it('must not use window.__HAPPY_TRAVEL_TEST__ assignment outside the guarded block', () => {
    const assignments = source.match(/window\.__HAPPY_TRAVEL_TEST__\s*=/g) || [];
    expect(
      assignments.length,
      'There should be exactly one assignment of window.__HAPPY_TRAVEL_TEST__, inside the guarded block',
    ).toBe(1);
  });

  it('must not contain runtime-only gates that prevent Vite tree-shaking', () => {
    // Ensure no `Boolean(window.__HAPPY_TRAVEL_TEST_MODE__)` without a compile-time guard
    // The primary gate should be import.meta.env.PROD which Vite can statically eliminate
    const hasRuntimeOnlyGate = /isTestOrDev\s*=[\s\S]*Boolean\(window/.test(source);
    expect(
      hasRuntimeOnlyGate,
      'Gate must not use runtime-only checks as the primary condition — use import.meta.env.PROD',
    ).toBe(false);
  });
});
