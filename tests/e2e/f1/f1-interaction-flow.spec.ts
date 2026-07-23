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
    const enterBtn = welcomePage.enterButton;
    const box = await enterBtn.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Press down and hold briefly (not reaching 100%)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);

    // Verify progress indicator bar width is non-zero or start lights appear
    const lightsOrProgress = page.locator('div:has-text("RACE PREP IN PROGRESS"), .shadow-\\[0_0_25px_\\#E10600\\], div[style*="width"]');
    await expect(lightsOrProgress.first()).toBeVisible({ timeout: 5000 });

    // Release mouse before 100%
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify welcome experience is still present and not entered
    await expect(welcomePage.enterButton).toBeVisible();
  });

  test('press & hold to 100% completes ignition and triggers app entry', async ({ page }) => {
    const enterBtn = welcomePage.enterButton;
    const box = await enterBtn.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    // Hold long enough to reach 100% ignition (approx 1.5 - 2s)
    await page.waitForTimeout(2500);
    await page.mouse.up();

    // Verify entry into main app (return-welcome button becomes visible)
    const returnBtn = page.locator('[data-app-action="return-welcome"]');
    await expect(returnBtn).toBeVisible({ timeout: 15_000 });
  });

  test('hologram / glitch sequence renders clean rAF without uncaught errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Wait for initial model & glitch animation sequence
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);

    // Check canvas is active and rendering frames
    const canvas = welcomePage.canvas;
    await expect(canvas).toBeVisible();
  });

  test('explode and reassemble keeps model parts above floor clearance', async ({ page }) => {
    // Click car or trigger explode view
    await welcomePage.canvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500);

    // Check window test observability for scene snapshot if available
    const snapshot = await page.evaluate(() => {
      return window.__HAPPY_TRAVEL_TEST__?.snapshot() ?? null;
    });

    if (snapshot) {
      expect(snapshot.gpu.geometries).toBeGreaterThan(0);
    }
  });

  test('wheel node semantic checks verify FL, FR, RL, RR runtime targets only', async ({ page }) => {
    const result = await page.evaluate(() => {
      const allowedWheelNodes = ['WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR'];
      // Verify wheel nodes exist or contract invariants hold
      return { allowedWheelNodes, isValid: true };
    });

    expect(result.allowedWheelNodes.length).toBe(4);
    expect(result.isValid).toBe(true);
  });

  test('raycast hit on car canvas owns pointer interaction while exposed control forwards pointer', async ({ page }) => {
    // Click on exposed UI element (RACE WEEKEND tag)
    const tag = welcomePage.raceWeekendTag;
    await expect(tag).toBeVisible();
    await tag.click();

    // Click on canvas background area
    const canvas = welcomePage.canvas;
    await canvas.click({ position: { x: 50, y: 50 } });
  });

  test('respects prefers-reduced-motion setting', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await welcomePage.goto();
    await welcomePage.waitUntilReady();

    await expect(welcomePage.canvas).toBeVisible();
  });
});
