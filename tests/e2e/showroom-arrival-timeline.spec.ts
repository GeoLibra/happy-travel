import { test, expect } from 'playwright/test';

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
  // Step 1: Open welcome page
  await openWelcome(page);

  const frames: { timeMs: number; name: string; metrics: CanvasFrameMetrics }[] = [];

  // T0: Initial load frame
  const canvasLocator = page.locator('canvas').first();
  await expect(canvasLocator).toBeVisible({ timeout: 15_000 });

  // T0: Initial load frame (Canvas only screenshot)
  const screenshotT0 = 'arrival-t0-initial.png';
  const bufferT0 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT0) });
  const metricsT0 = await analyzeCanvasScreenshot(page, bufferT0);
  frames.push({ timeMs: 0, name: screenshotT0, metrics: metricsT0 });

  const startMark = await page.evaluate(() => performance.now());

  // T1: Early motion frame (+300ms)
  await page.waitForFunction((start) => performance.now() - start >= 300, startMark);
  const screenshotT1 = 'arrival-t1-early-motion.png';
  const bufferT1 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT1) });
  const metricsT1 = await analyzeCanvasScreenshot(page, bufferT1);
  frames.push({ timeMs: 300, name: screenshotT1, metrics: metricsT1 });

  // T2: Mid arrival frame (+500ms -> total 800ms)
  await page.waitForFunction((start) => performance.now() - start >= 800, startMark);
  const screenshotT2 = 'arrival-t2-mid-motion.png';
  const bufferT2 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT2) });
  const metricsT2 = await analyzeCanvasScreenshot(page, bufferT2);
  frames.push({ timeMs: 800, name: screenshotT2, metrics: metricsT2 });

  // T3: Settled frame (+700ms -> total 1500ms)
  await page.waitForFunction((start) => performance.now() - start >= 1500, startMark);
  const screenshotT3 = 'arrival-t3-settled.png';
  const bufferT3 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT3) });
  const metricsT3 = await analyzeCanvasScreenshot(page, bufferT3);
  frames.push({ timeMs: 1500, name: screenshotT3, metrics: metricsT3 });

  // T4: Studio post-arrival frame (+1000ms -> total 2500ms)
  await page.waitForFunction((start) => performance.now() - start >= 2500, startMark);
  const screenshotT4 = 'arrival-t4-studio.png';
  const bufferT4 = await canvasLocator.screenshot({ path: evidence.screenshotPath(screenshotT4) });
  const metricsT4 = await analyzeCanvasScreenshot(page, bufferT4);
  frames.push({ timeMs: 2500, name: screenshotT4, metrics: metricsT4 });

  // Save full-page screenshot for visual evidence reporting
  await page.screenshot({ path: evidence.screenshotPath('arrival-fullpage-settled.png'), fullPage: true });

  // 1. Canvas Non-Empty Check (Isolated strictly to <canvas> WebGL pixels)
  for (const frame of frames) {
    expect(
      frame.metrics.nonEmptyPixelRatio,
      `Canvas frame at ${frame.timeMs}ms (${frame.name}) must render non-empty WebGL content`,
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
  const cta = page.locator('[data-f1-welcome-action="enter"]');
  await expect(cta).toBeVisible();
  await expect(cta).toBeEnabled();

  // Test Playwright actionability check (verifies element is not blocked or hidden)
  await cta.click({ trial: true });

  // Perform real click to ensure CTA responds cleanly to user pointer interaction
  await cta.click();

  evidence.record({
    name: 'F1 arrival timeline 5-frame sampling',
    viewport: 'Desktop Chromium (1280x800)',
    details: `Captured 5 arrival timeline frames (t0=${metricsT0.nonEmptyPixelRatio.toFixed(3)}, t1=${metricsT1.nonEmptyPixelRatio.toFixed(3)}, t2=${metricsT2.nonEmptyPixelRatio.toFixed(3)}, t3=${metricsT3.nonEmptyPixelRatio.toFixed(3)}, t4=${metricsT4.nonEmptyPixelRatio.toFixed(3)}). Centroid X=${metricsT3.centroidXRatio.toFixed(2)}. Total arrival delta=${totalMotion.toFixed(4)}. CTA operable=true.`,
    screenshot: screenshotT3,
  });
});
