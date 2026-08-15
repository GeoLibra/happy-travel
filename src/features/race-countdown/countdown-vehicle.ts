import * as THREE from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  ShowroomAssetManager,
  type AssetLoadResult,
} from '@/src/components/showroom/asset-manager';
import { SHOWROOM_ASSETS } from '@/src/components/showroom/showroom-assets';

import type { ViewportKind } from './digit-layout';

const COUNTDOWN_ENVIRONMENT_INTENSITY = 1.35;

export const COUNTDOWN_VEHICLE_POSES = {
  desktop: { position: [0, -2.1, 5.6], rotation: [0, -0.18, 0], scale: 1.15 },
  mobile: { position: [0, -5.8, 4.4], rotation: [0, -0.08, 0], scale: 0.9 },
} as const;

interface CountdownVehicleAsset {
  scene: THREE.Group;
}

export interface CountdownVehicleLoader {
  loadModel(url: string): Promise<AssetLoadResult<CountdownVehicleAsset>>;
}

export interface CountdownVehicleOptions {
  loader?: CountdownVehicleLoader;
}

export interface CountdownVehicle {
  object: THREE.Group;
  dispose(): void;
}

export function applyCountdownVehiclePose(
  object: THREE.Object3D,
  viewport: ViewportKind,
): void {
  const pose = COUNTDOWN_VEHICLE_POSES[viewport];
  object.position.set(pose.position[0], pose.position[1], pose.position[2]);
  object.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
  object.scale.setScalar(pose.scale);
  object.updateMatrix();
}

export async function loadCountdownVehicle(
  options: CountdownVehicleOptions = {},
): Promise<CountdownVehicle> {
  const ownedManager = options.loader ? null : new ShowroomAssetManager();
  const loader = options.loader ?? ownedManager as CountdownVehicleLoader;
  const result = await loader.loadModel(SHOWROOM_ASSETS.car);

  if (!result.success || !result.data?.scene) {
    ownedManager?.dispose();
    throw result.error ?? new Error(`Unable to load countdown vehicle: ${SHOWROOM_ASSETS.car}`);
  }

  const object = cloneSkinnedHierarchy(result.data.scene) as THREE.Group;
  const ownedMaterials = new Set<THREE.Material>();
  const materialClones = new Map<THREE.Material, THREE.Material>();

  const cloneMaterial = (source: THREE.Material): THREE.Material => {
    const cached = materialClones.get(source);
    if (cached) return cached;
    const clone = source.clone();
    if (clone instanceof THREE.MeshStandardMaterial) {
      clone.envMapIntensity = COUNTDOWN_ENVIRONMENT_INTENSITY;
    }
    materialClones.set(source, clone);
    ownedMaterials.add(clone);
    return clone;
  };

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map(cloneMaterial)
      : cloneMaterial(child.material);
    child.castShadow = true;
    child.receiveShadow = true;
  });

  let disposed = false;
  return {
    object,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      for (const material of ownedMaterials) material.dispose();
      ownedMaterials.clear();
      ownedManager?.dispose();
    },
  };
}
