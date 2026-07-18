import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  advanceF1AirflowTime,
  createF1Airflow,
  createF1AirflowPaths,
} from '../src/components/effects/f1Airflow';

const assertApproximatelyEqual = (actual: number, expected: number, message: string): void => {
  assert(Math.abs(actual - expected) <= 1e-6, `${message}: expected ${expected}, received ${actual}`);
};

interface ShippedGlbNode {
  name?: string;
  translation?: [number, number, number];
}

interface ShippedGlbJson {
  nodes: ShippedGlbNode[];
}

const shippedModelBytes = readFileSync(
  new URL('../public/models/red_bull_f1_showroom.glb', import.meta.url),
);
assert.equal(
  shippedModelBytes.toString('ascii', 16, 20),
  'JSON',
  'the shipped showroom asset must expose a GLB JSON chunk',
);
const shippedJsonLength = shippedModelBytes.readUInt32LE(12);
const shippedModel = JSON.parse(
  shippedModelBytes.toString('utf8', 20, 20 + shippedJsonLength),
) as ShippedGlbJson;
const shippedPivotZ = (name: string): number => {
  const node = shippedModel.nodes.find((candidate) => candidate.name === name);
  assert(node, `the shipped showroom GLB must contain ${name}`);
  assert(node.translation, `the shipped ${name} must expose its authored pivot translation`);
  return node.translation[2];
};
const shippedFrontPivotZ = [
  shippedPivotZ('WheelPivot_FL'),
  shippedPivotZ('WheelPivot_FR'),
];
const shippedRearPivotZ = [
  shippedPivotZ('WheelPivot_RL'),
  shippedPivotZ('WheelPivot_RR'),
];
assert(
  shippedFrontPivotZ.every((z) => z > 0),
  'the real shipped front wheel pivots must be on local positive Z',
);
assert(
  shippedRearPivotZ.every((z) => z < 0),
  'the real shipped rear wheel pivots must be on local negative Z',
);
assert(
  Math.min(...shippedFrontPivotZ) > Math.max(...shippedRearPivotZ),
  'the real shipped front axle must remain ahead of the rear axle in local +Z',
);

const assertMirroredWithFloorMargin = (
  bounds: THREE.Box3,
  paths: THREE.Vector3[][],
): void => {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const floorMarginY = bounds.min.y + size.y * 0.12;
  let minimumPathY = Infinity;

  for (let index = 0; index < paths.length; index += 2) {
    const left = paths[index];
    const right = paths[index + 1];
    assert.equal(left.length, right.length, 'mirrored path pairs must have equal point counts');
    for (let pointIndex = 0; pointIndex < left.length; pointIndex += 1) {
      const leftPoint = left[pointIndex];
      const rightPoint = right[pointIndex];
      assertApproximatelyEqual(
        (leftPoint.x + rightPoint.x) * 0.5,
        center.x,
        'mirrored path midpoint x',
      );
      assertApproximatelyEqual(leftPoint.y, rightPoint.y, 'mirrored path y');
      assertApproximatelyEqual(leftPoint.z, rightPoint.z, 'mirrored path z');
      minimumPathY = Math.min(minimumPathY, leftPoint.y, rightPoint.y);
    }
  }

  assertApproximatelyEqual(minimumPathY, floorMarginY, 'airflow path floor margin');
};

const compactBounds = new THREE.Box3(
  new THREE.Vector3(-2, -0.5, -5),
  new THREE.Vector3(2, 1.5, 5),
);
const paths = createF1AirflowPaths(compactBounds);
assert.equal(paths.length, 14);
const compactModelFrontNoseZ = compactBounds.max.z;
const compactModelRearZ = compactBounds.min.z;
const compactModelLength = compactBounds.max.z - compactBounds.min.z;
for (const path of paths) {
  assert(
    path[0].z >= compactModelFrontNoseZ - compactModelLength * 0.07,
    'paths must begin near the shipped model positive-Z front nose',
  );
  assertApproximatelyEqual(
    path.at(-1)!.z,
    compactModelRearZ - compactModelLength * 0.16,
    'paths must exit behind the shipped model negative-Z rear',
  );
  for (let pointIndex = 1; pointIndex < path.length; pointIndex += 1) {
    assert(
      path[pointIndex].z < path[pointIndex - 1].z,
      'airflow curve UV must increase from the positive-Z nose toward the negative-Z rear',
    );
  }
  assert(path.every((point) => point.y >= compactBounds.min.y), 'paths must not run below the car');
}
assertMirroredWithFloorMargin(compactBounds, paths);

const translatedBounds = new THREE.Box3(
  new THREE.Vector3(8, 2, -18),
  new THREE.Vector3(18, 8, 6),
);
const translatedPaths = createF1AirflowPaths(translatedBounds);
assert.equal(translatedPaths.length, 14);
assertMirroredWithFloorMargin(translatedBounds, translatedPaths);
const translatedModelFrontNoseZ = translatedBounds.max.z;
const translatedModelRearZ = translatedBounds.min.z;

interface CapturedAirflowGeometry {
  start: THREE.Vector3;
  end: THREE.Vector3;
  bounds: THREE.Box3;
  radius: number;
}

const capturedGeometries: CapturedAirflowGeometry[] = [];
const bounded = createF1Airflow('high', {
  bounds: translatedBounds,
  createGeometry: (curve, _tubularSegments, radius) => {
    assert(curve instanceof THREE.CatmullRomCurve3, 'airflow geometry must use Catmull-Rom paths');
    const sampledPoints = curve.getPoints(72);
    capturedGeometries.push({
      start: sampledPoints[0].clone(),
      end: sampledPoints.at(-1)!.clone(),
      bounds: new THREE.Box3().setFromPoints(sampledPoints),
      radius,
    });
    return new THREE.BufferGeometry();
  },
});
assert.equal(bounded.group.children.length, 14);
assert.equal(capturedGeometries.length, 14);
const translatedSize = translatedBounds.getSize(new THREE.Vector3());
const translatedFloorMarginY = translatedBounds.min.y + translatedSize.y * 0.12;
for (const captured of capturedGeometries) {
  assert(
    captured.start.z >= translatedModelFrontNoseZ - translatedSize.z * 0.07,
    'bounded curve must start near the supplied positive-Z front nose',
  );
  assertApproximatelyEqual(
    captured.end.z,
    translatedModelRearZ - translatedSize.z * 0.16,
    'bounded curve must end behind the supplied negative-Z rear',
  );
  assert(
    captured.bounds.min.x >= translatedBounds.min.x - 1e-6
      && captured.bounds.max.x <= translatedBounds.max.x + 1e-6,
    'bounded curve must use the supplied translated width',
  );
  assert(
    captured.bounds.min.y >= translatedFloorMarginY - 1e-6,
    'sampled bounded curve must preserve the supplied floor margin',
  );
  assertApproximatelyEqual(
    captured.radius,
    translatedSize.x * 0.0018,
    'bounded airflow radius',
  );
}

const high = createF1Airflow('high');
assert.equal(high.group.children.length, 14);
assert.equal(high.group.visible, false, 'airflow must start hidden');
const materials = new Set(high.group.children.map((child: any) => child.material));
assert.equal(materials.size, 1);
assert(high.material, 'successful airflow creation must expose its material');
assert.match(
  high.material.fragmentShader,
  /#include <colorspace_fragment>/,
  'airflow output must be converted to the renderer output color space',
);
assert.equal(
  high.material.toneMapped,
  false,
  'airflow tone-mapping behavior must be explicit so white/cyan authored color stays stable',
);
assert.match(
  high.material.fragmentShader,
  /fract\(vUv\.x \* 2\.4 - uTime \* uSpeed\)/,
  'the animated pulse must travel along increasing UV from model front to rear',
);
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
const mid = createF1Airflow('mid');
assert.equal(mid.group.children.length, 11);

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
mid.dispose();
bounded.dispose();

const lowTierRadii: number[] = [];
const lowBounded = createF1Airflow('low', {
  bounds: translatedBounds,
  createGeometry: (_curve, _tubularSegments, radius) => {
    lowTierRadii.push(radius);
    return new THREE.BufferGeometry();
  },
});
assert.equal(lowBounded.group.children.length, 8);
assert.equal(lowTierRadii.length, 8);
for (const radius of lowTierRadii) {
  assertApproximatelyEqual(
    radius,
    translatedSize.x * 0.0048,
    'low-tier bounded airflow radius',
  );
}
assert(lowBounded.material, 'low-tier airflow must expose its shared material');
assert.equal(lowBounded.material.depthTest, false, 'low-tier airflow must remain readable over the car');
assert.equal(lowBounded.material.depthWrite, false, 'low-tier airflow must not occlude the car');
assert.equal(lowBounded.material.polygonOffset, false, 'low-tier airflow does not need a depth bias');

assert(bounded.material, 'high-tier airflow must expose its shared material');
assert.equal(bounded.material.depthTest, true, 'high-tier airflow depth behavior must remain unchanged');
assert.equal(bounded.material.polygonOffset, false, 'high-tier airflow appearance must remain unchanged');
lowBounded.dispose();
