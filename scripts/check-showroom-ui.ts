import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { translate } from '../src/i18n.tsx';
import { CinematicRenderer } from '../src/components/showroom/cinematic-renderer.ts';
import {
  isIgnitionKey,
  shouldLockScroll,
  PureIgnitionController,
} from '../src/components/showroom/useIgnition.ts';
import { getShowroomChapter } from '../src/lib/showroom-story.ts';

// 1. Verify i18n keys wiring for showroom UI overlay
assert.equal(translate('zh', 'showroom.ignition.hold'), '按住空格/回车或点击启动引擎');
assert.equal(translate('en', 'showroom.ignition.hold'), 'Hold Space/Enter or Click to Start Engine');
assert.equal(translate('zh', 'showroom.ignition.starting'), '引擎启动中');
assert.equal(translate('en', 'showroom.ignition.starting'), 'Engine Starting');
assert.equal(translate('zh', 'showroom.ignition.ready'), '狂欢开启');
assert.equal(translate('en', 'showroom.ignition.ready'), 'Enter Showroom');
assert.equal(translate('zh', 'showroom.skip'), '跳过动画');
assert.equal(translate('en', 'showroom.skip'), 'Skip Intro');
assert.equal(translate('zh', 'showroom.chapter'), '章节');
assert.equal(translate('en', 'showroom.chapter'), 'Chapter');

// 2. Verify isIgnitionKey matcher helper
assert.equal(isIgnitionKey(' '), true, 'Space character key must trigger ignition');
assert.equal(isIgnitionKey('Space'), true, 'Space code must trigger ignition');
assert.equal(isIgnitionKey('Enter'), true, 'Enter key must trigger ignition');
assert.equal(isIgnitionKey({ key: ' ' }), true);
assert.equal(isIgnitionKey({ code: 'Space' }), true);
assert.equal(isIgnitionKey({ key: 'Enter' }), true);
assert.equal(isIgnitionKey('Tab'), false, 'Tab key must not trigger ignition');
assert.equal(isIgnitionKey({ key: 'a' }), false);

// 3. Verify scroll locking behavior rules
assert.equal(shouldLockScroll('ready'), true, 'Scroll must be locked when ready');
assert.equal(shouldLockScroll('holding'), true, 'Scroll must be locked when holding');
assert.equal(shouldLockScroll('completing'), true, 'Scroll must be locked when completing');
assert.equal(shouldLockScroll('ignited'), false, 'Scroll must be unlocked when ignited');

// 4. Verify pure controller keyboard & pointer ignition flow + handoff callback
let completedCount = 0;
const controller = new PureIgnitionController(0, () => {
  completedCount += 1;
});

assert.equal(controller.getState().status, 'ready');
assert.equal(controller.getState().progress, 0);

// KeyDown Space -> holding
controller.handleKeyDown({ key: ' ' });
assert.equal(controller.getState().status, 'holding');

// KeyDown repeat -> no change
controller.handleKeyDown({ key: ' ', repeat: true });
assert.equal(controller.getState().status, 'holding');

// Tick 1250ms -> progress 0.5
controller.tick(1250);
assert.equal(controller.getState().status, 'holding');
assert.equal(controller.getState().progress, 0.5);

// KeyUp Space -> completing (progress >= 30%)
controller.handleKeyUp({ key: ' ' });
assert.equal(controller.getState().status, 'completing');

// Tick 1500ms -> ignited & handoff callback executed
controller.tick(1500);
assert.equal(controller.getState().status, 'ignited');
assert.equal(controller.getState().progress, 1.0);
assert.equal(completedCount, 1, 'Handoff callback must be called exactly once upon ignition');

// Submitting tick when already ignited should keep count 1
controller.tick(500);
assert.equal(completedCount, 1);

// Controller reset
controller.reset();
assert.equal(controller.getState().status, 'ready');
assert.equal(controller.getState().progress, 0);

// Pointer press flow
controller.press();
assert.equal(controller.getState().status, 'holding');
controller.tick(2500);
assert.equal(controller.getState().status, 'ignited');
assert.equal(completedCount, 2);

// 5. Verify CinematicRenderer outputColorSpace application when renderer is provided
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

// 6. Source-level UI Accessibility & Data Attributes Check
const overlaySource = readFileSync('src/components/showroom/ShowroomOverlay.tsx', 'utf8');
const welcomeSource = readFileSync('src/components/WelcomePage.tsx', 'utf8');

assert.match(overlaySource, /data-showroom-action="ignition"/, 'ShowroomOverlay must declare data-showroom-action="ignition"');
assert.match(overlaySource, /data-showroom-action="skip"/, 'ShowroomOverlay must declare data-showroom-action="skip"');
assert.match(overlaySource, /aria-label=/, 'ShowroomOverlay must provide aria-label attributes');
assert.match(overlaySource, /aria-live="polite"/, 'ShowroomOverlay must include live region for screen readers');
assert.match(overlaySource, /tabIndex=\{0\}/, 'ShowroomOverlay controls must be focusable');

assert.match(welcomeSource, /ShowroomOverlay/, 'WelcomePage must incorporate ShowroomOverlay scaffold');
assert.match(welcomeSource, /useIgnition/, 'WelcomePage must incorporate useIgnition hook scaffold');

// 7. Verify Chapter Story definition integration
const chStart = getShowroomChapter(0.0);
assert.equal(chStart.id, 'material');
const chEnd = getShowroomChapter(1.0);
assert.equal(chEnd.id, 'weekend');

console.log('check:showroom-ui passed cleanly.');
