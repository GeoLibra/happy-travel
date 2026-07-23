# Rosebud Nested Inner Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single annular inner guide with deterministic nested inner rings and lightly restrain the outer ring so the real first-stable rose reads as a natural bud.

**Architecture:** Extend the existing guide-point settings with an optional alternate radius and height selected by petal-index parity. Keep the current per-petal angular sector, root lock, one `Bud` target per physical petal, weights-only animation, runtime timing, and final open `Basis`; regenerate only the closed morph target and advance the cache key.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`), glTF morph targets, Node/TypeScript checks, Three.js, Vite, headed Playwright CLI.

## Global Constraints

- Primary inner even ring is radius `0.04`, height `1.10`; primary inner odd ring is radius `0.09`, height `1.04`.
- Primary outer ring is radius `0.48`, height `0.75`, bend `12°`, guide pull `0.35`, and angular offset `±1°`.
- Middle remains radius `0.30`, height `0.90`, bend `24°`, guide pull `0.45`, and angular offset `±2°`.
- Inner bend remains `38°`, guide pull remains `0.90`, and angular offset remains `±3°`.
- Inner petals keep their own angular sectors; no petal targets a shared horizontal center point.
- The only allowed geometry fallback is inner even `0.05 / 1.08`, inner odd `0.10 / 1.03`, and outer radius/pull `0.50 / 0.30`.
- The fallback may be used only after the primary profile fails an automated geometry threshold; visual failure never authorizes the fallback.
- Root zone `t <= 0.15` moves by at most `1e-5`; object transforms remain unanimated.
- Existing layer opening frames, runtime timing, final open `Basis`, 25 `Bud` targets, weights-only contract, and final bound tolerance `1e-4` remain unchanged.
- Every sampled frame remains at or below `80` intersecting pairs and `40,000` triangle overlaps with zero meaningful object rotation.
- The two generated GLB destinations remain byte-identical after each generation.
- Browser acceptance uses the real trigger and first-stable timing; screenshots may not be taken early to hide an invalid early-bloom state.
- First and reopen must have no obvious center hole or mature annular spiral, a wrapped middle, and slightly open outer petals that do not spread downward; middle remains continuous and shard-free; final remains unchanged.
- If the selected profile fails visual acceptance or the single fallback fails any gate, stop without further parameter tuning.

---

## File Map

- Modify `scripts/rosebud_morph.py`: optional alternate guide radius/height and parity selection.
- Modify `scripts/check_rosebud_morph.py`: RED/GREEN checks for nested rings and single-ring regression.
- Modify `scripts/prepare_rose_bloom.py`: exact primary profile, descending nested-radius validation, and conditional specified fallback.
- Regenerate `src/model/rose.glb` and `public/models/rose.glb`.
- Modify `scripts/check-rose-animation.ts` and `src/lib/rose-animation.ts`: cache key `nested-bud-1`.
- Reuse `scripts/verify-rose-glb.mjs` and `scripts/verify_rose_bloom_geometry.py` unchanged as contract and geometry gates.

### Task 1: Add optional nested guide-ring math

**Files:**
- Modify: `scripts/check_rosebud_morph.py`
- Modify: `scripts/rosebud_morph.py`

**Interfaces:**
- Produces: `MorphSettings(..., alternate_guide_radius_ratio: float | None = None, alternate_guide_height_ratio: float | None = None)`.
- Retains: `compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index) -> Vector`.
- Retains: `generate_bud_world_positions(...) -> tuple[list[Vector], list[float]]`.
- Selection rule: even `petal_index` uses the primary radius/height; odd `petal_index` uses both alternate values when present.

- [ ] **Step 1: Write nested-ring RED checks first**

Extend the imports with no new production-only helper. Replace the main nested settings fixture with:

```python
nested = MorphSettings(
    opening_frame=34,
    bend_radians=math.radians(38.0),
    guide_radius_ratio=0.04,
    guide_height_ratio=1.10,
    guide_pull=0.90,
    angular_offset_radians=math.radians(3.0),
    alternate_guide_radius_ratio=0.09,
    alternate_guide_height_ratio=1.04,
)
origin = Vector((1.0, 0.0, 0.0))
centroid = Vector((1.2, 0.0, 1.0))
flower_center = Vector((0.0, 0.0, 0.5))
maximum_radius = 2.0

even_guide = compute_guide_point(origin, flower_center, centroid, maximum_radius, nested, 2)
odd_guide = compute_guide_point(origin, flower_center, centroid, maximum_radius, nested, 3)
even_radius = math.hypot(even_guide.x - flower_center.x, even_guide.y - flower_center.y)
odd_radius = math.hypot(odd_guide.x - flower_center.x, odd_guide.y - flower_center.y)
growth_length = (centroid - origin).length
assert abs(even_radius - maximum_radius * 0.04) <= 1e-6
assert abs(odd_radius - maximum_radius * 0.09) <= 1e-6
assert abs(even_guide.z - (origin.z + growth_length * 1.10)) <= 1e-6
assert abs(odd_guide.z - (origin.z + growth_length * 1.04)) <= 1e-6
assert (Vector((even_guide.x, even_guide.y)) - Vector((odd_guide.x, odd_guide.y))).length > 0.05
```

Add a single-ring regression and partial-alternate validation:

```python
single = MorphSettings(18, math.radians(24.0), 0.30, 0.90, 0.45, math.radians(2.0))
single_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, single, 2)
single_odd = compute_guide_point(origin, flower_center, centroid, maximum_radius, single, 3)
assert abs(math.hypot(single_even.x, single_even.y) - 0.60) <= 1e-6
assert abs(math.hypot(single_odd.x, single_odd.y) - 0.60) <= 1e-6

for incomplete in (
    MorphSettings(34, 0.1, 0.04, 1.10, 0.90, 0.0, 0.09, None),
    MorphSettings(34, 0.1, 0.04, 1.10, 0.90, 0.0, None, 1.04),
):
    try:
        compute_guide_point(origin, flower_center, centroid, maximum_radius, incomplete, 0)
    except ValueError as error:
        assert 'alternate guide radius and height' in str(error).lower()
    else:
        raise AssertionError('Partial alternate guide settings must fail')
```

Retain the existing root-lock, closer-to-guide, finite-output, invalid-base-settings, and degenerate-growth assertions.

- [ ] **Step 2: Run the Blender math check and verify RED**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
```

Expected: nonzero exit because `MorphSettings` does not accept the alternate fields.

- [ ] **Step 3: Extend the immutable settings model**

Append defaulted fields after the existing required fields:

```python
@dataclass(frozen=True)
class MorphSettings:
    opening_frame: int
    bend_radians: float
    guide_radius_ratio: float
    guide_height_ratio: float
    guide_pull: float
    angular_offset_radians: float
    alternate_guide_radius_ratio: float | None = None
    alternate_guide_height_ratio: float | None = None
```

- [ ] **Step 4: Validate and select one complete guide profile**

In `compute_guide_point`, replace direct radius/height use with:

```python
alternate_values = (
    settings.alternate_guide_radius_ratio,
    settings.alternate_guide_height_ratio,
)
if (alternate_values[0] is None) != (alternate_values[1] is None):
    raise ValueError('Alternate guide radius and height must be provided together')
if alternate_values[0] is not None:
    if not all(math.isfinite(value) for value in alternate_values):
        raise ValueError('Alternate guide settings must be finite')
    if not 0.0 < alternate_values[0] <= 1.0:
        raise ValueError('Alternate guide radius ratio must be in (0, 1]')
    if alternate_values[1] <= 0.0:
        raise ValueError('Alternate guide height ratio must be positive')

use_alternate = alternate_values[0] is not None and petal_index % 2 == 1
guide_radius_ratio = alternate_values[0] if use_alternate else settings.guide_radius_ratio
guide_height_ratio = alternate_values[1] if use_alternate else settings.guide_height_ratio
```

Use `guide_radius_ratio` and `guide_height_ratio` in the returned vector. Keep the existing parity sign for angular offset, sector validation, growth validation, and finite base settings validation.

- [ ] **Step 5: Run the Blender math check and verify GREEN**

Run the Step 2 command.

Expected: `PASS: rosebud morph deformation math verified` and exit `0`.

- [ ] **Step 6: Commit nested guide math**

```bash
git add scripts/rosebud_morph.py scripts/check_rosebud_morph.py
git commit -m "feat: alternate rosebud inner guide rings"
```

### Task 2: Generate and verify the nested-ring rosebud

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:41-45, 286-330`
- Regenerate: `src/model/rose.glb`
- Regenerate: `public/models/rose.glb`
- Test: existing GLB contract, morph math, and geometry verifier.

**Interfaces:**
- Consumes: alternate settings fields from Task 1.
- Produces: unchanged 25-node, weights-only `RoseBloom` GLB contract with revised `Bud` positions.
- Primary profile is attempted first; the exact fallback may replace it only after a recorded primary geometry failure.

- [ ] **Step 1: Install the exact primary profile**

Use:

```python
MORPH_SETTINGS = {
    "outer": MorphSettings(1, math.radians(12.0), 0.48, 0.75, 0.35, math.radians(1.0)),
    "middle": MorphSettings(18, math.radians(24.0), 0.30, 0.90, 0.45, math.radians(2.0)),
    "inner": MorphSettings(
        34,
        math.radians(38.0),
        0.04,
        1.10,
        0.90,
        math.radians(3.0),
        alternate_guide_radius_ratio=0.09,
        alternate_guide_height_ratio=1.04,
    ),
}
```

Replace the existing radius validation with:

```python
outer_radius = MORPH_SETTINGS["outer"].guide_radius_ratio
middle_radius = MORPH_SETTINGS["middle"].guide_radius_ratio
inner_even_radius = MORPH_SETTINGS["inner"].guide_radius_ratio
inner_odd_radius = MORPH_SETTINGS["inner"].alternate_guide_radius_ratio
if inner_odd_radius is None:
    raise RuntimeError('Inner nested guide radius is required')
if not outer_radius > middle_radius > inner_odd_radius > inner_even_radius > 0.0:
    raise RuntimeError(
        'Guide radii must descend outer > middle > inner odd > inner even; '
        f'found {[outer_radius, middle_radius, inner_odd_radius, inner_even_radius]}'
    )
```

- [ ] **Step 2: Run primary generation and focused gates one command at a time**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: all exit `0`; all 13 frames are at or below `80 / 40,000` with rotation `0.00°` and both GLBs compare equal.

If the geometry verifier fails, record the exact frame and values, then continue only with Step 3. If generation, contract, math, root, final-pose, or `cmp` fails, stop without using the fallback.

- [ ] **Step 3: Use the single fallback only after primary geometry failure**

Skip this step when primary geometry passes. Otherwise replace only these values:

```python
"outer": MorphSettings(1, math.radians(12.0), 0.50, 0.75, 0.30, math.radians(1.0)),
"inner": MorphSettings(
    34,
    math.radians(38.0),
    0.05,
    1.08,
    0.90,
    math.radians(3.0),
    alternate_guide_radius_ratio=0.10,
    alternate_guide_height_ratio=1.03,
),
```

Rerun every Step 2 command from generation onward. Expected: all pass. If any fallback gate fails, stop and report `BLOCKED`; do not tune again.

- [ ] **Step 4: Verify functional idempotence for the selected profile**

Run the selected profile's generator a second time, then run:

```bash
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: identical pass/fail profile selection, 25 `Bud` targets, zero final weights, unchanged final bounds, all 13 geometry samples within limits, and byte-identical destinations. Cross-run byte identity is not required.

- [ ] **Step 5: Commit the selected profile and assets**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: close rosebud with nested inner rings"
```

### Task 3: Refresh cache and run strict real-time browser acceptance

**Files:**
- Modify: `scripts/check-rose-animation.ts:30`
- Modify: `src/lib/rose-animation.ts:3`
- Test artifacts: `output/playwright/nested-bud-first.png`, `nested-bud-middle.png`, `nested-bud-final.png`, `nested-bud-reopen.png`.

**Interfaces:**
- Consumes: selected nested-ring GLB from Task 2 and unchanged runtime animation timing.
- Produces: `/models/rose.glb?v=nested-bud-1` plus four visual evidence files.

- [ ] **Step 1: Run cache-key RED/GREEN**

Change the assertion first:

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=nested-bud-1");
```

Run `npm run check:rose-animation` and require a failure against the current `guided-bud-1`. Then change production:

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=nested-bud-1";
```

Rerun and require `PASS: rose assembly, handoff, bloom, and presentation timing verified`.

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

- [ ] **Step 3: Capture the real first sequence with headed Playwright CLI**

Use `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh`. Start a fresh Vite server on `127.0.0.1:3000`, open headed, snapshot before using element refs, complete welcome, snapshot again, and trigger the same five rapid title-parent clicks.

Use the established real first-stable timing from the trigger and cached-model load; do not capture earlier than the previous `guided-bud-first` acceptance time. Save:

```text
output/playwright/nested-bud-first.png
output/playwright/nested-bud-middle.png
output/playwright/nested-bud-final.png
```

Open all three at original resolution. First passes only with no obvious dark center hole or mature annular spiral, a wrapped middle, and outer petals that are slightly open without downward spread. Middle must open outside-in with continuous surfaces and no shards. Final must match the existing mature open rose.

- [ ] **Step 4: Capture the reopen sequence**

Close the final pose, repeat the same trigger, wait the same first-stable time, and save:

```text
output/playwright/nested-bud-reopen.png
```

Open at original resolution. It must reproduce the qualified first bud rather than resume final. Stop browser and Vite after capture.

If first or reopen fails the center/outer criteria, or any image shows shards or a changed final, report `BLOCKED`, retain screenshots, do not alter timing, do not use the geometry fallback for a visual failure, and do not commit the cache-key change.

- [ ] **Step 5: Commit the cache key only after visual PASS**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: load nested-ring rosebud model"
```
