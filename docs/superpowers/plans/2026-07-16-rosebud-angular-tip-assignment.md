# Rosebud Angular Tip Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spatially alternate the approved nested tip guides by inner-petal circular order so the tip-local rosebud returns within the fixed pair gate and closes naturally.

**Architecture:** Add a pure deterministic angular-ranking helper, compute layer membership and inner ranks before the generator loop, and pass a spatial `guide_index` separately from the unchanged animation index. Keep all approved body/tip parameters, tip-local interpolation, opening timing, final open pose, and verification thresholds unchanged.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`), glTF morph targets, Node/TypeScript checks, Three.js, Vite, headed Playwright CLI.

## Global Constraints

- Rank inner petals by ascending `atan2(centroid.y - center.y, centroid.x - center.x)` with petal name as deterministic tie-breaker.
- The eight inner ranks `0…7` alternate small/even and large/odd tip profiles, including opposite parity at the `7 -> 0` wrap.
- Inner angular rank controls tip selection and the existing `±3°` guide offset only.
- Existing object index continues to control `(index % 5) * 2` opening stagger; timing is unchanged.
- Outer and middle continue using their existing object index as guide index.
- Inner body remains `0.12 / 1.05`, even tip `0.04 / 1.10`, odd tip `0.09 / 1.04`, bend `38°`, pull `0.90`, offset `±3°`.
- Primary tip blend start remains `0.65`; only geometry failure authorizes the sole `0.75` fallback.
- Outer remains radius `0.50`, height `0.75`, bend `12°`, pull `0.30`, offset `±1°`; middle remains `0.30 / 0.90 / 24° / 0.45 / ±2°`.
- Root zone `t <= 0.15` moves by at most `1e-5`; transforms stay unanimated; opening frames, runtime timing, final `Basis`, 25 `Bud` targets, weights-only contract, and `1e-4` final-bound tolerance remain unchanged.
- Every sampled frame stays at or below `80` intersecting pairs and `40,000` triangle overlaps with zero meaningful object rotation.
- Both GLB destinations remain byte-identical after each generation.
- Browser first/reopen use the real approximately `5.3s` capture time and must have no obvious dark center hole or mature annular spiral, a wrapped middle, and slightly open outer petals without downward spread.
- Middle stays continuous and shard-free; final stays unchanged; no earlier screenshot or timing change is allowed.
- If the `0.75` fallback fails geometry or the selected profile fails visual acceptance, stop without manual reordering or parameter tuning.

---

## File Map

- Modify `scripts/rosebud_morph.py`: pure angular guide-index ranking.
- Modify `scripts/check_rosebud_morph.py`: shuffled-order, parity, and invalid-input RED/GREEN checks.
- Modify `scripts/prepare_rose_bloom.py`: precomputed layers and separate animation/guide indices.
- Regenerate `src/model/rose.glb` and `public/models/rose.glb`.
- Modify `scripts/check-rose-animation.ts` and `src/lib/rose-animation.ts`: cache key `angular-tip-bud-1`.
- Reuse existing GLB and geometry verifiers unchanged.

### Task 1: Add deterministic angular guide ranking

**Files:**
- Modify: `scripts/check_rosebud_morph.py`
- Modify: `scripts/rosebud_morph.py`

**Interfaces:**
- Produces: `compute_angular_guide_indices(named_centroids: list[tuple[str, Vector]], flower_center: Vector) -> dict[str, int]`.
- Consumed by Task 2 for the inner subset only.
- Existing guide and deformation interfaces remain unchanged.

- [ ] **Step 1: Write angular-ranking RED checks first**

Import `compute_angular_guide_indices` and add:

```python
circle_points = [
    ('ne', Vector((1.0, 1.0, 0.5))),
    ('w', Vector((-1.0, 0.0, 0.5))),
    ('se', Vector((1.0, -1.0, 0.5))),
    ('n', Vector((0.0, 1.0, 0.5))),
    ('sw', Vector((-1.0, -1.0, 0.5))),
    ('e', Vector((1.0, 0.0, 0.5))),
    ('nw', Vector((-1.0, 1.0, 0.5))),
    ('s', Vector((0.0, -1.0, 0.5))),
]
angular_indices = compute_angular_guide_indices(circle_points, Vector((0.0, 0.0, 0.5)))
expected_order = ['sw', 's', 'se', 'e', 'ne', 'n', 'nw', 'w']
assert [name for name, _ in sorted(angular_indices.items(), key=lambda item: item[1])] == expected_order
assert angular_indices == compute_angular_guide_indices(list(reversed(circle_points)), Vector((0.0, 0.0, 0.5)))
for rank in range(len(expected_order)):
    assert rank % 2 != ((rank + 1) % len(expected_order)) % 2
```

Add invalid cases:

```python
invalid_rank_inputs = (
    [],
    [('same', Vector((1.0, 0.0, 0.0))), ('same', Vector((-1.0, 0.0, 0.0)))],
    [('center', Vector((0.0, 0.0, 0.0))), ('e', Vector((1.0, 0.0, 0.0)))],
    [('nan', Vector((float('nan'), 1.0, 0.0))), ('e', Vector((1.0, 0.0, 0.0)))],
    [('a', Vector((1.0, 0.0, 0.0))), ('b', Vector((0.0, 1.0, 0.0))), ('c', Vector((-1.0, 0.0, 0.0)))],
)
for invalid in invalid_rank_inputs:
    try:
        compute_angular_guide_indices(invalid, Vector((0.0, 0.0, 0.0)))
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid angular guide input must fail')

try:
    compute_angular_guide_indices(circle_points, Vector((float('inf'), 0.0, 0.0)))
except ValueError:
    pass
else:
    raise AssertionError('Non-finite flower center must fail')
```

Retain all tip-local, blend-boundary, root-lock, finite, and degenerate regressions.

- [ ] **Step 2: Run Blender math and verify RED**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
```

Expected: nonzero exit because `compute_angular_guide_indices` does not exist.

- [ ] **Step 3: Implement the pure ranking helper**

Add to `scripts/rosebud_morph.py`:

```python
def compute_angular_guide_indices(
    named_centroids: list[tuple[str, Vector]],
    flower_center: Vector,
) -> dict[str, int]:
    if not named_centroids:
        raise ValueError('Angular guide ranking requires petals')
    if len(named_centroids) % 2 != 0:
        raise ValueError('Angular guide ranking requires an even petal count')
    if not all(math.isfinite(component) for component in flower_center):
        raise ValueError('Flower center must be finite')
    names = [name for name, _ in named_centroids]
    if len(set(names)) != len(names):
        raise ValueError('Angular guide ranking requires unique names')
    ranked = []
    for name, centroid in named_centroids:
        if not all(math.isfinite(component) for component in centroid):
            raise ValueError('Petal centroid must be finite')
        dx = centroid.x - flower_center.x
        dy = centroid.y - flower_center.y
        if dx * dx + dy * dy <= EPSILON:
            raise ValueError('Petal angular sector is degenerate')
        ranked.append((math.atan2(dy, dx), name))
    ranked.sort(key=lambda item: (item[0], item[1]))
    return {name: rank for rank, (_, name) in enumerate(ranked)}
```

- [ ] **Step 4: Run Blender math and verify GREEN**

Run Step 2. Expected: `PASS: rosebud morph deformation math verified`, exit `0`.

- [ ] **Step 5: Commit ranking math**

```bash
git add scripts/rosebud_morph.py scripts/check_rosebud_morph.py
git commit -m "feat: rank rosebud tips by circular order"
```

### Task 2: Integrate spatial guide indices and regenerate assets

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:22, 286-350`
- Regenerate: `src/model/rose.glb`
- Regenerate: `public/models/rose.glb`

**Interfaces:**
- Consumes: `compute_angular_guide_indices` from Task 1.
- Produces: unchanged 25-node weights-only GLB contract using spatial inner guide indices.
- Animation index remains separate and unchanged.

- [ ] **Step 1: Import the ranking helper and precompute layers before the loop**

Extend the import from `rosebud_morph`. After radius validation, add:

```python
layers = {}
for petal in petals:
    normalized_radius = radial[petal] / max_radius
    layers[petal] = 'outer' if normalized_radius >= 0.66 else 'middle' if normalized_radius >= 0.33 else 'inner'

inner_petals = [petal for petal in petals if layers[petal] == 'inner']
if len(inner_petals) != 8:
    raise RuntimeError(f'Expected 8 inner petals for circular alternation, found {len(inner_petals)}')
inner_guide_indices = compute_angular_guide_indices(
    [(petal.name, centers[petal]) for petal in inner_petals],
    flower_center,
)
```

- [ ] **Step 2: Separate animation and guide indices**

Inside the loop, use:

```python
for animation_index, petal in enumerate(petals):
    layer = layers[petal]
    settings = MORPH_SETTINGS[layer]
    guide_index = inner_guide_indices[petal.name] if layer == 'inner' else animation_index
    stagger = (animation_index % 5) * 2
```

Pass `guide_index` as the final argument to `generate_bud_world_positions`. Remove the old in-loop layer calculation. Do not change opening-frame or stagger formulas.

- [ ] **Step 3: Restore and generate the primary `0.65` profile**

Ensure the existing approved values remain exact and set only:

```python
tip_blend_start=0.65,
```

Run individually:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: all pass; every one of 13 frames is at or below `80 / 40,000`, rotation `0.00°`, and destinations compare equal. Only a geometry failure authorizes Step 4.

- [ ] **Step 4: Use the sole fallback only after primary geometry failure**

Change only `tip_blend_start=0.75`, regenerate, and rerun all Step 3 gates. If any fallback gate fails, report `BLOCKED` and stop without tuning or manual reordering.

- [ ] **Step 5: Run the selected profile a second time**

Run generation, contract, math, all 13 geometry samples, and `cmp` again. Expected: the same profile passes, 25 `Bud` targets remain, final bounds stay unchanged, and both destinations are byte-identical. Cross-run byte identity is not required.

- [ ] **Step 6: Commit generator and assets**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: alternate rosebud tips in circular order"
```

### Task 3: Refresh cache and run strict browser acceptance

**Files:**
- Modify: `scripts/check-rose-animation.ts:30`
- Modify: `src/lib/rose-animation.ts:3`
- Test artifacts: `output/playwright/angular-tip-bud-first.png`, `angular-tip-bud-middle.png`, `angular-tip-bud-final.png`, `angular-tip-bud-reopen.png`.

**Interfaces:**
- Consumes: spatially assigned GLB from Task 2 and unchanged timing.
- Produces: `/models/rose.glb?v=angular-tip-bud-1` and four screenshots.

- [ ] **Step 1: Run cache RED/GREEN**

Set the test assertion first:

```ts
assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=angular-tip-bud-1");
```

Run `npm run check:rose-animation` and require failure against `guided-bud-1`. Then set production:

```ts
export const ROSE_MODEL_URL = "/models/rose.glb?v=angular-tip-bud-1";
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

Expected: all exit `0`; only the existing nonfatal Vite chunk-size warning is allowed.

- [ ] **Step 3: Capture real-time first, middle, and final**

Use `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh`, a fresh Vite server on `127.0.0.1:3000`, headed mode, and snapshots before refs. Complete welcome, trigger five rapid title-parent clicks, account for cached-model load, and capture first no earlier than approximately `5.3s` after the trigger.

Save/open at original resolution:

```text
output/playwright/angular-tip-bud-first.png
output/playwright/angular-tip-bud-middle.png
output/playwright/angular-tip-bud-final.png
```

First must have no obvious center hole or mature annular spiral, inner tips covering the center, a wrapped middle, and slightly open outer petals without downward spread. Middle must remain continuous and shard-free. Final must match the mature reference.

- [ ] **Step 4: Capture reopen at the same time**

Close, repeat the trigger, wait the same first-stable time, and save/open `output/playwright/angular-tip-bud-reopen.png`. It must reproduce the qualified bud, not final. Stop browser and Vite.

Any visual failure retains screenshots, reports `BLOCKED`, and forbids timing, order, parameter, or threshold changes.

- [ ] **Step 5: Commit cache key only after visual PASS**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: load angular-tip rosebud model"
```
