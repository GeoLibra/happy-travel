import { test, expect } from 'playwright/test';

import {
  createAcceptanceEvidence,
  openWelcome,
} from './support/showroom.ts';

const evidence = createAcceptanceEvidence('showroom-webkit-smoke');

test.afterEach(({}, testInfo) => evidence.recordFailure(testInfo));
test.afterAll(() =>
  evidence.writeSummary(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
);

test('WebKit renders the welcome control and canvas', async ({ page }) => {
  await openWelcome(page);
  await expect(page.locator('canvas')).not.toHaveCount(0);
  await expect(page.locator('[data-f1-welcome-action="enter"]')).toBeVisible();

  const screenshot = 'showroom-v2-overlay-webkit.png';
  await page.screenshot({
    path: evidence.screenshotPath(screenshot),
    fullPage: true,
  });
  evidence.record({
    name: 'WebKit showroom render smoke',
    viewport: 'Desktop WebKit (1280x800)',
    details: 'F1 welcome scene, WebGL canvas, and hold-to-start control rendered.',
    screenshot,
  });
});
