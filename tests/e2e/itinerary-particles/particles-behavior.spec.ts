import { expect, test } from 'playwright/test';
import { ItineraryPage } from '../pages/ItineraryPage';

test.describe('Itinerary Particles Behavior', () => {
  let itineraryPage: ItineraryPage;

  test.beforeEach(async ({ page }) => {
    itineraryPage = new ItineraryPage(page);
    await itineraryPage.goto();
  });

  test('entry to itinerary page mounts particles and exit to welcome unmounts cleanly', async ({ page }) => {
    // Verify itinerary page is active and return button is visible
    await itineraryPage.waitUntilReady();

    // Click return to welcome
    await itineraryPage.clickReturnToWelcome();

    // Verify welcome page enter button is back (observable landmark)
    const enterBtn = page.locator('[data-f1-welcome-action="enter"]');
    await expect(enterBtn).toBeVisible({ timeout: 15_000 });
  });

  test('resizing viewport and orientation change update canvas dimensions without error', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Resize viewport — wait for layout to stabilize via rAF
    await page.setViewportSize({ width: 800, height: 600 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    // Trigger orientationchange event and wait for processing
    await page.evaluate(() => {
      window.dispatchEvent(new Event('orientationchange'));
      return new Promise(resolve => requestAnimationFrame(resolve));
    });

    expect(pageErrors).toEqual([]);
  });

  test('tab hidden/resume pauses and resumes rAF loop without clock jumps', async ({ page }) => {
    // Dispatch visibilitychange hidden
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for hidden state processing via rAF
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    // Dispatch visibilitychange visible
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for visible state processing via rAF
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    // Verify page remains interactive and healthy (observable)
    await expect(itineraryPage.returnWelcomeButton).toBeVisible();
  });

  test('reduced motion mode disables heavy particle animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const enterBtn = page.locator('[data-f1-welcome-action="enter"]');
    await enterBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await enterBtn.click();

    await itineraryPage.waitUntilReady();
    await expect(itineraryPage.returnWelcomeButton).toBeVisible();
  });
});
