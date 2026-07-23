import { test, expect, type Page } from 'playwright/test';

import { createAcceptanceEvidence, openWelcome } from './support/showroom.ts';

const evidence = createAcceptanceEvidence('webgl-renderer-lifecycle-chromium');

test.afterEach(({}, testInfo) => evidence.recordFailure(testInfo));
test.afterAll(() =>
  evidence.writeSummary(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
);

interface WebGLAuditMetrics {
  geometries: number;
  textures: number;
  programs: number;
  activeAnimationFrames: number;
}

function hasStrictMonotonicGrowth(values: number[]): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return false; // Found a non-increasing step, not strictly monotonic
    }
  }
  return true; // Every step strictly increased
}

async function triggerEnterToMainApp(page: Page): Promise<void> {
  const enterCta = page.locator('[data-f1-welcome-action="enter"]');
  await expect(enterCta).toBeVisible({ timeout: 15_000 });

  // Dispatch primary pointerdown to trigger engine start pressing state
  await enterCta.evaluate((el) => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        button: 0,
      }),
    );
  });

  // Wait 2.5s for engine start progress interval to pass 30% and auto-accelerate to 100%
  await page.waitForTimeout(2500);

  // Trigger enter handoff to main application
  await enterCta.evaluate((el) => {
    el.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        button: 0,
      }),
    );
    (el as HTMLElement).click();
  });

  // Wait for Main Application view to be visible
  await page.locator('main').waitFor({ state: 'visible', timeout: 15_000 });
}

test('runs 5-cycle WebGL renderer lifecycle trend and verifies GPU resources do not grow monotonically', async ({
  page,
}) => {
  test.setTimeout(120_000); // Allow sufficient time for 5 WebGL reassembly cycles

  const samples: { cycle: number; metrics: WebGLAuditMetrics }[] = [];

  // Step 1: Open WelcomePage
  await openWelcome(page);

  for (let cycle = 1; cycle <= 5; cycle++) {
    console.log(`[WebGL Lifecycle Trend] Executing Cycle ${cycle}...`);

    // 1. Enter Main Application
    await triggerEnterToMainApp(page);

    // Brief pause for main app UI to render
    await page.waitForTimeout(500);

    // 2. Click return button to unmount Main App and return to WelcomePage
    const returnBtn = page.locator('[data-app-action="return-welcome"]');
    await expect(returnBtn).toBeVisible({ timeout: 5000 });
    await returnBtn.click({ force: true });

    // 3. Wait for WelcomePage to be remounted and ready
    const enterCta = page.locator('[data-f1-welcome-action="enter"]');
    await expect(enterCta).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);

    // 4. Query WebGL renderer telemetry snapshot
    const metrics = await page.evaluate(() => {
      const audit = (window as any).__F1_SHOWROOM_RESOURCE_AUDIT__;
      if (typeof audit === 'function') {
        const data = audit();
        return {
          geometries: Number(data.geometries ?? 0),
          textures: Number(data.textures ?? 0),
          programs: Number(data.programs ?? 0),
          activeAnimationFrames: Number(data.activeAnimationFrames ?? 0),
        };
      }
      return null;
    });

    expect(
      metrics,
      `WebGL Telemetry snapshot must be exposed on window.__F1_SHOWROOM_RESOURCE_AUDIT__ in cycle ${cycle}`,
    ).not.toBeNull();

    if (metrics) {
      samples.push({ cycle, metrics });
      console.log(
        `[WebGL Cycle ${cycle}] Geometries=${metrics.geometries}, Textures=${metrics.textures}, Programs=${metrics.programs}, ActiverAF=${metrics.activeAnimationFrames}`,
      );
    }
  }

  // Treat Cycle 1 as shader, texture, and model pre-warmup.
  const warmSamples = samples.slice(1);
  const geometriesTrend = warmSamples.map((s) => s.metrics.geometries);
  const texturesTrend = warmSamples.map((s) => s.metrics.textures);
  const programsTrend = warmSamples.map((s) => s.metrics.programs);

  // Assertions for Cycles 2..5: WebGL GPU resources must NOT exhibit strict monotonic growth
  expect(
    hasStrictMonotonicGrowth(geometriesTrend),
    `WebGL geometries count (${geometriesTrend.join(', ')}) must not grow strictly monotonically across cycles 2-5`,
  ).toBe(false);

  expect(
    hasStrictMonotonicGrowth(texturesTrend),
    `WebGL textures count (${texturesTrend.join(', ')}) must not grow strictly monotonically across cycles 2-5`,
  ).toBe(false);

  expect(
    hasStrictMonotonicGrowth(programsTrend),
    `WebGL shader programs count (${programsTrend.join(', ')}) must not grow strictly monotonically across cycles 2-5`,
  ).toBe(false);

  // Record summary evidence for review
  const lastSample = samples[samples.length - 1].metrics;
  evidence.record({
    name: 'WebGL 5-cycle renderer lifecycle trend audit',
    viewport: 'Desktop Chromium (1280x800)',
    details: `Successfully completed 5 lifecycle cycles. Cycle 5 WebGL Telemetry: Geometries=${lastSample.geometries}, Textures=${lastSample.textures}, Programs=${lastSample.programs}. Monotonic growth absent across cycles 2-5.`,
    screenshot: 'arrival-fullpage-settled.png',
  });
});
