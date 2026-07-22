/**
 * Showroom Material System & Hologram Lifecycle Module
 * Role-aware PBR material profile generator and single-lifecycle material apply/revert manager.
 */

import * as THREE from 'three';
import { ShowroomQualityLevel } from '../../lib/showroom-quality';
import { VehicleComponentRole } from './vehicle-profile';

export interface PBRMaterialProfile {
  metalness: number;
  roughness: number;
  clearcoat?: number;
  opacity?: number;
  transparent?: boolean;
}

export function getPBRMaterialProfile(
  role: VehicleComponentRole,
  qualityLevel: ShowroomQualityLevel = 'high',
): PBRMaterialProfile {
  const isLow = qualityLevel === 'low';

  switch (role) {
    case 'body':
      return {
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: isLow ? 0 : 0.9,
      };

    case 'wheel':
      return {
        metalness: 0.9,
        roughness: 0.1,
      };

    case 'tyre':
      return {
        metalness: 0.1,
        roughness: 0.8,
      };

    case 'wing':
      return {
        metalness: 0.5,
        roughness: 0.3,
      };

    case 'floor':
      return {
        metalness: 0.2,
        roughness: 0.6,
      };

    case 'halo':
      return {
        metalness: 0.85,
        roughness: 0.15,
      };

    case 'suspension':
      return {
        metalness: 0.9,
        roughness: 0.2,
      };

    case 'brake':
      return {
        metalness: 0.7,
        roughness: 0.4,
      };

    case 'unknown':
    default:
      return {
        metalness: 0.5,
        roughness: 0.5,
      };
  }
}

export interface AppliedMaterialRecord {
  originalMaterial: THREE.Material | THREE.Material[];
  overrideMaterial: THREE.Material;
}

export class ShowroomMaterialSystem {
  private appliedRecords = new Map<THREE.Mesh, AppliedMaterialRecord>();
  private isDisposed = false;

  public get isSystemDisposed(): boolean {
    return this.isDisposed;
  }

  public get appliedCount(): number {
    return this.appliedRecords.size;
  }

  /**
   * Applies a role-aware material override to a mesh.
   * Guaranteed 1:1 paired lifecycle. Repeated calls on the same mesh update the override
   * without overwriting or cloning the original material reference multiple times.
   */
  public apply(
    mesh: THREE.Mesh,
    role: VehicleComponentRole,
    qualityLevel: ShowroomQualityLevel = 'high',
  ): THREE.Material {
    if (this.isDisposed || !mesh) {
      throw new Error('ShowroomMaterialSystem is disposed or mesh is invalid');
    }

    const pbr = getPBRMaterialProfile(role, qualityLevel);
    let record = this.appliedRecords.get(mesh);

    if (!record) {
      // Save original material reference once
      const originalMaterial = mesh.material;
      const newOverride = new THREE.MeshStandardMaterial({
        metalness: pbr.metalness,
        roughness: pbr.roughness,
        opacity: pbr.opacity ?? 1.0,
        transparent: pbr.transparent ?? false,
      });

      record = {
        originalMaterial,
        overrideMaterial: newOverride,
      };
      this.appliedRecords.set(mesh, record);
      mesh.material = newOverride;
    } else {
      // Update existing override without re-cloning original
      if (record.overrideMaterial instanceof THREE.MeshStandardMaterial) {
        record.overrideMaterial.metalness = pbr.metalness;
        record.overrideMaterial.roughness = pbr.roughness;
      }
    }

    return record.overrideMaterial;
  }

  /**
   * Reverts the mesh back to its exact original material.
   */
  public revert(mesh: THREE.Mesh): void {
    if (!mesh) return;
    const record = this.appliedRecords.get(mesh);
    if (record) {
      mesh.material = record.originalMaterial;
      record.overrideMaterial.dispose();
      this.appliedRecords.delete(mesh);
    }
  }

  /**
   * Reverts all applied meshes and disposes owned materials.
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    for (const [mesh, record] of this.appliedRecords.entries()) {
      mesh.material = record.originalMaterial;
      record.overrideMaterial.dispose();
    }
    this.appliedRecords.clear();
  }
}
