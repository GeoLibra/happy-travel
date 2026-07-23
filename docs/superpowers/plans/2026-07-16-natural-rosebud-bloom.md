# Natural Rosebud Bloom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current uniformly contracted half-open starting pose with a natural rosebud whose outer petals remain slightly open, middle petals gather inward, and center petals stay closed until the final bloom.

**Architecture:** Keep the existing 25-petal Blender preprocessing pipeline and the embedded `RoseBloom` glTF clip. Add layer metadata and strictly capped quaternion channels to the generated GLB, validate the animation contract in Node, validate sampled mesh intersections in Blender, then keep the existing Three.js one-shot playback unchanged except for its model cache key.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`, `BVHTree`), glTF 2.0 / GLB, Node.js assertions, Three.js, TypeScript, Vite, Playwright CLI.

## Global Constraints

- The starting pose must read as a natural bud: outer ring slightly open, middle ring gathered, center tightly closed.
- The fully open final frame must remain unchanged within the existing `1e-4` bounds tolerance.
- The animation must target exactly 25 complete physical `Petal_*` nodes and only petal nodes.
- Maximum rotation relative to the final pose is `1°` for outer petals, `4°` for middle petals, and `8°` for inner petals; no petal may exceed `8°`.
- Any sampled frame must remain at or below `80` intersecting petal pairs and `40,000` overlapping triangle pairs; closed-bud overlap is allowed, while the `8°` rotation cap and browser screenshots remain the shard-safety gates.
- `src/model/rose.glb` and `public/models/rose.glb` must remain byte-identical.
- Stem, leaves, thorns, materials, lighting, camera, particles, presentation timing, and trigger behavior remain unchanged.

---

## File Map

- `scripts/verify-rose-glb.mjs`: validates the exported GLB structure, layer metadata, required animation paths, and quaternion rotation caps.
- `scripts/prepare_rose_bloom.py`: classifies petals, constructs the natural-bud transforms, writes layer metadata, and exports both GLB copies.
- `scripts/verify_rose_bloom_geometry.py`: imports the exported GLB in Blender and enforces sampled BVH intersection and rotation limits.
- `src/model/rose.glb`: generated source model.
- `public/models/rose.glb`: byte-identical browser model.
- `src/lib/rose-animation.ts`: browser model URL cache key only.
- `scripts/check-rose-animation.ts`: expected cache key only.

### Task 1: Encode the bounded layered-rotation GLB contract

**Files:**
- Modify: `scripts/verify-rose-glb.mjs:48-162`
- Test: `scripts/verify-rose-glb.mjs`

**Interfaces:**
- Consumes: glTF accessors, animation samplers, channel target nodes, and `node.extras.RoseLayer`.
- Produces: `readFloatAccessor(json, bin, accessorIndex, expectedType) -> number[][]` and an executable contract requiring layer-aware rotation at or below the declared cap.

- [ ] **Step 1: Replace the scalar-only accessor reader with a typed float accessor reader**

```js
const COMPONENTS_BY_TYPE = { SCALAR: 1, VEC3: 3, VEC4: 4 };

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
```

- [ ] **Step 2: Write the new failing layer and rotation assertions**

```js
const ROTATION_CAP_DEGREES = { outer: 1, middle: 4, inner: 8 };
const radiansToDegrees = (value) => value * 180 / Math.PI;
const quaternionAngleDegrees = (left, right) => {
  const leftLength = Math.hypot(...left);
  const rightLength = Math.hypot(...right);
  assert(leftLength > 0 && rightLength > 0, 'Rotation quaternion must be nonzero');
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0) / (leftLength * rightLength);
  return radiansToDegrees(2 * Math.acos(Math.min(1, Math.abs(dot))));
};

const petalNodesArray = [...petalNodes];
const layers = new Set(petalNodesArray.map((nodeName) => {
  const node = json.nodes.find(({ name }) => name === nodeName);
  const layer = node?.extras?.RoseLayer;
  assert(layer in ROTATION_CAP_DEGREES, `${nodeName} must declare a valid RoseLayer`);
  return layer;
}));
assert.deepEqual(layers, new Set(['outer', 'middle', 'inner']));

const rotationTargets = targets.filter(({ path }) => path === 'rotation');
assert(rotationTargets.length > 0, 'RoseBloom must contain bounded rotation channels');
const rotationLayers = new Set(rotationTargets.map(({ node }) =>
  json.nodes.find(({ name }) => name === node)?.extras?.RoseLayer,
));
assert(rotationLayers.has('middle') && rotationLayers.has('inner'), 'Middle and inner petals must fold inward');
for (const { node, sampler } of rotationTargets) {
  const layer = json.nodes.find(({ name }) => name === node)?.extras?.RoseLayer;
  const quaternions = readFloatAccessor(json, bin, sampler.output, 'VEC4');
  const finalQuaternion = quaternions.at(-1);
  const maximum = Math.max(...quaternions.map((value) => quaternionAngleDegrees(value, finalQuaternion)));
  assert(maximum <= ROTATION_CAP_DEGREES[layer] + 0.05, `${node} ${layer} rotation ${maximum.toFixed(3)}° exceeds its cap`);
}
```

Also change input-time reading to `readFloatAccessor(json, bin, sampler.input, 'SCALAR').flat()` and retain the existing 25-petal, translation/scale, duration, and open-bounds assertions.

- [ ] **Step 3: Run the contract and confirm the current no-rotation GLB fails for the intended reason**

Run: `npm run check:rose-glb`

Expected: `FAIL: ... must declare a valid RoseLayer` or `FAIL: RoseBloom must contain bounded rotation channels`.

- [ ] **Step 4: Check the JavaScript syntax before moving to model generation**

Run: `node --check scripts/verify-rose-glb.mjs`

Expected: exit code `0` with no output.

- [ ] **Step 5: Commit the red contract test**

```bash
git add scripts/verify-rose-glb.mjs
git commit -m "test: define natural rosebud animation contract"
```

### Task 2: Generate the layered natural-bud transforms

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:16-40, 243-355`
- Modify (generated): `src/model/rose.glb`
- Modify (generated): `public/models/rose.glb`
- Test: `scripts/verify-rose-glb.mjs`

**Interfaces:**
- Consumes: the existing 25 complete petals, `attachment_origin()`, layer radius thresholds, and final open world transforms.
- Produces: `capped_rotation(source, target, maximum_angle) -> Quaternion`, `RoseLayer` node extras, and a `RoseBloom` clip with location, quaternion, and scale channels.

- [ ] **Step 1: Add exact layer settings and the capped quaternion helper**

```python
from mathutils import Matrix, Quaternion, Vector

LAYER_SETTINGS = {
    # opening frame, inward translation, local scale, maximum inward fold
    "outer": (1, 0.08, (0.86, 0.86, 0.98), math.radians(1.0)),
    "middle": (18, 0.26, (0.74, 0.74, 0.98), math.radians(4.0)),
    "inner": (34, 0.42, (0.84, 0.84, 0.995), math.radians(8.0)),
}

def capped_rotation(source: Vector, target: Vector, maximum_angle: float) -> Quaternion:
    if source.length_squared < 1e-16 or target.length_squared < 1e-16 or maximum_angle <= 0:
        return Quaternion()
    delta = source.normalized().rotation_difference(target.normalized())
    if delta.angle > maximum_angle and delta.angle > 1e-12:
        delta = Quaternion().slerp(delta, maximum_angle / delta.angle)
    return delta
```

- [ ] **Step 2: Build and keyframe each layer's closed transform**

Replace the current tuple unpacking and stable-rotation assignment with:

```python
layer_frame, inward, scale_factors, max_angle = LAYER_SETTINGS[layer]
petal["RoseLayer"] = layer

closed_world_location = open_world_location.copy()
closed_world_location.x += (flower_center.x - open_world_location.x) * inward
closed_world_location.y += (flower_center.y - open_world_location.y) * inward
growth = centers[petal] - open_world_location
toward_axis = Vector((flower_center.x, flower_center.y, centers[petal].z)) - open_world_location
rotation_delta = capped_rotation(growth, toward_axis, max_angle)
closed_world_rotation = rotation_delta @ open_world_rotation
closed_world_scale = Vector(tuple(open_world_scale[axis] * scale_factors[axis] for axis in range(3)))
```

Keyframe all three transform paths in both poses:

```python
for path in ("location", "rotation_quaternion", "scale"):
    petal.keyframe_insert(data_path=path, frame=1)
    petal.keyframe_insert(data_path=path, frame=opening_frame)
# restore open transform
for path in ("location", "rotation_quaternion", "scale"):
    petal.keyframe_insert(data_path=path, frame=open_frame)
    petal.keyframe_insert(data_path=path, frame=END_FRAME)
```

- [ ] **Step 3: Regenerate both GLB copies in a clean Blender process**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/prepare_rose_bloom.py`

Expected: `PASS: exported 25 petals as RoseBloom ... and mirrored identical bytes ...`.

- [ ] **Step 4: Run the new GLB contract**

Run: `npm run check:rose-glb`

Expected: `PASS: RoseBloom animation contract verified`.

- [ ] **Step 5: Confirm the generated files are identical and idempotent**

Run: `cmp src/model/rose.glb public/models/rose.glb`

Expected: exit code `0`.

Run the Blender generation command again, then run `npm run check:rose-glb` and `cmp src/model/rose.glb public/models/rose.glb` again.

Expected: both commands pass on the second generation.

- [ ] **Step 6: Commit the model generator and generated assets**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "fix: shape rose bloom from a natural bud"
```

### Task 3: Add sampled geometry regression verification

**Files:**
- Create: `scripts/verify_rose_bloom_geometry.py`
- Test: `scripts/verify_rose_bloom_geometry.py`

**Interfaces:**
- Consumes: `public/models/rose.glb`, Blender's evaluated dependency graph, and frames `(1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 105, 120, 135)`.
- Produces: per-frame intersection/rotation diagnostics and a nonzero exit when a threshold is exceeded.

- [ ] **Step 1: Create the Blender geometry verifier**

```python
from __future__ import annotations

import math
from itertools import combinations
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

MODEL = Path(__file__).resolve().parent.parent / "public/models/rose.glb"
FRAMES = (1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 105, 120, 135)
MAX_INTERSECTING_PAIRS = 80
MAX_TRIANGLE_PAIRS = 40_000
MAX_ROTATION_DEGREES = 8.05

def material_names(obj):
    return {material.name for material in obj.data.materials if material} if obj.type == "MESH" else set()

def evaluated_bvh(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=1e-5)
    finally:
        evaluated.to_mesh_clear()

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(MODEL))
petals = sorted(
    [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and "m_petal" in material_names(obj)],
    key=lambda obj: obj.name,
)
if len(petals) != 25:
    raise RuntimeError(f"Expected 25 petals, found {len(petals)}")

bpy.context.scene.frame_set(135)
bpy.context.view_layer.update()
final_rotations = {petal: petal.matrix_world.to_quaternion() for petal in petals}

for frame in FRAMES:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    bvhs = {petal: evaluated_bvh(petal) for petal in petals}
    overlaps = [
        len(bvhs[left].overlap(bvhs[right]))
        for left, right in combinations(petals, 2)
    ]
    intersecting_pairs = sum(count > 0 for count in overlaps)
    triangle_pairs = sum(overlaps)
    maximum_rotation = max(
        math.degrees(petal.matrix_world.to_quaternion().rotation_difference(final_rotations[petal]).angle)
        for petal in petals
    )
    print(
        f"FRAME {frame:03d}: intersecting_pairs={intersecting_pairs:03d} "
        f"triangle_pairs={triangle_pairs:05d} rotation_max={maximum_rotation:05.2f}"
    )
    if intersecting_pairs > MAX_INTERSECTING_PAIRS:
        raise RuntimeError(f"Frame {frame} has {intersecting_pairs} intersecting petal pairs")
    if triangle_pairs > MAX_TRIANGLE_PAIRS:
        raise RuntimeError(f"Frame {frame} has {triangle_pairs} overlapping triangle pairs")
    if maximum_rotation > MAX_ROTATION_DEGREES:
        raise RuntimeError(f"Frame {frame} rotates a petal by {maximum_rotation:.3f} degrees")

print("PASS: sampled rose bloom geometry stays within intersection and rotation limits")
```

- [ ] **Step 2: Run the sampled geometry verifier**

Before running the verifier, restore the Task 2 approved layer settings exactly if a previous failed calibration attempt changed them:

```python
"outer": (1, 0.08, (0.86, 0.86, 0.98), math.radians(1.0)),
"middle": (18, 0.26, (0.74, 0.74, 0.98), math.radians(4.0)),
"inner": (34, 0.42, (0.84, 0.84, 0.995), math.radians(8.0)),
```

Regenerate both GLBs, then run: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py`

Expected: all 13 frames print at or below the declared limits, followed by `PASS: sampled rose bloom geometry stays within intersection and rotation limits`.

- [ ] **Step 3: Treat any remaining threshold failure as a blocker**

The revised thresholds intentionally cover the measured natural-bud pose (`77` intersecting pairs and `39,391` triangle overlaps at frame 1). Do not loosen the thresholds or change the approved layer settings inside this task. If any sampled frame still exceeds a limit, report BLOCKED with the exact frame statistics for design review.

- [ ] **Step 4: Commit the geometry regression check**

```bash
git add scripts/verify_rose_bloom_geometry.py scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "test: guard rose bloom mesh intersections"
```

### Task 4: Refresh browser cache key and verify the complete experience

**Files:**
- Modify: `src/lib/rose-animation.ts:3`
- Modify: `scripts/check-rose-animation.ts:30`
- Test: `scripts/check-rose-animation.ts`, browser screenshots.

**Interfaces:**
- Consumes: regenerated `public/models/rose.glb` and the unchanged `createRoseBloomAction()` playback API.
- Produces: browser URL `/models/rose.glb?v=natural-bud-1` and visual evidence for the bud, intermediate, and final poses.

- [ ] **Step 1: Write the failing cache-key expectation**

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=natural-bud-1");
```

- [ ] **Step 2: Run the animation check and confirm it fails**

Run: `npm run check:rose-animation`

Expected: assertion failure showing `v=4aa0a7e` differs from `v=natural-bud-1`.

- [ ] **Step 3: Update the production cache key**

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=natural-bud-1";
```

- [ ] **Step 4: Run all automated checks**

Run, in order:

```bash
npm run check:rose-glb
npm run check:rose-animation
npm run lint
npm run build
npm run check:f1-motion
npm run check:i18n
cmp src/model/rose.glb public/models/rose.glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
```

Expected: every command exits `0`; Vite may retain its existing nonfatal chunk-size warning.

- [ ] **Step 5: Verify the animation in a fresh browser session**

Start the app with `npm run dev -- --host 127.0.0.1`, open `http://127.0.0.1:3000` using the Playwright wrapper, complete the hold-to-enter screen, trigger the rose modal with five rapid clicks on the itinerary title container, then capture screenshots at approximately `4.8s`, `5.8s`, `7.0s`, `8.2s`, and `9.7s` after the scene begins.

Pass only if the screenshots show all of the following:

- At `4.8s`, the outer ring is slightly open while the center is visually covered.
- Middle frames open from outside to inside without shard-like spikes or abrupt silhouette jumps.
- The final frame matches the existing fully open rose.
- Closing and reopening the modal restarts from the bud.

- [ ] **Step 6: Commit the runtime cache refresh**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: refresh natural rosebud model cache key"
```

- [ ] **Step 7: Record the failed visual acceptance as RED evidence**

Use `output/playwright/task4-rose-4.8s.png` as the failing reproduction. The image fails because all seven outer-layer petals retain `86%` of their open-pose XY size, producing a mature half-open silhouette even though the inner petals cover the center.

- [ ] **Step 8: Test the single-variable outer-silhouette hypothesis**

Change only the outer XY scale in `scripts/prepare_rose_bloom.py`; keep its opening frame, inward translation, Z scale, and rotation cap unchanged, and keep all middle/inner settings unchanged:

```python
"outer": (1, 0.08, (0.72, 0.72, 0.98), math.radians(1.0)),
```

Do not change another model parameter in this correction attempt. Regenerate both GLBs.

- [ ] **Step 9: Refresh the corrected model cache key with a RED/GREEN check**

First change the assertion to:

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=natural-bud-2");
```

Run `npm run check:rose-animation` and confirm it fails against `natural-bud-1`, then change the production constant to:

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=natural-bud-2";
```

Rerun the check and require PASS.

- [ ] **Step 10: Re-run the complete automated gates**

Run the same eight checks from Step 4, including Blender with `--python-exit-code 1`. Every check must pass before browser review.

- [ ] **Step 11: Capture corrected first-visible and reopen-to-bud evidence**

In a fresh server and browser session, capture the first stable rose at approximately scene `+4.8s`, the final pose at `+9.7s`, close/reopen the modal, and capture the restarted first stable rose again at approximately scene `+4.8s`. Pass only if both first-visible images read as a compact natural bud: the seven outer petals form a restrained silhouette, the middle ring is gathered, the center is covered, and no shard-like spikes appear.

If the first-visible image still reads as a half-open flower, stop and report BLOCKED with the screenshot. Do not change inward translation, middle/inner scale, or any rotation in this attempt.

- [ ] **Step 12: Commit the visual correction after GREEN evidence**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "fix: tighten rosebud outer silhouette"
```

- [ ] **Step 13: Record the remaining gathered-middle failure as a new RED**

Use `output/playwright/task4-corrected-first-4.8s.png`. The outer silhouette is narrower than the prior RED, confirming the outer XY change had the intended local effect, but the ten middle-layer petals remain radially separated and expose an open spiral instead of forming a gathered bud shell.

- [ ] **Step 14: Test the single-variable middle-gathering hypothesis**

Keep the corrected outer scale from Step 8 and every scale/rotation value unchanged. Change only the middle inward translation:

```python
"middle": (18, 0.42, (0.74, 0.74, 0.98), math.radians(4.0)),
```

Regenerate both GLBs. Do not change middle scale, inner settings, or any rotation.

- [ ] **Step 15: Refresh the second corrected model cache key with RED/GREEN evidence**

Update the assertion first to `/models/rose.glb?v=natural-bud-3`, confirm `npm run check:rose-animation` fails against `natural-bud-2`, then update `ROSE_MODEL_URL` to the same `natural-bud-3` value and require PASS.

- [ ] **Step 16: Re-run all automated and visual gates**

Run the eight automated checks from Step 4. In a fresh browser session, capture first-visible `+4.8s`, final `+9.7s`, and reopened `+4.8s`. Pass only if both first-visible images show the middle ring gathered over a covered center, the outer ring restrained, and no shards. If it still reads half-open, stop and report BLOCKED without a third parameter change.

- [ ] **Step 17: Commit the two confirmed visual corrections after GREEN**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "fix: gather rosebud middle petals"
```
