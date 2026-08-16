import { expect, type Locator, type Page } from 'playwright/test';

export interface CountdownObservabilitySnapshot {
  activeAnimationFrames: number;
  activeListeners: number;
  activeScenes: number;
  composers: number;
  environments: number;
  frameCount: number;
  floors: number;
  geometries: number;
  materials: number;
  mode: 'countdown' | null;
  ready: boolean;
  renderers: number;
  resourceCount: number;
  vehicles: number;
  viewport: 'desktop' | 'mobile' | null;
}

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
  readonly unitLabels: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scene = page.locator('[data-time-viz-state]');
    this.canvas = page.locator('canvas[data-time-viz-canvas]');
    this.layout = page.locator('[data-time-viz-layout]');
    this.product = page.locator('main[data-countdown-state]');
    this.sourceStatus = page.locator('[data-countdown-source]');
    this.liveStatus = page.locator('[data-countdown-live]');
    this.domFallback = page.locator('[data-countdown-fallback]');
    this.lightsOut = page.getByText('LIGHTS OUT', { exact: true });
    this.backButton = page.getByRole('button', { name: '返回行程' });
    this.unitLabels = page.locator('.race-countdown-unit-labels > span');
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

  async readObservability(): Promise<CountdownObservabilitySnapshot | null> {
    return this.page.evaluate(() => {
      const api = (window as typeof window & {
        __HAPPY_TRAVEL_TEST__?: {
          countdown?: () => CountdownObservabilitySnapshot;
        };
      }).__HAPPY_TRAVEL_TEST__;
      return api?.countdown?.() ?? null;
    });
  }

  async waitForObservabilityReady(): Promise<CountdownObservabilitySnapshot> {
    await expect.poll(async () => (await this.readObservability())?.ready ?? false).toBe(true);
    const snapshot = await this.readObservability();
    if (!snapshot) throw new Error('Countdown observability snapshot is unavailable');
    return snapshot;
  }

  async loseWebGLContext(): Promise<void> {
    await this.canvas.evaluate((canvas) => {
      const webglCanvas = canvas as HTMLCanvasElement;
      const context = (webglCanvas.getContext('webgl2')
        ?? webglCanvas.getContext('webgl')) as WebGL2RenderingContext | WebGLRenderingContext | null;
      const extension = context?.getExtension('WEBGL_lose_context');
      if (extension) {
        extension.loseContext();
      } else {
        webglCanvas.dispatchEvent(new Event('webglcontextlost'));
      }
    });
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
