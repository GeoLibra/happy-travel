import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createF1ExplodedParts,
  getF1ExplodedPartsFloorAudit,
  getF1LocalBounds,
  getF1WheelAudit,
  resolveF1WheelNodes,
  updateF1ExplodedParts,
} from '../src/lib/f1-model';

const root = new THREE.Group();
const upper = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2));
upper.position.set(0.8, 1.2, 0);
const lower = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1));
lower.position.set(-0.8, 0.25, 0);
root.add(upper, lower);
root.rotation.z = 0.08;
root.scale.setScalar(3);
root.updateMatrixWorld(true);

const assertApproximatelyEqual = (actual: number, expected: number, message: string): void => {
  assert(Math.abs(actual - expected) <= 1e-6, `${message}: expected ${expected}, received ${actual}`);
};

const bounds = getF1LocalBounds(root);
const expectedMin = new THREE.Vector3(-1.3, 0.05, -1);
const expectedMax = new THREE.Vector3(1.3, 1.7, 1);
for (const axis of ['x', 'y', 'z'] as const) {
  assertApproximatelyEqual(bounds.min[axis], expectedMin[axis], `root-local minimum ${axis}`);
  assertApproximatelyEqual(bounds.max[axis], expectedMax[axis], `root-local maximum ${axis}`);
}

const parts = createF1ExplodedParts(root);

const semanticRoot = new THREE.Group();
const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 3));
const rearBodyAssembly = new THREE.Group();
rearBodyAssembly.name = 'RearBodyAssembly';
const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.4));
const hardRockPanelGroup = new THREE.Group();
hardRockPanelGroup.name = 'RearHardRockAeroPanel';
const hardRockPanel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.4));
const wheelAdjacentCover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.25));
wheelAdjacentCover.name = 'FrontHardRockWheelCover_FL';
wheelAdjacentCover.position.set(-0.7, -0.05, 0);
const wheelAdjacentShroud = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.2));
wheelAdjacentShroud.name = 'FrontHardRockInnerShroud_FL';
wheelAdjacentShroud.position.set(0.7, -0.05, 0);
hardRockPanelGroup.add(hardRockPanel, wheelAdjacentCover, wheelAdjacentShroud);
rearBodyAssembly.add(rearWing, hardRockPanelGroup);
semanticRoot.add(mainBody, rearBodyAssembly);
const semanticParts = createF1ExplodedParts(semanticRoot);
assert(semanticParts.some((part) => part.object === rearBodyAssembly));
assert(!semanticParts.some((part) => part.object === rearWing));
assert(!semanticParts.some((part) => part.object === hardRockPanel));
assert(!semanticParts.some((part) => part.object === wheelAdjacentCover));
assert(!semanticParts.some((part) => part.object === wheelAdjacentShroud));

semanticRoot.updateMatrixWorld(true);
const assembledRearPosition = rearBodyAssembly.getWorldPosition(new THREE.Vector3());
const assembledWheelAdjacentPositions = [wheelAdjacentCover, wheelAdjacentShroud].map((object) => (
  object.getWorldPosition(new THREE.Vector3())
));
const semanticClearance = 0.01;
const semanticFloorY = new THREE.Box3().setFromObject(semanticRoot).min.y - semanticClearance;
const assertSemanticAssembly = (phase: string, frame: number): void => {
  semanticRoot.updateMatrixWorld(true);
  const rearDelta = rearBodyAssembly
    .getWorldPosition(new THREE.Vector3())
    .sub(assembledRearPosition);

  [wheelAdjacentCover, wheelAdjacentShroud].forEach((object, index) => {
    const childDelta = object
      .getWorldPosition(new THREE.Vector3())
      .sub(assembledWheelAdjacentPositions[index]);
    assert(
      childDelta.distanceTo(rearDelta) <= 1e-6,
      `${phase} frame ${frame}: wheel-adjacent bodywork must follow RearBodyAssembly`,
    );
  });
  for (const part of semanticParts) {
    assert(
      new THREE.Box3().setFromObject(part.object).min.y
        >= semanticFloorY + semanticClearance - 1e-4,
      `${phase} frame ${frame}: semantic body groups must retain floor clearance`,
    );
  }
};

for (let frame = 0; frame <= 120; frame += 1) {
  updateF1ExplodedParts(semanticParts, frame / 120, 1 / 60, {
    floorY: semanticFloorY,
    clearance: semanticClearance,
  });
  assertSemanticAssembly('semantic explosion', frame);
}
for (let frame = 0; frame <= 120; frame += 1) {
  updateF1ExplodedParts(semanticParts, 1 - frame / 120, 1 / 60, {
    floorY: semanticFloorY,
    clearance: semanticClearance,
  });
  assertSemanticAssembly('semantic reassembly', frame);
}
const cachedPartResources = parts.map((part) => {
  const cachedPart = part as typeof part & {
    localCorners?: readonly THREE.Vector3[];
    scratch?: object;
  };
  assert.equal(
    cachedPart.localCorners?.length,
    8,
    'each exploded part must cache its eight local bounds corners once',
  );
  assert(cachedPart.scratch, 'each exploded part must cache per-frame scratch math objects');
  return {
    corners: cachedPart.localCorners,
    scratch: cachedPart.scratch,
  };
});
for (const part of parts) {
  assert(part.object.parent, 'fixture mesh must have a parent');
  const explodedPosition = part.assembledPosition.clone().add(part.explodedOffset);
  const parentLocalOffset = explodedPosition.sub(part.assembledPosition);
  const parentWorldLinearTransform = new THREE.Matrix3().setFromMatrix4(
    part.object.parent.matrixWorld,
  );
  const worldOffset = parentLocalOffset.applyMatrix3(parentWorldLinearTransform);
  assert(worldOffset.y >= -1e-9, 'exploded offset must not point downward in world space');
}

const clearance = 0.01;
const floorY = new THREE.Box3().setFromObject(root).min.y - clearance;
const assertEveryPartClearsFloor = (phase: string, frame: number): void => {
  root.updateMatrixWorld(true);
  for (const part of parts) {
    assert(
      new THREE.Box3().setFromObject(part.object).min.y >= floorY + clearance - 1e-4,
      `${phase} frame ${frame}: every part must retain floor clearance`,
    );
  }
};

for (let frame = 0; frame <= 120; frame += 1) {
  updateF1ExplodedParts(parts, frame / 120, 1 / 60, { floorY, clearance });
  assertEveryPartClearsFloor('explosion', frame);
}
for (let frame = 0; frame <= 120; frame += 1) {
  updateF1ExplodedParts(parts, 1 - frame / 120, 1 / 60, { floorY, clearance });
  assertEveryPartClearsFloor('reassembly', frame);
}

const countPartMatrixUpdates = (run: () => void): number => {
  let updates = 0;
  const originals = parts.map((part) => part.object.updateMatrixWorld);
  parts.forEach((part, index) => {
    part.object.updateMatrixWorld = function updateMatrixWorld(force?: boolean): void {
      updates += 1;
      originals[index].call(this, force);
    };
  });
  try {
    run();
  } finally {
    parts.forEach((part, index) => {
      part.object.updateMatrixWorld = originals[index];
    });
  }
  return updates;
};

const nearlyExploded = 1 - 5e-5;
for (let frame = 0; frame < 240; frame += 1) {
  updateF1ExplodedParts(parts, nearlyExploded, 1 / 60, { floorY, clearance });
  assertEveryPartClearsFloor('near-exploded settling', frame);
}
assert.equal(
  countPartMatrixUpdates(() => {
    updateF1ExplodedParts(parts, nearlyExploded, 1 / 60, { floorY, clearance });
  }),
  0,
  'a threshold-settled exploded pose must skip all matrix and corner floor-guard work',
);

const nearlyReassembled = 5e-5;
for (let frame = 0; frame < 240; frame += 1) {
  updateF1ExplodedParts(parts, nearlyReassembled, 1 / 60, { floorY, clearance });
  assertEveryPartClearsFloor('near-reassembled settling', frame);
}
assert.equal(
  countPartMatrixUpdates(() => {
    updateF1ExplodedParts(parts, nearlyReassembled, 1 / 60, { floorY, clearance });
  }),
  0,
  'a threshold-settled reassembled pose must skip all matrix and corner floor-guard work',
);

parts.forEach((part, index) => {
  const cachedPart = part as typeof part & {
    localCorners?: readonly THREE.Vector3[];
    scratch?: object;
  };
  assert.equal(
    cachedPart.localCorners,
    cachedPartResources[index].corners,
    'animation must reuse the same cached bounds-corner array',
  );
  assert.equal(
    cachedPart.scratch,
    cachedPartResources[index].scratch,
    'animation must reuse the same per-part scratch objects',
  );
});

const wheelRoot = new THREE.Group();
const wheelNodes = ['WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR'].map((name) => {
  const wheel = new THREE.Group();
  wheel.name = name;
  wheel.rotation.x = name.endsWith('_FL') ? 0.25 : 0.5;
  wheelRoot.add(wheel);
  return wheel;
});
const wheelAudit = getF1WheelAudit(wheelNodes);
assert.deepEqual(wheelAudit.wheelNodeNames, [
  'WheelSpin_FL',
  'WheelSpin_FR',
  'WheelSpin_RL',
  'WheelSpin_RR',
]);
assert.equal(wheelAudit.hasAllRuntimeWheelNodes, true);
assert.equal(wheelAudit.missingWheelNodes.length, 0);
assert.equal(wheelAudit.wheelSpinAngles.WheelSpin_FL, 0.25);
assert.equal(wheelAudit.wheelSpinAngles.WheelSpin_RR, 0.5);

const missingWheelAudit = getF1WheelAudit([wheelNodes[0], wheelNodes[2]]);
assert.equal(missingWheelAudit.hasAllRuntimeWheelNodes, false);
assert.deepEqual(missingWheelAudit.missingWheelNodes, ['WheelSpin_FR', 'WheelSpin_RR']);

const floorAuditParts = createF1ExplodedParts(root);
updateF1ExplodedParts(floorAuditParts, 1, 1 / 60, { floorY, clearance });
const floorAudit = getF1ExplodedPartsFloorAudit(floorAuditParts, floorY, clearance);
assert.equal(floorAudit.partCount, floorAuditParts.length);
assert.equal(floorAudit.allPartsAboveFloor, true);
assert(floorAudit.minPartWorldY !== null && floorAudit.minPartWorldY >= floorY + clearance - 1e-4);
