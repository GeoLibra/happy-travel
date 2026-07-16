import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import {
  createRoseBloomAction,
  getRoseArcStrength,
  getRoseAssemblyProgress,
  getRoseBloomDelta,
  getRoseHandoffProgress,
  getRosePresentationPitch,
  getRosePresentationScale,
  getRosePresentationYaw,
  ROSE_ASSEMBLY_MS,
  ROSE_BLOOM_END_MS,
  ROSE_BLOOM_START_MS,
  ROSE_PRESENTATION_END_MS,
  ROSE_PRESENTATION_START_MS,
  ROSE_HANDOFF_MS,
  ROSE_HANDOFF_END_MS,
  ROSE_FINAL_PITCH,
  ROSE_FINAL_SCALE,
  ROSE_INITIAL_YAW,
  ROSE_MODEL_URL,
} from "../src/lib/rose-animation";

const closeTo = (actual: number, expected: number, tolerance = 1e-6) => {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=guided-bud-1");
assert.equal(ROSE_ASSEMBLY_MS, 3_000);
assert.equal(ROSE_HANDOFF_MS, 600);
assert.equal(ROSE_HANDOFF_END_MS, 3_600);
assert.equal(ROSE_PRESENTATION_START_MS, 2_500);
assert.equal(ROSE_PRESENTATION_END_MS, 5_100);
assert.equal(ROSE_BLOOM_START_MS, 4_600);
assert.equal(ROSE_BLOOM_END_MS, 9_600);
assert.equal(ROSE_ASSEMBLY_MS - ROSE_PRESENTATION_START_MS, 500);
assert.equal(ROSE_PRESENTATION_END_MS - ROSE_BLOOM_START_MS, 500);

assert.equal(getRoseAssemblyProgress(-10, 0, 0), 0);
assert.equal(getRoseAssemblyProgress(0, 0, 0), 0);
assert(getRoseAssemblyProgress(1_500, 0, 0) > getRoseAssemblyProgress(1_500, 1, 1));
assert.equal(getRoseAssemblyProgress(ROSE_ASSEMBLY_MS, 1, 1), 1);
assert.equal(getRoseAssemblyProgress(9_000, 0.5, 0.5), 1);
assert.equal(getRoseArcStrength(0), 0);
assert(getRoseArcStrength(0.5) > 0.5);
closeTo(getRoseArcStrength(1), 0);

assert.equal(getRoseHandoffProgress(2_999), 0);
assert.equal(getRoseHandoffProgress(3_000), 0);
assert(getRoseHandoffProgress(3_300) > 0 && getRoseHandoffProgress(3_300) < 1);
assert.equal(getRoseHandoffProgress(3_600), 1);

closeTo(getRosePresentationYaw(0), ROSE_INITIAL_YAW);
closeTo(getRosePresentationYaw(2_500), ROSE_INITIAL_YAW);
assert(getRosePresentationYaw(4_350) < ROSE_INITIAL_YAW);
closeTo(getRosePresentationYaw(5_100), 0);
closeTo(getRosePresentationYaw(9_600), 0);
closeTo(getRosePresentationYaw(10_600), 0.05);

closeTo(getRosePresentationPitch(0), 0);
closeTo(getRosePresentationPitch(ROSE_PRESENTATION_START_MS), 0);
assert(getRosePresentationPitch(4_350) > 0);
assert(getRosePresentationPitch(4_350) < ROSE_FINAL_PITCH);
closeTo(getRosePresentationPitch(ROSE_PRESENTATION_END_MS), ROSE_FINAL_PITCH);
closeTo(getRosePresentationPitch(9_600), ROSE_FINAL_PITCH);
closeTo(ROSE_FINAL_PITCH, THREE.MathUtils.degToRad(70));
closeTo(ROSE_FINAL_SCALE, 1.5);
closeTo(getRosePresentationScale(0), 1);
closeTo(getRosePresentationScale(ROSE_PRESENTATION_START_MS), 1);
assert(getRosePresentationScale(4_350) > 1);
assert(getRosePresentationScale(4_350) < ROSE_FINAL_SCALE);
closeTo(getRosePresentationScale(ROSE_PRESENTATION_END_MS), ROSE_FINAL_SCALE);
closeTo(getRosePresentationScale(9_600), ROSE_FINAL_SCALE);

const finalPlantAxis = new THREE.Vector3(0, 1, 0).applyAxisAngle(
  new THREE.Vector3(1, 0, 0),
  ROSE_FINAL_PITCH,
);
assert(finalPlantAxis.z > 0.9, "the flower end of the plant must turn toward the +Z camera");

assert.equal(getRoseBloomDelta(4_599, 0.016), 0);
closeTo(getRoseBloomDelta(4_608, 0.016), 0.0072);
closeTo(getRoseBloomDelta(5_000, 0.1), 0.09);
closeTo(getRoseBloomDelta(9_608, 0.016), 0.0072);
assert.equal(getRoseBloomDelta(9_700, 0.016), 0);
const stalledBloomFrames = [
  [4_500, 0.1],
  [4_700, 0.2],
  [5_500, 0.8],
  [7_000, 1.5],
  [9_700, 2.7],
] as const;
closeTo(
  stalledBloomFrames.reduce(
    (total, [elapsed, frameDelta]) => total + getRoseBloomDelta(elapsed, frameDelta),
    0,
  ),
  4.5,
);

const root = new THREE.Group();
const clip = new THREE.AnimationClip("RoseBloom", 4.5, []);
const playback = createRoseBloomAction(root, [clip]);

assert(playback, "RoseBloom playback should be created");
assert.equal(playback.action.loop, THREE.LoopOnce);
assert.equal(playback.action.repetitions, 1);
assert.equal(playback.action.clampWhenFinished, true);
assert.equal(playback.action.isRunning(), true);
assert.equal(playback.mixer.time, 0);
assert.equal(createRoseBloomAction(root, []), null);

const threeRoseSource = fs.readFileSync(
  new URL("../src/components/ThreeRose.tsx", import.meta.url),
  "utf8",
);
assert.match(threeRoseSource, /MeshSurfaceSampler/);
assert.match(threeRoseSource, /startPositions/);
assert.match(threeRoseSource, /targetPositions/);
assert.match(threeRoseSource, /getRoseAssemblyProgress/);
assert.match(threeRoseSource, /presentationGroup/);
assert.match(threeRoseSource, /getRoseHandoffProgress/);
assert.match(threeRoseSource, /getRosePresentationYaw/);
assert.match(threeRoseSource, /presentationGroup\.rotation\.x = getRosePresentationPitch\(elapsed\)/);
assert.match(
  threeRoseSource,
  /presentationGroup\.scale\.setScalar\(getRosePresentationScale\(elapsed\)\)/,
);
assert.match(threeRoseSource, /positionsSnappedToTarget/);
assert.doesNotMatch(threeRoseSource, /ROSE_PARTICLE_PHASE_MS/);
assert.doesNotMatch(threeRoseSource, /elapsed \* 0\.0002/);
assert.doesNotMatch(threeRoseSource, /Math\.min\(Math\.max\(\(ts - previousFrameTimestamp\)/);
assert.doesNotMatch(threeRoseSource, /allVertices/);

console.log("PASS: rose assembly, handoff, bloom, and presentation timing verified");
