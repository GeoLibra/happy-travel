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

  /**
   * Hold enter button via real mouse input and wait for observable engine
   * progress to reach the specified state (or timeout).
   */
  async holdToIgnite(): Promise<void> {
    const box = await this.enterButton.boundingBox();
    if (!box) throw new Error('Enter button bounding box not available');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await this.page.mouse.move(x, y);
    await this.page.mouse.down();

    // Wait for observable engine progress → button text changes to ENTER or REASSEMBLING
    await this.page.waitForFunction(() => {
      const btn = document.querySelector('[data-f1-welcome-action="enter"]');
      if (!btn) return false;
      const text = btn.textContent || '';
      return text.includes('ENTER') || text.includes('REASSEMBLING');
    }, { timeout: 10_000 });

    await this.page.mouse.up();
  }

  /**
   * Hold enter button briefly (partial press, not reaching 100%).
   * Uses observable check that progress has started but not completed.
   */
  async holdPartially(): Promise<void> {
    const box = await this.enterButton.boundingBox();
    if (!box) throw new Error('Enter button bounding box not available');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await this.page.mouse.move(x, y);
    await this.page.mouse.down();

    // Wait for observable engine progress to start (button text contains ENGINE STARTING)
    await this.page.waitForFunction(() => {
      const btn = document.querySelector('[data-f1-welcome-action="enter"]');
      if (!btn) return false;
      const text = btn.textContent || '';
      return text.includes('ENGINE STARTING');
    }, { timeout: 5_000 });

    await this.page.mouse.up();
  }

  async clickEnter() {
    await this.enterButton.click();
  }

  async isCanvasVisible(): Promise<boolean> {
    return this.canvas.isVisible();
  }
}
