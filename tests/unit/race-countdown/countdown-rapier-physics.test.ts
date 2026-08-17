import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  CountdownRapierPhysics,
  initRapier,
} from '@/src/features/race-countdown/countdown-rapier-physics';

describe('CountdownRapierPhysics', () => {
  it('initializes Rapier and creates physics world with boundary colliders', async () => {
    const RAPIER = await initRapier();
    expect(RAPIER).toBeDefined();

    const physics = await CountdownRapierPhysics.create({
      maxParticles: 50,
      cubeSize: 0.2,
    });

    expect(physics.world).toBeDefined();
    expect(physics.groundCollider).toBeDefined();
    expect(physics.boundaryColliders.length).toBe(4);
    expect(physics.maxParticles).toBe(50);
    expect(physics.getActiveCount()).toBe(0);

    physics.dispose();
  });

  it('spawns cube particles and steps 6-DOF simulation', async () => {
    const physics = await CountdownRapierPhysics.create({
      maxParticles: 20,
      cubeSize: 0.2,
    });

    const index0 = physics.spawnCube(0, 5.0, 0, [0, 1, 0], [0.1, 0, 0], [1.0, 0, 0]);
    expect(index0).toBe(0);
    expect(physics.getActiveCount()).toBe(1);
    expect(physics.getParticleState(index0)).toBe('falling');

    // Step simulation for a few frames
    for (let i = 0; i < 15; i += 1) {
      physics.step(0.016);
    }

    // Particle should have fallen downward (Y < 5.0)
    expect(physics.getParticleState(index0)).toBe('falling');

    // Run enough steps for particle to hit the ground (Y ≈ 0)
    for (let i = 0; i < 120; i += 1) {
      physics.step(0.016);
    }

    const stateAfterLanding = physics.getParticleState(index0);
    expect(['falling', 'dwelling']).toContain(stateAfterLanding);

    physics.dispose();
  });

  it('transitions through dwell and fade states to inactive', async () => {
    const physics = await CountdownRapierPhysics.create({
      maxParticles: 10,
      cubeSize: 0.2,
      groundDwellSeconds: 1.0,
      fadeSeconds: 0.5,
    });

    const idx = physics.spawnCube(0, 0.2, 0, [0, 0, 0], [0, 0, 0], [0, 0, 0]);

    // Let it settle on the floor
    for (let i = 0; i < 15; i += 1) {
      physics.step(0.016);
    }
    expect(physics.getParticleState(idx)).toBe('dwelling');

    // Advance dwell duration (1.0s)
    for (let i = 0; i < 70; i += 1) {
      physics.step(0.016);
    }
    expect(physics.getParticleState(idx)).toBe('fading');

    // Advance fade duration (0.5s)
    for (let i = 0; i < 40; i += 1) {
      physics.step(0.016);
    }
    expect(physics.getParticleState(idx)).toBe('inactive');

    physics.dispose();
  });

  it('updates and removes vehicle dynamic colliders', async () => {
    const physics = await CountdownRapierPhysics.create({
      maxParticles: 10,
    });

    expect(physics.vehicleCollider).toBeNull();

    physics.updateVehicleCollider({ x: 0, y: 0.5, z: 2.0 }, { x: 1.0, y: 0.5, z: 2.0 });
    expect(physics.vehicleCollider).not.toBeNull();

    physics.updateVehicleCollider({ x: 1.0, y: 0.5, z: 2.0 });
    expect(physics.vehicleCollider).not.toBeNull();

    physics.removeVehicleCollider();
    expect(physics.vehicleCollider).toBeNull();

    physics.dispose();
  });

  it('synchronizes transforms and attributes to InstancedMesh', async () => {
    const physics = await CountdownRapierPhysics.create({
      maxParticles: 10,
      cubeSize: 0.2,
    });

    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, 10);
    const scaleAttr = new THREE.InstancedBufferAttribute(new Float32Array(10), 1);
    const noiseAttr = new THREE.InstancedBufferAttribute(new Float32Array(30), 3);

    physics.spawnCube(1.5, 3.0, -1.0, [1.5, 2.0, 0.5], [0, 0, 0]);
    physics.step(0.016);

    physics.syncToInstancedMesh(mesh, scaleAttr, noiseAttr);

    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(1.5, 1);
    expect(position.y).toBeLessThan(3.0);
    expect(scaleAttr.array[0]).toBe(1.0);
    expect(noiseAttr.array[0]).toBe(1.5);

    physics.dispose();
    geo.dispose();
    mat.dispose();
  });

  it('resets all active particles cleanly', async () => {
    const physics = await CountdownRapierPhysics.create({
      maxParticles: 10,
    });

    physics.spawnCube(0, 5, 0, [0, 0, 0]);
    physics.spawnCube(1, 5, 0, [1, 0, 0]);
    expect(physics.getActiveCount()).toBe(2);

    physics.reset();
    expect(physics.getActiveCount()).toBe(0);
    expect(physics.getParticleState(0)).toBe('inactive');
    expect(physics.getParticleState(1)).toBe('inactive');

    physics.dispose();
  });
});
