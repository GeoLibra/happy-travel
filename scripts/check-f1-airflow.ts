import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  advanceF1AirflowTime,
  createF1Airflow,
  createF1AirflowPaths,
} from '../src/components/effects/f1Airflow';

const compactBounds = new THREE.Box3(
  new THREE.Vector3(-2, -0.5, -5),
  new THREE.Vector3(2, 1.5, 5),
);
const paths = createF1AirflowPaths(compactBounds);
assert.equal(paths.length, 14);
for (const path of paths) {
  assert(path[0].z <= compactBounds.min.z + 1.5, 'paths must begin near the nose');
  assert(path.at(-1)!.z > compactBounds.max.z, 'paths must exit behind the rear');
  assert(path.every((point) => point.y >= compactBounds.min.y), 'paths must not run below the car');
}
const bounded = createF1Airflow('high', { bounds: compactBounds });
assert.equal(bounded.group.children.length, 14);

const high = createF1Airflow('high');
assert.equal(high.group.children.length, 14);
assert.equal(high.group.visible, false, 'airflow must start hidden');
const materials = new Set(high.group.children.map((child: any) => child.material));
assert.equal(materials.size, 1);
assert(high.material, 'successful airflow creation must expose its material');
high.update({ time: 1, holdIntensity: 1, reducedMotion: false });
assert.equal(high.material.uniforms.uOpacity.value, 1);
assert.equal(high.group.visible, true);
const phase = high.material.uniforms.uTime.value;
high.update({ time: 2, holdIntensity: 0, reducedMotion: false });
assert.equal(high.material.uniforms.uOpacity.value, 0);
assert.equal(high.group.visible, false);
assert(high.material.uniforms.uTime.value > phase);
const releasedPhase = high.material.uniforms.uTime.value;
high.update({ time: 3, holdIntensity: 0.5, reducedMotion: true });
assert.equal(high.material.uniforms.uOpacity.value, 0.5);
assert.equal(high.group.visible, true);
assert.equal(high.material.uniforms.uTime.value, releasedPhase);
high.update({ time: 4, holdIntensity: 0.05, reducedMotion: false });
assert.equal(high.group.visible, false, 'airflow at the visibility threshold must be hidden');
high.update({ time: 5, holdIntensity: 0.051, reducedMotion: false });
assert.equal(high.group.visible, true, 'airflow above the visibility threshold must be visible');
const low = createF1Airflow('low');
assert.equal(low.group.children.length, 8);

assert.equal(
  advanceF1AirflowTime(1, 30),
  1.1,
  'a suspension-sized delta must advance the airflow phase by only 100 ms',
);
assert.equal(advanceF1AirflowTime(1, -2), 1, 'negative deltas must not rewind airflow');

let allocationCount = 0;
let disposedGeometryCount = 0;
let disposedMaterialCount = 0;
const warnings: unknown[][] = [];
const failed = createF1Airflow('low', {
  createGeometry: () => {
    allocationCount += 1;
    if (allocationCount === 4) throw new Error('forced fourth allocation failure');
    const geometry = new THREE.BufferGeometry();
    geometry.addEventListener('dispose', () => {
      disposedGeometryCount += 1;
    });
    return geometry;
  },
  createMaterial: (parameters) => {
    const material = new THREE.ShaderMaterial(parameters);
    material.addEventListener('dispose', () => {
      disposedMaterialCount += 1;
    });
    return material;
  },
  warn: (...args) => warnings.push(args),
});
assert.equal(allocationCount, 4, 'the failure must be injected on the requested allocation');
assert.equal(disposedGeometryCount, 3, 'all geometries allocated before failure must be disposed');
assert.equal(disposedMaterialCount, 1, 'the shared material must be disposed on failure');
assert.equal(failed.group.children.length, 0, 'failed creation must not expose partial meshes');
assert.equal(failed.group.visible, false, 'failed creation must return a hidden inert effect');
assert.equal(failed.material, null, 'failed creation must not expose a disposed material');
failed.update({ time: 99, holdIntensity: 1, reducedMotion: false });
failed.dispose();
failed.dispose();

createF1Airflow('low', {
  createGeometry: () => {
    throw new Error('forced first allocation failure');
  },
  warn: (...args) => warnings.push(args),
});
assert.equal(warnings.length, 1, 'airflow allocation failures must warn only once');

const particleBackgroundSource = readFileSync(
  new URL('../src/components/ParticleBackground.tsx', import.meta.url),
  'utf8',
);
assert.match(
  particleBackgroundSource,
  /let airflowTime = 0;/,
  'ParticleBackground must keep an airflow clock separate from absolute elapsed time',
);
assert.match(
  particleBackgroundSource,
  /airflowTime = advanceF1AirflowTime\(airflowTime, delta\);/,
  'ParticleBackground must advance airflow time from the clamped frame delta',
);
assert.match(
  particleBackgroundSource,
  /airflow\.update\(\{[\s\S]*?time: airflowTime,/,
  'ParticleBackground must drive airflow with the accumulated clamped clock',
);
high.dispose();
high.dispose();
low.dispose();
bounded.dispose();
