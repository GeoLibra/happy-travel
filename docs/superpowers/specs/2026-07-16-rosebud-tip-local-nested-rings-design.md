# Rosebud Tip-Local Nested Rings Design

## Context

The full-petal nested-ring design failed the unchanged geometry gates. The primary profile stopped at frame 1 with `81` intersecting pairs and `42,943` triangle overlaps; its sole fallback stopped at frame 1 with `82` pairs and `41,660` triangle overlaps. Both retained `0.00°` object rotation and passed generation, GLB contract, and morph-math checks, so the failure is isolated to excessive petal-body overlap.

This design supersedes the deformation portion of `2026-07-16-rosebud-nested-inner-rings-design.md`. It keeps the nested visual target but limits its influence to the petal tips.

## Goal

Close the visible center opening with alternating nested tip targets while preserving the previously passing single-ring deformation across the inner-petal bodies. Keep a restrained outer silhouette, continuous outside-in bloom, existing runtime timing, and unchanged final open rose.

## Non-Goals

- Do not relax the `80` intersecting-pair or `40,000` triangle-overlap gates.
- Do not delay bloom or capture earlier screenshots.
- Do not change the final open `Basis`, layer opening frames, or runtime timing.
- Do not target a shared horizontal center point.
- Do not perform open-ended parameter tuning after the one specified fallback.

## Deformation Model

### Body guide

Every inner petal uses the previously passing single-ring body guide:

- Body radius ratio `0.12`.
- Body height ratio `1.05`.
- Bend `38°`.
- Guide pull `0.90`.
- Alternating angular offset `±3°`.

The bend direction and stable bend axis are computed only from this body guide. This prevents the inner-petal bodies from being aimed directly at the much smaller nested rings.

### Tip guides

Inner tips alternate deterministically by existing petal-index parity:

- Even tip radius / height: `0.04 / 1.10`.
- Odd tip radius / height: `0.09 / 1.04`.

Each tip guide retains the petal's own centroid-derived angular sector and the same parity angular offset. Neither guide is a shared center point.

For longitudinal parameter `t`, the primary nested-tip blend is:

```text
tipBlend = smoothstep((t - 0.65) / 0.35)
bodyLine = O + (bodyGuide - O) * t
tipLine = O + (tipGuide - O) * t
guideLine = lerp(bodyLine, tipLine, tipBlend)
```

At `t <= 0.65`, the guide line is exactly the passing body guide. At `t = 1`, it reaches the nested tip guide. The existing root lock and main deformation weight continue to control total displacement, so the new blend does not introduce a positional seam.

### Outer and middle layers

The outer profile is the gentler restrained setting:

- Radius `0.50`.
- Height `0.75`.
- Bend `12°`.
- Pull `0.30`.
- Offset `±1°`.

The middle profile remains unchanged at radius `0.30`, height `0.90`, bend `24°`, pull `0.45`, and offset `±2°`.

## Settings Interface

Replace the unintegrated `alternate_guide_radius_ratio` and `alternate_guide_height_ratio` fields with optional tip-local fields:

- `tip_guide_radius_ratio`
- `tip_guide_height_ratio`
- `alternate_tip_guide_radius_ratio`
- `alternate_tip_guide_height_ratio`
- `tip_blend_start`

All five tip-local fields are either absent together or supplied together. When absent, the current single-ring behavior is byte-for-byte equivalent at the math level. When present, radius values must be finite and in `(0, 1]`, height values finite and positive, and `tip_blend_start` finite in `(ROOT_LOCK_END, 1)`.

## Single Allowed Fallback

The only fallback changes `tip_blend_start` from `0.65` to `0.75`. All body, tip, outer, middle, bend, pull, height, offset, timing, and threshold values remain unchanged.

The fallback is authorized only if the primary profile fails the geometry verifier. Any generation, contract, root, final-pose, byte-comparison, or visual failure stops without using the fallback. If the fallback geometry fails, stop without further tuning.

## Tests and Automated Gates

Implementation follows RED/GREEN:

1. Replace full-petal alternate-ring math checks with tip-local settings and interpolation checks.
2. Verify a point below `t=0.65` uses the same guide line and output as single-ring deformation.
3. Verify the blend is continuous at `t=0.65`, and even/odd tips reach their distinct radius and height targets at `t=1`.
4. Retain root-lock, finite-output, invalid-settings, partial-settings, degenerate-growth, and single-ring regressions.
5. Generate the primary GLBs and run contract, math, all 13 geometry samples, final-pose, and destination `cmp` gates.
6. Use only the `0.75` fallback after a recorded primary geometry failure.
7. Run the selected passing profile twice to verify functional idempotence and byte-identical destination copies.
8. Run the existing TypeScript, build, F1 motion, and i18n checks unchanged.

## Browser Acceptance

Advance the model cache key and use the same real trigger, cached-model path, headed Playwright workflow, and established approximately `5.3s` first-stable capture time. Capture `first`, `middle`, `final`, and `reopen` at original resolution.

Pass only when:

- First: no obvious dark center hole or mature annular spiral; nested inner tips cover the center; middle petals wrap the core; outer petals are slightly open without downward half-open spread.
- Middle: outside-in opening remains continuous and no petal surface detaches or reads as a shard.
- Final: the mature open rose remains unchanged.
- Reopen: the same qualified early bud returns rather than the final pose.

Screenshots may not be captured earlier and animation timing may not be changed to hide an invalid early-bloom state.

## Failure Handling

- Primary geometry failure: record exact frame, pairs, triangle overlaps, and rotation, then use only the `0.75` fallback.
- Fallback geometry failure: stop with evidence and no model commit.
- Visual failure: keep the screenshots, do not commit the cache-key change, and return to design review.
- Contract, final-pose, or destination-copy failure: stop immediately without compensating elsewhere.
- Unrelated working-tree files remain untouched and unstaged.
