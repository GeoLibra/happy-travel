import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const assets = {
  sourceModel: 'public/models/red_bull_f1_rigged.glb',
  model: 'public/models/red_bull_f1_showroom_v4.glb',
  studio: 'public/environments/ferndale_studio_09_1k.hdr',
  night: 'public/environments/rooftop_night_1k.hdr',
};

const parseGlbJson = async (path) => {
  const bytes = await readFile(path);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + length));
};

const sha1 = async (path) => createHash('sha1')
  .update(await readFile(path))
  .digest('hex');

const PIVOT_NODES = ['WheelPivot_FL', 'WheelPivot_FR', 'WheelPivot_RL', 'WheelPivot_RR'];

const normalizedLocalTransform = (node) => {
  if (node.matrix) return node.matrix;

  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const xx = x * x * 2;
  const yy = y * y * 2;
  const zz = z * z * 2;
  const xy = x * y * 2;
  const xz = x * z * 2;
  const yz = y * z * 2;
  const wx = w * x * 2;
  const wy = w * y * 2;
  const wz = w * z * 2;

  return [
    (1 - yy - zz) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - xx - zz) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - xx - yy) * sz, 0,
    tx, ty, tz, 1,
  ];
};

const parentNames = (gltf) => {
  const parents = new Map();
  gltf.nodes.forEach((node, parentIndex) => {
    for (const childIndex of node.children ?? []) {
      const names = parents.get(childIndex) ?? [];
      names.push(gltf.nodes[parentIndex].name ?? null);
      parents.set(childIndex, names);
    }
  });
  return parents;
};

const assertSameTransform = (name, sourceNode, optimizedNode) => {
  const sourceTransform = normalizedLocalTransform(sourceNode);
  const optimizedTransform = normalizedLocalTransform(optimizedNode);
  assert.equal(optimizedTransform.length, sourceTransform.length);
  sourceTransform.forEach((value, index) => {
    assert.ok(
      Math.abs(optimizedTransform[index] - value) <= 1e-7,
      `${name} local transform changed at matrix index ${index}: `
        + `${value} -> ${optimizedTransform[index]}`,
    );
  });
};

const assertWheelPivotContract = (source, optimized) => {
  for (const name of PIVOT_NODES) {
    const sourceIndex = source.nodes.findIndex((node) => node.name === name);
    const optimizedIndex = optimized.nodes.findIndex((node) => node.name === name);
    assert.notEqual(sourceIndex, -1, `Source is missing required node: ${name}`);
    assert.notEqual(optimizedIndex, -1, `Missing required node: ${name}`);
    assertSameTransform(name, source.nodes[sourceIndex], optimized.nodes[optimizedIndex]);
  }
};

const modelStat = await stat(assets.model);
assert.ok(modelStat.size <= 15 * 1024 * 1024, `Showroom GLB is ${modelStat.size} bytes`);

const sourceGltf = await parseGlbJson(assets.sourceModel);
const gltf = await parseGlbJson(assets.model);
const airflowCheckSource = await readFile('scripts/check-f1-airflow.ts', 'utf8');
const welcomeSource = await readFile('src/components/WelcomePage.tsx', 'utf8');
const showroomAssetsSource = await readFile('src/components/showroom/showroom-assets.ts', 'utf8');
assert.match(
  airflowCheckSource,
  /public\/models\/red_bull_f1_showroom_v4\.glb/,
  'the airflow check must read the real shipped showroom GLB',
);
assert.match(
  welcomeSource,
  /\/models\/red_bull_f1_showroom_v4\.glb\?v=hard-rock-inner-shrouds-1/,
  'the welcome scene must load the versioned v4 showroom GLB',
);
assert.match(
  showroomAssetsSource,
  /\/models\/red_bull_f1_showroom_v4\.glb/,
  'the showroom asset registry must expose the v4 showroom GLB',
);
for (const pivotName of ['WheelPivot_FL', 'WheelPivot_FR', 'WheelPivot_RL', 'WheelPivot_RR']) {
  assert.match(
    airflowCheckSource,
    new RegExp(pivotName),
    `the airflow check must verify the shipped ${pivotName} axle pivot`,
  );
}
const names = new Set(gltf.nodes.map((node) => node.name));
for (const name of [
  'F1_Car',
  'WheelSpin_FL',
  'WheelSpin_FR',
  'WheelSpin_RL',
  'WheelSpin_RR',
  'WheelStatic_FL',
  'WheelStatic_FR',
  'WheelStatic_RL',
  'WheelStatic_RR',
  'RearBodyAssembly',
  'RearHardRockAeroPanel',
  'FrontHardRockWheelCover_FL',
  'FrontHardRockWheelCover_FR',
  'FrontHardRockInnerShroud_FL',
  'FrontHardRockInnerShroud_FR',
]) {
  assert.ok(names.has(name), `Missing required node: ${name}`);
}

const mutatedTransform = structuredClone(sourceGltf);
mutatedTransform.nodes.find((node) => node.name === 'WheelPivot_FL').translation = [0.01, 0, 0];
assert.throws(
  () => assertWheelPivotContract(sourceGltf, mutatedTransform),
  /WheelPivot_FL local transform changed/,
);
assertWheelPivotContract(sourceGltf, gltf);

assert.equal(await sha1(assets.studio), '300723e57b930413fa3e493033033713f911dd18');
assert.equal(await sha1(assets.night), '4dc306b1cc07c5e9e830758dede1eb7ed8ecbebd');
console.log(`PASS: showroom assets (${(modelStat.size / 1024 / 1024).toFixed(2)} MB model)`);
