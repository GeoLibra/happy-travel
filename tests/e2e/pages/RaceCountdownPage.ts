import { expect, type Locator, type Page } from 'playwright/test';

export class RaceCountdownPageObject {
  readonly page: Page;
  readonly scene: Locator;
  readonly canvas: Locator;
  readonly layout: Locator;
  readonly product: Locator;
  readonly sourceStatus: Locator;
  readonly liveStatus: Locator;
  readonly domFallback: Locator;
  readonly lightsOut: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scene = page.locator('[data-time-viz-state]');
    this.canvas = page.locator('canvas[data-time-viz-canvas]');
    this.layout = page.locator('[data-time-viz-layout]');
    this.product = page.locator('[data-countdown-state]');
    this.sourceStatus = page.locator('[data-countdown-source]');
    this.liveStatus = page.locator('[data-countdown-live]');
    this.domFallback = page.locator('[data-countdown-fallback]');
    this.lightsOut = page.getByText('LIGHTS OUT', { exact: true });
    this.backButton = page.getByRole('button', { name: '返回行程' });
  }

  async goto() {
    await this.page.goto('/countdown', { waitUntil: 'domcontentloaded' });
  }

  async disableWebGL() {
    await this.page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (contextId, options) {
        if (contextId === 'webgl' || contextId === 'webgl2') return null;
        return originalGetContext.call(this, contextId, options);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
  }

  async gotoReference() {
    await this.page.goto('/time-viz-reference', { waitUntil: 'domcontentloaded' });
  }

  async waitForSceneReady() {
    await expect(this.scene).toHaveAttribute('data-time-viz-state', 'ready');
    await expect.poll(async () => Number(
      await this.scene.getAttribute('data-time-viz-frame-count'),
    )).toBeGreaterThanOrEqual(1);
    await expect(this.canvas).toHaveCount(1);
  }

  async captureReferenceFrame(path: string) {
    await this.waitForSceneReady();
    await this.page.screenshot({ path });
  }
}
