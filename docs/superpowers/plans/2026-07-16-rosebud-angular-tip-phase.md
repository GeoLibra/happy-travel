# Rosebud Angular Tip Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test the remaining discrete nested-ring phase by assigning angular-rank even petals to the large tip and odd petals to the small tip without changing any continuous parameter.

**Architecture:** Add a pure validated phase application helper, keep angular ranking and animation scheduling separate, set one explicit generator phase constant to `1`, and rerun the unchanged primary/fallback, geometry, contract, cache, and real-time visual gates. If both blend starts fail, terminate the nested-ring route.

**Tech Stack:** Blender 5.1 Python API (`bpy`, `mathutils`), glTF morph targets, Node/TypeScript checks, Three.js, Vite, headed Playwright CLI.

## Global Constraints

- `INNER_GUIDE_PHASE = 1`; inner `guide_index = angular_rank + INNER_GUIDE_PHASE`.
- Angular-rank even uses the large tip `0.09 / 1.04`; angular-rank odd uses the small tip `0.04 / 1.10`.
- Exactly eight inner petals produce four even and four odd phased guide indices; adjacent circular ranks including wrap remain opposite parity.
- Existing object index continues to control opening stagger; outer/middle keep their object index as guide index.
- Inner body stays `0.12 / 1.05 / 38° / 0.90 / ±3°`; outer stays `0.50 / 0.75 / 12° / 0.30 / ±1°`; middle stays `0.30 / 0.90 / 24° / 0.45 / ±2°`.
- Primary blend start stays `0.65`; only geometry failure permits the sole `0.75` fallback.
- Root `t <= 0.15` moves by at most `1e-5`; opening frames, runtime timing, final open `Basis`, 25 `Bud` targets, weights-only contract, and `1e-4` final-bound tolerance remain unchanged.
- All 13 samples remain at or below `80` intersecting pairs and `40,000` triangle overlaps with zero meaningful object rotation.
- Both GLB destinations remain byte-identical after each generation.
- Browser first/reopen use the real approximately `5.3s` capture time and must have no obvious center hole or mature annular spiral, wrapped middle petals, and slightly open outer petals without downward spread.
- Middle stays continuous and shard-free; final stays unchanged; timing and capture time may not change.
- If phased `0.65` and `0.75` both fail geometry, stop the nested-ring route without another phase, order, parameter, threshold, or named-petal exception.

---

## File Map

- Modify `scripts/rosebud_morph.py`: pure phase application helper.
- Modify `scripts/check_rosebud_morph.py`: RED/GREEN phase, parity-count, wrap, and invalid-map tests.
- Modify `scripts/prepare_rose_bloom.py`: phase constant, phased inner map, validations, and diagnostic logging.
- Regenerate `src/model/rose.glb` and `public/models/rose.glb`.
- Modify `scripts/check-rose-animation.ts` and `src/lib/rose-animation.ts`: cache key `angular-tip-phase-bud-1`.
- Reuse all existing verifiers unchanged.

### Task 1: Add validated angular phase application

**Files:**
- Modify: `scripts/check_rosebud_morph.py`
- Modify: `scripts/rosebud_morph.py`

**Interfaces:**
- Produces: `apply_angular_guide_phase(angular_indices: dict[str, int], phase: int) -> dict[str, int]`.
- Consumes: contiguous even-count ranks from `compute_angular_guide_indices`.
- Existing ranking and deformation interfaces remain unchanged.

- [ ] **Step 1: Write phase RED checks first**

Import `apply_angular_guide_phase` and add after the angular-ranking assertions:

```python
phased_indices = apply_angular_guide_phase(angular_indices, 1)
assert apply_angular_guide_phase(angular_indices, 0) == angular_indices
assert set(phased_indices) == set(angular_indices)
for name, rank in angular_indices.items():
    assert phased_indices[name] == rank + 1
    assert phased_indices[name] % 2 != rank % 2
assert sum(index % 2 == 0 for index in phased_indices.values()) == 4
assert sum(index % 2 == 1 for index in phased_indices.values()) == 4

ordered_names = [name for name, _ in sorted(angular_indices.items(), key=lambda item: item[1])]
for position, name in enumerate(ordered_names):
    next_name = ordered_names[(position + 1) % len(ordered_names)]
    assert phased_indices[name] % 2 != phased_indices[next_name] % 2

for invalid_map, invalid_phase in (
    ({}, 1),
    ({'a': 0, 'b': 2}, 1),
    ({'a': 0, 'b': 1, 'c': 2}, 1),
    ({'a': 0, 'b': 1}, -1),
    ({'a': 0, 'b': 1}, 2),
):
    try:
        apply_angular_guide_phase(invalid_map, invalid_phase)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid angular phase input must fail')
```

Retain all ranking, tip-local, root-lock, finite, and degenerate regressions.

- [ ] **Step 2: Run Blender math and verify RED**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
```

Expected: nonzero exit because `apply_angular_guide_phase` does not exist.

- [ ] **Step 3: Implement the pure phase helper**

```python
def apply_angular_guide_phase(
    angular_indices: dict[str, int],
    phase: int,
) -> dict[str, int]:
    if phase not in (0, 1):
        raise ValueError('Angular guide phase must be 0 or 1')
    if not angular_indices:
        raise ValueError('Angular guide phase requires indices')
    ranks = sorted(angular_indices.values())
    if ranks != list(range(len(ranks))):
        raise ValueError('Angular guide ranks must be contiguous from zero')
    if len(ranks) % 2 != 0:
        raise ValueError('Angular guide phase requires an even rank count')
    phased = {name: rank + phase for name, rank in angular_indices.items()}
    parity_counts = [sum(index % 2 == parity for index in phased.values()) for parity in (0, 1)]
    if parity_counts != [len(phased) // 2, len(phased) // 2]:
        raise ValueError('Angular guide phase must split parity evenly')
    ordered = [name for name, _ in sorted(angular_indices.items(), key=lambda item: item[1])]
    for position, name in enumerate(ordered):
        next_name = ordered[(position + 1) % len(ordered)]
        if phased[name] % 2 == phased[next_name] % 2:
            raise ValueError('Adjacent angular guides must alternate parity')
    return phased
```

- [ ] **Step 4: Run Blender math and verify GREEN**

Run Step 2. Expected: `PASS: rosebud morph deformation math verified`, exit `0`.

- [ ] **Step 5: Commit phase math**

```bash
git add scripts/rosebud_morph.py scripts/check_rosebud_morph.py
git commit -m "feat: phase rosebud tip guide assignment"
```

### Task 2: Integrate reversed phase and verify assets

**Files:**
- Modify: `scripts/prepare_rose_bloom.py:22, 39-50, 286-355`
- Regenerate: `src/model/rose.glb`
- Regenerate: `public/models/rose.glb`

**Interfaces:**
- Consumes: `apply_angular_guide_phase` and the existing angular ranks.
- Produces: unchanged 25-node weights-only contract with reversed inner parity.

- [ ] **Step 1: Add the explicit phase and phased map**

Import `apply_angular_guide_phase`. Add beside other constants:

```python
INNER_GUIDE_PHASE = 1
```

After computing `inner_guide_indices`, use:

```python
inner_guide_indices = apply_angular_guide_phase(inner_guide_indices, INNER_GUIDE_PHASE)
even_count = sum(index % 2 == 0 for index in inner_guide_indices.values())
odd_count = sum(index % 2 == 1 for index in inner_guide_indices.values())
if (even_count, odd_count) != (4, 4):
    raise RuntimeError(f'Inner phased guides must split 4/4, found {even_count}/{odd_count}')
for petal in sorted(inner_petals, key=lambda item: inner_guide_indices[item.name]):
    print(
        f'INNER_GUIDE petal={petal.name} '
        f'angular_rank={inner_guide_indices[petal.name] - INNER_GUIDE_PHASE} '
        f'guide_index={inner_guide_indices[petal.name]}'
    )
```

Keep `animation_index` for stagger and pass the phased map value only as inner `guide_index`.

- [ ] **Step 2: Restore primary `tip_blend_start=0.65` and run focused gates**

Run individually:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/check_rosebud_morph.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/verify_rose_bloom_geometry.py
cmp src/model/rose.glb public/models/rose.glb
```

Expected: all pass; 13 frames are at or below `80 / 40,000`, rotation `0.00°`, and destinations compare equal. Only a geometry failure authorizes Step 3.

- [ ] **Step 3: Use the sole `0.75` fallback only after primary geometry failure**

Change only `tip_blend_start=0.75`, regenerate, and rerun every Step 2 gate. If any fallback gate fails, report `BLOCKED` and terminate the nested-ring route.

- [ ] **Step 4: Run the selected profile a second time**

Run generation, contract, math, all 13 geometry frames, and `cmp` again. Expected: the same profile passes, 25 targets and final bounds remain unchanged, and both destinations remain byte-identical.

- [ ] **Step 5: Commit generator and assets**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: reverse rosebud tip guide phase"
```

### Task 3: Refresh cache and run final visual acceptance

**Files:**
- Modify: `scripts/check-rose-animation.ts:30`
- Modify: `src/lib/rose-animation.ts:3`
- Test artifacts: `output/playwright/angular-tip-phase-first.png`, `angular-tip-phase-middle.png`, `angular-tip-phase-final.png`, `angular-tip-phase-reopen.png`.

**Interfaces:**
- Consumes: passing reversed-phase GLB and unchanged timing.
- Produces: `/models/rose.glb?v=angular-tip-phase-bud-1` and four screenshots.

- [ ] **Step 1: Run cache RED/GREEN**

Set the assertion to `/models/rose.glb?v=angular-tip-phase-bud-1`, run `npm run check:rose-animation` and require failure against `guided-bud-1`, then set production to the same new URL and require PASS.

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

- [ ] **Step 3: Capture first, middle, and final at real timing**

Use the headed Playwright CLI, fresh Vite server, snapshots before refs, welcome flow, five-click trigger, cached model, and no-earlier-than approximately `5.3s` first capture. Save/open at original resolution:

```text
output/playwright/angular-tip-phase-first.png
output/playwright/angular-tip-phase-middle.png
output/playwright/angular-tip-phase-final.png
```

First must have no obvious center hole or mature annular spiral, a wrapped middle, and slightly open outer petals without downward spread. Middle must be continuous and shard-free. Final must remain unchanged.

- [ ] **Step 4: Capture reopen at the same timing**

Close, repeat trigger and timing, save/open `output/playwright/angular-tip-phase-reopen.png`, and require the same qualified bud instead of final. Stop browser and Vite.

Visual failure retains evidence, reports `BLOCKED`, and forbids further phase, ordering, parameter, threshold, timing, or capture changes.

- [ ] **Step 5: Commit cache only after visual PASS**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "chore: load reversed-phase rosebud model"
```
