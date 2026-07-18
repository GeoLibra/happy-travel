import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createStudioReflection } from '../src/components/effects/studioReflection';

const source = readFileSync(
  new URL('../src/components/effects/studioReflection.ts', import.meta.url),
  'utf8',
);

assert.match(source, /export interface StudioReflectionEffect/);
assert.match(source, /export const createStudioReflection/);
assert.match(source, /new THREE\.PlaneGeometry\(90, 80\)/);
assert.match(source, /Math\.ceil\(width \* 0\.5\)/);
assert.match(source, /Math\.ceil\(height \* 0\.5\)/);
assert.match(source, /tier === 'fallback'/);

const fallbackBranch = source.indexOf("if (tier === 'fallback')");
const targetAllocation = source.indexOf('new THREE.WebGLRenderTarget');
assert(fallbackBranch >= 0 && fallbackBranch < targetAllocation);
assert.match(source.slice(fallbackBranch, targetAllocation), /return \{/);

const hideFloor = source.indexOf('floor.visible = false');
const reflectionRender = source.indexOf('renderer.render(scene, mirroredCamera)');
const restoreState = source.indexOf('finally', reflectionRender);
assert(hideFloor >= 0 && hideFloor < reflectionRender);
assert(reflectionRender < restoreState);
assert.match(source.slice(restoreState), /floor\.visible = floorWasVisible/);
assert.match(source.slice(restoreState), /camera\.visible = cameraWasVisible/);
assert.match(source.slice(restoreState), /renderer\.setRenderTarget\(previousTarget\)/);

const horizontalPass = source.indexOf('renderer.setRenderTarget(targetB)');
const verticalPass = source.indexOf('renderer.setRenderTarget(targetA)', horizontalPass);
assert(horizontalPass > reflectionRender);
assert(verticalPass > horizontalPass);
assert.equal(source.match(/renderer\.render\(blurScene, blurCamera\)/g)?.length, 2);
assert.match(source, /targetA\.setSize\(halfWidth, halfHeight\)/);
assert.match(source, /targetB\.setSize\(halfWidth, halfHeight\)/);
assert.match(source, /if \(disposed\) return/);

const reflectiveRender = source.indexOf('render: () => {', targetAllocation);
const resizeMethod = source.indexOf('resize: (width, height) => {', reflectiveRender);
assert(reflectiveRender >= 0 && resizeMethod > reflectiveRender);
assert.doesNotMatch(source.slice(reflectiveRender, resizeMethod), /new THREE\./);

const fallback = createStudioReflection({
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100),
  viewport: { width: 800, height: 600 },
  tier: 'fallback',
});

assert(fallback.floor.geometry instanceof THREE.PlaneGeometry);
assert(fallback.floor.material instanceof THREE.MeshStandardMaterial);
assert.equal(fallback.floor.rotation.x, -Math.PI / 2);
assert.doesNotThrow(() => fallback.render());
assert.doesNotThrow(() => fallback.resize(1280, 720));

let geometryDisposals = 0;
let materialDisposals = 0;
fallback.floor.geometry.dispose = () => { geometryDisposals += 1; };
fallback.floor.material.dispose = () => { materialDisposals += 1; };
fallback.dispose();
fallback.dispose();
assert.equal(geometryDisposals, 1);
assert.equal(materialDisposals, 1);
