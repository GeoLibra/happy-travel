import assert from "node:assert/strict";
import * as THREE from "three";
import { createRoseBloomAction } from "../src/lib/rose-animation";

const root = new THREE.Group();
const clip = new THREE.AnimationClip("RoseBloom", 4.5, []);
const playback = createRoseBloomAction(root, [clip]);

assert(playback, "RoseBloom playback should be created");
assert.equal(playback.action.loop, THREE.LoopOnce);
assert.equal(playback.action.repetitions, 1);
assert.equal(playback.action.clampWhenFinished, true);
assert.equal(playback.action.isRunning(), true);
assert.equal(createRoseBloomAction(root, []), null);

console.log("PASS: rose bloom playback is one-shot and clamped");
