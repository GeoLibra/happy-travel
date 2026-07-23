# Guided-Ring Rosebud Morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the common-center petal deformation with layer-specific guide rings so each petal curls within its own angular sector and the first visible rose reads as a natural bud without exceeding geometry gates.

**Architecture:** Extend the existing tested morph helper with an explicit guide-point calculation and guide-line deformation. Keep the already-working 25 shape keys, weights-only glTF animation, export pipeline, geometry verifier, and runtime playback unchanged; regenerate only the morph target geometry and final cache URL.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`), glTF morph targets, Node/TypeScript checks, Three.js, Vite, Playwright CLI.

## Global Constraints

- Every petal retains its own angular sector; no two layer guide points collapse to a common horizontal coordinate.
- Guide radius ratios are outer `0.55`, middle `0.30`, inner `0.12`; guide height ratios are `0.75`, `0.90`, `1.05`.
- Progressive bends are outer `12°`, middle `24°`, inner `38°`; guide pulls are `0.25`, `0.45`, `0.90`; angular offsets are `±1°`, `±2°`, `±3°`.
- Guide radii satisfy `outer > middle > inner > 0`; guide pulls stay in `[0,1]`.
- Root zone `t <= 0.15` moves by at most `1e-5`; object transforms remain unanimated.
- Existing 25 `Bud` targets, weights-only contract, timing, final open bounds `1e-4`, and byte-identical GLB copies remain unchanged.
- Every sampled frame remains at or below `80` intersecting pairs and `40,000` triangle overlaps.
- Browser first and reopen frames must show restrained outer petals, wrapped middle, tightly curled center, and no mature open spiral; no shards; final pose unchanged.
- Existing uncommitted `morph-bud-1` cache edits are replaced by `guided-bud-1`; unrelated scratch remains untouched and unstaged.

---

## File Map

- Modify `scripts/rosebud_morph.py`: guide settings, guide-point validation, and guide-line deformation.
- Modify `scripts/check_rosebud_morph.py`: guide-sector and deformation RED/GREEN checks.
- Modify `scripts/prepare_rose_bloom.py`: exact layer guide settings and `max_radius` integration.
- Regenerate `src/model/rose.glb` and `public/models/rose.glb`.
- Modify `scripts/check-rose-animation.ts` and `src/lib/rose-animation.ts`: final cache key.
- Existing `scripts/verify-rose-glb.mjs` and `scripts/verify_rose_bloom_geometry.py` remain unchanged and act as regression gates.

### Task 1: Add tested guide-ring deformation math

**Files:**
- Modify: `scripts/check_rosebud_morph.py`
- Modify: `scripts/rosebud_morph.py`

**Interfaces:**
- Produces: `MorphSettings(opening_frame, bend_radians, guide_radius_ratio, guide_height_ratio, guide_pull, angular_offset_radians)`.
- Produces: `compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index) -> Vector`.
- Updates: `generate_bud_world_positions(..., maximum_radius, settings, petal_index)` while retaining its `(closed_points, parameters)` return type.

- [ ] **Step 1: Write the guide-ring RED checks first**

Replace the test settings and calls with:

```python
settings = MorphSettings(
    opening_frame=18,
    bend_radians=math.radians(24.0),
    guide_radius_ratio=0.30,
    guide_height_ratio=0.90,
    guide_pull=0.45,
    angular_offset_radians=math.radians(2.0),
)
origin = Vector((1.0, 0.0, 0.0))
centroid = Vector((1.2, 0.0, 1.0))
flower_center = Vector((0.0, 0.0, 0.5))
maximum_radius = 2.0
points = [origin + Vector((0.01, 0.0, 0.05)), Vector((1.1, 0.0, 0.5)), centroid]

guide_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, 2)
guide_odd = compute_guide_point(origin, flower_center, Vector((0.0, 1.2, 1.0)), maximum_radius, settings, 3)
assert abs(math.hypot(guide_even.x - flower_center.x, guide_even.y - flower_center.y) - 0.60) <= 1e-6
assert (Vector((guide_even.x, guide_even.y)) - Vector((guide_odd.x, guide_odd.y))).length > 0.25

closed, parameters = generate_bud_world_positions(
    points, origin, flower_center, centroid, maximum_radius, settings, petal_index=2
)
assert parameters[0] <= ROOT_LOCK_END
assert (closed[0] - points[0]).length <= 1e-5
assert (closed[-1] - guide_even).length < (points[-1] - guide_even).length
assert all(math.isfinite(component) for point in closed for component in point)

for bad_settings in (
    MorphSettings(18, 0.1, 0.0, 0.9, 0.45, 0.0),
    MorphSettings(18, 0.1, 0.3, 0.9, 1.1, 0.0),
    MorphSettings(18, float('nan'), 0.3, 0.9, 0.45, 0.0),
):
    try:
        compute_guide_point(origin, flower_center, centroid, maximum_radius, bad_settings, 0)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid guide settings must fail')

try:
    compute_guide_point(origin, flower_center, centroid, float('nan'), settings, 0)
except ValueError:
    pass
else:
    raise AssertionError('Invalid maximum radius must fail')

try:
    generate_bud_world_positions(
        points, origin, flower_center, origin, maximum_radius, settings, petal_index=0
    )
except ValueError as error:
    assert 'growth direction' in str(error)
else:
    raise AssertionError('Degenerate growth direction must fail')
```

Import `ROOT_LOCK_END` and the new `compute_guide_point` alongside the existing helper imports. Retain smoothstep, finite-output, and degenerate-growth checks.

- [ ] **Step 2: Run Blender math check and verify RED**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py`

Expected: nonzero exit because `compute_guide_point` and the expanded `MorphSettings` fields do not exist.

- [ ] **Step 3: Replace common-center settings and implement guide-point calculation**

Use this data model and helper in `scripts/rosebud_morph.py`:

```python
@dataclass(frozen=True)
class MorphSettings:
    opening_frame: int
    bend_radians: float
    guide_radius_ratio: float
    guide_height_ratio: float
    guide_pull: float
    angular_offset_radians: float

def compute_guide_point(
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    settings: MorphSettings,
    petal_index: int,
) -> Vector:
    if not math.isfinite(maximum_radius) or maximum_radius <= EPSILON:
        raise ValueError('Maximum petal radius is degenerate')
    numeric_settings = (
        settings.bend_radians,
        settings.guide_radius_ratio,
        settings.guide_height_ratio,
        settings.guide_pull,
        settings.angular_offset_radians,
    )
    if not all(math.isfinite(value) for value in numeric_settings):
        raise ValueError('Guide settings must be finite')
    if not 0.0 < settings.guide_radius_ratio <= 1.0:
        raise ValueError('Guide radius ratio must be in (0, 1]')
    if settings.guide_height_ratio <= 0.0:
        raise ValueError('Guide height ratio must be positive')
    if not 0.0 <= settings.guide_pull <= 1.0:
        raise ValueError('Guide pull must be in [0, 1]')
    sector = Vector((centroid.x - flower_center.x, centroid.y - flower_center.y, 0.0))
    if sector.length_squared <= EPSILON:
        raise ValueError('Petal sector direction is degenerate')
    sector.normalize()
    sign = -1.0 if petal_index % 2 else 1.0
    sector = Quaternion(Vector((0.0, 0.0, 1.0)), settings.angular_offset_radians * sign) @ sector
    growth_length = (centroid - origin).length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    return Vector((
        flower_center.x + sector.x * maximum_radius * settings.guide_radius_ratio,
        flower_center.y + sector.y * maximum_radius * settings.guide_radius_ratio,
        origin.z + growth_length * settings.guide_height_ratio,
    ))
```

- [ ] **Step 4: Replace common-center vertex pull with the guide line**

Update the function signature to accept `maximum_radius` before `settings`. Inside it, compute `guide` once, use `desired = (guide - origin).normalized()`, retain `_stable_bend_axis`, and replace the old center/tangent operations with:

```python
guide = compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index)
desired = (guide - origin).normalized()
bend_axis = _stable_bend_axis(growth_direction, desired)

# inside the vertex loop, after computing weight
curved = origin + Quaternion(bend_axis, settings.bend_radians * weight) @ (point - origin)
guide_line_point = origin + (guide - origin) * parameter
curved += (guide_line_point - curved) * (settings.guide_pull * weight)
```

Remove `inward`, `tangent`, `tangent_sign`, `radial_pull`, and `tangential_offset` logic.

- [ ] **Step 5: Run Blender math check and verify GREEN**

Run the Step 2 command.

Expected: `PASS: rosebud morph deformation math verified` and exit `0`.

- [ ] **Step 6: Commit the guide math**

```bash
git add scripts/rosebud_morph.py scripts/check_rosebud_morph.py
git commit -m "feat: guide rose petals along layer rings"
```

### Task 2: Regenerate and verify guided-ring morph assets

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:41-45, 286-320`
- Regenerate: `src/model/rose.glb`
- Regenerate: `public/models/rose.glb`
- Test: existing morph contract and geometry verifier.

**Interfaces:**
- Consumes: expanded `MorphSettings` and `generate_bud_world_positions(... maximum_radius ...)` from Task 1.
- Produces: the same 25-node, weights-only `RoseBloom` GLB contract with new `Bud` positions.

- [ ] **Step 1: Replace layer settings with exact guide-ring profile**

```python
MORPH_SETTINGS = {
    "outer": MorphSettings(1, math.radians(12.0), 0.55, 0.75, 0.25, math.radians(1.0)),
    "middle": MorphSettings(18, math.radians(24.0), 0.30, 0.90, 0.45, math.radians(2.0)),
    "inner": MorphSettings(34, math.radians(38.0), 0.12, 1.05, 0.90, math.radians(3.0)),
}
```

The inner pull is the user-approved calibrated value after isolated probes showed `0.65 -> 101 / 50,505`, `0.75 -> 91 / 43,148`, and `0.85 -> 82 / 35,175` at frame 1.

Before the petal loop, validate:

```python
guide_radii = [MORPH_SETTINGS[layer].guide_radius_ratio for layer in ("outer", "middle", "inner")]
if not guide_radii[0] > guide_radii[1] > guide_radii[2] > 0.0:
    raise RuntimeError(f"Guide ring radii must descend outer-to-inner, found {guide_radii}")
```

- [ ] **Step 2: Pass the already-computed maximum radius into deformation**

```python
closed_points, parameters = generate_bud_world_positions(
    open_points, origin, flower_center, centers[petal], max_radius, settings, index
)
```

- [ ] **Step 3: Regenerate and run focused gates**

Run one command at a time:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: all pass; all 13 frames remain at or below `80 / 40,000` and rotation `0.00°`. If geometry fails, stop with exact frame/layer evidence; do not tune values or gates inside this task.

- [ ] **Step 4: Verify functional idempotence**

Run the generator a second time, then rerun GLB contract, geometry verifier, and `cmp`.

Expected: all pass with the same 25 `Bud` targets and unchanged final pose; cross-run byte identity is not required.

- [ ] **Step 5: Commit guided-ring assets**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: shape rosebud with guided morph rings"
```

### Task 3: Refresh cache and repeat strict browser acceptance

**Files:**
- Modify: `scripts/check-rose-animation.ts:30`
- Modify: `src/lib/rose-animation.ts:3`
- Test artifacts: `output/playwright/guided-bud-first.png`, `guided-bud-middle.png`, `guided-bud-final.png`, `guided-bud-reopen.png`.

**Interfaces:**
- Consumes: guided-ring GLB and unchanged Three.js weights animation playback.
- Produces: `/models/rose.glb?v=guided-bud-1` and browser acceptance evidence.

- [ ] **Step 1: Run cache RED/GREEN**

Set the assertion first:

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=guided-bud-1");
```

Run `npm run check:rose-animation` and require failure against the current `morph-bud-1`, then set production:

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=guided-bud-1";
```

Rerun and require PASS.

- [ ] **Step 2: Run the full automated suite**

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

Expected: all exit `0`; only the existing nonfatal Vite chunk warning is allowed.

- [ ] **Step 3: Capture first browser sequence**

Start a fresh Vite server and headed Playwright wrapper session. Complete welcome, snapshot, trigger five rapid title-parent clicks, account for model-load offset, and capture first stable rose, mid bloom, and final pose as `guided-bud-first.png`, `guided-bud-middle.png`, and `guided-bud-final.png`.

Pass only if first frame has restrained outer, wrapped middle, tightly curled center with no mature spiral; middle opens outside-in without shards; final stays unchanged.

- [ ] **Step 4: Capture reopen sequence**

Close, reopen with the same trigger, wait to the same first-stable scene time, and save `guided-bud-reopen.png`.

Pass only if it reproduces the qualified bud rather than resuming the final pose. Stop browser/server after capture.

- [ ] **Step 5: Commit final cache key**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: load guided-ring rosebud model"
```
