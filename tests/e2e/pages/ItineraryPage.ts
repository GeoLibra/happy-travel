import { expect, type Locator, type Page } from 'playwright/test';

export class ItineraryPage {
  readonly page: Page;
  readonly returnWelcomeButton: Locator;
  readonly roseTriggerHeader: Locator;
  readonly dayTabs: Locator;
  readonly mapContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.returnWelcomeButton = page.locator('[data-app-action="return-welcome"]');
    this.roseTriggerHeader = page.locator('[data-rose-trigger="true"]');
    this.dayTabs = page.locator('button:has-text("DAY")');
    this.mapContainer = page.locator('.amap-container, canvas, [data-testid="map-container"]').first();
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    const enterBtn = this.page.locator('[data-f1-welcome-action="enter"]');
    await enterBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await enterBtn.click();
    await this.waitUntilReady();
  }

  async waitUntilReady() {
    await expect(this.returnWelcomeButton).toBeVisible({ timeout: 15_000 });
  }

  async clickReturnToWelcome() {
    await this.returnWelcomeButton.click();
  }

  async triggerSecretRoseClicks(count = 5) {
    for (let i = 0; i < count; i++) {
      await this.roseTriggerHeader.click();
      // Wait for a single animation frame to allow event processing
      await this.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
  }

  async selectDayTab(index: number) {
    await this.dayTabs.nth(index).click();
  }
}
