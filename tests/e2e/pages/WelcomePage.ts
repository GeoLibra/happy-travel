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
    const point = await this.enterButtonCenter();
    await this.page.mouse.move(point.x, point.y);
    await this.page.mouse.down();
    try {
      await this.waitForIgnitionAutoCompleteThreshold();
    } finally {
      await this.page.mouse.up();
    }

    await this.waitForIgnitionReadyToEnter();
    await expect(this.enterButton).toBeHidden({ timeout: 15_000 }).catch(async () => {
      await this.enterButton.focus();
      await this.page.keyboard.press('Enter');
      await expect(this.enterButton).toBeHidden({ timeout: 15_000 });
    });
  }

  /**
   * Hold enter button briefly (partial press, not reaching 100%).
   * Uses observable check that progress has started but not completed.
   */
  async holdPartially(): Promise<void> {
    const point = await this.enterButtonCenter();
    await this.page.mouse.move(point.x, point.y);
    await this.page.mouse.down();
    await expect.poll(async () => {
      return this.enterButton.textContent();
    }, {
      intervals: [100],
      timeout: 10_000,
    }).toContain('ENGINE STARTING');
    await this.page.mouse.up();
  }

  async holdUntilIgnitedWithoutEntering(): Promise<void> {
    const point = await this.enterButtonCenter();
    await this.page.mouse.move(point.x, point.y);
    await this.page.mouse.down();
    await this.waitForIgnitionCompleteOrEntered();
    await this.page.mouse.move(point.x, Math.max(1, point.y - 220));
    await this.page.mouse.up();
    await expect(this.enterButton).toBeVisible();
    await this.page.waitForFunction(() => {
      const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
      return audit?.phase === 'settled' || audit?.phase === 'exploded';
    }, undefined, { timeout: 15_000 });
  }

  async tapCarCanvas(): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas bounding box unavailable');
    }
    const x = box.x + box.width * 0.5;
    const y = box.y + box.height * 0.42;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.up();
  }

  async clickEnter() {
    await this.enterButton.click();
  }

  async isCanvasVisible(): Promise<boolean> {
    return this.canvas.isVisible();
  }

  private async enterButtonCenter(): Promise<{ x: number; y: number }> {
    const box = await this.enterButton.boundingBox();
    if (!box) throw new Error('Enter button bounding box not available');
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  }

  private async waitForIgnitionReadyToEnter(): Promise<void> {
    await expect.poll(async () => {
      return (await this.enterButton.textContent().catch(() => '')) || '';
    }, {
      intervals: [100],
      timeout: 90_000,
    }).toMatch(/ENTER|REASSEMBLING/);
  }

  private async waitForIgnitionAutoCompleteThreshold(): Promise<void> {
    await expect.poll(async () => {
      const text = (await this.enterButton.textContent().catch(() => '')) || '';
      const match = text.match(/ENGINE STARTING\s+(\d+)%/);
      return match ? Number(match[1]) : 0;
    }, {
      intervals: [100],
      timeout: 45_000,
    }).toBeGreaterThanOrEqual(35);
  }

  private async waitForIgnitionCompleteOrEntered(): Promise<void> {
    await expect.poll(async () => {
      const enteredApp = await this.enterButton.isHidden().catch(() => false);
      if (enteredApp) return 'ENTERED_APP';
      return (await this.enterButton.textContent().catch(() => '')) || '';
    }, {
      intervals: [100],
      timeout: 25_000,
    }).toMatch(/ENTERED_APP|ENTER|REASSEMBLING/);
  }
}
