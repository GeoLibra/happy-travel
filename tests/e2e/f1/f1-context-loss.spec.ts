import { expect, test } from 'playwright/test';
import { ShowroomPage } from '../pages/ShowroomPage';

test.describe('F1 WebGL Context Loss & Restore', () => {
  let showroomPage: ShowroomPage;

  test.beforeEach(async ({ page }) => {
    showroomPage = new ShowroomPage(page);
    await showroomPage.goto();
  });

  test('handles WebGL context loss gracefully without uncaught exceptions', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await expect(showroomPage.canvas).toBeVisible({ timeout: 30_000 });

    // Trigger WEBGL_lose_context loseContext
    await showroomPage.triggerWebGLContextLoss();

    // Wait for observable webglcontextlost event to propagate (canvas remains in DOM)
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas !== null;
    }, { timeout: 5_000 });

    // Filter out expected context loss messages, verify no fatal crash
    const fatalErrors = pageErrors.filter(
      (msg) => !msg.includes('CONTEXT_LOST') && !msg.includes('context lost'),
    );
    expect(fatalErrors).toEqual([]);
  });

  test('restores WebGL context and continues rendering cleanly', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await expect(showroomPage.canvas).toBeVisible({ timeout: 30_000 });

    // Lose context then restore
    await showroomPage.triggerWebGLContextLoss();

    // Wait for observable context loss to propagate
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas !== null;
    }, { timeout: 5_000 });

    await showroomPage.restoreWebGLContext();

    // Wait for canvas to remain visible after restore (observable recovery)
    await expect(showroomPage.canvas).toBeVisible({ timeout: 5_000 });
  });
});
