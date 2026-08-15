# Time visualization design QA

## Evidence and normalization

- Source visual truth: `output/reference/time-viz-source/desktop-1280x720.png` and `output/reference/time-viz-source/mobile-390x844.png`, captured from `https://gnanasai-threejs-time-viz-02.vercel.app/` in the Codex in-app browser.
- Rendered implementation: `output/reference/time-viz-local/desktop-1280x720.png` and `output/reference/time-viz-local/mobile-390x844.png`, captured from `/time-viz-reference` in the same browser.
- Full-view comparisons: `output/reference/comparisons/desktop-final.png` (2560 x 720) and `output/reference/comparisons/mobile-final.png` (780 x 844). Each image places source on the left and implementation on the right.
- Desktop viewport/state: 1280 x 720 CSS px, DPR 1, source and local pixels 1280 x 720, matching digits `183624`, collapsed debug UI.
- Mobile viewport/state: 390 x 844 CSS px, DPR 1, source and local pixels 390 x 844, matching digits `012346`, collapsed debug UI.
- Density normalization: none required; every source/local pair is 1:1 CSS pixels at DPR 1 with no browser chrome or device frame.
- Focused-region comparison was not needed. The page is one full-viewport WebGL composition, and the final paired images show cube faces, bevels, controls, horizon, and floor reflection at a readable 1:1 scale.

## Required fidelity surfaces

- Fonts and typography: the only DOM type is development tooling. Its small monospace FPS readout and compact neutral debug summary preserve the source hierarchy and do not compete with the canvas.
- Spacing and layout: desktop is a centered HH/MM/SS row with paired gaps; mobile is three centered two-digit rows. Digit baselines, outer bounds, horizon, and mobile floor start align with the source at both target viewports.
- Colors and tokens: black level, pastel/rainbow cube distribution, restrained bloom, and dark control surfaces match the source intent. The seeded distribution is intentionally deterministic rather than reproducing the source's stochastic colors cube-for-cube.
- Image quality and asset fidelity: the source is a live Three.js render, so the implementation uses rounded 3D box geometry, HDR lighting, post-processing, and a real reflective shader rather than CSS or raster substitutes. The reference author's avatar is intentionally omitted as third-party branding, per the product design specification.
- Copy and content: development-only copy is limited to `FPS`, `scene ready`, `Debug-UI`, digits, seed, and mode; production builds render none of it.
- Responsiveness and accessibility: the canvas remains singular and decorative, the debug summary is keyboard-operable, no persistent controls overflow either viewport, and reduced motion disables liquid displacement.

## Comparison history

### Iteration 1 — blocked

- [P1] The initial local material emitted uniform white, causing severe bloom blowout and erasing the seeded color distribution.
- [P1] Desktop digits sat too low and the mobile floor intersected the lower rows.
- Evidence: `output/reference/time-viz-local/desktop-1280x720-iteration-1.png` and `output/reference/time-viz-local/mobile-390x844-initial.png`.
- Fixes: corrected instanced-color material usage, reduced bloom radius/strength, added reference camera framing, and made floor placement responsive.

### Iteration 2 — blocked

- [P2] Desktop digits had thin strokes and uniform gaps rather than the source's heavier cube glyphs and paired HH/MM/SS rhythm.
- [P2] Mobile pair width, row cadence, and reflection horizon drifted from the source.
- Evidence: `output/reference/comparisons/desktop-iteration-1.png` and `output/reference/time-viz-local/mobile-390x844-iteration-2.png`.
- Fixes: applied a two-cell glyph weight, independent horizontal/vertical cube pitch, desktop pair grouping, per-viewport cube scale, mobile row spacing, and mobile floor depth.

### Iteration 3 — passed

- Post-fix evidence: `output/reference/comparisons/desktop-final.png` and `output/reference/comparisons/mobile-final.png`.
- Camera framing, digit scale, cube bevel, seeded color balance, bloom, black level, horizon, reflection depth, and mobile three-row grouping have no remaining actionable P0/P1/P2 mismatch.
- Residual P3: the procedural local liquid ripple bends reflections more vertically than the source capture. The reflective depth, brightness, motion, and horizon are preserved, and exact ripple phase/orientation is GPU- and time-dependent.

## Browser interaction and runtime checks

- Primary interactions: debug panel expanded to reveal matching digits, seed 26, and reference mode, then collapsed; live clock advance is covered by browser automation.
- Console: zero browser console errors in the final mobile state. The only observed non-error diagnostic was Three.js's `RGBELoader` deprecation warning.
- No actionable P0/P1/P2 findings remain.

final result: passed
