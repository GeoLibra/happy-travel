import { test, expect } from 'playwright/test';

import {
  createAcceptanceEvidence,
  waitForRacePrep,
} from './support/showroom.ts';

const evidence = createAcceptanceEvidence('app-desktop-chromium');

test.afterEach(({}, testInfo) => evidence.recordFailure(testInfo));
test.afterAll(() =>
  evidence.writeSummary(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
);

test('default route renders the welcome experience without showroom overlay', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForRacePrep(page);

  await expect(page.locator('[data-showroom-overlay="true"]')).toHaveCount(0);
  await expect(page.locator('[data-f1-welcome-action="enter"]')).toBeVisible();
  await expect(page.locator('canvas')).not.toHaveCount(0);

  const screenshot = 'showroom-default-route-desktop.png';
  await page.screenshot({
    path: evidence.screenshotPath(screenshot),
    fullPage: true,
  });
  evidence.record({
    name: 'Default route welcome experience',
    viewport: 'Desktop Chromium (1280x800)',
    details: 'Welcome CTA and car canvas are visible without the showroom overlay.',
    screenshot,
  });
});

