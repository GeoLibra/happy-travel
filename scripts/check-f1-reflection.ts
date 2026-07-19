import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createStudioReflection } from '../src/components/effects/studioReflection';

const source = readFileSync(
  new URL('../src/components/effects/studioReflection.ts', import.meta.url),
  'utf8',
);

const assertVisibleCharcoal = (color: THREE.Color, label: string): void => {
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  assert(
    luminance >= 0.03,
    `${label} must remain visibly charcoal instead of reading as pure black`,
  );
};

assert.match(source, /export interface StudioReflectionEffect/);
assert.match(source, /export const createStudioReflection/);
assert.match(source, /const STUDIO_FLOOR_COLOR = 0xaeb8c4/);
assert.match(source, /0\.72 \* inside \* uReveal/);
assert.match(source, /opacity:\s*0/);
assert.match(source, /roughness:\s*0\.68/);
assert.match(source, /const FALLBACK_FLOOR_ALPHA = 0\.12/);
assert.match(source, /mix\(0\.08, 0\.64, reflectionMask\)/);
assert.match(source, /smoothstep\(0\.015, 0\.22, reflectionEnergy\)/);
assert.match(source, /#include <colorspace_fragment>/);
assert.match(source, /new THREE\.PlaneGeometry\(90, 80\)/);
assert.match(source, /Math\.ceil\(width \* 0\.5\)/);
assert.match(source, /Math\.ceil\(height \* 0\.5\)/);
assert.match(source, /tier === 'fallback'/);

const fallbackBranch = source.indexOf("if (tier === 'fallback')");
const targetAllocation = source.indexOf('new THREE.WebGLRenderTarget');
assert(fallbackBranch >= 0 && fallbackBranch < targetAllocation);
assert.match(source.slice(fallbackBranch, targetAllocation), /return createFallbackEffect\(scene\)/);

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

assert.equal(fallback.floor.visible, false, 'fallback floor must start hidden');
assertVisibleCharcoal(
  (fallback.floor.material as THREE.MeshStandardMaterial).color,
  'fallback floor',
);
assert.equal(
  fallback.floor.material.toneMapped,
  false,
  'fallback floor must preserve its authored charcoal tone',
);
fallback.setReveal(0.5);
assert.equal(fallback.floor.visible, true);
assert.equal((fallback.floor.material as THREE.MeshStandardMaterial).opacity, 0.06);
fallback.setReveal(0);
assert.equal(fallback.floor.visible, false);
assert.match(source, /uReveal/);
assert.match(source, /setReveal: \(reveal\) =>/);

const reflectivePreview = createStudioReflection({
  renderer: {} as THREE.WebGLRenderer,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100),
  viewport: { width: 800, height: 600 },
  tier: 'reflective',
});
assert(reflectivePreview.floor.material instanceof THREE.ShaderMaterial);
assertVisibleCharcoal(
  reflectivePreview.floor.material.uniforms.uFloorColor.value as THREE.Color,
  'reflective floor',
);
assert.equal(
  reflectivePreview.floor.material.toneMapped,
  false,
  'reflective floor must preserve its authored charcoal tone',
);
reflectivePreview.dispose();

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

let setupAllocations = 0;
let setupTargetDisposals = 0;
const setupFailureScene = new THREE.Scene();
const setupFailure = createStudioReflection({
  renderer: {} as THREE.WebGLRenderer,
  scene: setupFailureScene,
  camera: new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100),
  viewport: { width: 800, height: 600 },
  tier: 'reflective',
  createRenderTarget: (width, height, options) => {
    setupAllocations += 1;
    if (setupAllocations === 2) throw new Error('forced second-target failure');
    const target = new THREE.WebGLRenderTarget(width, height, options);
    target.dispose = () => { setupTargetDisposals += 1; };
    return target;
  },
});

assert.equal(setupAllocations, 2);
assert.equal(setupTargetDisposals, 1);
assert(setupFailure.floor.material instanceof THREE.MeshStandardMaterial);
assert(setupFailureScene.children.includes(setupFailure.floor));
assert.doesNotThrow(() => setupFailure.render());
setupFailure.dispose();

class FailingOnceScene extends THREE.Scene {
  private addAttempts = 0;

  override add(...objects: THREE.Object3D[]): this {
    this.addAttempts += 1;
    if (this.addAttempts === 1) throw new Error('forced scene-attachment failure');
    return super.add(...objects);
  }
}

let lateSetupTargetDisposals = 0;
let lateSetupGeometryDisposals = 0;
let lateSetupMaterialDisposals = 0;
let lateSetupFallbackMaterialDisposals = 0;
const originalGeometryDispose = THREE.PlaneGeometry.prototype.dispose;
const originalMaterialDispose = THREE.ShaderMaterial.prototype.dispose;
const originalFallbackMaterialDispose = THREE.MeshStandardMaterial.prototype.dispose;
let lateSetupFailure!: ReturnType<typeof createStudioReflection>;

try {
  THREE.PlaneGeometry.prototype.dispose = function disposeTrackedGeometry() {
    lateSetupGeometryDisposals += 1;
    originalGeometryDispose.call(this);
  };
  THREE.ShaderMaterial.prototype.dispose = function disposeTrackedMaterial() {
    lateSetupMaterialDisposals += 1;
    originalMaterialDispose.call(this);
  };
  THREE.MeshStandardMaterial.prototype.dispose = function disposeTrackedFallbackMaterial() {
    lateSetupFallbackMaterialDisposals += 1;
    originalFallbackMaterialDispose.call(this);
  };
  lateSetupFailure = createStudioReflection({
    renderer: {} as THREE.WebGLRenderer,
    scene: new FailingOnceScene(),
    camera: new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100),
    viewport: { width: 800, height: 600 },
    tier: 'reflective',
    createRenderTarget: (width, height, options) => {
      const target = new THREE.WebGLRenderTarget(width, height, options);
      target.dispose = () => { lateSetupTargetDisposals += 1; };
      return target;
    },
  });
} finally {
  THREE.PlaneGeometry.prototype.dispose = originalGeometryDispose;
  THREE.ShaderMaterial.prototype.dispose = originalMaterialDispose;
  THREE.MeshStandardMaterial.prototype.dispose = originalFallbackMaterialDispose;
}

assert.equal(lateSetupTargetDisposals, 2);
assert.equal(lateSetupGeometryDisposals, 2);
assert.equal(lateSetupMaterialDisposals, 3);
assert.equal(lateSetupFallbackMaterialDisposals, 1);
assert(lateSetupFailure.floor.material instanceof THREE.MeshStandardMaterial);
lateSetupFailure.dispose();

let renderTargetDisposals = 0;
let renderTargetResizes = 0;
const renderFailureScene = new THREE.Scene();
const renderFailureCamera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
const targetTransitions: Array<THREE.WebGLRenderTarget | null> = [];
let firstTargetFailure = true;
const failingRenderer = {
  getRenderTarget: () => null,
  setRenderTarget: (target: THREE.WebGLRenderTarget | null) => {
    targetTransitions.push(target);
    if (target && firstTargetFailure) {
      firstTargetFailure = false;
      throw new Error('forced first-render allocation failure');
    }
  },
  render: () => assert.fail('scene render must not run after target binding fails'),
} as unknown as THREE.WebGLRenderer;

const renderFailure = createStudioReflection({
  renderer: failingRenderer,
  scene: renderFailureScene,
  camera: renderFailureCamera,
  viewport: { width: 800, height: 600 },
  tier: 'reflective',
  createRenderTarget: (width, height, options) => {
    const target = new THREE.WebGLRenderTarget(width, height, options);
    target.dispose = () => { renderTargetDisposals += 1; };
    target.setSize = () => { renderTargetResizes += 1; };
    return target;
  },
});

assert(renderFailure.floor.material instanceof THREE.ShaderMaterial);
const renderFailureGeometry = renderFailure.floor.geometry;
const reflectiveMaterial = renderFailure.floor.material;
let renderFailureGeometryDisposals = 0;
let reflectiveMaterialDisposals = 0;
renderFailureGeometry.dispose = () => { renderFailureGeometryDisposals += 1; };
reflectiveMaterial.dispose = () => { reflectiveMaterialDisposals += 1; };

renderFailure.setReveal(0.5);
assert.doesNotThrow(() => renderFailure.render());
assert(renderFailure.floor.material instanceof THREE.MeshStandardMaterial);
assert.equal(renderFailure.floor.geometry, renderFailureGeometry);
assert.equal(renderFailure.floor.visible, true);
assert.equal(renderFailure.floor.material.opacity, 0.06);
assert.equal(renderFailureCamera.visible, true);
assert.equal(targetTransitions.at(-1), null);
assert.equal(renderTargetDisposals, 2);
assert.equal(reflectiveMaterialDisposals, 1);
assert.equal(renderFailureGeometryDisposals, 0);

const transitionCountAfterFailure = targetTransitions.length;
assert.doesNotThrow(() => renderFailure.render());
renderFailure.resize(1280, 720);
assert.equal(targetTransitions.length, transitionCountAfterFailure);
assert.equal(renderTargetResizes, 0);

let runtimeFallbackMaterialDisposals = 0;
renderFailure.floor.material.dispose = () => { runtimeFallbackMaterialDisposals += 1; };
renderFailure.dispose();
renderFailure.dispose();
assert.equal(renderFailureGeometryDisposals, 1);
assert.equal(runtimeFallbackMaterialDisposals, 1);
assert(!renderFailureScene.children.includes(renderFailure.floor));
