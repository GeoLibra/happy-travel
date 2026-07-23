# Acceptance Report

## Verdict

PASS_WITH_NOTES

## Scope Checked

- Blender wheel separation, pivots, hierarchy, symmetry, and export.
- glTF node names, mesh descendants, direct pivot parenting, and local transforms.
- Runtime acceleration, stopping, wheel angle, frame-rate independence, and allocation behavior.
- Desktop browser idle, racing, completion, hologram, model loading, and console health.
- Mobile racing layout was captured during the implementation loop; the final user-requested layer restoration was re-verified on desktop.

## Reviewers Run

- Inline requirements acceptance review.
- Inline test coverage review.
- Inline code-quality and performance review.
- Frontend visual review using Blender and browser screenshots.

## Tests Run

- `node scripts/verify-f1-glb.mjs public/models/red_bull_f1_rigged.glb` — PASS.
- `npm run check:f1-motion` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `scripts/check_f1_ui.mjs --desktop-only` with managed Vite server — PASS; GLB HTTP 200, no wheel warnings, page errors, or non-favicon console errors.
- `git diff --check` — PASS.

## Requirement Coverage

1. Four transformable wheel nodes: PASS.
2. Correct pivots and isolated wheel geometry: PASS by Blender bounds and viewport inspection.
3. Material-preserving model load: PASS by Blender and browser screenshots.
4. Smooth interaction-driven wheel motion: PASS by deterministic motion check and browser flow.
5. Shared speed signal across effects: PASS by code inspection and racing screenshot.
6. Smooth 100% settle and inspection state: PASS by stopped screenshot.
7. Missing nodes degrade gracefully: PASS by deterministic node-resolution check.
8. TypeScript and build: PASS.
9. Browser verification: PASS_WITH_NOTES; desktop final state is current, mobile evidence predates only the restoration of the original shared z-layer.

## Findings and Fixes Applied

- Fixed double wheel translation introduced by Blender parenting.
- Reduced excessive racing-road brightness.
- Restored the original UI/car z-layer after the ENTER button obscured the car.
- Stabilized browser canvas selection and isolated the known favicon noise.

## Residual Risks

- Vite reports the pre-existing main JavaScript chunk is over 500 kB.
- `/favicon.ico` remains absent and produces a known browser 404 unrelated to this feature.
- The GLB is still a large asset at approximately 44 MB.

## Follow-ups

- Optional: add a favicon.
- Optional: compress textures/geometry further after a dedicated visual-quality comparison.

