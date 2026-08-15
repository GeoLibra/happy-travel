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

### Iteration 3 — rejected by independent review

- Post-fix evidence: `output/reference/comparisons/desktop-final.png` and `output/reference/comparisons/mobile-final.png`.
- [P1] Independent review found that the local desktop glyphs remained thinner, sparser, and flatter, with stronger halos and a crisp segmented reflection extending too far into the foreground.
- [P1] Independent review found that mobile pairs remained smaller and narrower, with different row cadence and an over-bright segmented reflection.

### Iteration 4 — blocked

- Fresh matched desktop evidence: `output/reference/round-1/source-desktop-1280x720.jpg` and `output/reference/round-1/local-desktop-1280x720.jpg`, both 1280 x 720, digits `192440`; paired in `output/reference/comparisons/desktop-final.png` at 2560 x 720.
- Fixes attempted: increased cube mass and depth, reduced bloom, introduced spatial pastel gradients, adjusted pair spacing/camera pose, and increased reflector blur while lowering the ripple frequency.
- Glyph bounds, mass, color balance, and desktop pair framing are materially closer.
- [P1] The local floor remains a vertically segmented mirrored image. The source has a broad, soft, liquid reflection with large horizontal wave bands and diffused color fields. This is an actionable material/reflection mismatch, not a ripple-phase P3.
- The prior 390 x 844 matched mobile comparison remains blocked by the independent-review P1. A replacement mobile pair was not represented as passing because this round did not clear the desktop P1.

## Browser interaction and runtime checks

- Primary interactions: debug panel expanded to reveal matching digits, seed 26, and reference mode, then collapsed; live clock advance is covered by browser automation.
- Console: zero browser console errors in the round-1 local desktop state. The only observed non-error diagnostic was Three.js's `RGBELoader` deprecation warning.
- Renderer readiness and responsive observability findings are fixed and tested, but the P1 reflector mismatch remains.

### Iteration 5 — structural fix round 2, blocked

- Fresh matched desktop evidence: `output/reference/round-2/source-desktop-1280x720.jpg` and `output/reference/round-2/local-desktop-1280x720.jpg`, both 1280 x 720 with digits `195342`; paired source-left/local-right in `output/reference/comparisons/desktop-final.png` at 2560 x 720.
- Fresh matched mobile evidence: `output/reference/round-2/source-mobile-390x844.png` and `output/reference/round-2/local-mobile-390x844.png`, both 390 x 844 with digits `012346`; paired source-left/local-right in `output/reference/comparisons/mobile-final.png` at 780 x 844. The source image is the previously captured exact in-app-browser baseline; the local image is a fresh exact 390 x 844 renderer-applied mobile capture.
- Structural changes: replaced the 10 x 7 visual grid with a fixed-capacity 20 x 14 (280-slot) supersampled lattice, switched to smaller near-square microcubes, removed the prior coarse one-sided weighting, exposed more cube side depth, and replaced the checkerboard-like reflector with depth-dominant multi-octave distortion, normalized horizontal Gaussian sampling, foreground blur growth, and reflection gain falloff. Reduced motion retains static liquid distortion while freezing time animation.
- Readiness remains tied to at least one successful composed frame, and the renderer snapshot—not React `innerWidth`—drives the exposed responsive layout.
- [P1] Desktop framing regressed during the structural geometry pass: the local row is substantially oversized and cropped at the right and bottom, while the source contains all six digits with generous horizontal bounds. This is an immediately visible composition failure.
- [P1] The mobile reflection remains a compact mirrored glow beneath the third row rather than the source's wide, horizontally broken liquid bands. Cube edges are also more uniformly frontal than the source's stronger side-face depth.
- The round was stopped after the required bounded structural pass. These are actionable P1 differences, so no visual pass is claimed.

## Round-2 runtime checks

- In-app-browser state: desktop reported `desktop-row`, `desktop`, `ready`, and `frameCount=1`; the exact mobile stage reported `mobile-three-row`, `mobile`, `ready`, and `frameCount=1` after the renderer resize.
- Console: zero errors in the final local capture. The only warning was Three.js's existing `RGBELoader` deprecation notice; Vite/analytics development diagnostics were informational.
- Focused units: 21 passed. Responsive Playwright: 3 passed. `pnpm test:fast`: passed with 64 unit tests, 10 resolver tests, 6/6 asset validators, and a successful production build.

### Iteration 6 — bounded fix round 3, blocked

- Matched desktop: `output/reference/round-3/source-desktop-1280x720.jpg` and `output/reference/round-3/local-desktop-1280x720.jpg`, digits `195342`, paired source-left/local-right in `output/reference/comparisons/desktop-final.png` (2560 x 720).
- Matched mobile: `output/reference/round-3/source-mobile-390x844.png` and `output/reference/round-3/local-mobile-390x844.png`, digits `012346`, paired source-left/local-right in `output/reference/comparisons/mobile-final.png` (780 x 844).
- The local reference renderer is normalized to the source's measured one backing pixel per CSS pixel. The desktop camera distance was adjusted by the 1.86x oversize ratio measured in round 2, with the lattice and group origins unchanged.
- The reflector now spreads foreground samples across a 180-pixel UV radius, halves each horizontal step across nine taps, reduces the center weight to 0.06, compresses depth more strongly, and increases vertical blur. Mobile now produces broad broken horizontal streaks with no readable mirrored third-row glyph, clearing that round-2 P1.
- [P1] Desktop remains unacceptable: after the bounded distance correction, only the first three digits are visible in the lower-right portion of the local comparison. It does not reproduce the source's centered, fully visible six-digit row and balanced horizon. No further exploratory tuning was performed.
- Console: zero errors; only the existing `RGBELoader` deprecation warning. Focused units 21/21, responsive Playwright 3/3, and `pnpm test:fast` all passed.

final result: blocked
