import { test, expect } from 'playwright/test';

import {
  createAcceptanceEvidence,
  openWelcome,
} from './support/showroom.ts';

const evidence = createAcceptanceEvidence('showroom-mobile-chromium');

test.afterEach(({}, testInfo) => evidence.recordFailure(testInfo));
test.afterAll(() =>
  evidence.writeSummary(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
);

test('mobile touch viewport renders the F1 welcome controls', async ({
  page,
}) => {
  await openWelcome(page);
  const enter = page.locator('[data-f1-welcome-action="enter"]');
  await expect(enter).toContainText(/HOLD TO START|CALIBRATING/);

  const screenshot = 'showroom-v2-overlay-mobile.png';
  await page.screenshot({
    path: evidence.screenshotPath(screenshot),
    fullPage: true,
  });

  evidence.record({
    name: 'Emulated Chrome mobile showroom acceptance',
    viewport: 'Mobile Chromium (390x844, touch emulation)',
    details: 'The welcome CTA and car canvas rendered in a touch-enabled viewport. This is CI emulation, not real-device coverage.',
    screenshot,
  });
});
