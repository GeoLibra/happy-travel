/**
 * Showroom Preallocated Airflow Effect Module
 * Preallocates particle geometry/material buffers and updates attributes in-place without per-frame allocations.
 */

import * as THREE from 'three';
import { ShowroomQualityProfile } from '../../lib/showroom-quality';

export interface AirflowFrameInput {
  intensity: number; // [0, 1.0]
  speed?: number;
  timeMs?: number;
}

export class AirflowEffect {
  private group: THREE.Group;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private positions: Float32Array;
  private opacities: Float32Array;
  private particleCount: number;
  private isDisposed = false;

  constructor(qualityProfile?: ShowroomQualityProfile) {
    const density = qualityProfile?.particleDensity ?? 1.0;
    const isLow = qualityProfile?.level === 'low';
    const isReduced = qualityProfile?.reducedMotion ?? false;

    // Preallocate particle count based on quality profile
    const baseCount = isLow ? 100 : 500;
    this.particleCount = Math.max(20, Math.round(baseCount * density * (isReduced ? 0.5 : 1.0)));

    this.group = new THREE.Group();
    this.positions = new Float32Array(this.particleCount * 3);
    this.opacities = new Float32Array(this.particleCount);

    // Initial particle distribution
    for (let i = 0; i < this.particleCount; i += 1) {
      this.positions[i * 3 + 0] = (Math.random() - 0.5) * 4;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      this.opacities[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(this.positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', positionAttr);

    this.material = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.group.add(this.points);
  }

  public get object3D(): THREE.Group {
    return this.group;
  }

  public get count(): number {
    return this.particleCount;
  }

  public get bufferGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  public get effectMaterial(): THREE.PointsMaterial {
    return this.material;
  }

  public get isEffectDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * In-place update of particle positions without replacing geometry or allocating new arrays.
   */
  public update(input: AirflowFrameInput): void {
    if (this.isDisposed) return;

    const intensity = Math.min(1.0, Math.max(0, input.intensity));
    const speed = input.speed ?? 1.0;
    const timeMs = input.timeMs ?? performance.now();

    this.material.opacity = 0.2 + intensity * 0.6;

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < this.particleCount; i += 1) {
      const idx = i * 3;
      // Advance particle along Z axis
      array[idx + 2] += 0.02 * speed * (0.5 + intensity);
      if (array[idx + 2] > 3) {
        array[idx + 2] = -3;
        array[idx + 0] = (Math.random() - 0.5) * 4;
        array[idx + 1] = (Math.random() - 0.5) * 2;
      }
    }

    posAttr.needsUpdate = true;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}
