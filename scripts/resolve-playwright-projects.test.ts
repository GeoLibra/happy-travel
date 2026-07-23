import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_PLAYWRIGHT_PROJECTS,
  resolveAffectedPlaywrightProjects,
  toPlaywrightMatrix,
} from './lib/affected-playwright-projects.ts';

test('documentation-only changes select no browser projects', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['README.md', 'docs/architecture.md']),
    [],
  );
});

test('ordinary application changes select desktop app coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/components/TripPlanner.tsx']),
    ['app-desktop-chromium'],
  );
});

test('welcome UI changes select the complete safety matrix', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/components/WelcomePage.tsx']),
    ALL_PLAYWRIGHT_PROJECTS,
  );
});

test('showroom implementation and F1 model changes select the complete safety matrix', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'src/components/showroom/ShowroomOverlay.tsx',
      'public/models/2024_redbull_rb20_showroom_v6.glb',
    ]),
    ALL_PLAYWRIGHT_PROJECTS,
  );
});

test('acceptance infrastructure and dependency changes select the complete safety matrix', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'playwright.config.ts',
      'package-lock.json',
      '.github/workflows/showroom-browser-acceptance.yml',
    ]),
    ALL_PLAYWRIGHT_PROJECTS,
  );
});

test('unknown implementation paths fail safe with the complete matrix', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['vite.config.ts']),
    ALL_PLAYWRIGHT_PROJECTS,
  );
});

test('matrix output preserves deterministic project order', () => {
  assert.deepEqual(
    toPlaywrightMatrix(['showroom-mobile-chromium', 'app-desktop-chromium']),
    {
      include: [
        { project: 'app-desktop-chromium', browser: 'chromium' },
        { project: 'showroom-mobile-chromium', browser: 'chromium' },
      ],
    },
  );
});

