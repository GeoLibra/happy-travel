import { expect, type Locator, type Page } from 'playwright/test';

export class RoseModalPage {
  readonly page: Page;
  readonly modalContainer: Locator;
  readonly canvas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modalContainer = page.locator('div.fixed.inset-0.z-\\[100\\]').first();
    this.canvas = this.modalContainer.locator('canvas').first();
  }

  async isVisible(): Promise<boolean> {
    return this.modalContainer.isVisible();
  }

  async waitUntilVisible() {
    await expect(this.modalContainer).toBeVisible({ timeout: 10_000 });
  }

  async waitUntilHidden() {
    await expect(this.modalContainer).toBeHidden({ timeout: 10_000 });
  }

  async closeByBackdrop() {
    await this.modalContainer.click({ position: { x: 10, y: 10 } });
  }

  async closeByEscape() {
    await this.page.keyboard.press('Escape');
  }
}
