import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createRoseBloomAction,
  getRoseBloomDelta,
  ROSE_MODEL_URL,
} from "../src/lib/rose-animation";

assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=1ba2e7a");
assert.equal(getRoseBloomDelta(2_499, 0.016), 0);
assert.equal(getRoseBloomDelta(2_500, 0.016), 0.016);
assert.equal(getRoseBloomDelta(3_000, 0.1), 0.1);

const root = new THREE.Group();
const clip = new THREE.AnimationClip("RoseBloom", 4.5, []);
const playback = createRoseBloomAction(root, [clip]);

assert(playback, "RoseBloom playback should be created");
assert.equal(playback.action.loop, THREE.LoopOnce);
assert.equal(playback.action.repetitions, 1);
assert.equal(playback.action.clampWhenFinished, true);
assert.equal(playback.action.isRunning(), true);
assert.equal(createRoseBloomAction(root, []), null);

console.log("PASS: rose bloom URL, timing, and playback contract verified");
