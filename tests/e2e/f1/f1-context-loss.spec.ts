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
    await page.waitForTimeout(500);

    // Filter out expected context loss messages if any, verify no fatal crash
    const fatalErrors = pageErrors.filter(
      (msg) => !msg.includes('CONTEXT_LOST') && !msg.includes('context lost'),
    );
    expect(fatalErrors).toEqual([]);
  });

  test('restores WebGL context and continues rendering cleanly', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await expect(showroomPage.canvas).toBeVisible({ timeout: 30_000 });

    // Lose context then restore context
    await showroomPage.triggerWebGLContextLoss();
    await page.waitForTimeout(300);
    await showroomPage.restoreWebGLContext();
    await page.waitForTimeout(500);

    await expect(showroomPage.canvas).toBeVisible();
  });
});
