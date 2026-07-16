# Rosebud Angular Tip Phase Design

## Context

Angular ordering made nested-tip assignment deterministic but did not pass the pair gate. The primary blend start produced `82 / 35,843`; the sole fallback produced `82 / 35,713`. A comparison with the last passing guided-ring asset showed exactly three added pairs—`Petal_004–Petal_022`, `Petal_005–Petal_022`, and `Petal_012–Petal_022`—with no removed pairs. The current even-small phase assigns `Petal_022` to the small ring.

An alternating two-ring sequence has only two discrete phases. This design tests the remaining phase without changing any continuous geometry parameter.

## Goal

Swap the circular nested-ring phase so even angular ranks use the large ring and odd ranks use the small ring, while preserving spatial alternation, timing, all approved deformation values, and all verification limits.

## Assignment

Add one explicit generator constant:

```text
INNER_GUIDE_PHASE = 1
```

For inner petals only:

```text
guide_index = angular_rank + INNER_GUIDE_PHASE
```

The morph code continues using guide-index parity for both tip-ring selection and the existing `±3°` angular offset. Therefore the phase swap changes:

- Angular-rank even: large tip `0.09 / 1.04`.
- Angular-rank odd: small tip `0.04 / 1.10`.
- Alternating offset direction is swapped consistently.

Adjacent circular ranks remain opposite parity, including the `7 -> 0` wrap. Exactly four inner petals use each ring.

Outer and middle guide indices remain their object indices. The existing object index continues to drive opening stagger, so animation timing is unchanged.

## Diagnostics and Validation

Before deformation, the generator validates:

- Exactly eight inner petals.
- Angular ranks are exactly `0…7`.
- Phased guide indices contain exactly four even and four odd values.
- Adjacent phased ranks, including wrap-around, have opposite parity.

Generation logs each inner petal's name, angular rank, and phased guide index. No petal name is special-cased.

## Fixed Geometry Profiles

All geometry values remain unchanged:

- Inner body `0.12 / 1.05`, bend `38°`, pull `0.90`, offset magnitude `3°`.
- Small tip `0.04 / 1.10`; large tip `0.09 / 1.04`.
- Outer `0.50 / 0.75 / 12° / 0.30 / ±1°`.
- Middle `0.30 / 0.90 / 24° / 0.45 / ±2°`.
- Primary blend start `0.65`.
- Sole geometry fallback blend start `0.75`.

Only a primary geometry failure authorizes the fallback. No other value may change.

## Gates

The selected phase/profile must pass two complete generation rounds:

- 25 `Bud` targets and weights-only contract.
- Root displacement at most `1e-5` for `t <= 0.15`.
- Final open bounds within `1e-4`.
- All 13 frames at or below `80` intersecting pairs and `40,000` triangle overlaps.
- Zero meaningful object rotation.
- Byte-identical GLB destinations.

Then the unchanged TypeScript/build/F1/i18n suite and real-time browser flow run with a new cache key.

## Browser Acceptance

Capture `first`, `middle`, `final`, and `reopen` at the established real approximately `5.3s` first-stable time. First/reopen must have no obvious center hole or mature annular spiral, a wrapped middle, and slightly open outer petals without downward spread. Middle must remain continuous and shard-free. Final must remain unchanged.

Timing and capture time may not be changed.

## Terminal Condition

If both the phased `0.65` profile and the sole `0.75` fallback fail geometry, the nested two-ring topology is rejected for this mesh. Stop without trying another order, phase, radius, height, pull, blend curve, threshold, or named-petal exception.

If geometry passes but visual acceptance fails, retain screenshots and stop without further tuning.
