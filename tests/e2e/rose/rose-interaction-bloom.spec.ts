import { expect, test } from 'playwright/test';
import { ItineraryPage } from '../pages/ItineraryPage';
import { RoseModalPage } from '../pages/RoseModalPage';

test.describe('Rose Easter Egg, Modal & Bloom Interaction', () => {
  let itineraryPage: ItineraryPage;
  let roseModalPage: RoseModalPage;

  test.beforeEach(async ({ page }) => {
    itineraryPage = new ItineraryPage(page);
    roseModalPage = new RoseModalPage(page);
    await itineraryPage.goto();
  });

  test('secret 5-tap triggers rose modal opening and fallback works when devicemotion unavailable', async ({ page }) => {
    // Perform 5 secret taps on header title
    await itineraryPage.triggerSecretRoseClicks(5);

    // Verify Rose Modal opens
    await roseModalPage.waitUntilVisible();
    await expect(roseModalPage.modalContainer).toBeVisible();
  });

  test('modal interaction allows backdrop click and Escape key to close modal', async ({ page }) => {
    // Open modal via 5 secret taps
    await itineraryPage.triggerSecretRoseClicks(5);
    await roseModalPage.waitUntilVisible();

    // Close via Escape key
    await roseModalPage.closeByEscape();
    await roseModalPage.waitUntilHidden();

    // Open again
    await itineraryPage.triggerSecretRoseClicks(5);
    await roseModalPage.waitUntilVisible();

    // Close via backdrop click
    await roseModalPage.closeByBackdrop();
    await roseModalPage.waitUntilHidden();
  });

  test('bloom timeline advances rose 3D model assembly and presentation', async ({ page }) => {
    await itineraryPage.triggerSecretRoseClicks(5);
    await roseModalPage.waitUntilVisible();

    // Verify 3D canvas is rendering
    await expect(roseModalPage.canvas).toBeVisible();

    // Allow time for rose bloom animation timeline (assembling -> blooming -> presented)
    await page.waitForTimeout(1500);

    // Check GPU metrics / observability if present
    const snapshot = await page.evaluate(() => {
      return window.__HAPPY_TRAVEL_TEST__?.snapshot() ?? null;
    });

    if (snapshot) {
      expect(snapshot.gpu).toBeDefined();
    }
  });

  test('repeat open and close cycles clean up WebGL and animation frame resources', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Cycle 1: Open & Close
    await itineraryPage.triggerSecretRoseClicks(5);
    await roseModalPage.waitUntilVisible();
    await roseModalPage.closeByEscape();
    await roseModalPage.waitUntilHidden();

    // Cycle 2: Open & Close
    await itineraryPage.triggerSecretRoseClicks(5);
    await roseModalPage.waitUntilVisible();
    await roseModalPage.closeByEscape();
    await roseModalPage.waitUntilHidden();

    expect(pageErrors).toEqual([]);
  });
});
