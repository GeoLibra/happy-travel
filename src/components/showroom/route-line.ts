/**
 * Showroom Preallocated Route Line Effect Module
 * Uses resampleRoutePoints() and preallocated LineBufferGeometry for deterministic, allocation-free route line updates.
 */

import * as THREE from 'three';
import { resampleRoutePoints, RoutePoint, Vector3D } from '../../lib/showroom-route';
import { ShowroomQualityProfile } from '../../lib/showroom-quality';

export class RouteLineEffect {
  private line: THREE.Line;
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private positions: Float32Array;
  private routePoints: RoutePoint[];
  private segmentCount: number;
  private isDisposed = false;

  constructor(
    rawPathPoints: Vector3D[],
    qualityProfile?: ShowroomQualityProfile,
  ) {
    const isLow = qualityProfile?.level === 'low';
    const sampleCount = isLow ? 20 : 50;

    const formattedPoints: RoutePoint[] = (rawPathPoints && rawPathPoints.length > 0)
      ? rawPathPoints.map((p) => ({ position: p }))
      : [
          { position: { x: -5, y: 0, z: -5 } },
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 5, y: 0, z: 5 } },
        ];

    this.routePoints = resampleRoutePoints(formattedPoints, sampleCount);
    this.segmentCount = this.routePoints.length;

    this.positions = new Float32Array(this.segmentCount * 3);
    for (let i = 0; i < this.segmentCount; i += 1) {
      const pos = this.routePoints[i].position;
      this.positions[i * 3 + 0] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
    }

    this.geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(this.positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', positionAttr);

    this.material = new THREE.LineBasicMaterial({
      color: 0xffb800,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });

    this.line = new THREE.Line(this.geometry, this.material);
  }

  public get object3D(): THREE.Line {
    return this.line;
  }

  public get segmentPointsCount(): number {
    return this.segmentCount;
  }

  public get bufferGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  public get lineMaterial(): THREE.LineBasicMaterial {
    return this.material;
  }

  public get isEffectDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * In-place update of route line progress without creating new geometries or buffers.
   */
  public update(progress: number): void {
    if (this.isDisposed) return;

    const clampedProgress = Math.min(1.0, Math.max(0, progress));
    this.material.opacity = 0.3 + clampedProgress * 0.7;

    const visibleCount = Math.max(1, Math.round(this.segmentCount * clampedProgress));
    this.geometry.setDrawRange(0, visibleCount);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }
}
