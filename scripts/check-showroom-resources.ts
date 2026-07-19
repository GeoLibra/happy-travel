import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  createCpuParticleField,
  createSpeedLineField,
  createTrailField,
} from '../src/components/showroom/showroom-particles';
import { createShowroomTrack } from '../src/components/showroom/showroom-track';

const assertIdempotentDisposal = (
  label: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  dispose: () => void,
): void => {
  let geometryDisposals = 0;
  let materialDisposals = 0;
  geometry.dispose = () => { geometryDisposals += 1; };
  material.dispose = () => { materialDisposals += 1; };

  dispose();
  dispose();

  assert.equal(geometryDisposals, 1, `${label} geometry must be disposed exactly once`);
  assert.equal(materialDisposals, 1, `${label} material must be disposed exactly once`);
};

const cpuParticles = createCpuParticleField(2);
assert(cpuParticles.points instanceof THREE.Points);
assert(cpuParticles.points.geometry instanceof THREE.BufferGeometry);
assert(cpuParticles.material instanceof THREE.ShaderMaterial);
assert.equal(cpuParticles.positions.length, 1_000 * 3);
assert.equal(cpuParticles.phases.length, 1_000);
assert.equal(cpuParticles.points.geometry.getAttribute('position').count, 1_000);
assert.equal(cpuParticles.points.geometry.getAttribute('color').count, 1_000);
assert.equal(cpuParticles.points.geometry.getAttribute('size').count, 1_000);
assert.equal(cpuParticles.material.uniforms.uPixelRatio.value, 2);
assertIdempotentDisposal(
  'CPU particle field',
  cpuParticles.points.geometry,
  cpuParticles.material,
  cpuParticles.dispose,
);

const trails = createTrailField();
assert(trails.geometry instanceof THREE.BufferGeometry);
assert(trails.positionAttribute instanceof THREE.BufferAttribute);
assert(trails.alphaAttribute instanceof THREE.BufferAttribute);
assert(trails.material instanceof THREE.ShaderMaterial);
assert.equal(trails.positionAttribute.count, 15 * 20);
assert.equal(trails.alphaAttribute.count, 15 * 20);
assert.equal(trails.geometry.getAttribute('color').count, 15 * 20);
assertIdempotentDisposal('trail field', trails.geometry, trails.material, trails.dispose);

const speedLines = createSpeedLineField();
assert(speedLines.points instanceof THREE.Points);
assert(speedLines.geometry instanceof THREE.BufferGeometry);
assert(speedLines.material instanceof THREE.ShaderMaterial);
assert.equal(speedLines.positions.length, 100 * 3);
assert.equal(speedLines.speeds.length, 100);
assert.equal(speedLines.geometry.getAttribute('position').count, 100);
assert.equal(speedLines.geometry.getAttribute('color').count, 100);
assert.equal(speedLines.geometry.getAttribute('size').count, 100);
assertIdempotentDisposal(
  'speed-line field',
  speedLines.geometry,
  speedLines.material,
  speedLines.dispose,
);

const track = createShowroomTrack();
assert(track.mesh instanceof THREE.InstancedMesh);
assert(track.mesh.geometry instanceof THREE.PlaneGeometry);
assert(track.material instanceof THREE.MeshBasicMaterial);
assert(track.scratch instanceof THREE.Object3D);
assert.equal(track.mesh.count, 3_000 + 400);
assert.equal(track.data.length, 3_000 + 400);
assert.equal(track.mesh.position.y, -10.05);
assert.equal(track.data.filter((datum) => datum.isVertical).length, 400);
assertIdempotentDisposal(
  'showroom track',
  track.mesh.geometry,
  track.material,
  track.dispose,
);

const componentSource = readFileSync(
  new URL('../src/components/ParticleBackground.tsx', import.meta.url),
  'utf8',
);
assert.match(componentSource, /from ['"].\/showroom\/showroom-constants['"]/);
assert.match(componentSource, /from ['"].\/showroom\/showroom-particles['"]/);
assert.match(componentSource, /from ['"].\/showroom\/showroom-track['"]/);
assert.doesNotMatch(componentSource, /const\s+COLORS\s*=/);
assert.doesNotMatch(componentSource, /const\s+HAIRLINE_COUNT\s*=/);
assert.doesNotMatch(componentSource, /const\s+SIDE_LINE_COUNT\s*=/);

console.log('Showroom resource checks passed.');
