import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  applyCountdownVehiclePose,
  loadCountdownVehicle,
} from '@/src/features/race-countdown/countdown-vehicle';

function createCachedModel() {
  const scene = new THREE.Group();
  const sharedGeometry = new THREE.BoxGeometry();
  const sharedMaterial = new THREE.MeshStandardMaterial({ color: 0x16245f });
  scene.add(new THREE.Mesh(sharedGeometry, sharedMaterial));
  return { scene, sharedGeometry, sharedMaterial };
}

describe('loadCountdownVehicle', () => {
  it('returns independent model clones and disposes only owned clone resources', async () => {
    const cached = createCachedModel();
    const loader = {
      loadModel: vi.fn().mockResolvedValue({
        data: { scene: cached.scene },
        isFallback: false,
        success: true,
      }),
    };

    const first = await loadCountdownVehicle({ loader });
    const second = await loadCountdownVehicle({ loader });
    const firstMesh = first.object.children[0] as THREE.Mesh;
    const secondMesh = second.object.children[0] as THREE.Mesh;
    const firstMaterial = firstMesh.material as THREE.Material;
    const secondMaterial = secondMesh.material as THREE.Material;
    const firstMaterialDispose = vi.spyOn(firstMaterial, 'dispose');
    const secondMaterialDispose = vi.spyOn(secondMaterial, 'dispose');
    const sharedMaterialDispose = vi.spyOn(cached.sharedMaterial, 'dispose');
    const sharedGeometryDispose = vi.spyOn(cached.sharedGeometry, 'dispose');
    const firstParent = new THREE.Group();
    const secondParent = new THREE.Group();
    firstParent.add(first.object);
    secondParent.add(second.object);

    expect(first.object).not.toBe(second.object);
    expect(firstMesh.geometry).toBe(cached.sharedGeometry);
    expect(secondMesh.geometry).toBe(cached.sharedGeometry);
    expect(firstMaterial).not.toBe(cached.sharedMaterial);
    expect(secondMaterial).not.toBe(cached.sharedMaterial);
    expect(firstMaterial).not.toBe(secondMaterial);

    first.dispose();
    first.dispose();

    expect(first.object.parent).toBeNull();
    expect(second.object.parent).toBe(secondParent);
    expect(firstMaterialDispose).toHaveBeenCalledTimes(1);
    expect(secondMaterialDispose).not.toHaveBeenCalled();
    expect(sharedMaterialDispose).not.toHaveBeenCalled();
    expect(sharedGeometryDispose).not.toHaveBeenCalled();

    second.dispose();
  });

  it('uses the accepted RB20 asset and reports a failed asset load', async () => {
    const failure = new Error('model unavailable');
    const loader = {
      loadModel: vi.fn().mockResolvedValue({
        data: null,
        error: failure,
        isFallback: true,
        success: false,
      }),
    };

    await expect(loadCountdownVehicle({ loader })).rejects.toThrow('model unavailable');
    expect(loader.loadModel).toHaveBeenCalledWith('/models/2024_redbull_rb20_showroom_v5.glb');
  });

  it('applies distinct desktop and mobile poses to keep the car in front of the digits', () => {
    const vehicle = new THREE.Group();

    applyCountdownVehiclePose(vehicle, 'desktop');
    expect(vehicle.position.toArray()).toEqual([0, -2.1, 5.6]);
    expect(vehicle.rotation.toArray().slice(0, 3)).toEqual([0, -0.18, 0]);
    expect(vehicle.scale.toArray()).toEqual([1.15, 1.15, 1.15]);

    applyCountdownVehiclePose(vehicle, 'mobile');
    expect(vehicle.position.toArray()).toEqual([0, -5.8, 4.4]);
    expect(vehicle.rotation.toArray().slice(0, 3)).toEqual([0, -0.08, 0]);
    expect(vehicle.scale.toArray()).toEqual([0.9, 0.9, 0.9]);
  });
});
