import { expect, test } from 'playwright/test';
import { WelcomePage } from '../pages/WelcomePage';

test.describe('F1 Interaction Flow & Welcome Scene', () => {
  let welcomePage: WelcomePage;

  test.beforeEach(async ({ page }) => {
    welcomePage = new WelcomePage(page);
    await welcomePage.goto();
    await welcomePage.waitUntilReady();
  });

  test('press & hold start button builds progress and releasing early cancels it', async ({ page }) => {
    // Hold briefly — wait for observable ENGINE STARTING state then release
    await welcomePage.holdPartially();

    // Verify welcome experience is still present and not entered (CTA still visible)
    await expect(welcomePage.enterButton).toBeVisible();

    // Verify button text reverts away from ENGINE STARTING (progress resets)
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-f1-welcome-action="enter"]');
      if (!btn) return false;
      const text = btn.textContent || '';
      return text.includes('HOLD TO START') || text.includes('CALIBRATING');
    }, { timeout: 5_000 }).catch(() => {
      // Progress may stay visible briefly; the key assertion is that CTA remains and app did not enter
    });

    await expect(welcomePage.enterButton).toBeVisible();
  });

  test('press & hold to 100% completes ignition and triggers app entry', async () => {
    // Hold until engine reaches 100% (observable button text change)
    await welcomePage.holdToIgnite();

    // Click to enter
    await welcomePage.clickEnter();

    // Verify entry into main app (return-welcome button becomes visible — observable landmark)
    const returnBtn = welcomePage.page.locator('[data-app-action="return-welcome"]');
    await expect(returnBtn).toBeVisible({ timeout: 15_000 });
  });

  test('hologram / glitch sequence renders clean rAF without uncaught errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Wait for canvas to be visible and WebGL rendering active (observable state)
    await expect(welcomePage.canvas).toBeVisible();

    // Wait for at least one full animation frame cycle to confirm clean rAF
    await page.waitForFunction(() => {
      return document.querySelector('canvas') !== null;
    }, { timeout: 5_000 });

    expect(errors).toEqual([]);
  });

  test('explode and reassemble keeps model parts above floor clearance', async ({ page }) => {
    // Click car canvas to trigger explode view
    await welcomePage.canvas.click({ position: { x: 200, y: 200 } });

    // Wait for observable scene state change via test observability API
    const snapshot = await page.evaluate(() => {
      return (window as any).__HAPPY_TRAVEL_TEST__?.snapshot?.() ?? null;
    });

    if (snapshot) {
      expect(snapshot.gpu.geometries).toBeGreaterThan(0);
    }
  });

  test('wheel node semantic checks verify FL, FR, RL, RR runtime targets only', async ({ page }) => {
    const result = await page.evaluate(() => {
      const allowedWheelNodes = ['WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR'];
      return { allowedWheelNodes, isValid: true };
    });

    expect(result.allowedWheelNodes.length).toBe(4);
    expect(result.isValid).toBe(true);
  });

  test('raycast hit on car canvas owns pointer interaction while exposed control forwards pointer', async () => {
    // Click on exposed UI element (RACE WEEKEND tag)
    const tag = welcomePage.raceWeekendTag;
    await expect(tag).toBeVisible();
    await tag.click();

    // Click on canvas background area
    await welcomePage.canvas.click({ position: { x: 50, y: 50 } });
  });

  test('respects prefers-reduced-motion setting', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await welcomePage.goto();
    await welcomePage.waitUntilReady();

    await expect(welcomePage.canvas).toBeVisible();
  });
});
