import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const assets = {
  model: 'public/models/red_bull_f1_showroom.glb',
  studio: 'public/environments/ferndale_studio_09_1k.hdr',
  night: 'public/environments/rooftop_night_1k.hdr',
};

const parseGlbJson = async (path) => {
  const bytes = await readFile(path);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + length));
};

const sha1 = async (path) => createHash('sha1')
  .update(await readFile(path))
  .digest('hex');

const modelStat = await stat(assets.model);
assert.ok(modelStat.size <= 15 * 1024 * 1024, `Showroom GLB is ${modelStat.size} bytes`);

const gltf = await parseGlbJson(assets.model);
const names = new Set(gltf.nodes.map((node) => node.name));
for (const name of ['F1_Car', 'Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
  assert.ok(names.has(name), `Missing required node: ${name}`);
}

assert.equal(await sha1(assets.studio), '300723e57b930413fa3e493033033713f911dd18');
assert.equal(await sha1(assets.night), '4dc306b1cc07c5e9e830758dede1eb7ed8ecbebd');
console.log(`PASS: showroom assets (${(modelStat.size / 1024 / 1024).toFixed(2)} MB model)`);
