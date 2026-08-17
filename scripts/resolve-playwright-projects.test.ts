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
    [
      'showroom-desktop-chromium',
      'showroom-mobile-chromium',
      'showroom-arrival-timeline-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
      'showroom-webkit-smoke',
      'f1-e2e-chromium',
    ],
  );
});

test('F1 interaction changes select F1 browser and lifecycle coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['tests/e2e/f1/f1-interaction-flow.spec.ts']),
    [
      'showroom-desktop-chromium',
      'showroom-mobile-chromium',
      'showroom-arrival-timeline-chromium',
      'webgl-renderer-lifecycle-chromium',
      'showroom-webkit-smoke',
      'f1-e2e-chromium',
    ],
  );
});

test('race countdown changes select desktop, mobile, and WebGL lifecycle coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'src/features/race-countdown/time-viz-scene.ts',
    ]),
    [
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
    ],
  );
});

test('shared observability changes select the complete scene safety matrix', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/lib/test-observability.ts']),
    ALL_PLAYWRIGHT_PROJECTS,
  );
});

test('shared showroom dependencies include countdown browser coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'src/lib/showroom-quality.ts',
      'src/components/showroom/asset-manager.ts',
    ]),
    [
      'showroom-desktop-chromium',
      'showroom-mobile-chromium',
      'showroom-arrival-timeline-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
      'showroom-webkit-smoke',
      'f1-e2e-chromium',
    ],
  );
});

test('countdown lifecycle helper preserves showroom coverage and adds countdown coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'src/components/showroom/showroom-resource-lifecycle.ts',
    ]),
    [
      'showroom-desktop-chromium',
      'showroom-mobile-chromium',
      'showroom-arrival-timeline-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
      'showroom-webkit-smoke',
      'f1-e2e-chromium',
    ],
  );
});

test('countdown glyph changes preserve app coverage and add countdown coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/components/digit.ts']),
    [
      'app-desktop-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
    ],
  );
});

test('countdown environment changes select dedicated countdown and lifecycle coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'public/environments/lythwood_room_1k.hdr',
    ]),
    [
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
    ],
  );
});

test('shared model loader changes select all direct browser consumers', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/lib/model-loader.ts']),
    [
      'app-desktop-chromium',
      'showroom-desktop-chromium',
      'showroom-mobile-chromium',
      'showroom-arrival-timeline-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
      'showroom-webkit-smoke',
      'f1-e2e-chromium',
      'rose-e2e-chromium',
    ],
  );
});

test('particle itinerary changes select app and particles E2E only', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['tests/e2e/itinerary-particles/particles.spec.ts']),
    ['app-desktop-chromium', 'particles-e2e-chromium'],
  );
});

test('map lifecycle changes preserve particles coverage and add countdown lifecycle coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/components/MapComponent.tsx']),
    [
      'app-desktop-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
      'particles-e2e-chromium',
    ],
  );
});

test('mini firework timer changes select app and countdown lifecycle coverage', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['src/components/MiniFirework.tsx']),
    [
      'app-desktop-chromium',
      'webgl-renderer-lifecycle-chromium',
      'race-countdown-desktop-chromium',
      'race-countdown-mobile-chromium',
    ],
  );
});

test('rose changes select app and rose E2E only', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects(['tests/e2e/rose/rose-interaction-bloom.spec.ts']),
    ['app-desktop-chromium', 'rose-e2e-chromium'],
  );
});

test('acceptance infrastructure and dependency changes select the complete safety matrix', () => {
  assert.deepEqual(
    resolveAffectedPlaywrightProjects([
      'playwright.config.ts',
      'pnpm-lock.yaml',
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
