import { expect, test } from 'playwright/test';

import { RaceCountdownPageObject } from '../pages/RaceCountdownPage';

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
});

test('reference route exposes one ready canvas and desktop layout', async ({ page }) => {
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();

  await countdown.waitForSceneReady();
  await expect(countdown.canvas).toBeVisible();
  await expect(countdown.layout).toHaveAttribute('data-time-viz-layout', 'desktop-row');
});

test('reference route groups digits into three rows on mobile', async ({ page }) => {
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

test('product countdown places the RB20 in the desktop scene', async ({ page }) => {
  const countdown = new RaceCountdownPageObject(page);
  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready');
  await expect(countdown.product).toHaveAttribute('data-countdown-vehicle', 'ready');
  await expect(countdown.canvas).toBeVisible();
  await expect(countdown.canvas).toHaveCount(1);
  await page.evaluate(() => new Promise<void>((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )));
  await page.screenshot({ path: 'output/reference/countdown-rb20-desktop.png' });
});

test('product countdown keeps the RB20 framed on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const countdown = new RaceCountdownPageObject(page);
  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready');
  await expect(countdown.product).toHaveAttribute('data-countdown-vehicle', 'ready');
  await expect(countdown.canvas).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )));
  await page.screenshot({ path: 'output/reference/countdown-rb20-mobile.png' });
});
