import { expect, test } from 'playwright/test';

import { RaceCountdownPageObject } from '../pages/RaceCountdownPage';

test('reference route exposes one ready canvas and desktop layout', async ({ page }) => {
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();

  await countdown.waitForSceneReady();
  await expect(countdown.canvas).toBeVisible();
  await expect(countdown.layout).toHaveAttribute('data-time-viz-layout', 'desktop-row');
});

test('reference route groups digits into three rows on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();

  await countdown.waitForSceneReady();
  await expect(countdown.layout).toHaveAttribute('data-time-viz-layout', 'mobile-three-row');
});

test('reference clock advances once per second', async ({ page }) => {
  const countdown = new RaceCountdownPageObject(page);
  await countdown.gotoReference();
  await countdown.waitForSceneReady();
  const initialDigits = await countdown.scene.getAttribute('data-time-viz-digits');

  await expect(countdown.scene).not.toHaveAttribute('data-time-viz-digits', initialDigits ?? '');
});
