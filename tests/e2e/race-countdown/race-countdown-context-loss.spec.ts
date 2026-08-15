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

test('WebGL context loss preserves a navigable DOM countdown fallback', async ({ page }) => {
  const countdown = new RaceCountdownPageObject(page);
  await countdown.goto();
  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready');
  await countdown.waitForObservabilityReady();

  await countdown.loseWebGLContext();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'webgl-fallback');
  await expect(countdown.domFallback).toBeVisible();
  await expect(countdown.domFallback.locator('[data-countdown-unit]')).toHaveCount(4);
  await expect(countdown.canvas).toHaveCount(0);
  await expect(countdown.backButton).toBeVisible();
  await countdown.backButton.click();
  await expect(page).toHaveURL(/\/$/);
});
