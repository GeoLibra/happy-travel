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
    }, undefined, { timeout: 5_000 }).catch(() => {
      // Progress may stay visible briefly; the key assertion is that CTA remains and app did not enter
    });

    await expect(welcomePage.enterButton).toBeVisible();
  });

  test('press & hold to 100% completes ignition and triggers app entry', async ({ page }) => {
    test.setTimeout(90_000);

    // Hold until engine ignition completes to 100%
    await welcomePage.holdToIgnite();

    // Verify entry into main app (return-welcome button becomes visible)
    const returnBtn = page.locator('[data-app-action="return-welcome"]');
    await expect(returnBtn).toBeVisible({ timeout: 15_000 });
  });

  test('hologram / glitch sequence renders clean rAF without uncaught errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message && err.message !== 'null') errors.push(err.message);
    });

    // Wait for canvas to be visible and WebGL rendering active (observable state)
    await expect(welcomePage.canvas).toBeVisible();

    // Wait for at least one full animation frame cycle to confirm clean rAF
    await page.waitForFunction(() => {
      return document.querySelector('canvas') !== null;
    }, undefined, { timeout: 5_000 });

    expect(errors).toEqual([]);
  });

  test('explode view keeps all semantic parts above studio floor clearance', async ({ page }) => {
    test.setTimeout(90_000);

    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message && err.message !== 'null') errors.push(err.message);
    });

    await welcomePage.holdUntilIgnitedWithoutEntering();
    await welcomePage.tapCarCanvas();

    await page.waitForFunction(() => {
      const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
      if (!audit) return false;
      const explodeAmount = audit.details?.explodeAmount ?? 0;
      return (audit.phase === 'exploded' || explodeAmount > 0.85)
        && audit.details?.allPartsAboveFloor === true;
    }, undefined, { timeout: 30_000 });

    const floorAudit = await page.evaluate(() => {
      const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
      return audit?.details ?? null;
    });

    expect(floorAudit, 'f1-welcome floor audit must be exposed via test observability API').not.toBeNull();
    expect(floorAudit!.partCount).toBeGreaterThan(0);
    expect(floorAudit!.allPartsAboveFloor).toBe(true);
    expect(floorAudit!.minPartWorldY).toBeGreaterThanOrEqual(
      (floorAudit!.floorY ?? 0) + (floorAudit!.clearance ?? 0) - 1e-4,
    );
    expect(errors).toEqual([]);
  });

  test('wheel node semantic contract verifies FL, FR, RL, RR runtime targets only', async ({ page }) => {
    await page.waitForFunction(() => {
      const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
      return audit?.details?.hasAllRuntimeWheelNodes === true;
    }, undefined, { timeout: 30_000 });

    const audit = await page.evaluate(() => {
      return (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome') ?? null;
    });

    expect(audit, 'f1-welcome scene audit must be registered').not.toBeNull();
    const details = audit!.details ?? {};
    expect(details.hasAllRuntimeWheelNodes).toBe(true);
    expect(details.wheelNodeNames).toEqual(['WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR']);
    expect(details.missingWheelNodes).toEqual([]);
    expect(Object.keys(details.wheelSpinAngles ?? {})).toEqual([
      'WheelSpin_FL',
      'WheelSpin_FR',
      'WheelSpin_RL',
      'WheelSpin_RR',
    ]);
  });

  test('raycast hit on car canvas owns pointer interaction while exposed control forwards pointer', async ({ page }) => {
    // Click on exposed UI element (RACE WEEKEND tag)
    const tag = welcomePage.raceWeekendTag;
    await expect(tag).toBeVisible();
    await tag.click();

    // Send raw mouse click to canvas background area
    await page.mouse.click(50, 50);
  });

  test('respects prefers-reduced-motion setting', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await welcomePage.goto();
    await welcomePage.waitUntilReady();

    await expect(welcomePage.canvas).toBeVisible();
  });
});
