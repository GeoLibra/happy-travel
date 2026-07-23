# Rosebud Morph Bloom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one procedural `Bud` morph target for each of the 25 complete rose petals so the flower continuously unfolds from a curled natural bud into the unchanged open rose.

**Architecture:** Move nonlinear vertex-deformation math into a focused Blender helper, keep mesh discovery/export orchestration in the existing generator, and replace all petal transform animation with one `weights` channel per petal. Validate the glTF morph contract in Node, validate deformation/geometry in Blender, then accept the result only from fresh-browser first-visible and reopen screenshots.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`, shape keys), glTF 2.0 morph targets, Node.js assertions, Three.js, TypeScript, Vite, Playwright CLI.

## Global Constraints

- The first visible rose must read as a natural bud: outer ring slightly open, middle ring wrapping, center tightly curled with no mature open spiral.
- Each of the 25 `Petal_*` nodes has exactly one morph target named `Bud`; `RoseBloom` contains only `weights` channels.
- Petal object transforms remain at the open pose; no translation, rotation, or scale animation channels are allowed.
- `Bud` weight is `1` at the closed pose and exactly `0` at the final frame; final open bounds stay within `1e-4` of the current open model.
- Vertices in the root protection zone (`t <= 0.15`) move by at most `1e-5`.
- Any sampled frame remains at or below `80` intersecting petal pairs and `40,000` overlapping triangle pairs.
- `src/model/rose.glb` and `public/models/rose.glb` remain byte-identical.
- Stem, leaves, thorns, materials, lighting, camera, particles, playback timing, trigger behavior, and `ThreeRose.tsx` remain unchanged.
- Existing uncommitted rigid-transform experiments are replaced by the morph generator and final cache key; unrelated `.superpowers/brainstorm/` files remain untouched.

---

## File Map

- Create `scripts/rosebud_morph.py`: deterministic, testable vertex-deformation math only.
- Create `scripts/check_rosebud_morph.py`: Blender-run unit checks for root locking, curvature, finite output, and degenerate axes.
- Modify `scripts/verify-rose-glb.mjs`: morph target and animation-channel contract.
- Modify `scripts/prepare_rose_bloom.py`: shape key lifecycle, layer timing, animation, export, and idempotent regeneration.
- Modify `scripts/verify_rose_bloom_geometry.py`: shape-key/root checks, zero object rotation, and sampled BVH limits.
- Regenerate `src/model/rose.glb` and `public/models/rose.glb`.
- Modify `src/lib/rose-animation.ts` and `scripts/check-rose-animation.ts`: final cache key only.

### Task 1: Define the glTF morph-animation contract

**Files:**
- Modify: `scripts/verify-rose-glb.mjs:9-154`
- Test: `scripts/verify-rose-glb.mjs`

**Interfaces:**
- Consumes: GLB animation channels/samplers, node-to-mesh references, `mesh.extras.targetNames`, primitive morph targets, and scalar weight accessors.
- Produces: an executable contract requiring exactly 25 `weights` channels, one `Bud` target per petal, closed weight `1`, final weight `0`, and no transform channels.

- [ ] **Step 1: Replace the transform/rotation assertions with exact morph assertions**

Remove `ROTATION_CAP_DEGREES`, `radiansToDegrees`, and `quaternionAngleDegrees`. After constructing `targets`, use:

```js
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
```

Retain the existing animation-name, duration `4.0–5.0s`, 25-petal uniqueness, accessor bounds, and `OpenPoseBounds` checks.

- [ ] **Step 2: Run the current rigid-transform GLB and verify RED**

Run: `npm run check:rose-glb`

Expected: `FAIL: RoseBloom must contain one channel per physical petal` or `FAIL: RoseBloom may contain only Petal_* morph weight channels` because the current model exports transform channels.

- [ ] **Step 3: Verify JavaScript syntax**

Run: `node --check scripts/verify-rose-glb.mjs`

Expected: exit `0`, no output.

- [ ] **Step 4: Commit the RED morph contract**

```bash
git add scripts/verify-rose-glb.mjs
git commit -m "test: define rosebud morph animation contract"
```

### Task 2: Build and test deterministic petal-curvature math

**Files:**
- Create: `scripts/rosebud_morph.py`
- Create: `scripts/check_rosebud_morph.py`

**Interfaces:**
- Produces: `MorphSettings`, `smoothstep01(value)`, and `generate_bud_world_positions(open_points, origin, flower_center, centroid, settings, petal_index) -> tuple[list[Vector], list[float]]`.
- Consumes later: Task 3 imports these exact names from `rosebud_morph`.

- [ ] **Step 1: Write the failing Blender math check**

Create `scripts/check_rosebud_morph.py`:

```python
import math
from mathutils import Vector

from rosebud_morph import MorphSettings, generate_bud_world_positions, smoothstep01

settings = MorphSettings(
    opening_frame=18,
    bend_radians=math.radians(30.0),
    radial_pull=0.25,
    tangential_offset=0.025,
)
origin = Vector((0.0, 0.0, 0.0))
centroid = Vector((1.0, 0.0, 1.0))
flower_center = Vector((0.0, 1.0, 0.5))
points = [
    Vector((0.05, 0.0, 0.05)),
    Vector((0.5, 0.0, 0.5)),
    Vector((1.0, 0.0, 1.0)),
]

closed, parameters = generate_bud_world_positions(
    points, origin, flower_center, centroid, settings, petal_index=2
)
assert smoothstep01(-1.0) == 0.0
assert smoothstep01(2.0) == 1.0
assert parameters[0] <= 0.15
assert (closed[0] - points[0]).length <= 1e-5
assert math.hypot(closed[-1].x - flower_center.x, closed[-1].y - flower_center.y) < math.hypot(points[-1].x - flower_center.x, points[-1].y - flower_center.y)
assert all(math.isfinite(component) for point in closed for component in point)

try:
    generate_bud_world_positions(points, origin, flower_center, origin, settings, petal_index=0)
except ValueError as error:
    assert 'growth direction' in str(error)
else:
    raise AssertionError('Degenerate growth direction must fail')

print('PASS: rosebud morph deformation math verified')
```

- [ ] **Step 2: Run the check and verify RED**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py`

Expected: nonzero exit with `ModuleNotFoundError: No module named 'rosebud_morph'`.

- [ ] **Step 3: Implement the minimal deformation helper**

Create `scripts/rosebud_morph.py`:

```python
from __future__ import annotations

import math
from dataclasses import dataclass

from mathutils import Quaternion, Vector

ROOT_LOCK_END = 0.15
EPSILON = 1e-12

@dataclass(frozen=True)
class MorphSettings:
    opening_frame: int
    bend_radians: float
    radial_pull: float
    tangential_offset: float

def smoothstep01(value: float) -> float:
    value = min(max(value, 0.0), 1.0)
    return value * value * (3.0 - 2.0 * value)

def _stable_bend_axis(growth: Vector, desired: Vector) -> Vector:
    axis = growth.cross(desired)
    if axis.length_squared <= EPSILON:
        axis = growth.cross(Vector((0.0, 0.0, 1.0)))
    if axis.length_squared <= EPSILON:
        axis = growth.cross(Vector((1.0, 0.0, 0.0)))
    if axis.length_squared <= EPSILON:
        raise ValueError('Could not compute a stable bend axis')
    return axis.normalized()

def generate_bud_world_positions(
    open_points: list[Vector],
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    settings: MorphSettings,
    petal_index: int,
) -> tuple[list[Vector], list[float]]:
    growth = centroid - origin
    growth_length = growth.length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    growth_direction = growth / growth_length
    inward = Vector((flower_center.x - origin.x, flower_center.y - origin.y, 0.0))
    if inward.length_squared <= EPSILON:
        raise ValueError('Petal inward direction is degenerate')
    inward.normalize()
    desired = (inward + Vector((0.0, 0.0, 0.65))).normalized()
    bend_axis = _stable_bend_axis(growth_direction, desired)
    tangent = Vector((-inward.y, inward.x, 0.0))
    tangent_sign = -1.0 if petal_index % 2 else 1.0

    closed_points = []
    parameters = []
    for point in open_points:
        parameter = min(max((point - origin).dot(growth_direction) / growth_length, 0.0), 1.0)
        parameters.append(parameter)
        if parameter <= ROOT_LOCK_END:
            closed_points.append(point.copy())
            continue
        weight = smoothstep01((parameter - ROOT_LOCK_END) / (1.0 - ROOT_LOCK_END))
        curved = origin + Quaternion(bend_axis, settings.bend_radians * weight) @ (point - origin)
        axis_point = Vector((flower_center.x, flower_center.y, curved.z))
        curved += (axis_point - curved) * (settings.radial_pull * weight)
        curved += tangent * (growth_length * settings.tangential_offset * tangent_sign * weight)
        if not all(math.isfinite(component) for component in curved):
            raise ValueError('Morph deformation produced a non-finite vertex')
        closed_points.append(curved)
    return closed_points, parameters
```

- [ ] **Step 4: Run the math check and verify GREEN**

Run the Step 2 Blender command.

Expected: `PASS: rosebud morph deformation math verified` and exit `0`.

- [ ] **Step 5: Commit the deformation unit**

```bash
git add scripts/rosebud_morph.py scripts/check_rosebud_morph.py
git commit -m "feat: add rosebud morph deformation math"
```

### Task 3: Generate shape keys, weights animation, and morph-aware geometry checks

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:16-41, 140-167, 265-391, 418-458`
- Modify: `scripts/verify_rose_bloom_geometry.py:14-85`
- Regenerate: `src/model/rose.glb`
- Regenerate: `public/models/rose.glb`
- Test: `scripts/verify-rose-glb.mjs`, `scripts/check_rosebud_morph.py`, `scripts/verify_rose_bloom_geometry.py`

**Interfaces:**
- Consumes: `MorphSettings` and `generate_bud_world_positions` from Task 2; existing 25-petal discovery and layer classification.
- Produces: one `Bud` shape key and one `weights` channel per petal, with object transforms fixed at the open pose.

- [ ] **Step 1: Replace rigid layer settings with morph settings**

```python
from rosebud_morph import MorphSettings, ROOT_LOCK_END, generate_bud_world_positions

MORPH_SETTINGS = {
    "outer": MorphSettings(1, math.radians(3.0), 0.12, 0.015),
    "middle": MorphSettings(18, math.radians(6.0), 0.25, 0.025),
    "inner": MorphSettings(34, math.radians(11.0), 0.38, 0.035),
}
```

Remove `Matrix`, `Quaternion`, `LAYER_SETTINGS`, and `capped_rotation` from the generator.

- [ ] **Step 2: Make re-import remove old morph animation and targets safely**

At final frame, clear both object and shape-key animation before removing actions:

```python
for obj in imported:
    obj.animation_data_clear()
    shape_keys = obj.data.shape_keys if obj.type == "MESH" else None
    if shape_keys is not None:
        shape_keys.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
```

Before creating new keys for each discovered petal:

```python
if petal.data.shape_keys is not None:
    petal.shape_key_clear()
```

- [ ] **Step 3: Replace `animate_petals` with morph target generation and weight animation**

Use this structure inside the existing radius/layer loop:

```python
def animate_petals(petals: list[bpy.types.Object]) -> None:
    centers = {petal: centroid(petal) for petal in petals}
    flower_center = sum(centers.values(), Vector()) / len(centers)
    radial = {
        petal: math.hypot(centers[petal].x - flower_center.x, centers[petal].y - flower_center.y)
        for petal in petals
    }
    max_radius = max(radial.values())
    if max_radius <= 1e-12:
        raise RuntimeError("Petal centroids have no usable radial distribution")

    for index, petal in enumerate(petals):
        if petal.data.shape_keys is not None:
            petal.shape_key_clear()
        origin = attachment_origin(petal)
        set_world_origin(petal, origin)
        petal.matrix_world = petal.matrix_world.copy()

        normalized_radius = radial[petal] / max_radius
        layer = "outer" if normalized_radius >= 0.66 else "middle" if normalized_radius >= 0.33 else "inner"
        settings = MORPH_SETTINGS[layer]
        petal["RoseLayer"] = layer
        stagger = (index % 5) * 2
        opening_frame = settings.opening_frame + stagger
        open_frame = opening_frame + 82
        if open_frame >= END_FRAME:
            raise RuntimeError(f"Open frame {open_frame} leaves no final hold for {petal.name}")

        basis = petal.shape_key_add(name="Basis", from_mix=False)
        bud = petal.shape_key_add(name="Bud", from_mix=False)
        open_world = petal.matrix_world.copy()
        open_points = [open_world @ point.co for point in basis.data]
        closed_points, parameters = generate_bud_world_positions(
            open_points, origin, flower_center, centers[petal], settings, index
        )
        inverse_world = open_world.inverted_safe()
        for vertex_index, closed_world in enumerate(closed_points):
            bud.data[vertex_index].co = inverse_world @ closed_world
            if parameters[vertex_index] <= ROOT_LOCK_END:
                displacement = (bud.data[vertex_index].co - basis.data[vertex_index].co).length
                if displacement > 1e-5:
                    raise RuntimeError(f"{petal.name} root vertex moved by {displacement:.9g}")

        bud.value = 1.0
        bud.keyframe_insert(data_path="value", frame=1)
        bud.keyframe_insert(data_path="value", frame=opening_frame)
        bud.value = 0.0
        bud.keyframe_insert(data_path="value", frame=open_frame)
        bud.keyframe_insert(data_path="value", frame=END_FRAME)

        shape_keys = petal.data.shape_keys
        action = shape_keys.animation_data.action
        if action is None:
            raise RuntimeError(f"Blender did not create a shape-key action for {petal.name}")
        action.name = f"{petal.name}_RoseBloom"
        for curve in action_fcurves(action):
            for keyframe in curve.keyframe_points:
                keyframe.interpolation = "BEZIER"
                keyframe.handle_left_type = "AUTO_CLAMPED"
                keyframe.handle_right_type = "AUTO_CLAMPED"
        shape_keys.animation_data.action = None
        track = shape_keys.animation_data.nla_tracks.new()
        track.name = "RoseBloom"
        strip = track.strips.new("RoseBloom", 1, action)
        strip.action_frame_start = 1
        strip.action_frame_end = END_FRAME
```

- [ ] **Step 4: Make scene/export validation morph-aware**

`verify_scene_animation` must reject object animation and require one shape-key NLA track per petal:

```python
def verify_scene_animation(petals: list[bpy.types.Object]) -> None:
    petal_names = {petal.name for petal in petals}
    for obj in bpy.context.scene.objects:
        if obj.animation_data and (obj.animation_data.action or len(obj.animation_data.nla_tracks)):
            raise RuntimeError(f"Object transforms may not be animated; found {obj.name}")
    animated = set()
    for petal in petals:
        keys = petal.data.shape_keys
        if keys is None or [key.name for key in keys.key_blocks] != ["Basis", "Bud"]:
            raise RuntimeError(f"{petal.name} must contain exactly Basis and Bud shape keys")
        data = keys.animation_data
        if not data or len(data.nla_tracks) != 1:
            raise RuntimeError(f"{petal.name} must contain one shape-key NLA track")
        animated.add(petal.name)
    if animated != petal_names:
        raise RuntimeError(f"Every petal must have morph animation; found {len(animated)}")
```

Add explicit exporter options:

```python
export_morph=True,
export_morph_animation=True,
export_morph_normal=True,
export_morph_tangent=False,
```

- [ ] **Step 5: Update the Blender geometry verifier for morphs and zero object rotation**

Import the shared root constant and `Vector`, then require `Basis`/`Bud`, recompute the same longitudinal `t <= 0.15` root zone used by the generator, and change rotation gates to one global `0.05°` numerical tolerance:

```python
from mathutils import Vector
from rosebud_morph import ROOT_LOCK_END

MAX_OBJECT_ROTATION_DEGREES = 0.05

for petal in petals:
    keys = petal.data.shape_keys
    if keys is None or [key.name for key in keys.key_blocks] != ["Basis", "Bud"]:
        raise RuntimeError(f"{petal.name} must contain exactly Basis and Bud shape keys")
    basis, bud = keys.key_blocks
    open_world = petal.matrix_world
    open_points = [open_world @ point.co for point in basis.data]
    origin = open_world.translation
    centroid = sum(open_points, Vector()) / len(open_points)
    growth = centroid - origin
    if growth.length <= 1e-12:
        raise RuntimeError(f"{petal.name} has a degenerate growth direction")
    growth_direction = growth.normalized()
    for index, point in enumerate(open_points):
        parameter = min(max((point - origin).dot(growth_direction) / growth.length, 0.0), 1.0)
        if parameter <= ROOT_LOCK_END:
            displacement = (open_world.to_3x3() @ (bud.data[index].co - basis.data[index].co)).length
            if displacement > 1e-5:
                raise RuntimeError(f"{petal.name} root vertex moved by {displacement:.9g}")
```

At each frame, retain the `80`/`40,000` BVH assertions and replace per-layer transform rotation checks with:

```python
maximum_rotation = max(rotations.values())
if maximum_rotation > MAX_OBJECT_ROTATION_DEGREES:
    raise RuntimeError(f"Frame {frame} rotates a petal object by {maximum_rotation:.3f} degrees")
```

- [ ] **Step 6: Regenerate and verify GREEN**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: every command exits `0`; geometry prints all 13 frames at or below the limits and object rotation `0.00°`.

- [ ] **Step 7: Verify functional idempotence**

Run the generator a second time, then rerun `npm run check:rose-glb`, the geometry verifier, and `cmp`.

Expected: 25 petals, one `Bud` target each, final weight `0`, all gates pass, and the two copies are byte-identical within the second export. Cross-run Blender byte identity is not required.

- [ ] **Step 8: Commit the morph generator and assets**

```bash
git add scripts/prepare_rose_bloom.py scripts/verify_rose_bloom_geometry.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: generate rose bloom from morph targets"
```

### Task 4: Refresh cache and accept the natural bud in a real browser

**Files:**
- Modify: `scripts/check-rose-animation.ts:30`
- Modify: `src/lib/rose-animation.ts:3`
- Test artifacts: `output/playwright/morph-bud-first.png`, `morph-bud-middle.png`, `morph-bud-final.png`, `morph-bud-reopen.png`

**Interfaces:**
- Consumes: the morph-enabled `public/models/rose.glb` and unchanged Three.js `AnimationMixer` playback.
- Produces: cache URL `/models/rose.glb?v=morph-bud-1` and fresh-browser visual acceptance evidence.

- [ ] **Step 1: Write and verify the cache-key RED**

Set the test expectation first:

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=morph-bud-1");
```

Run: `npm run check:rose-animation`

Expected: assertion failure against the current `natural-bud-3` working-tree value.

- [ ] **Step 2: Update the production cache key and verify GREEN**

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=morph-bud-1";
```

Run: `npm run check:rose-animation`

Expected: `PASS: rose assembly, handoff, bloom, and presentation timing verified`.

- [ ] **Step 3: Run the complete automated suite**

```bash
npm run check:rose-glb
npm run check:rose-animation
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
npm run lint
npm run build
npm run check:f1-motion
npm run check:i18n
cmp src/model/rose.glb public/models/rose.glb
```

Expected: all commands exit `0`; only the existing nonfatal Vite chunk-size warning is allowed.

- [ ] **Step 4: Capture the first browser sequence**

Start `npm run dev -- --host 127.0.0.1`, open a fresh headed browser with the Playwright wrapper, complete hold-to-enter, and fire five rapid clicks on the parent of `h1` text `Shanghai Weekend Itinerary`. Account for measured model-load offset and capture:

- `output/playwright/morph-bud-first.png` at the first stable rose around scene `+4.8s`.
- `output/playwright/morph-bud-middle.png` around scene `+7.0s`.
- `output/playwright/morph-bud-final.png` around scene `+9.7s`.

Pass only if the first image has a restrained outer ring, wrapped middle, and tightly curled center with no mature open spiral; the middle image unfolds outside-in without shards; the final image matches the current open rose.

- [ ] **Step 5: Capture reopen acceptance**

Close the modal, reopen with five rapid clicks, wait to the same first-stable-rose time, and save `output/playwright/morph-bud-reopen.png`.

Pass only if it matches the same qualified bud state rather than resuming the final pose. Stop the browser and dev server after capture.

- [ ] **Step 6: Commit the final cache key**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: load morph rosebud model"
```
