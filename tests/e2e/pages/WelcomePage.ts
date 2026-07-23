import { expect, type Locator, type Page } from 'playwright/test';

export class WelcomePage {
  readonly page: Page;
  readonly enterButton: Locator;
  readonly canvas: Locator;
  readonly raceWeekendTag: Locator;
  readonly racePrepIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.enterButton = page.locator('[data-f1-welcome-action="enter"]');
    this.canvas = page.locator('canvas').first();
    this.raceWeekendTag = page.locator('div:has-text("RACE WEEKEND")').first();
    this.racePrepIndicator = page.getByText('RACE PREP IN PROGRESS');
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  async waitUntilReady() {
    await this.racePrepIndicator.waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => {});
    await expect(this.enterButton).toBeVisible({ timeout: 30_000 });
    await expect(this.canvas).toBeVisible();
  }

  async holdToIgnite(durationMs: number) {
    const box = await this.enterButton.boundingBox();
    if (!box) throw new Error('Enter button bounding box not available');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.waitForTimeout(durationMs);
    await this.page.mouse.up();
  }

  async clickEnter() {
    await this.enterButton.click();
  }

  async isCanvasVisible(): Promise<boolean> {
    return this.canvas.isVisible();
  }
}
