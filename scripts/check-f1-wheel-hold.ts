import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { applyF1WheelAngle, createF1WheelMotionState, stepF1WheelMotion } from '../src/lib/f1-wheel-motion';

const state = createF1WheelMotionState();
for (let i = 0; i < 60; i++) stepF1WheelMotion(state, true, 1 / 60, false);
assert(state.velocity > 4);
assert(state.holdIntensity > 0.95);
const releaseVelocity = state.velocity;
for (let i = 0; i < 30; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < releaseVelocity && state.velocity > 0);
for (let i = 0; i < 180; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < 0.02);
assert(state.holdIntensity < 0.02);

const wheel = new THREE.Group();
wheel.position.set(1, 2, 3);
wheel.rotation.set(0.1, 0.2, 0.3);
applyF1WheelAngle([wheel], 1.25);
assert.deepEqual(wheel.position.toArray(), [1, 2, 3]);
assert.equal(wheel.rotation.x, 1.25);
assert.equal(wheel.rotation.y, 0.2);
assert.equal(wheel.rotation.z, 0.3);

const reducedMotionState = createF1WheelMotionState();
for (let i = 0; i < 120; i++) {
  stepF1WheelMotion(reducedMotionState, true, 1 / 60, true);
}
assert.equal(reducedMotionState.velocity, 0, 'reduced-motion hold must keep wheel velocity at zero');
assert.equal(reducedMotionState.angle, 0, 'reduced-motion hold must keep wheel angle at zero');

const particleBackgroundSource = readFileSync(
  new URL('../src/components/ParticleBackground.tsx', import.meta.url),
  'utf8',
);

const sceneSetup = particleBackgroundSource.indexOf('const scene = new THREE.Scene()');
const rendererSetup = particleBackgroundSource.indexOf('const renderer = new THREE.WebGLRenderer');
const wheelMotionSetup = particleBackgroundSource.indexOf('const wheelMotion = createF1WheelMotionState()');
const airflowSetup = particleBackgroundSource.indexOf('const airflow = createF1Airflow(');
const studioLightingSetup = particleBackgroundSource.indexOf('const studioLighting = createF1StudioLighting(scene)');
const reflectionSetup = particleBackgroundSource.indexOf('const reflection = createStudioReflection({');

assert(sceneSetup >= 0, 'ParticleBackground must create the main scene');
assert(rendererSetup > sceneSetup, 'ParticleBackground must create the renderer after the main scene');
assert(wheelMotionSetup > rendererSetup, 'ParticleBackground must create wheel motion after renderer setup');
assert(airflowSetup > rendererSetup, 'ParticleBackground must create airflow after renderer setup');
assert(studioLightingSetup > rendererSetup, 'ParticleBackground must create studio lighting after renderer setup');
assert(reflectionSetup > rendererSetup, 'ParticleBackground must create reflection after renderer setup');

const modelInjection = particleBackgroundSource.indexOf('const checkModelInjection');
const airflowAttachment = particleBackgroundSource.indexOf('f1CarGroup.add(airflow.group)', modelInjection);
const modelCompilation = particleBackgroundSource.indexOf('renderer.compile(scene, camera)', modelInjection);
assert(
  airflowAttachment > modelInjection && airflowAttachment < modelCompilation,
  'ParticleBackground must attach airflow to the F1 car before renderer compilation',
);

assert.match(
  particleBackgroundSource,
  /const s = stateRef\.current;[\s\S]*?stepF1WheelMotion\(wheelMotion, s\.isPressing, delta, prefersReducedMotion\);/,
  'ParticleBackground must feed current press state into wheel motion',
);
assert.match(
  particleBackgroundSource,
  /applyF1WheelAngle\(f1Wheels, wheelMotion\.angle\);/,
  'ParticleBackground must apply the wheel helper to resolved F1 wheels',
);
assert.match(
  particleBackgroundSource,
  /airflow\.update\(\{[\s\S]*?holdIntensity: wheelMotion\.holdIntensity,[\s\S]*?\}\);/,
  'ParticleBackground must pass decaying wheel hold intensity to airflow',
);
assert.doesNotMatch(
  particleBackgroundSource,
  /holdIntensity:\s*s\.isPressing\s*\?\s*wheelMotion\.holdIntensity\s*:\s*0/,
  'ParticleBackground must not cut airflow opacity to zero immediately on release',
);

const reflectionRender = particleBackgroundSource.indexOf('reflection.render()');
const mainSceneRender = particleBackgroundSource.indexOf('renderer.render(scene, camera)', reflectionRender);
assert(
  reflectionRender >= 0 && reflectionRender < mainSceneRender,
  'ParticleBackground must render reflection before the main scene',
);
assert.match(
  particleBackgroundSource,
  /const previousAutoClear = renderer\.autoClear;[\s\S]*?renderer\.autoClear = true;[\s\S]*?reflection\.render\(\);[\s\S]*?renderer\.autoClear = previousAutoClear;/,
  'ParticleBackground must clear reflection targets without changing the dual-pass renderer mode',
);
assert.match(
  particleBackgroundSource,
  /reflection\.resize\(window\.innerWidth, window\.innerHeight\);/,
  'ParticleBackground must resize reflection with the viewport',
);

const airflowDispose = particleBackgroundSource.indexOf('airflow.dispose()');
const studioLightingDispose = particleBackgroundSource.indexOf('studioLighting.dispose()');
const reflectionDispose = particleBackgroundSource.indexOf('reflection.dispose()');
const rendererDispose = particleBackgroundSource.indexOf('renderer.dispose()');
assert(airflowDispose >= 0 && airflowDispose < rendererDispose, 'ParticleBackground must dispose airflow before the renderer');
assert(studioLightingDispose >= 0 && studioLightingDispose < rendererDispose, 'ParticleBackground must dispose studio lighting before the renderer');
assert(reflectionDispose >= 0 && reflectionDispose < rendererDispose, 'ParticleBackground must dispose reflection before the renderer');
