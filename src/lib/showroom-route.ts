/**
 * Showroom Route & Keyframe Morph Interpolation Module
 * Pure logic for path resampling, keyframe morph interpolation, and deterministic vector math.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion4D {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface RoutePoint {
  position: Vector3D;
  distance?: number;
}

export interface ShowroomRouteKeyframe {
  progress: number; // [0, 1.0]
  position: Vector3D;
  lookAt: Vector3D;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1.0, Math.max(0, t));
}

export function lerpVector3D(a: Vector3D, b: Vector3D, t: number): Vector3D {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function distanceVector3D(a: Vector3D, b: Vector3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Resamples a sequence of route points into uniform arc-length distance intervals.
 */
export function resampleRoutePoints(points: RoutePoint[], sampleCount: number): RoutePoint[] {
  if (!points || points.length === 0) return [];
  if (points.length === 1 || sampleCount <= 1) {
    return Array.from({ length: Math.max(1, sampleCount) }, () => ({
      position: { ...points[0].position },
      distance: 0,
    }));
  }

  // Calculate cumulative distances along original path
  const distances: number[] = [0];
  let totalDistance = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = distanceVector3D(points[i - 1].position, points[i].position);
    totalDistance += d;
    distances.push(totalDistance);
  }

  if (totalDistance === 0) {
    return Array.from({ length: sampleCount }, () => ({
      position: { ...points[0].position },
      distance: 0,
    }));
  }

  const resampled: RoutePoint[] = [];
  const step = totalDistance / (sampleCount - 1);

  let searchIndex = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const targetDistance = i * step;

    while (searchIndex < points.length - 2 && distances[searchIndex + 1] < targetDistance) {
      searchIndex += 1;
    }

    const segStart = points[searchIndex].position;
    const segEnd = points[searchIndex + 1].position;
    const distStart = distances[searchIndex];
    const distEnd = distances[searchIndex + 1];
    const segLength = distEnd - distStart;

    const t = segLength > 0 ? (targetDistance - distStart) / segLength : 0;
    const position = lerpVector3D(segStart, segEnd, t);

    resampled.push({
      position,
      distance: targetDistance,
    });
  }

  return resampled;
}

/**
 * Interpolates position and lookAt between keyframes for a given progress in [0, 1.0].
 */
export function interpolateRouteKeyframe(
  keyframes: ShowroomRouteKeyframe[],
  progress: number,
): ShowroomRouteKeyframe {
  if (!keyframes || keyframes.length === 0) {
    const zeroVec: Vector3D = { x: 0, y: 0, z: 0 };
    return { progress: 0, position: zeroVec, lookAt: zeroVec };
  }

  const clampedProgress = Math.min(1.0, Math.max(0, progress));

  if (keyframes.length === 1 || clampedProgress <= keyframes[0].progress) {
    return { ...keyframes[0], progress: clampedProgress };
  }

  const lastKeyframe = keyframes[keyframes.length - 1];
  if (clampedProgress >= lastKeyframe.progress) {
    return { ...lastKeyframe, progress: clampedProgress };
  }

  // Find keyframe interval
  let k1 = keyframes[0];
  let k2 = keyframes[1];
  for (let i = 0; i < keyframes.length - 1; i += 1) {
    if (clampedProgress >= keyframes[i].progress && clampedProgress <= keyframes[i + 1].progress) {
      k1 = keyframes[i];
      k2 = keyframes[i + 1];
      break;
    }
  }

  const range = k2.progress - k1.progress;
  const t = range > 0 ? (clampedProgress - k1.progress) / range : 0;

  return {
    progress: clampedProgress,
    position: lerpVector3D(k1.position, k2.position, t),
    lookAt: lerpVector3D(k1.lookAt, k2.lookAt, t),
  };
}
