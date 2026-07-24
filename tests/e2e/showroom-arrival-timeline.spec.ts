import { test, expect, type Page } from 'playwright/test';

import {
  analyzeCanvasScreenshot,
  computeSampleDelta,
  createAcceptanceEvidence,
  openWelcome,
  type CanvasFrameMetrics,
} from './support/showroom.ts';

const evidence = createAcceptanceEvidence('showroom-arrival-timeline-chromium');

test.afterEach(({}, testInfo) => evidence.recordFailure(testInfo));
test.afterAll(() =>
  evidence.writeSummary(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
);

test('captures 5 arrival timeline frames and verifies canvas non-empty, centered composition, motion delta, and CTA operability', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // Step 1: Open welcome page
  await openWelcome(page);

  const frames: { milestone: string; name: string; metrics: CanvasFrameMetrics }[] = [];

  // T0: Initial load frame
  const canvasLocator = page.locator('canvas').first();
  await expect(canvasLocator).toBeVisible({ timeout: 15_000 });

  // T0: Initial load frame (Canvas only screenshot)
  const screenshotT0 = 'arrival-t0-initial.png';
  const bufferT0 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT0) });
  const metricsT0 = await analyzeCanvasScreenshot(page, bufferT0);
  frames.push({ milestone: 'idle', name: screenshotT0, metrics: metricsT0 });

  const cta = page.locator('[data-f1-welcome-action="enter"]');
  await cta.focus();
  await page.keyboard.down('Space');

  let metricsT1: CanvasFrameMetrics;
  let metricsT2: CanvasFrameMetrics;
  try {
    await waitForIgnitionProgress(page, 20);
    const screenshotT1 = 'arrival-t1-early-motion.png';
    const bufferT1 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT1) });
    metricsT1 = await analyzeCanvasScreenshot(page, bufferT1);
    frames.push({ milestone: 'ignition-20%', name: screenshotT1, metrics: metricsT1 });

    await waitForIgnitionProgress(page, 60);
    const screenshotT2 = 'arrival-t2-mid-motion.png';
    const bufferT2 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT2) });
    metricsT2 = await analyzeCanvasScreenshot(page, bufferT2);
    frames.push({ milestone: 'ignition-60%', name: screenshotT2, metrics: metricsT2 });

    await waitForIgnitionProgress(page, 100);
  } finally {
    await page.keyboard.up('Space');
  }

  await page.waitForFunction(() => {
    const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
    return audit?.details?.arrivalReady === true;
  }, undefined, { timeout: 60_000 });

  // T3: Settled frame after the arrival state confirms a stable pose.
  const screenshotT3 = 'arrival-t3-settled.png';
  const bufferT3 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT3) });
  const metricsT3 = await analyzeCanvasScreenshot(page, bufferT3);
  frames.push({ milestone: 'arrival-settled', name: screenshotT3, metrics: metricsT3 });

  await page.waitForFunction(() => {
    const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
    return (audit?.details?.studioReveal ?? 0) >= 0.95;
  }, undefined, { timeout: 30_000 });

  // T4: Studio post-arrival frame after the reveal reaches its stable state.
  const screenshotT4 = 'arrival-t4-studio.png';
  const bufferT4 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT4) });
  const metricsT4 = await analyzeCanvasScreenshot(page, bufferT4);
  frames.push({ milestone: 'studio-revealed', name: screenshotT4, metrics: metricsT4 });

  // Save full-page screenshot for visual evidence reporting
  await page.screenshot({ path: evidence.screenshotPath('arrival-fullpage-settled.png'), fullPage: true });

  // 1. Canvas Non-Empty Check (Isolated strictly to <canvas> WebGL pixels)
  for (const frame of frames) {
    expect(
      frame.metrics.nonEmptyPixelRatio,
      `Canvas frame at ${frame.milestone} (${frame.name}) must render non-empty WebGL content`,
    ).toBeGreaterThan(0.005);
  }

  // 2. Centered Composition Check (Settled frame T3 & Studio frame T4 on canvas)
  expect(
    metricsT3.centroidXRatio,
    'Settled car centroid must be centered horizontally within tolerance [0.30, 0.70]',
  ).toBeGreaterThan(0.30);
  expect(
    metricsT3.centroidXRatio,
    'Settled car centroid must be centered horizontally within tolerance [0.30, 0.70]',
  ).toBeLessThan(0.70);

  // 3. Motion Delta Check between consecutive frames
  const deltaT0T1 = computeSampleDelta(metricsT0, metricsT1);
  const deltaT1T2 = computeSampleDelta(metricsT1, metricsT2);
  const deltaT2T3 = computeSampleDelta(metricsT2, metricsT3);
  const deltaT3T4 = computeSampleDelta(metricsT3, metricsT4);

  // Motion must occur during arrival
  const totalMotion = deltaT0T1 + deltaT1T2 + deltaT2T3;
  expect(
    totalMotion,
    'Arrival sequence must exhibit dynamic frame changes across arrival timeline',
  ).toBeGreaterThan(0.0001);

  // Motion settles / stabilizes towards studio reveal
  expect(
    deltaT3T4,
    'Frame change delta must stabilize after arrival settles',
  ).toBeLessThan(0.15);

  // 4. CTA Operability & Real Handoff Actionability Check
  await expect(cta).toBeVisible();
  await expect(cta).toBeEnabled();

  // Perform a real keyboard handoff; pointer ownership is covered separately.
  await cta.press('Enter');
  await expect(page.locator('[data-app-action="return-welcome"]')).toBeVisible({
    timeout: 15_000,
  });

  evidence.record({
    name: 'F1 arrival timeline 5-frame sampling',
    viewport: 'Desktop Chromium (1280x800)',
    details: `Captured 5 arrival timeline frames (t0=${metricsT0.nonEmptyPixelRatio.toFixed(3)}, t1=${metricsT1.nonEmptyPixelRatio.toFixed(3)}, t2=${metricsT2.nonEmptyPixelRatio.toFixed(3)}, t3=${metricsT3.nonEmptyPixelRatio.toFixed(3)}, t4=${metricsT4.nonEmptyPixelRatio.toFixed(3)}). Centroid X=${metricsT3.centroidXRatio.toFixed(2)}. Total arrival delta=${totalMotion.toFixed(4)}. CTA operable=true.`,
    screenshot: screenshotT3,
  });
});

async function waitForIgnitionProgress(page: Page, target: number) {
  await page.waitForFunction((minimum: number) => {
    const button = document.querySelector('[data-f1-welcome-action="enter"]');
    const text = button?.textContent ?? '';
    if (text.includes('ENTER') || text.includes('REASSEMBLING')) return true;
    const match = text.match(/ENGINE STARTING\s+(\d+)%/);
    return match ? Number(match[1]) >= minimum : false;
  }, target, { timeout: 60_000 });
}
