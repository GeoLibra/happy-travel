import { expect, type Locator, type Page } from 'playwright/test';

export class WelcomePage {
  readonly page: Page;
  readonly enterButton: Locator;
  readonly returnWelcomeButton: Locator;
  readonly canvas: Locator;
  readonly carControl: Locator;
  readonly raceWeekendTag: Locator;
  readonly racePrepIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.enterButton = page.locator('[data-f1-welcome-action="enter"]');
    this.returnWelcomeButton = page.locator('[data-app-action="return-welcome"]');
    this.canvas = page.locator('canvas').first();
    this.carControl = page.getByRole('button', { name: 'Interactive Formula One showroom car' });
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
      await this.waitForIgnitionCompleteOrEntered();
    } finally {
      await this.page.mouse.up();
    }

    await this.waitForIgnitionReadyToEnter();
    if (await this.hasEnteredApp()) return;

    await this.enterButton.click({ timeout: 5_000 }).catch(() => {});
    await expect.poll(() => this.hasEnteredApp(), {
      intervals: [100],
      timeout: 15_000,
    }).toBe(true);
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
    await this.enterButton.focus();
    await this.page.keyboard.down('Space');
    try {
      await this.waitForIgnitionCompleteOrEntered();
    } finally {
      await this.page.keyboard.up('Space');
    }
    await expect(this.enterButton).toBeVisible();
  }

  async tapCarCanvas(): Promise<void> {
    await this.carControl.focus();
    await this.page.keyboard.press('Enter');
    await this.page.waitForFunction(() => {
      const audit = (window as any).__HAPPY_TRAVEL_TEST__?.sceneAudit?.('f1-welcome');
      const explodeAmount = audit?.details?.explodeAmount ?? 0;
      return audit?.phase === 'exploded' || explodeAmount > 0.05;
    }, undefined, { timeout: 5_000 }).catch(async () => {
      await this.tapCarCanvasAtVisualCenter();
    });
  }

  private async tapCarCanvasAtVisualCenter(): Promise<void> {
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
      if (await this.hasEnteredApp()) return 'ENTERED_APP';
      return (await this.enterButton.textContent().catch(() => '')) || '';
    }, {
      intervals: [100],
      timeout: 90_000,
    }).toMatch(/ENTERED_APP|ENTER|REASSEMBLING/);
  }

  private async waitForIgnitionAutoCompleteThreshold(): Promise<void> {
    await expect.poll(async () => {
      if (await this.hasEnteredApp()) return 100;
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
      if (await this.hasEnteredApp()) return 'ENTERED_APP';
      const enteredApp = await this.enterButton.isHidden().catch(() => false);
      if (enteredApp) return 'ENTERED_APP';
      return (await this.enterButton.textContent().catch(() => '')) || '';
    }, {
      intervals: [100],
      timeout: 25_000,
    }).toMatch(/ENTERED_APP|ENTER|REASSEMBLING/);
  }

  private async hasEnteredApp(): Promise<boolean> {
    return this.page.evaluate(() => {
      const returnButton = document.querySelector<HTMLElement>('[data-app-action="return-welcome"]');
      const welcomeButton = document.querySelector<HTMLElement>('[data-f1-welcome-action="enter"]');
      if (!returnButton) return false;
      if (!welcomeButton) return true;
      const styles = window.getComputedStyle(welcomeButton);
      return styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0;
    }).catch(() => false);
  }
}
