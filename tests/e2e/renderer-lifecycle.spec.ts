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
  activeListeners: number;
  activeRenderTargets: number;
  materials: number;
}

/**
 * Navigate from WelcomePage into the main app using real trusted browser input.
 * Waits for observable state transitions instead of fixed sleeps.
 */
async function triggerEnterToMainApp(page: Page): Promise<void> {
  const enterCta = page.locator('[data-f1-welcome-action="enter"]');
  await expect(enterCta).toBeVisible({ timeout: 15_000 });

  // Use real mouse down on the CTA center
  const box = await enterCta.boundingBox();
  if (!box) throw new Error('CTA bounding box not available');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();

  // Wait for observable engine progress to reach 100% (button text changes)
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-f1-welcome-action="enter"]');
    if (!btn) return false;
    const text = btn.textContent || '';
    return text.includes('ENTER') || text.includes('REASSEMBLING');
  }, { timeout: 10_000 });

  await page.mouse.up();

  // Click to trigger handoff
  await enterCta.click();

  // Wait for Main Application view to be visible (observable landmark)
  await page.locator('[data-app-action="return-welcome"]').waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Query the test observability API for WebGL resource snapshot.
 */
async function getResourceSnapshot(page: Page): Promise<WebGLAuditMetrics | null> {
  return page.evaluate(() => {
    const testApi = (window as any).__HAPPY_TRAVEL_TEST__;
    if (testApi && typeof testApi.snapshot === 'function') {
      const snap = testApi.snapshot();
      return {
        geometries: Number(snap.geometries ?? snap.gpu?.geometries ?? 0),
        textures: Number(snap.textures ?? snap.gpu?.textures ?? 0),
        programs: Number(snap.programs ?? snap.gpu?.programs ?? 0),
        activeAnimationFrames: Number(snap.activeAnimationFrames ?? snap.gpu?.activeAnimationFrames ?? 0),
        activeListeners: Number(snap.activeListeners ?? snap.gpu?.activeListeners ?? 0),
        activeRenderTargets: Number(snap.activeRenderTargets ?? snap.gpu?.activeRenderTargets ?? 0),
        materials: Number(snap.materials ?? snap.gpu?.materials ?? 0),
      };
    }
    // Fallback to legacy audit API
    const audit = (window as any).__F1_SHOWROOM_RESOURCE_AUDIT__;
    if (typeof audit === 'function') {
      const data = audit();
      return {
        geometries: Number(data.geometries ?? 0),
        textures: Number(data.textures ?? 0),
        programs: Number(data.programs ?? 0),
        activeAnimationFrames: Number(data.activeAnimationFrames ?? 0),
        activeListeners: 0,
        activeRenderTargets: 0,
        materials: 0,
      };
    }
    return null;
  });
}

test('runs 5-cycle WebGL renderer lifecycle trend and verifies GPU resources stabilize after warmup', async ({
  page,
}) => {
  test.setTimeout(180_000); // Allow sufficient time for 5 WebGL reassembly cycles

  const samples: { cycle: number; metrics: WebGLAuditMetrics }[] = [];

  // Step 1: Open WelcomePage
  await openWelcome(page);

  for (let cycle = 1; cycle <= 5; cycle++) {
    console.log(`[WebGL Lifecycle Trend] Executing Cycle ${cycle}...`);

    // 1. Enter Main Application via trusted browser input
    await triggerEnterToMainApp(page);

    // 2. Wait for main app to be fully interactive (return button visible)
    const returnBtn = page.locator('[data-app-action="return-welcome"]');
    await expect(returnBtn).toBeVisible({ timeout: 5000 });

    // 3. Click return button to unmount Main App and return to WelcomePage
    await returnBtn.click({ force: true });

    // 4. Wait for WelcomePage to be remounted and ready (observable landmark)
    const enterCta = page.locator('[data-f1-welcome-action="enter"]');
    await expect(enterCta).toBeVisible({ timeout: 15_000 });

    // Wait for canvas to be rendering (observable WebGL readiness)
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 10_000 });

    // 5. Query WebGL renderer telemetry snapshot
    const metrics = await getResourceSnapshot(page);

    expect(
      metrics,
      `WebGL Telemetry snapshot must be exposed via test observability API in cycle ${cycle}`,
    ).not.toBeNull();

    if (metrics) {
      samples.push({ cycle, metrics });
      console.log(
        `[WebGL Cycle ${cycle}] Geometries=${metrics.geometries}, Textures=${metrics.textures}, Programs=${metrics.programs}, ActiverAF=${metrics.activeAnimationFrames}`,
      );
    }
  }

  // --- Baseline stability assertions (cycles 2–5, after warmup cycle 1) ---
  const warmSamples = samples.slice(1); // cycles 2, 3, 4, 5
  const baseline = warmSamples[0].metrics;  // cycle 2 = post-warmup baseline

  for (let i = 1; i < warmSamples.length; i++) {
    const current = warmSamples[i].metrics;
    const cycleNum = warmSamples[i].cycle;

    // Geometries must stay within ±5% of baseline (shared renderer values must stabilize)
    expect(
      current.geometries,
      `Cycle ${cycleNum} geometries (${current.geometries}) must be within ±5% of baseline (${baseline.geometries})`,
    ).toBeLessThanOrEqual(Math.ceil(baseline.geometries * 1.05));
    expect(
      current.geometries,
      `Cycle ${cycleNum} geometries (${current.geometries}) must not drop below 95% of baseline (${baseline.geometries})`,
    ).toBeGreaterThanOrEqual(Math.floor(baseline.geometries * 0.95));

    // Textures must stay within ±5% of baseline
    expect(
      current.textures,
      `Cycle ${cycleNum} textures (${current.textures}) must be within ±5% of baseline (${baseline.textures})`,
    ).toBeLessThanOrEqual(Math.ceil(baseline.textures * 1.05));
    expect(
      current.textures,
      `Cycle ${cycleNum} textures (${current.textures}) must not drop below 95% of baseline (${baseline.textures})`,
    ).toBeGreaterThanOrEqual(Math.floor(baseline.textures * 0.95));

    // Programs must stay within ±5% of baseline
    expect(
      current.programs,
      `Cycle ${cycleNum} programs (${current.programs}) must be within ±5% of baseline (${baseline.programs})`,
    ).toBeLessThanOrEqual(Math.ceil(baseline.programs * 1.05));
    expect(
      current.programs,
      `Cycle ${cycleNum} programs (${current.programs}) must not drop below 95% of baseline (${baseline.programs})`,
    ).toBeGreaterThanOrEqual(Math.floor(baseline.programs * 0.95));
  }

  // Record summary evidence for review
  const lastSample = samples[samples.length - 1].metrics;
  evidence.record({
    name: 'WebGL 5-cycle renderer lifecycle trend audit',
    viewport: 'Desktop Chromium (1280x800)',
    details: `5 lifecycle cycles completed. Baseline (cycle 2): Geom=${baseline.geometries}, Tex=${baseline.textures}, Progs=${baseline.programs}. Cycle 5: Geom=${lastSample.geometries}, Tex=${lastSample.textures}, Progs=${lastSample.programs}. All cycles 2-5 within ±5% of baseline.`,
    screenshot: 'arrival-fullpage-settled.png',
  });
});
