import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { CinematicRenderer } from '../src/components/showroom/cinematic-renderer.ts';
import { getShowroomChapter } from '../src/lib/showroom-story.ts';

// 1. Verify CinematicRenderer outputColorSpace application when renderer is provided
const mockRenderer = {
  setPixelRatio: () => {},
  outputColorSpace: '',
  toneMapping: 0,
  toneMappingExposure: 1,
  shadowMap: { enabled: false, type: 0 },
} as unknown as THREE.WebGLRenderer;

const rendererScaffold = new CinematicRenderer({
  qualityOptions: { forceLevel: 'high' },
  renderer: mockRenderer,
});

assert.equal(
  mockRenderer.outputColorSpace,
  rendererScaffold.configuration.outputColorSpace,
  'CinematicRenderer must set config.outputColorSpace on provided renderer',
);
rendererScaffold.dispose();

// 2. Source-level WelcomePage runtime guardrails.
const welcomeSource = readFileSync('src/components/WelcomePage.tsx', 'utf8');

assert.doesNotMatch(welcomeSource, /ShowroomOverlay/, 'WelcomePage must keep the proven single welcome CTA runtime');
assert.doesNotMatch(welcomeSource, /useIgnition/, 'WelcomePage must not run a second ignition progress loop');
assert.match(welcomeSource, /audioRef\.current\.play\(\)/, 'Welcome CTA must start audio directly in the pointer gesture');
assert.match(welcomeSource, /setInterval\(/, 'Welcome CTA must keep the proven interval-based progress chain');
assert.match(welcomeSource, /data-f1-welcome-action="enter"/, 'Welcome CTA must expose the stable browser acceptance selector');

// 3. Verify Chapter Story definition integration.
const chStart = getShowroomChapter(0.0);
assert.equal(chStart.id, 'material');
const chEnd = getShowroomChapter(1.0);
assert.equal(chEnd.id, 'weekend');

console.log('check:showroom-ui passed cleanly.');
