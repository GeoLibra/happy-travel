import { expect, type Locator, type Page } from 'playwright/test';

export class ShowroomPage {
  readonly page: Page;
  readonly canvas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('canvas').first();
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  async isCanvasVisible(): Promise<boolean> {
    return this.canvas.isVisible();
  }

  async triggerWebGLContextLoss() {
    await this.page.evaluate(() => {
      const canvas = document.querySelector('canvas') as any;
      if (!canvas) throw new Error('Canvas element not found');
      if (canvas.__f1RendererAudit?.loseContext) {
        canvas.__f1RendererAudit.loseContext();
        return;
      }
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) throw new Error('WebGL context not found on canvas');
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) throw new Error('WEBGL_lose_context extension not supported');
      ext.loseContext();
    });
  }

  async restoreWebGLContext() {
    await this.page.evaluate(() => {
      const canvas = document.querySelector('canvas') as any;
      if (!canvas) throw new Error('Canvas element not found');
      if (canvas.__f1RendererAudit?.restoreContext) {
        canvas.__f1RendererAudit.restoreContext();
        return;
      }
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) throw new Error('WebGL context not found on canvas');
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) throw new Error('WEBGL_lose_context extension not supported');
      ext.restoreContext();
    });
  }
}
