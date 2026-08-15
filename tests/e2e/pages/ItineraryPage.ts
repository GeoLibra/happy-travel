import { expect, type Locator, type Page } from 'playwright/test';
import { WelcomePage } from './WelcomePage';

export class ItineraryPage {
  readonly page: Page;
  readonly returnWelcomeButton: Locator;
  readonly roseTriggerHeader: Locator;
  readonly dayTabs: Locator;
  readonly daySelector: Locator;
  readonly fullCountdownButton: Locator;
  readonly mapContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.returnWelcomeButton = page.locator('[data-app-action="return-welcome"]');
    this.roseTriggerHeader = page.locator('[data-rose-trigger="true"]');
    this.dayTabs = page.locator('button:has-text("DAY")');
    this.daySelector = this.dayTabs.first();
    this.fullCountdownButton = page.getByRole('button', { name: '查看全屏倒计时' });
    this.mapContainer = page.locator('.amap-container, canvas, [data-testid="map-container"]').first();
  }

  async completeWelcomeIgnition() {
    await this.goto();
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    const welcomePage = new WelcomePage(this.page);
    await welcomePage.waitUntilReady();
    await welcomePage.holdToIgnite();
    await this.waitUntilReady();
  }

  async waitUntilReady() {
    await expect(this.returnWelcomeButton).toBeVisible({ timeout: 30_000 });
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

  async openFullCountdown() {
    await this.fullCountdownButton.click();
  }
}
