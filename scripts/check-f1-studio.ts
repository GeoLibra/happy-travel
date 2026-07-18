import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createF1StudioLighting } from '../src/components/effects/f1StudioLighting';

const scene = new THREE.Scene();
const rig = createF1StudioLighting(scene);

assert.equal(rig.group.children.length, 4);
const base = rig.key.intensity;
rig.update(1);
assert(rig.key.intensity > base);
rig.dispose();
rig.dispose();
assert(!scene.children.includes(rig.group));
