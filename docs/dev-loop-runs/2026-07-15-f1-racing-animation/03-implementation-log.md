# Implementation Log

## Blender asset

- Added `scripts/prepare_f1_wheels.py`.
- Measured wheel centers and classified baked connected components using side, radial, bounding-center, and extent constraints.
- Extracted vertex totals: FL 25,745; FR 26,612; RL 44,282; RR 43,043.
- Created four wheel pivots and four independently rotating wheel meshes.
- Found and fixed a double-parent-translation bug by requiring zero wheel-local translation in the GLB verifier.
- Exported `public/models/red_bull_f1_rigged.glb` without modifying the 52 MB source GLB. The new model is approximately 44 MB.

## Runtime motion

- Added a frame-rate-independent, allocation-free F1 speed and wheel-angle state.
- Added one-time wheel-node resolution with graceful missing-node warnings.
- Switched `WelcomePage` to the versioned rigged model URL.
- Connected wheel rotation, road flow, speed lines, particles, and body vibration to one damped speed signal.
- Preserved the original `z-[70]` content / `z-[75]` car layering after user visual feedback so the car is not hidden by the ENTER button.

## Verification and debugging

- Used red/green checks for the GLB node contract, zero local wheel transforms, speed damping, frame-rate independence, and missing-node behavior.
- Used Blender viewport inspection to verify wheel bounds and car completeness.
- Used headless Chrome to verify the desktop idle, racing, and stopped flow.
- Diagnosed three console 404 messages as the pre-existing missing `/favicon.ico`; the browser check filters only that URL and still rejects other errors.
- Browser test harness uses separate contexts for desktop and mobile and supports `--desktop-only` for focused visual regression checks.

