import { expect, type Locator, type Page } from 'playwright/test';

export class RaceCountdownPageObject {
  readonly page: Page;
  readonly scene: Locator;
  readonly canvas: Locator;
  readonly layout: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scene = page.locator('[data-time-viz-state]');
    this.canvas = page.locator('canvas[data-time-viz-canvas]');
    this.layout = page.locator('[data-time-viz-layout]');
  }

  async gotoReference() {
    await this.page.goto('/time-viz-reference', { waitUntil: 'domcontentloaded' });
  }

  async waitForSceneReady() {
    await expect(this.scene).toHaveAttribute('data-time-viz-state', 'ready');
    await expect(this.canvas).toHaveCount(1);
  }

  async captureReferenceFrame(path: string) {
    await this.waitForSceneReady();
    await this.page.screenshot({ path });
  }
}
