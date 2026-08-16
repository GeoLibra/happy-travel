import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  CountdownFireworksSystem,
  type FireworkBurstType,
} from '@/src/features/race-countdown/countdown-fireworks-tsl';

describe('CountdownFireworksSystem (WebGPU / TSL)', () => {
  it('initializes particle buffers, attributes, and InstancedMesh object', () => {
    const system = new CountdownFireworksSystem();
    expect(system.mesh).toBeDefined();
    expect(system.mesh.isInstancedMesh).toBe(true);
    expect(system.mesh.frustumCulled).toBe(false);
    expect(system.mesh.renderOrder).toBe(5);

    const geo = system.mesh.geometry;
    expect(geo.getAttribute('aCenter')).toBeDefined();
    expect(geo.getAttribute('aInitVel')).toBeDefined();
    expect(geo.getAttribute('aColSize')).toBeDefined();
    expect(geo.getAttribute('aPhys')).toBeDefined();
    expect(geo.getAttribute('aTwink')).toBeDefined();

    const mat = system.mesh.material as THREE.Material & {
      transparent: boolean;
      depthWrite: boolean;
      blending: THREE.Blending;
    };
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.blending).toBe(THREE.AdditiveBlending);

    system.dispose();
  });

  it('emits particles and uploads dirty attributes', () => {
    const system = new CountdownFireworksSystem();
    const posAttr = system.mesh.geometry.getAttribute('aCenter') as THREE.BufferAttribute;

    const initialVersion = posAttr.version;

    system.emit(
      0, 5, -10, // px, py, pz
      0, 2, 0,   // vx, vy, vz
      1, 0.5, 0.2, // r, g, b
      2.5, // size
      2.0, // life
      1.0, // k (drag)
      1.0, // gravFac
      20,  // twS
      0,   // twP
    );

    system.update(1.0, 0.016);

    expect(posAttr.version).toBeGreaterThan(initialVersion);

    system.dispose();
  });

  it('launches shells and explodes into bursts at peak height', () => {
    const system = new CountdownFireworksSystem();

    // Manually trigger a firework launch
    system.launchRandomFirework();

    // Step physics forward until the shell reaches the peak of ascent and explodes
    for (let step = 0; step < 120; step += 1) {
      system.update(step * 0.02, 0.02);
    }

    // After bursting, live particles should have been emitted
    const liveCount = (system as unknown as { liveCount: number }).liveCount;
    expect(liveCount).toBeGreaterThan(100);

    system.dispose();
  });

  it('supports all burst types (peony, palette, willow, ring, double, glitter)', () => {
    const burstTypes: FireworkBurstType[] = ['peony', 'palette', 'willow', 'ring', 'double', 'glitter'];

    for (const burstType of burstTypes) {
      const system = new CountdownFireworksSystem();
      const shell = {
        x: 0,
        y: 3.5,
        z: -5,
        vx: 0,
        vy: 0.1, // Near peak, will explode immediately on next update
        vz: 0,
        color: new THREE.Color(1, 0.5, 0.2),
        type: burstType,
        trailTimer: 0,
      };

      // Access private shell array for deterministic testing of each burst pattern
      (system as unknown as { shells: typeof shell[] }).shells.push(shell);

      system.update(0.1, 0.02);

      const liveCount = (system as unknown as { liveCount: number }).liveCount;
      expect(liveCount).toBeGreaterThan(50);

      system.dispose();
    }
  });

  it('triggers first launch at 2.0s and next launch 60s later', () => {
    const system = new CountdownFireworksSystem();
    const launchSpy = vi.spyOn(system, 'launchFestivalDisplay');

    // Start at t = 0.0s
    system.update(0.0, 0.02);
    expect(launchSpy).toHaveBeenCalledTimes(0);

    // At t = 1.0s, no automated launch yet (needs 2.0s)
    system.update(1.0, 0.02);
    expect(launchSpy).toHaveBeenCalledTimes(0);

    // At t = 2.05s, first launch triggers
    system.update(2.05, 0.02);
    expect(launchSpy).toHaveBeenCalledTimes(1);

    // At t = 30.0s, no second launch yet
    system.update(30.0, 0.02);
    expect(launchSpy).toHaveBeenCalledTimes(1);

    // At t = 62.05s, second launch triggers
    system.update(62.05, 0.02);
    expect(launchSpy).toHaveBeenCalledTimes(2);

    system.dispose();
  });

  it('reclaims expired particles back into the pool', () => {
    const system = new CountdownFireworksSystem();

    // Emit a single particle with a very short life of 0.2s
    system.emit(0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0.2, 0, 0);
    system.update(0, 0.016);
    expect((system as unknown as { liveCount: number }).liveCount).toBe(1);

    // Advance time past 0.2s expiration
    system.update(0.3, 0.016);
    expect((system as unknown as { liveCount: number }).liveCount).toBe(0);

    system.dispose();
  });

  it('disposes all internal resources cleanly and idempotently', () => {
    const system = new CountdownFireworksSystem();
    const geoDispose = vi.spyOn(system.mesh.geometry, 'dispose');
    const matDispose = vi.spyOn(system.mesh.material as THREE.Material, 'dispose');

    system.dispose();
    expect(geoDispose).toHaveBeenCalledTimes(1);
    expect(matDispose).toHaveBeenCalledTimes(1);

    // Second call should be a no-op
    system.dispose();
    expect(geoDispose).toHaveBeenCalledTimes(1);
  });
});
