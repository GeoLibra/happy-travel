import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT_COMPONENT_TYPE = 5126;

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

function readScalarAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  assert(accessor, `Accessor ${accessorIndex} is missing`);
  assert.equal(accessor.type, 'SCALAR', `Accessor ${accessorIndex} must be SCALAR`);
  assert.equal(
    accessor.componentType,
    FLOAT_COMPONENT_TYPE,
    `Accessor ${accessorIndex} must use FLOAT components`,
  );

  const bufferView = json.bufferViews?.[accessor.bufferView];
  assert(bufferView, `Buffer view ${accessor.bufferView} is missing`);
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? Float32Array.BYTES_PER_ELEMENT;
  const values = [];

  for (let index = 0; index < accessor.count; index += 1) {
    const valueOffset = start + index * stride;
    assert(valueOffset + 4 <= bin.length, `Accessor ${accessorIndex} exceeds the BIN chunk`);
    values.push(bin.readFloatLE(valueOffset));
  }

  return values;
}

function verifyRoseBloom(filePath) {
  const { json, bin } = readGlb(filePath);
  const animation = json.animations?.find(({ name }) => name === 'RoseBloom');
  assert(animation, 'RoseBloom animation is missing');

  const targets = animation.channels.map((channel) => ({
    node: json.nodes[channel.target.node]?.name ?? '',
    path: channel.target.path,
    sampler: animation.samplers[channel.sampler],
  }));

  assert(targets.length >= 6, 'RoseBloom must animate multiple petals');
  assert(
    new Set(targets.map(({ node }) => node)).size >= 3,
    'RoseBloom must target at least three petal nodes',
  );
  assert(
    targets.every(({ node }) => node.startsWith('Petal_')),
    'RoseBloom may animate only Petal_* nodes',
  );
  assert(
    ['translation', 'rotation', 'scale'].every((path) =>
      targets.some((target) => target.path === path),
    ),
    'RoseBloom must contain translation, rotation, and scale channels',
  );

  const inputTimes = animation.samplers.flatMap((sampler) => {
    assert(sampler, 'RoseBloom channel sampler is missing');
    return readScalarAccessor(json, bin, sampler.input);
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
