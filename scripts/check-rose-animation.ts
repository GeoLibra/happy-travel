import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createRoseBloomAction,
  getRoseArcStrength,
  getRoseAssemblyProgress,
  getRoseBloomDelta,
  getRoseHandoffProgress,
  getRosePresentationYaw,
  ROSE_ASSEMBLY_MS,
  ROSE_BLOOM_END_MS,
  ROSE_BLOOM_START_MS,
  ROSE_HANDOFF_MS,
  ROSE_INITIAL_YAW,
  ROSE_MODEL_URL,
} from "../src/lib/rose-animation";

const closeTo = (actual: number, expected: number, tolerance = 1e-6) => {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=1ba2e7a");
assert.equal(ROSE_ASSEMBLY_MS, 3_000);
assert.equal(ROSE_HANDOFF_MS, 600);
assert.equal(ROSE_BLOOM_START_MS, 3_600);
assert.equal(ROSE_BLOOM_END_MS, 8_100);

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
closeTo(getRosePresentationYaw(3_600), ROSE_INITIAL_YAW);
assert(getRosePresentationYaw(5_850) < ROSE_INITIAL_YAW);
closeTo(getRosePresentationYaw(8_100), 0);
closeTo(getRosePresentationYaw(9_100), 0.05);

assert.equal(getRoseBloomDelta(3_599, 0.016), 0);
closeTo(getRoseBloomDelta(3_608, 0.016), 0.008);
closeTo(getRoseBloomDelta(4_000, 0.1), 0.1);
closeTo(getRoseBloomDelta(8_108, 0.016), 0.008);
assert.equal(getRoseBloomDelta(8_200, 0.016), 0);

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

console.log("PASS: rose assembly, handoff, bloom, and presentation timing verified");
