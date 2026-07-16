import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT_COMPONENT_TYPE = 5126;
const COMPONENTS_BY_TYPE = { SCALAR: 1, VEC3: 3, VEC4: 4 };

function readGlb(filePath) {
  const glb = readFileSync(filePath);

  assert(glb.length >= 12, 'GLB header is incomplete');
  assert.equal(glb.readUInt32LE(0), GLB_MAGIC, 'GLB magic is invalid');
  assert.equal(glb.readUInt32LE(4), GLB_VERSION, 'GLB version must be 2');
  assert.equal(glb.readUInt32LE(8), glb.length, 'GLB length does not match its header');

  let jsonChunk;
  let binChunk;
  let offset = 12;

  while (offset < glb.length) {
    assert(offset + 8 <= glb.length, 'GLB chunk header is incomplete');
    const chunkLength = glb.readUInt32LE(offset);
    const chunkType = glb.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    assert(chunkEnd <= glb.length, 'GLB chunk exceeds file length');

    if (chunkType === JSON_CHUNK) {
      jsonChunk = glb.subarray(chunkStart, chunkEnd);
    } else if (chunkType === BIN_CHUNK) {
      binChunk = glb.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd;
  }

  assert(jsonChunk, 'GLB JSON chunk is missing');
  assert(binChunk, 'GLB BIN chunk is missing');

  return {
    json: JSON.parse(jsonChunk.toString('utf8').replace(/[\u0000 ]+$/u, '')),
    bin: binChunk,
  };
}

function readFloatAccessor(json, bin, accessorIndex, expectedType) {
  const accessor = json.accessors?.[accessorIndex];
  assert(accessor, `Accessor ${accessorIndex} is missing`);
  assert.equal(accessor.type, expectedType, `Accessor ${accessorIndex} must be ${expectedType}`);
  assert.equal(accessor.componentType, FLOAT_COMPONENT_TYPE, `Accessor ${accessorIndex} must use FLOAT components`);
  const componentCount = COMPONENTS_BY_TYPE[expectedType];
  const elementSize = componentCount * Float32Array.BYTES_PER_ELEMENT;
  const bufferView = json.bufferViews?.[accessor.bufferView];
  assert(bufferView, `Buffer view ${accessor.bufferView} is missing`);
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? elementSize;
  const end = accessor.count === 0 ? start : start + (accessor.count - 1) * stride + elementSize;
  assert(stride >= elementSize && stride % 4 === 0, `Accessor ${accessorIndex} has an invalid stride`);
  assert(end <= (bufferView.byteOffset ?? 0) + bufferView.byteLength, `Accessor ${accessorIndex} exceeds its buffer view`);
  assert(end <= bin.length, `Accessor ${accessorIndex} exceeds the BIN chunk`);
  return Array.from({ length: accessor.count }, (_, elementIndex) =>
    Array.from({ length: componentCount }, (_, componentIndex) =>
      bin.readFloatLE(start + elementIndex * stride + componentIndex * 4),
    ),
  );
}

function verifyRoseBloom(filePath) {
  const { json, bin } = readGlb(filePath);
  assert.equal(json.animations?.length, 1, 'GLB must contain exactly one animation');
  const [animation] = json.animations;
  assert.equal(animation.name, 'RoseBloom', 'The animation must be named RoseBloom');

  const targets = animation.channels.map((channel) => ({
    node: json.nodes[channel.target.node]?.name ?? '',
    path: channel.target.path,
    sampler: animation.samplers[channel.sampler],
  }));

  assert.equal(targets.length, 25, 'RoseBloom must contain one channel per physical petal');
  assert(
    targets.every(({ node, path }) => node.startsWith('Petal_') && path === 'weights'),
    'RoseBloom may contain only Petal_* morph weight channels',
  );

  const petalNodes = new Set(targets.map(({ node }) => node));
  assert.equal(petalNodes.size, 25, 'RoseBloom must animate 25 unique physical petals');
  const layers = new Set();

  for (const { node: nodeName, sampler } of targets) {
    const node = json.nodes.find(({ name }) => name === nodeName);
    assert(node, `${nodeName} node is missing`);
    assert(['outer', 'middle', 'inner'].includes(node.extras?.RoseLayer), `${nodeName} must declare RoseLayer`);
    layers.add(node.extras.RoseLayer);

    const mesh = json.meshes?.[node.mesh];
    assert(mesh, `${nodeName} mesh is missing`);
    assert.deepEqual(mesh.extras?.targetNames, ['Bud'], `${nodeName} must expose one Bud target name`);
    assert.equal(mesh.weights?.length, 1, `${nodeName} must have one default morph weight`);
    assert.equal(mesh.primitives?.length, 1, `${nodeName} must have one mesh primitive`);
    assert.equal(mesh.primitives[0].targets?.length, 1, `${nodeName} must have one morph target`);
    assert(mesh.primitives[0].targets[0].POSITION !== undefined, `${nodeName} Bud target must contain positions`);

    const weights = readFloatAccessor(json, bin, sampler.output, 'SCALAR').flat();
    assert(weights.length >= 2, `${nodeName} weights sampler must contain multiple keys`);
    assert(weights.every((value) => Number.isFinite(value) && value >= -1e-5 && value <= 1 + 1e-5), `${nodeName} weights must stay in [0, 1]`);
    assert(Math.abs(weights[0] - 1) <= 1e-5, `${nodeName} must start at Bud weight 1`);
    assert(Math.abs(weights.at(-1)) <= 1e-5, `${nodeName} must finish at Bud weight 0`);
  }

  assert.deepEqual(layers, new Set(['outer', 'middle', 'inner']));

  const inputTimes = animation.samplers.flatMap((sampler) => {
    assert(sampler, 'RoseBloom channel sampler is missing');
    return readFloatAccessor(json, bin, sampler.input, 'SCALAR').flat();
  });
  const duration = Math.max(...inputTimes);
  assert(
    Number.isFinite(duration) && duration >= 4 && duration <= 5,
    'RoseBloom duration must be between 4.0 and 5.0 seconds',
  );

  const roseRoot = json.nodes?.find(({ name }) => name === 'RoseRoot');
  const openPoseBounds = roseRoot?.extras?.OpenPoseBounds;
  assert(
    Array.isArray(openPoseBounds) &&
      openPoseBounds.length === 6 &&
      openPoseBounds.every(Number.isFinite),
    'RoseRoot must contain six finite OpenPoseBounds values',
  );
}

try {
  verifyRoseBloom(process.argv[2]);
  console.log('PASS: RoseBloom animation contract verified');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
