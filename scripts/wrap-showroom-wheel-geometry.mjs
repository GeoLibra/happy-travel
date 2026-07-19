import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node scripts/wrap-showroom-wheel-geometry.mjs <input.glb> <output.glb>');
}

const JSON_CHUNK = 0x4e4f534a;
const GLB_MAGIC = 0x46546c67;
const wheelNames = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'];
const source = readFileSync(input);

if (source.readUInt32LE(0) !== GLB_MAGIC || source.readUInt32LE(4) !== 2) {
  throw new Error(`${input} is not a GLB 2.0 file`);
}

const chunks = [];
let offset = 12;
while (offset + 8 <= source.length) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  const data = source.subarray(offset + 8, offset + 8 + length);
  chunks.push({ type, data });
  offset += 8 + length;
}

const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK);
if (!jsonChunk) throw new Error(`${input} has no JSON chunk`);
const json = JSON.parse(jsonChunk.data.toString('utf8'));
const nodes = json.nodes ?? [];

for (const name of wheelNames) {
  const wheel = nodes.find((node) => node.name === name);
  if (!wheel || !Number.isInteger(wheel.mesh)) {
    throw new Error(`Missing mesh-bearing wheel node: ${name}`);
  }

  const geometry = { name: `${name}_Geometry`, mesh: wheel.mesh };
  for (const property of ['matrix', 'translation', 'rotation', 'scale', 'weights']) {
    if (wheel[property] !== undefined) {
      geometry[property] = wheel[property];
      delete wheel[property];
    }
  }
  delete wheel.mesh;

  const geometryIndex = nodes.push(geometry) - 1;
  wheel.children = [...(wheel.children ?? []), geometryIndex];
}

json.nodes = nodes;
let encodedJson = Buffer.from(JSON.stringify(json));
const padding = (4 - (encodedJson.length % 4)) % 4;
if (padding) encodedJson = Buffer.concat([encodedJson, Buffer.alloc(padding, 0x20)]);
jsonChunk.data = encodedJson;

const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
const header = Buffer.alloc(12);
header.writeUInt32LE(GLB_MAGIC, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);

const outputChunks = chunks.flatMap((chunk) => {
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(chunk.data.length, 0);
  chunkHeader.writeUInt32LE(chunk.type, 4);
  return [chunkHeader, chunk.data];
});

writeFileSync(output, Buffer.concat([header, ...outputChunks], totalLength));
