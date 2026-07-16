# Rosebud Angular Tip Assignment Design

## Context

The tip-local nested-ring architecture reduced frame-1 triangle overlaps below the fixed `40,000` limit, but both approved blend starts retained `81` intersecting petal pairs: `0.65` produced `81 / 37,497`, and `0.75` produced `81 / 37,478`. Both exceed the fixed pair limit by one.

A read-only comparison against the last passing guided-ring asset (`79 / 31,927`) identified the exact topology change. The tip-local asset added inner pairs `Petal_004–Petal_022`, `Petal_005–Petal_022`, and `Petal_012–Petal_022`, while removing middle/inner pair `Petal_017–Petal_024`. All three additions concentrate on `Petal_022`.

The cause is assignment order, not tip radius or blend extent. Physical petal object numbers are not ordered around the flower, so object-index parity does not spatially alternate the small and large tip rings.

## Goal

Assign nested tip profiles in circular order so every adjacent inner petal alternates between the small and large tip rings. Keep the approved tip-local deformation, runtime animation, final open rose, geometry limits, and visual acceptance unchanged.

## Non-Goals

- Do not change body, tip, outer, or middle parameters.
- Do not change primary `tip_blend_start=0.65` or the sole `0.75` fallback.
- Do not change opening stagger, layer opening frames, or runtime timing.
- Do not relax `80 / 40,000` geometry limits.
- Do not special-case `Petal_022` or any named model asset.

## Angular Ranking

After computing open-pose petal centroids, flower center, normalized radial distances, and layer membership, select the inner petals only. For each inner petal compute:

```text
angle = atan2(centroid.y - flowerCenter.y, centroid.x - flowerCenter.x)
```

Sort by `(angle, petal_name)` ascending. The name is a deterministic tie-breaker, not the primary assignment. Assign ranks `0…N-1` in that order.

The inner petal's angular rank becomes its `guide_index`:

- Even rank: small tip radius/height `0.04 / 1.10`.
- Odd rank: large tip radius/height `0.09 / 1.04`.
- The same rank controls the existing alternating `±3°` guide offset.

For eight inner petals, the wrap-around pair ranks `7` and `0` also has opposite parity. If the inner count is odd, generation fails because a closed circular alternation cannot satisfy the invariant.

Outer and middle petals continue using their existing object index as `guide_index`.

## Timing Separation

The existing object index continues to control `(index % 5) * 2` opening stagger. Angular rank must not replace the timing index. This separates spatial guide assignment from animation scheduling and preserves the current clip timing exactly.

## Pure Ranking Interface

Add a pure helper in `rosebud_morph.py`:

```text
compute_angular_guide_indices(named_centroids, flower_center) -> dict[str, int]
```

The helper accepts an iterable of unique `(name, Vector)` pairs and returns stable ranks by name. It rejects:

- Empty input.
- Duplicate names.
- Non-finite center or centroid components.
- A centroid whose horizontal sector from the flower center is degenerate.
- An odd item count, because circular parity would not alternate at the wrap.

Input order does not affect output.

## Generator Integration

The generator computes layer membership for all 25 petals before deformation. It builds angular ranks from the inner subset and verifies the expected inner count remains `8`. Inside the existing petal loop:

- `animation_index` remains the current enumerate index and continues to drive stagger.
- `guide_index` is the angular rank for inner petals and the existing index for outer/middle petals.
- Only `guide_index` is passed to `generate_bud_world_positions`.

No object names, layer membership, shape-key structure, or animation channels change.

## Tests and Gates

Implementation follows RED/GREEN:

1. Add a scrambled eight-point circular fixture and assert stable angular ranks independent of input order.
2. Assert adjacent sorted ranks, including `7 -> 0`, have opposite parity.
3. Assert duplicate names, empty input, non-finite points, degenerate sectors, and odd counts fail.
4. Retain all body/tip guide, blend-boundary, root-lock, finite-output, invalid-settings, and single-ring tests.
5. Regenerate the primary `0.65` asset and run contract, math, all 13 geometry frames, final-pose, and destination `cmp` gates.
6. Use only the unchanged `0.75` fallback after a primary geometry failure.
7. Run the selected profile twice for functional idempotence.
8. Run the complete TypeScript/build/F1/i18n suite and strict real-time browser acceptance.

## Browser Acceptance

Advance the cache key and capture `first`, `middle`, `final`, and `reopen` using the established real trigger, cached model, headed Playwright flow, and approximately `5.3s` first-stable timing.

The first and reopened poses must have no obvious dark center hole or mature annular spiral, inner tips covering the center, a wrapped middle, and slightly open outer petals without downward spread. Middle must remain continuous and shard-free. Final must remain unchanged.

## Failure Handling

- Primary geometry failure: record exact frame and values, then use only the unchanged `0.75` blend-start fallback.
- Fallback geometry failure: stop with evidence; do not reorder manually or tune parameters.
- Visual failure: retain screenshots and stop without changing timing or geometry values.
- Contract, final-pose, or byte-copy failure: stop immediately.
- Unrelated working-tree files remain untouched and unstaged.
