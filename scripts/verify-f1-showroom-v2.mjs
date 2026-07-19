import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const REQUIRED_PIVOTS = ['WheelPivot_FL', 'WheelPivot_FR', 'WheelPivot_RL', 'WheelPivot_RR'];
const REQUIRED_SPINS = ['WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR'];
const REQUIRED_STATICS = ['WheelStatic_FL', 'WheelStatic_FR', 'WheelStatic_RL', 'WheelStatic_RR'];
const REQUIRED_HARD_ROCK_COVERS = [
  'FrontHardRockWheelCover_FL',
  'FrontHardRockWheelCover_FR',
];

const readGlbJson = (filePath) => {
  const bytes = readFileSync(filePath);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${filePath} is not a GLB`);
  assert.equal(bytes.readUInt32LE(4), 2, `${filePath} is not glTF 2.0`);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === 0x4e4f534a) {
      return JSON.parse(bytes.subarray(start, start + length).toString('utf8'));
    }
    offset = start + length;
  }
  throw new Error(`${filePath} has no JSON chunk`);
};

const verify = (filePath) => {
  const gltf = readGlbJson(filePath);
  const nodes = gltf.nodes ?? [];
  const indexByName = new Map(nodes.map((node, index) => [node.name, index]));
  const parentByChild = new Map();
  nodes.forEach((node, parentIndex) => {
    for (const childIndex of node.children ?? []) parentByChild.set(childIndex, parentIndex);
  });
  const hasMeshDescendant = (nodeIndex, visited = new Set()) => {
    if (visited.has(nodeIndex)) return false;
    visited.add(nodeIndex);
    const node = nodes[nodeIndex];
    if (!node) return false;
    if (Number.isInteger(node.mesh)) return true;
    return (node.children ?? []).some((child) => hasMeshDescendant(child, visited));
  };
  const isDescendant = (nodeIndex, ancestorIndex) => {
    let current = parentByChild.get(nodeIndex);
    while (current !== undefined) {
      if (current === ancestorIndex) return true;
      current = parentByChild.get(current);
    }
    return false;
  };

  for (const name of [
    'F1_Car',
    ...REQUIRED_PIVOTS,
    ...REQUIRED_SPINS,
    ...REQUIRED_STATICS,
    'RearBodyAssembly',
    'RearHardRockAeroPanel',
    ...REQUIRED_HARD_ROCK_COVERS,
  ]) {
    assert.ok(indexByName.has(name), `Missing required node: ${name}`);
  }

  for (let index = 0; index < REQUIRED_PIVOTS.length; index += 1) {
    const pivotIndex = indexByName.get(REQUIRED_PIVOTS[index]);
    const spinIndex = indexByName.get(REQUIRED_SPINS[index]);
    const staticIndex = indexByName.get(REQUIRED_STATICS[index]);
    assert.equal(parentByChild.get(spinIndex), pivotIndex, `${REQUIRED_SPINS[index]} must be a direct pivot child`);
    assert.equal(parentByChild.get(staticIndex), pivotIndex, `${REQUIRED_STATICS[index]} must be a direct pivot child`);
    assert.ok(hasMeshDescendant(spinIndex), `${REQUIRED_SPINS[index]} must contain rotating geometry`);
    const spinTranslation = nodes[spinIndex].translation ?? [0, 0, 0];
    assert.ok(Math.hypot(...spinTranslation) <= 1e-4, `${REQUIRED_SPINS[index]} must have zero local translation`);
  }

  const rearBodyIndex = indexByName.get('RearBodyAssembly');
  const rearPanelIndex = indexByName.get('RearHardRockAeroPanel');
  assert.equal(parentByChild.get(rearPanelIndex), rearBodyIndex, 'rear Hard Rock panel must follow RearBodyAssembly');
  assert.ok(hasMeshDescendant(rearPanelIndex), 'rear Hard Rock panel must contain geometry');
  assert.ok(
    (nodes[rearBodyIndex].children ?? []).some(
      (childIndex) => childIndex !== rearPanelIndex && hasMeshDescendant(childIndex),
    ),
    'RearBodyAssembly must also contain rear-wing geometry outside the panel group',
  );
  for (const spinName of REQUIRED_SPINS) {
    assert.equal(
      isDescendant(rearPanelIndex, indexByName.get(spinName)),
      false,
      `rear Hard Rock panel must not rotate with ${spinName}`,
    );
  }
  for (const coverName of REQUIRED_HARD_ROCK_COVERS) {
    const coverIndex = indexByName.get(coverName);
    assert.ok(
      isDescendant(coverIndex, rearPanelIndex),
      `${coverName} must move with the Hard Rock body panel assembly`,
    );
    for (const spinName of REQUIRED_SPINS) {
      assert.equal(
        isDescendant(coverIndex, indexByName.get(spinName)),
        false,
        `${coverName} must not rotate with ${spinName}`,
      );
    }
  }

  console.log('PASS: semantic F1 wheel and Hard Rock cover hierarchy');
};

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/verify-f1-showroom-v2.mjs <model.glb>');
  process.exit(2);
}

try {
  verify(filePath);
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
