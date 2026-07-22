import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  getPBRMaterialProfile,
  ShowroomMaterialSystem,
} from '../src/components/showroom/material-system.ts';
import {
  identifyVehicleRole,
  isRuntimeWheelSpinNode,
  RUNTIME_WHEEL_SPIN_NODES,
} from '../src/components/showroom/vehicle-profile.ts';

// 1. Verify vehicle-profile contracts
assert.equal(RUNTIME_WHEEL_SPIN_NODES.length, 4);
assert.equal(isRuntimeWheelSpinNode('WheelSpin_FL'), true);
assert.equal(isRuntimeWheelSpinNode('WheelSpin_FR'), true);
assert.equal(isRuntimeWheelSpinNode('WheelSpin_RL'), true);
assert.equal(isRuntimeWheelSpinNode('WheelSpin_RR'), true);
assert.equal(isRuntimeWheelSpinNode('WheelSpin_FL_extra'), false);
assert.equal(isRuntimeWheelSpinNode('FrontWheelArchAeroPanel'), false);
assert.equal(isRuntimeWheelSpinNode('WheelAdjacentBodywork'), false);

assert.equal(identifyVehicleRole('WheelSpin_FL'), 'wheel');
assert.notEqual(identifyVehicleRole('WheelSpin_FL_extra'), 'wheel', 'WheelSpin_FL_extra must not be classified as wheel');
assert.notEqual(identifyVehicleRole('FrontWheelArchAeroPanel'), 'wheel', 'FrontWheelArchAeroPanel must not be classified as wheel');
assert.notEqual(identifyVehicleRole('WheelAdjacentBodywork'), 'wheel', 'WheelAdjacentBodywork must not be classified as wheel');

assert.equal(identifyVehicleRole('FrontWheelArchAeroPanel'), 'wing');
assert.equal(identifyVehicleRole('WheelAdjacentBodywork'), 'body');
assert.equal(identifyVehicleRole('RearHardRockAeroPanel'), 'wing');
assert.equal(identifyVehicleRole('tyre_front_left'), 'tyre');
assert.equal(identifyVehicleRole('halo_frame'), 'halo');
assert.equal(identifyVehicleRole('underbody_floor'), 'floor');
assert.equal(identifyVehicleRole('front_suspension'), 'suspension');
assert.equal(identifyVehicleRole('brake_disc'), 'brake');
assert.equal(identifyVehicleRole('chassis_body'), 'body');
assert.equal(identifyVehicleRole('unknown_component'), 'unknown');

// 2. Verify getPBRMaterialProfile
const bodyHigh = getPBRMaterialProfile('body', 'high');
assert.equal(bodyHigh.metalness, 0.8);
assert.equal(bodyHigh.clearcoat, 0.9);

const bodyLow = getPBRMaterialProfile('body', 'low');
assert.equal(bodyLow.clearcoat, 0);

const wheelPbr = getPBRMaterialProfile('wheel', 'high');
assert.equal(wheelPbr.metalness, 0.9);
assert.equal(wheelPbr.roughness, 0.1);

// 3. Verify ShowroomMaterialSystem apply / revert / single-lifecycle
const materialSystem = new ShowroomMaterialSystem();
const originalMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const mockMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), originalMaterial);

// First apply
const override1 = materialSystem.apply(mockMesh, 'body', 'high');
assert.notEqual(mockMesh.material, originalMaterial);
assert.equal(mockMesh.material, override1);
assert.equal(materialSystem.appliedCount, 1);

// Second apply on same mesh (must not overwrite originalMaterial reference or double clone)
const override2 = materialSystem.apply(mockMesh, 'body', 'low');
assert.equal(materialSystem.appliedCount, 1, 'repeated apply on same mesh must not duplicate records');
assert.equal(override2, override1, 'must reuse same override material');

// Revert
materialSystem.revert(mockMesh);
assert.equal(mockMesh.material, originalMaterial, 'revert must restore exact original material');
assert.equal(materialSystem.appliedCount, 0);

// Multi-mesh dispose test
const mat1 = new THREE.MeshBasicMaterial();
const mat2 = new THREE.MeshBasicMaterial();
const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(), mat1);
const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(), mat2);

materialSystem.apply(mesh1, 'wing');
materialSystem.apply(mesh2, 'halo');
assert.equal(materialSystem.appliedCount, 2);

materialSystem.dispose();
assert.equal(mesh1.material, mat1);
assert.equal(mesh2.material, mat2);
assert.equal(materialSystem.appliedCount, 0);
assert.equal(materialSystem.isSystemDisposed, true);

console.log('check:showroom-materials passed cleanly.');
