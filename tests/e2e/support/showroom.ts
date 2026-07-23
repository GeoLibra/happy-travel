import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, type Page, type TestInfo } from 'playwright/test';

export interface ScenarioResult {
  name: string;
  viewport: string;
  status: 'PASS' | 'FAIL';
  details: string;
  screenshot?: string;
}

export interface AcceptanceEvidence {
  record(result: Omit<ScenarioResult, 'status'>): void;
  recordFailure(testInfo: TestInfo): void;
  screenshotPath(fileName: string): string;
  writeSummary(baseURL: string): void;
}

export function createAcceptanceEvidence(
  projectName: string,
): AcceptanceEvidence {
  const outputDirectory = path.resolve('output/playwright', projectName);
  const results: ScenarioResult[] = [];
  mkdirSync(outputDirectory, { recursive: true });

  return {
    record(result) {
      results.push({ ...result, status: 'PASS' });
    },
    recordFailure(testInfo) {
      if (
        testInfo.status === testInfo.expectedStatus
        || testInfo.retry < testInfo.project.retries
      ) {
        return;
      }
      results.push({
        name: testInfo.title,
        viewport: projectName,
        status: 'FAIL',
        details: testInfo.error?.message ?? `Unexpected ${testInfo.status}`,
      });
    },
    screenshotPath(fileName) {
      return path.join(outputDirectory, fileName);
    },
    writeSummary(baseURL) {
      writeFileSync(
        path.join(outputDirectory, 'showroom-acceptance-summary.json'),
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            overallStatus: results.some(({ status }) => status === 'FAIL')
              ? 'FAIL'
              : 'PASS',
            project: projectName,
            baseUrl: baseURL,
            scenarios: results,
          },
          null,
          2,
        ),
        'utf8',
      );
    },
  };
}

export async function waitForRacePrep(page: Page): Promise<void> {
  await page
    .getByText('RACE PREP IN PROGRESS')
    .waitFor({ state: 'hidden', timeout: 45_000 })
    .catch(() => {});
}

export async function openWelcome(page: Page): Promise<void> {
  await page.goto('/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForRacePrep(page);
  await expect(page.locator('[data-f1-welcome-action="enter"]')).toBeVisible();
  await expect(page.locator('canvas')).not.toHaveCount(0);
}

export interface CanvasFrameMetrics {
  width: number;
  height: number;
  totalPixels: number;
  nonEmptyPixels: number;
  nonEmptyPixelRatio: number;
  centroidXRatio: number;
  centroidYRatio: number;
  sampleImageData: number[];
}

export async function analyzeCanvasScreenshot(
  page: Page,
  screenshotBuffer: Buffer,
): Promise<CanvasFrameMetrics> {
  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();

    const width = img.width;
    const height = img.height;
    const helperCanvas = document.createElement('canvas');
    helperCanvas.width = width;
    helperCanvas.height = height;
    const ctx = helperCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2d context for screenshot metrics');
    }

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let nonEmptyPixels = 0;
    let sumX = 0;
    let sumY = 0;
    const step = 4;
    const sampleImageData: number[] = [];

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];

        sampleImageData.push(r, g, b, a);

        if (a > 20 && (r > 15 || g > 15 || b > 15)) {
          nonEmptyPixels += 1;
          sumX += x;
          sumY += y;
        }
      }
    }

    const sampledTotal = Math.ceil(height / step) * Math.ceil(width / step);
    const nonEmptyPixelRatio = nonEmptyPixels / sampledTotal;
    const centroidXRatio = nonEmptyPixels > 0 ? sumX / nonEmptyPixels / width : 0.5;
    const centroidYRatio = nonEmptyPixels > 0 ? sumY / nonEmptyPixels / height : 0.5;

    return {
      width,
      height,
      totalPixels: sampledTotal,
      nonEmptyPixels,
      nonEmptyPixelRatio,
      centroidXRatio,
      centroidYRatio,
      sampleImageData,
    };
  }, dataUrl);
}

export function computeSampleDelta(
  metricsA: CanvasFrameMetrics,
  metricsB: CanvasFrameMetrics,
): number {
  const dataA = metricsA.sampleImageData;
  const dataB = metricsB.sampleImageData;
  const len = Math.min(dataA.length, dataB.length);
  if (len === 0) return 0;

  let totalDiff = 0;
  const pixelCount = len / 4;

  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
    totalDiff += (dr + dg + db) / 3;
  }

  return totalDiff / (pixelCount * 255);
}

