# Rosebud Tip-Local Nested Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the early rose center with alternating nested tip targets while keeping inner-petal bodies on the previously passing single guide ring.

**Architecture:** Replace the unintegrated full-petal alternate settings with an optional complete tip profile. Compute bending from the body guide, blend the guide line toward the parity-selected tip guide only after `tip_blend_start`, keep all animation timing and the final open `Basis` unchanged, and permit only a `0.65 -> 0.75` blend-start fallback after a geometry failure.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`), glTF morph targets, Node/TypeScript checks, Three.js, Vite, headed Playwright CLI.

## Global Constraints

- Inner body guide remains radius `0.12`, height `1.05`, bend `38°`, guide pull `0.90`, and angular offset `±3°`.
- Inner even tip is radius/height `0.04 / 1.10`; inner odd tip is `0.09 / 1.04`.
- Primary `tip_blend_start` is `0.65`; the only fallback is `0.75`, authorized only after primary geometry failure.
- Outer is radius `0.50`, height `0.75`, bend `12°`, pull `0.30`, and offset `±1°`.
- Middle remains radius `0.30`, height `0.90`, bend `24°`, pull `0.45`, and offset `±2°`.
- Bending uses only the body guide; tip guides affect only the guide-line target through `smoothstep((t - start) / (1 - start))`.
- Every guide retains its petal's centroid-derived angular sector; no shared horizontal center target is allowed.
- Root zone `t <= 0.15` moves by at most `1e-5`; object transforms remain unanimated.
- Existing opening frames, runtime timing, final open `Basis`, 25 `Bud` targets, weights-only contract, and final bound tolerance `1e-4` remain unchanged.
- Every sampled frame remains at or below `80` intersecting pairs and `40,000` triangle overlaps with zero meaningful object rotation.
- Both generated GLB destinations remain byte-identical after each generation.
- Browser first/reopen use the established real approximately `5.3s` capture time and must have no obvious center hole or mature annular spiral, a wrapped middle, and slightly open outer petals without downward spread.
- Middle remains continuous and shard-free; final remains unchanged; screenshots may not be captured earlier and timing may not be altered.
- If the `0.75` fallback fails geometry or the selected profile fails visual acceptance, stop without further tuning.

---

## File Map

- Modify `scripts/rosebud_morph.py`: complete optional tip profile, tip guide helper, and tip-local guide-line interpolation.
- Modify `scripts/check_rosebud_morph.py`: RED/GREEN tip-local, continuity, validation, and single-ring regression checks.
- Modify `scripts/prepare_rose_bloom.py`: exact primary profile, nested-radius validation, and single blend-start fallback.
- Regenerate `src/model/rose.glb` and `public/models/rose.glb`.
- Modify `scripts/check-rose-animation.ts` and `src/lib/rose-animation.ts`: cache key `tip-local-bud-1`.
- Reuse `scripts/verify-rose-glb.mjs` and `scripts/verify_rose_bloom_geometry.py` unchanged.

### Task 1: Replace full-petal alternates with tip-local blending

**Files:**
- Modify: `scripts/check_rosebud_morph.py`
- Modify: `scripts/rosebud_morph.py`

**Interfaces:**
- Produces: `MorphSettings(..., tip_guide_radius_ratio=None, tip_guide_height_ratio=None, alternate_tip_guide_radius_ratio=None, alternate_tip_guide_height_ratio=None, tip_blend_start=None)`.
- Produces: `compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index) -> Vector | None`.
- Retains: `compute_guide_point(...) -> Vector` as the body-guide API.
- Retains: `generate_bud_world_positions(...) -> tuple[list[Vector], list[float]]`.

- [ ] **Step 1: Write the tip-local RED checks first**

Import `compute_tip_guide_point`. Replace the current `nested` fixture with:

```python
tip_local = MorphSettings(
    opening_frame=34,
    bend_radians=math.radians(38.0),
    guide_radius_ratio=0.12,
    guide_height_ratio=1.05,
    guide_pull=0.90,
    angular_offset_radians=math.radians(3.0),
    tip_guide_radius_ratio=0.04,
    tip_guide_height_ratio=1.10,
    alternate_tip_guide_radius_ratio=0.09,
    alternate_tip_guide_height_ratio=1.04,
    tip_blend_start=0.65,
)
origin = Vector((1.0, 0.0, 0.0))
centroid = Vector((1.2, 0.0, 1.0))
flower_center = Vector((0.0, 0.0, 0.5))
maximum_radius = 2.0
growth = centroid - origin

body_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 2)
body_odd = compute_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 3)
tip_even = compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 2)
tip_odd = compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 3)
assert tip_even is not None and tip_odd is not None
assert abs(math.hypot(body_even.x, body_even.y) - maximum_radius * 0.12) <= 1e-6
assert abs(math.hypot(body_odd.x, body_odd.y) - maximum_radius * 0.12) <= 1e-6
assert abs(math.hypot(tip_even.x, tip_even.y) - maximum_radius * 0.04) <= 1e-6
assert abs(math.hypot(tip_odd.x, tip_odd.y) - maximum_radius * 0.09) <= 1e-6
assert abs(tip_even.z - (origin.z + growth.length * 1.10)) <= 1e-6
assert abs(tip_odd.z - (origin.z + growth.length * 1.04)) <= 1e-6
```

Prove the body remains identical through the blend boundary:

```python
single = MorphSettings(34, math.radians(38.0), 0.12, 1.05, 0.90, math.radians(3.0))
sample_points = [
    origin + growth * 0.05,
    origin + growth * 0.50,
    origin + growth * 0.65,
    origin + growth,
]
single_closed, single_parameters = generate_bud_world_positions(
    sample_points, origin, flower_center, centroid, maximum_radius, single, 2
)
tip_closed, tip_parameters = generate_bud_world_positions(
    sample_points, origin, flower_center, centroid, maximum_radius, tip_local, 2
)
assert single_parameters == tip_parameters
assert (single_closed[1] - tip_closed[1]).length <= 1e-6
assert (single_closed[2] - tip_closed[2]).length <= 1e-6
assert (single_closed[3] - tip_closed[3]).length > 1e-4
assert compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, single, 2) is None
```

Add complete-profile validation:

```python
tip_values = (0.04, 1.10, 0.09, 1.04, 0.65)
for missing_index in range(len(tip_values)):
    incomplete = list(tip_values)
    incomplete[missing_index] = None
    settings = MorphSettings(34, 0.1, 0.12, 1.05, 0.90, 0.0, *incomplete)
    try:
        compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, settings, 0)
    except ValueError as error:
        assert 'tip guide settings must be provided together' in str(error).lower()
    else:
        raise AssertionError('Partial tip guide settings must fail')

for invalid_start in (ROOT_LOCK_END, 1.0, float('nan')):
    settings = MorphSettings(34, 0.1, 0.12, 1.05, 0.90, 0.0, 0.04, 1.10, 0.09, 1.04, invalid_start)
    try:
        compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, settings, 0)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid tip blend start must fail')
```

Retain smoothstep, root-lock, finite-output, invalid-body-settings, invalid-radius, closer-to-body-guide, and degenerate-growth checks.

- [ ] **Step 2: Run Blender math and verify RED**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
```

Expected: nonzero exit because the tip-local keyword fields and `compute_tip_guide_point` do not exist.

- [ ] **Step 3: Replace the settings fields**

Replace the two `alternate_guide_*` fields with:

```python
tip_guide_radius_ratio: float | None = None
tip_guide_height_ratio: float | None = None
alternate_tip_guide_radius_ratio: float | None = None
alternate_tip_guide_height_ratio: float | None = None
tip_blend_start: float | None = None
```

- [ ] **Step 4: Share guide construction and implement tip validation**

Extract the current sector, parity rotation, growth-length, and vector construction into:

```python
def _compute_guide_point_for_ratios(
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    radius_ratio: float,
    height_ratio: float,
    angular_offset_radians: float,
    petal_index: int,
) -> Vector:
    sector = Vector((centroid.x - flower_center.x, centroid.y - flower_center.y, 0.0))
    if sector.length_squared <= EPSILON:
        raise ValueError('Petal sector direction is degenerate')
    sector.normalize()
    sign = -1.0 if petal_index % 2 else 1.0
    sector = Quaternion(Vector((0.0, 0.0, 1.0)), angular_offset_radians * sign) @ sector
    growth_length = (centroid - origin).length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    return Vector((
        flower_center.x + sector.x * maximum_radius * radius_ratio,
        flower_center.y + sector.y * maximum_radius * radius_ratio,
        origin.z + growth_length * height_ratio,
    ))
```

`compute_guide_point` keeps existing base validation and calls this helper with the body ratios. Add:

```python
def compute_tip_guide_point(
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    settings: MorphSettings,
    petal_index: int,
) -> Vector | None:
    values = (
        settings.tip_guide_radius_ratio,
        settings.tip_guide_height_ratio,
        settings.alternate_tip_guide_radius_ratio,
        settings.alternate_tip_guide_height_ratio,
        settings.tip_blend_start,
    )
    if all(value is None for value in values):
        return None
    if any(value is None for value in values):
        raise ValueError('Tip guide settings must be provided together')
    if not all(math.isfinite(value) for value in values):
        raise ValueError('Tip guide settings must be finite')
    even_radius, even_height, odd_radius, odd_height, blend_start = values
    if not 0.0 < even_radius <= 1.0 or not 0.0 < odd_radius <= 1.0:
        raise ValueError('Tip guide radius ratios must be in (0, 1]')
    if even_height <= 0.0 or odd_height <= 0.0:
        raise ValueError('Tip guide height ratios must be positive')
    if not ROOT_LOCK_END < blend_start < 1.0:
        raise ValueError('Tip blend start must be between root lock and 1')
    compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index)
    radius_ratio = odd_radius if petal_index % 2 else even_radius
    height_ratio = odd_height if petal_index % 2 else even_height
    return _compute_guide_point_for_ratios(
        origin, flower_center, centroid, maximum_radius,
        radius_ratio, height_ratio, settings.angular_offset_radians, petal_index,
    )
```

- [ ] **Step 5: Blend only the guide line after the configured start**

In `generate_bud_world_positions`, rename `guide` to `body_guide`, compute `tip_guide`, and keep `desired`/`bend_axis` based only on `body_guide`. Replace guide-line construction inside the loop with:

```python
body_line_point = origin + (body_guide - origin) * parameter
guide_line_point = body_line_point
if tip_guide is not None:
    tip_blend = smoothstep01(
        (parameter - settings.tip_blend_start) / (1.0 - settings.tip_blend_start)
    )
    tip_line_point = origin + (tip_guide - origin) * parameter
    guide_line_point = body_line_point.lerp(tip_line_point, tip_blend)
curved += (guide_line_point - curved) * (settings.guide_pull * weight)
```

- [ ] **Step 6: Run Blender math and verify GREEN**

Run Step 2. Expected: `PASS: rosebud morph deformation math verified` and exit `0`.

- [ ] **Step 7: Commit tip-local math**

```bash
git add scripts/rosebud_morph.py scripts/check_rosebud_morph.py
git commit -m "feat: blend nested guides at rose petal tips"
```

### Task 2: Generate and verify the tip-local rosebud

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:41-45, 286-330`
- Regenerate: `src/model/rose.glb`
- Regenerate: `public/models/rose.glb`

**Interfaces:**
- Consumes: complete optional tip profile from Task 1.
- Produces: unchanged 25-node, weights-only `RoseBloom` GLB contract.
- Primary start is `0.65`; fallback changes only that value to `0.75` after geometry failure.

- [ ] **Step 1: Replace failed full-petal working-tree profile with the primary tip-local profile**

```python
MORPH_SETTINGS = {
    "outer": MorphSettings(1, math.radians(12.0), 0.50, 0.75, 0.30, math.radians(1.0)),
    "middle": MorphSettings(18, math.radians(24.0), 0.30, 0.90, 0.45, math.radians(2.0)),
    "inner": MorphSettings(
        34,
        math.radians(38.0),
        0.12,
        1.05,
        0.90,
        math.radians(3.0),
        tip_guide_radius_ratio=0.04,
        tip_guide_height_ratio=1.10,
        alternate_tip_guide_radius_ratio=0.09,
        alternate_tip_guide_height_ratio=1.04,
        tip_blend_start=0.65,
    ),
}
```

Validate:

```python
outer_radius = MORPH_SETTINGS["outer"].guide_radius_ratio
middle_radius = MORPH_SETTINGS["middle"].guide_radius_ratio
inner_body_radius = MORPH_SETTINGS["inner"].guide_radius_ratio
inner_odd_tip = MORPH_SETTINGS["inner"].alternate_tip_guide_radius_ratio
inner_even_tip = MORPH_SETTINGS["inner"].tip_guide_radius_ratio
if inner_odd_tip is None or inner_even_tip is None:
    raise RuntimeError('Inner tip guide radii are required')
if not outer_radius > middle_radius > inner_body_radius > inner_odd_tip > inner_even_tip > 0.0:
    raise RuntimeError(
        'Guide radii must descend outer > middle > inner body > odd tip > even tip; '
        f'found {[outer_radius, middle_radius, inner_body_radius, inner_odd_tip, inner_even_tip]}'
    )
```

- [ ] **Step 2: Generate primary and run focused gates individually**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: all exit `0`; 13 frames remain at or below `80 / 40,000`, rotation `0.00°`, and destinations compare equal. If geometry alone fails, record exact evidence and continue to Step 3. Any other failure stops without fallback.

- [ ] **Step 3: Use the sole blend-start fallback only after primary geometry failure**

Change only:

```python
tip_blend_start=0.75,
```

Rerun all Step 2 commands. If any gate fails, report `BLOCKED` and stop without tuning.

- [ ] **Step 4: Run the selected profile a second time**

Run the generator again, followed by contract, morph math, geometry, and `cmp` commands from Step 2. Expected: all pass with the same profile, 25 `Bud` targets, unchanged final bounds, all 13 frames within limits, and byte-identical destinations. Cross-run byte identity is not required.

- [ ] **Step 5: Commit selected profile and assets**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: close rosebud with tip-local rings"
```

### Task 3: Refresh cache and repeat strict real-time visual acceptance

**Files:**
- Modify: `scripts/check-rose-animation.ts:30`
- Modify: `src/lib/rose-animation.ts:3`
- Test artifacts: `output/playwright/tip-local-bud-first.png`, `tip-local-bud-middle.png`, `tip-local-bud-final.png`, `tip-local-bud-reopen.png`.

**Interfaces:**
- Consumes: selected passing GLB from Task 2 and unchanged runtime timing.
- Produces: `/models/rose.glb?v=tip-local-bud-1` and four visual evidence files.

- [ ] **Step 1: Run cache-key RED/GREEN**

Set the test assertion to:

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=tip-local-bud-1");
```

Run `npm run check:rose-animation` and require failure against `guided-bud-1`. Then set production:

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=tip-local-bud-1";
```

Rerun and require PASS.

- [ ] **Step 2: Run the complete automated suite**

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

Expected: every command exits `0`; only the existing nonfatal Vite chunk-size warning is allowed.

- [ ] **Step 3: Capture first, middle, and final with the real timing**

Use `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh`, a fresh Vite server at `127.0.0.1:3000`, headed mode, and fresh snapshots before element refs. Complete welcome, trigger five rapid title-parent clicks, use the same cached-model offset, and capture first no earlier than the established approximately `5.3s` trigger time.

Save and open at original resolution:

```text
output/playwright/tip-local-bud-first.png
output/playwright/tip-local-bud-middle.png
output/playwright/tip-local-bud-final.png
```

First passes only with no obvious dark center hole or mature annular spiral, a wrapped middle, and outer petals slightly open without downward spread. Middle must open outside-in with continuous, shard-free surfaces. Final must match the existing mature rose.

- [ ] **Step 4: Capture reopen at the same first-stable time**

Close, repeat the same trigger, wait the same time, and save/open:

```text
output/playwright/tip-local-bud-reopen.png
```

It must reproduce the qualified bud rather than the final pose. Stop browser and Vite afterward.

If any visual gate fails, retain screenshots, report `BLOCKED`, do not change timing or parameters, and do not commit the cache key.

- [ ] **Step 5: Commit cache key only after visual PASS**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: load tip-local rosebud model"
```
