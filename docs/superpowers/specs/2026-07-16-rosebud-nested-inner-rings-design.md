# Rosebud Nested Inner Rings Design

## Context

The guided-ring morph removed the original detached-shard failure and passes the automated GLB and geometry gates, but independent browser review still rejects the first and reopened poses. At the real first-stable capture time, the center contains a visible dark opening and readable mature ring, while the lower outer petals spread too far. The result reads as a partially opened rose rather than a natural bud.

The existing single inner guide ring is the structural cause: all eight inner petals terminate around the same `0.12M` radius, creating an annular opening even though the petals retain their angular sectors. This revision must close that opening without returning to a common-center target.

## Goal

Create a natural early rosebud whose center is visually closed, middle petals form a coherent wrapper, and outer petals remain only slightly open. Preserve the continuous outside-in bloom, existing runtime timing, final open rose, 25-petal weights-only animation contract, and existing geometry thresholds.

## Non-Goals

- Do not delay bloom playback or capture an artificially early acceptance image.
- Do not change the final open `Basis` geometry.
- Do not add object translation, rotation, or scale animation.
- Do not relax the `80` intersecting-pair or `40,000` triangle-overlap limits.
- Do not resume open-ended parameter search after the one specified fallback.

## Morph Architecture

### Alternating nested inner rings

Only the inner layer uses two guide rings. Inner petals alternate deterministically by their existing petal index:

- Primary even ring: radius ratio `0.04`, height ratio `1.10`.
- Primary odd ring: radius ratio `0.09`, height ratio `1.04`.
- Inner bend remains `38°`.
- Inner guide pull remains `0.90`.
- Inner alternating angular offset remains `±3°`.

The smaller ring covers the visual center while the larger ring supports and overlaps it from each petal's own angular sector. No petal targets a shared horizontal point.

`MorphSettings` gains optional alternate guide radius and height values. When those values are absent, the current single-ring behavior is unchanged. `compute_guide_point` selects the alternate pair only for the parity assigned by the generator; all finite, positive-radius, positive-height, pull-range, sector, growth, and root-lock validation remains active.

### Restrained outer ring

The outer layer changes from radius `0.55`, pull `0.25` to:

- Guide radius ratio `0.48`.
- Guide height ratio `0.75` unchanged.
- Bend `12°` unchanged.
- Guide pull `0.35`.
- Alternating angular offset `±1°` unchanged.

The middle layer remains exactly unchanged at radius `0.30`, height `0.90`, bend `24°`, pull `0.45`, and offset `±2°`. It continues to act as the stable wrapper between the restrained outer silhouette and nested center.

## Single Allowed Fallback

If the primary profile fails either geometry threshold, stop and record the exact frame and values before using this one fallback profile:

- Inner even radius / height: `0.05 / 1.08`.
- Inner odd radius / height: `0.10 / 1.03`.
- Outer radius / pull: `0.50 / 0.30`.
- All other values remain identical to the primary profile.

The fallback is not available merely because of visual preference. If the primary profile passes geometry but fails visual acceptance, or if the fallback fails any automated or visual gate, stop without further parameter tuning.

## Animation and Data Flow

The generator imports the current GLB at its final open frame, removes old animation and shape keys, classifies the same 25 physical petals, and rebuilds one `Bud` target per petal. Each inner petal receives one of the two guide points from its deterministic parity; outer and middle petals use their single guide ring. The exported `RoseBloom` clip continues to animate only morph `weights` from `1` to `0` with existing layer opening frames and existing runtime timing.

The final frame has all `Bud` weights at zero, so the open `Basis` and final presentation remain unchanged. `src/model/rose.glb` and `public/models/rose.glb` are generated together and must remain byte-identical.

## Tests and Automated Gates

Implementation follows RED/GREEN:

1. Extend the Blender math check first so it fails until alternate radius and height selection exist.
2. Verify adjacent inner petals select different guide radii and heights while preserving different angular sectors.
3. Retain finite-output, degenerate-growth, invalid-settings, root-lock, and single-ring regression checks.
4. Regenerate the GLBs and run the GLB contract, morph math, and all 13 geometry samples.
5. Require every sampled frame to remain at or below `80` intersecting pairs and `40,000` triangle overlaps with zero meaningful object rotation.
6. Run the generator and gates a second time to verify functional idempotence and byte-identical destination copies.
7. Run the existing TypeScript, build, F1 motion, and i18n checks without modifying their thresholds.

## Browser Acceptance

Use the existing real trigger, model-load path, runtime bloom timing, headed Playwright workflow, and first-stable timing. Capture and inspect `first`, `middle`, `final`, and `reopen` at original resolution.

The revision passes only when:

- First: the center has no obvious dark hole or mature annular spiral; inner petals visibly cover the center; middle petals wrap the core; outer petals are slightly open but do not spread downward like a half-open rose.
- Middle: the flower opens continuously from outside toward the center with coherent petal surfaces and no detached or shard-like geometry.
- Final: the existing mature open rose remains visually unchanged.
- Reopen: the same qualified bud is reproduced rather than resuming the final pose.

Screenshots may not be taken earlier merely to hide a later invalid early-bloom state.

## Failure Handling

- Automated failure: report the exact command, frame, layer/profile, intersecting pairs, triangle overlaps, and rotation; use only the specified fallback when the primary geometry gate fails.
- Visual failure: retain the screenshots, do not commit the model change, and return to design review.
- Contract or final-pose failure: stop immediately; do not compensate in runtime playback.
- Unrelated working-tree files remain untouched and unstaged.
