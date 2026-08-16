import { expect, test } from 'playwright/test';

import { RaceCountdownPageObject } from '../pages/RaceCountdownPage';
import { ItineraryPage } from '../pages/ItineraryPage';

const officialShanghaiFixture = {
  MRData: {
    RaceTable: {
      Races: [{
        season: '2027',
        date: '2027-03-21',
        time: '07:00:00Z',
        Circuit: { circuitId: 'shanghai' },
      }],
    },
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('happy-travel-locale', 'zh'));
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: officialShanghaiFixture })
  ));
  // Mock Google Fonts to use local font and avoid network flakiness
  await page.route('https://fonts.googleapis.com/css2**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: `@font-face {
  font-family: 'Russo One';
  font-style: normal;
  font-weight: 400;
  src: url('/fonts/RussoOne-Regular.ttf') format('truetype');
}`,
  }));
});

test('reference route matches the dedicated project viewport and layout', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'race-countdown-mobile-chromium';
  expect(page.viewportSize()).toEqual(mobile
    ? { width: 390, height: 844 }
    : { width: 1280, height: 720 });
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();

  await countdown.waitForSceneReady();
  await expect(countdown.canvas).toBeVisible();
  await expect(countdown.layout).toHaveAttribute(
    'data-time-viz-layout',
    mobile ? 'mobile-three-row' : 'desktop-row',
  );
});

test('reference route groups digits into three rows on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();
  await countdown.waitForSceneReady();

  await expect(countdown.layout).toHaveAttribute('data-time-viz-layout', 'desktop-row');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(countdown.layout).toHaveAttribute('data-time-viz-layout', 'mobile-three-row');
  await expect(countdown.scene).toHaveAttribute('data-time-viz-viewport', 'mobile');
});

test('reference clock advances once per second', async ({ page }) => {
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();
  await countdown.waitForSceneReady();
  const initialDigits = await countdown.scene.getAttribute('data-time-viz-digits');

  await expect(countdown.scene).not.toHaveAttribute('data-time-viz-digits', initialDigits ?? '');
});

test('product countdown places the RB20 in the desktop scene', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'race-countdown-desktop-chromium');
  test.setTimeout(240_000);
  const countdown = new RaceCountdownPageObject(page);
  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready', { timeout: 60_000 });
  await expect(countdown.product).toHaveAttribute('data-countdown-vehicle', 'ready', { timeout: 60_000 });
  await expect(countdown.canvas).toBeVisible();
  await expect(countdown.canvas).toHaveCount(1);
  await page.evaluate(() => new Promise<void>((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )));
  await page.screenshot({ path: 'output/reference/countdown-rb20-desktop.png' });
});

test('product countdown keeps the RB20 framed on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'race-countdown-mobile-chromium');
  test.setTimeout(240_000);
  const countdown = new RaceCountdownPageObject(page);
  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready', { timeout: 60_000 });
  await expect(countdown.product).toHaveAttribute('data-countdown-vehicle', 'ready', { timeout: 60_000 });
  await expect(countdown.canvas).toBeVisible();
  await expect(countdown.product).toHaveAttribute('data-countdown-layout', 'mobile-unit-rows', { timeout: 60_000 });
  await expect(countdown.product).toHaveAttribute('data-countdown-unit-rows', 'DDD|HH|MM|SS', { timeout: 60_000 });
  await expect(countdown.canvas).toHaveCSS('height', '844px');
  await page.evaluate(() => new Promise<void>((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )));
  await page.screenshot({ path: 'output/reference/countdown-rb20-mobile.png' });
});

test('countdown renderer resources return to baseline after five open and close cycles', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'race-countdown-desktop-chromium');
  test.setTimeout(480_000);

  const itinerary = new ItineraryPage(page);
  const countdown = new RaceCountdownPageObject(page);
  await itinerary.completeWelcomeIgnition();

  const baseline = await countdown.readObservability();
  expect(baseline).toMatchObject({
    activeAnimationFrames: 0,
    activeListeners: 0,
    activeScenes: 0,
    composers: 0,
    environments: 0,
    frameCount: 0,
    floors: 0,
    geometries: 0,
    materials: 0,
    mode: null,
    ready: false,
    renderers: 0,
    resourceCount: 0,
    vehicles: 0,
    viewport: null,
  });

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await itinerary.openFullCountdown();
    await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready', { timeout: 60_000 });
    await expect(countdown.product).toHaveAttribute('data-countdown-vehicle', 'ready', { timeout: 60_000 });
    const active = await countdown.waitForObservabilityReady(60_000);
    expect(active.activeScenes, `cycle ${cycle} must own one countdown scene`).toBe(1);
    expect(active.activeAnimationFrames, `cycle ${cycle} must own one animation frame`).toBe(1);
    expect(active.activeListeners, `cycle ${cycle} must own its context listener`).toBe(1);
    expect(active.renderers, `cycle ${cycle} must own one renderer`).toBe(1);
    expect(active.composers, `cycle ${cycle} must own one composer`).toBe(1);
    expect(active.vehicles, `cycle ${cycle} must own one vehicle clone`).toBe(1);
    expect(active.resourceCount, `cycle ${cycle} must report owned resources`).toBeGreaterThan(0);

    await countdown.backButton.click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => await countdown.readObservability()).toEqual(baseline);
  }
});
