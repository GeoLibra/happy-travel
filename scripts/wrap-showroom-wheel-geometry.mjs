import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node scripts/wrap-showroom-wheel-geometry.mjs <input.glb> <output.glb>');
}

const wheelNames = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(input);
const root = document.getRoot();

for (const name of wheelNames) {
  const wheel = root.listNodes().find((node) => node.getName() === name);
  if (!wheel) throw new Error(`Missing wheel node: ${name}`);
  const mesh = wheel.getMesh();
  if (!mesh) throw new Error(`Wheel node has no mesh: ${name}`);

  const geometry = document.createNode(`${name}_Geometry`).setMesh(mesh);
  wheel.setMesh(null).addChild(geometry);
}

await io.write(output, document);
