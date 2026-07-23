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
