import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const filePath = process.argv[2];
assert(filePath, 'Usage: node scripts/verify-rb20-showroom-v5.mjs <model.glb>');

const bytes = readFileSync(filePath);
assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${filePath} is not a GLB`);
assert.equal(bytes.readUInt32LE(4), 2, `${filePath} is not glTF 2.0`);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
const nodes = gltf.nodes ?? [];
const indexByName = new Map(nodes.map((node, index) => [node.name, index]));
const parentByChild = new Map();
for (const [parentIndex, node] of nodes.entries()) {
  for (const childIndex of node.children ?? []) parentByChild.set(childIndex, parentIndex);
}

const isDescendant = (nodeIndex, ancestorIndex) => {
  let current = parentByChild.get(nodeIndex);
  while (current !== undefined) {
    if (current === ancestorIndex) return true;
    current = parentByChild.get(current);
  }
  return false;
};
const hasMeshDescendant = (nodeIndex, visited = new Set()) => {
  if (visited.has(nodeIndex)) return false;
  visited.add(nodeIndex);
  const node = nodes[nodeIndex];
  if (!node) return false;
  return Number.isInteger(node.mesh)
    || (node.children ?? []).some((child) => hasMeshDescendant(child, visited));
};
const quaternionAngleFromIdentity = (rotation = [0, 0, 0, 1]) => {
  const normalizedW = Math.min(1, Math.max(-1, Math.abs(rotation[3])));
  return 2 * Math.acos(normalizedW);
};

for (const name of [
  'F1_Car',
  'RearBodyAssembly',
  'RearHardRockAeroPanel',
  'WheelPivot_FL', 'WheelPivot_FR', 'WheelPivot_RL', 'WheelPivot_RR',
  'WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR',
  'WheelStatic_FL', 'WheelStatic_FR', 'WheelStatic_RL', 'WheelStatic_RR',
]) {
  assert(indexByName.has(name), `Missing required node: ${name}`);
}

for (const key of ['FL', 'FR', 'RL', 'RR']) {
  const pivotIndex = indexByName.get(`WheelPivot_${key}`);
  const spinIndex = indexByName.get(`WheelSpin_${key}`);
  const staticIndex = indexByName.get(`WheelStatic_${key}`);
  assert.equal(parentByChild.get(spinIndex), pivotIndex, `WheelSpin_${key} must be a direct pivot child`);
  assert.equal(parentByChild.get(staticIndex), pivotIndex, `WheelStatic_${key} must be a direct pivot child`);
  assert(hasMeshDescendant(spinIndex), `WheelSpin_${key} must own rotating wheel geometry`);
  assert(Math.hypot(...(nodes[spinIndex].translation ?? [0, 0, 0])) <= 1e-5, `WheelSpin_${key} must have zero local translation`);
  const wheelChildren = (nodes[spinIndex].children ?? []).map((index) => nodes[index]);
  assert.equal(wheelChildren.length, 1, `WheelSpin_${key} must directly own one native WHEEL subtree`);
  assert(
    quaternionAngleFromIdentity(wheelChildren[0].rotation) <= 1e-4,
    `WheelSpin_${key} local X must inherit the native wheel axle orientation`,
  );
}

const rearBodyIndex = indexByName.get('RearBodyAssembly');
const panelIndex = indexByName.get('RearHardRockAeroPanel');
assert.equal(parentByChild.get(panelIndex), rearBodyIndex, 'RearHardRockAeroPanel must follow RearBodyAssembly');
assert(hasMeshDescendant(panelIndex), 'RearHardRockAeroPanel must contain rear-wing geometry');
for (const key of ['FL', 'FR', 'RL', 'RR']) {
  assert.equal(isDescendant(panelIndex, indexByName.get(`WheelSpin_${key}`)), false, `rear body must not rotate with WheelSpin_${key}`);
}

assert((gltf.meshes ?? []).length >= 150, 'native RB20 part decomposition must be preserved');
assert(bytes.length <= 15 * 1024 * 1024, `shipped RB20 is ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`PASS: native RB20 showroom hierarchy (${gltf.meshes.length} meshes, ${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
