import { test, expect } from 'playwright/test';

import {
  createAcceptanceEvidence,
  openWelcome,
} from './support/showroom.ts';

const evidence = createAcceptanceEvidence('showroom-desktop-chromium');

test.afterEach(({}, testInfo) => evidence.recordFailure(testInfo));
test.afterAll(() =>
  evidence.writeSummary(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
);

test('captures the desktop F1 welcome arrival frame and controls', async ({
  page,
}) => {
  await openWelcome(page);
  await expect(page.locator('[data-f1-welcome-action="enter"]')).toContainText(
    /HOLD TO START|CALIBRATING/,
  );

  const arrivalScreenshot = 'showroom-v2-overlay-desktop.png';
  await page.screenshot({
    path: evidence.screenshotPath(arrivalScreenshot),
    fullPage: true,
  });

  evidence.record({
    name: 'Desktop F1 welcome arrival frame',
    viewport: 'Desktop Chromium (1280x800)',
    details: 'Captured the loaded welcome CTA, foreground car canvas, and final arrival framing.',
    screenshot: arrivalScreenshot,
  });
});
