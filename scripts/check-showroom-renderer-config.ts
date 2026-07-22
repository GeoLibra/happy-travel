import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  getEffectivePixelRatio,
  selectShowroomRendererConfig,
} from '../src/lib/showroom-renderer-config.ts';
import { CinematicRenderer } from '../src/components/showroom/cinematic-renderer.ts';

// 1. Test getEffectivePixelRatio capping
assert.equal(getEffectivePixelRatio(2.0, 3.0), 2.0, 'DPR 3.0 must be capped to maxPixelRatio 2.0');
assert.equal(getEffectivePixelRatio(2.0, 1.0), 1.0, 'DPR 1.0 below max 2.0 remains 1.0');
assert.equal(getEffectivePixelRatio(1.5, 2.0), 1.5, 'DPR 2.0 must be capped to maxPixelRatio 1.5');
assert.equal(getEffectivePixelRatio(1.0, 2.0), 1.0, 'DPR 2.0 must be capped to maxPixelRatio 1.0');

// 2. Test selectShowroomRendererConfig defaults (High tier)
const highConfig = selectShowroomRendererConfig({ forceLevel: 'high' });
assert.equal(highConfig.qualityLevel, 'high');
assert.equal(highConfig.maxPixelRatio, 2.0);
assert.equal(highConfig.antialias, true);
assert.equal(highConfig.shadowsEnabled, true);
assert.equal(highConfig.shadowMapType, THREE.PCFSoftShadowMap);
assert.equal(highConfig.toneMapping, THREE.ACESFilmicToneMapping);
assert.equal(highConfig.outputColorSpace, THREE.SRGBColorSpace);
assert.equal(highConfig.postprocessing.enabled, true);
assert.equal(highConfig.postprocessing.bloomEnabled, true);
assert.equal(highConfig.postprocessing.vignetteEnabled, true);
assert.equal(highConfig.postprocessing.chromaticAberrationEnabled, true);

// 3. Test selectShowroomRendererConfig Mobile (Medium tier)
const mediumConfig = selectShowroomRendererConfig({ mobile: true });
assert.equal(mediumConfig.qualityLevel, 'medium');
assert.equal(mediumConfig.maxPixelRatio, 1.5);
assert.equal(mediumConfig.shadowsEnabled, false);
assert.equal(mediumConfig.postprocessing.bloomEnabled, true);
assert.equal(mediumConfig.postprocessing.chromaticAberrationEnabled, false);

// 4. Test selectShowroomRendererConfig Low Hardware Specs (Low tier)
const lowConfig = selectShowroomRendererConfig({ deviceMemory: 2, hardwareConcurrency: 2 });
assert.equal(lowConfig.qualityLevel, 'low');
assert.equal(lowConfig.maxPixelRatio, 1.0);
assert.equal(lowConfig.antialias, false);
assert.equal(lowConfig.shadowsEnabled, false);
assert.equal(lowConfig.postprocessing.enabled, false);
assert.equal(lowConfig.postprocessing.bloomEnabled, false);

// 5. Test selectShowroomRendererConfig Reduced Motion
const reducedConfig = selectShowroomRendererConfig({ prefersReducedMotion: true });
assert.equal(reducedConfig.reducedMotion, true);
assert.equal(reducedConfig.shadowsEnabled, false);
assert.equal(reducedConfig.postprocessing.enabled, false);
assert.equal(reducedConfig.postprocessing.bloomEnabled, false);
assert.equal(reducedConfig.postprocessing.vignetteEnabled, false);

// 6. Test CinematicRenderer construction, update, identity preservation, and disposal
const rendererInstance = new CinematicRenderer({
  qualityOptions: { forceLevel: 'high' },
});

assert.equal(rendererInstance.configuration.qualityLevel, 'high');
assert.ok(rendererInstance.sceneObject instanceof THREE.Scene);
assert.ok(rendererInstance.cameraObject instanceof THREE.PerspectiveCamera);
assert.ok(rendererInstance.floorObject instanceof THREE.Mesh);
assert.ok(rendererInstance.floorGeom instanceof THREE.PlaneGeometry);
assert.ok(rendererInstance.floorMat instanceof THREE.MeshStandardMaterial);
assert.ok(rendererInstance.lightingGroupObject instanceof THREE.Group);

// Assert object identity preservation across multiple frame updates (zero per-frame allocations)
const floorGeomBefore = rendererInstance.floorGeom;
const floorMatBefore = rendererInstance.floorMat;
const lightingGroupBefore = rendererInstance.lightingGroupObject;

rendererInstance.update({
  lightIntensity: 1.5,
  floorReveal: 0.8,
  cameraPosition: { x: 0, y: 3, z: 10 },
  cameraTarget: { x: 0, y: 0, z: 0 },
});

rendererInstance.update({
  lightIntensity: 0.5,
  floorReveal: 1.0,
  cameraPosition: { x: 2, y: 4, z: 12 },
});

const floorGeomAfter = rendererInstance.floorGeom;
const floorMatAfter = rendererInstance.floorMat;
const lightingGroupAfter = rendererInstance.lightingGroupObject;

assert.equal(floorGeomBefore, floorGeomAfter, 'update must preserve floor geometry identity');
assert.equal(floorMatBefore, floorMatAfter, 'update must preserve floor material identity');
assert.equal(lightingGroupBefore, lightingGroupAfter, 'update must preserve lighting group identity');

// Verify updated values
assert.equal(rendererInstance.keyLightObject.intensity, 3.0 * 0.5);
assert.equal(rendererInstance.floorMat.opacity, 0.9 * 1.0);

// Test disposal lifecycle
rendererInstance.dispose();
assert.equal(rendererInstance.isRendererDisposed, true);

// Idempotent double dispose check
rendererInstance.dispose();
assert.equal(rendererInstance.isRendererDisposed, true);

// 7. Test CinematicRenderer outputColorSpace application when renderer is provided
let appliedPixelRatio = 1;
const mockWebGLRenderer = {
  setPixelRatio: (dpr: number) => { appliedPixelRatio = dpr; },
  outputColorSpace: '',
  toneMapping: 0,
  toneMappingExposure: 1,
  shadowMap: { enabled: false, type: 0 },
} as unknown as THREE.WebGLRenderer;

const rendererWithMock = new CinematicRenderer({
  qualityOptions: { forceLevel: 'high' },
  renderer: mockWebGLRenderer,
});

assert.equal(
  mockWebGLRenderer.outputColorSpace,
  rendererWithMock.configuration.outputColorSpace,
  'CinematicRenderer must apply config.outputColorSpace when renderer is provided',
);
rendererWithMock.dispose();

console.log('check:showroom-renderer-config passed cleanly.');
