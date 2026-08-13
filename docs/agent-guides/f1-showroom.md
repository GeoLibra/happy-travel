# F1 showroom agent guidance

Use this guidance for changes to the welcome scene, showroom handoff, F1 model or materials, WebGL lifecycle, ignition flow, and their tests.

## Rendering and interaction contracts

- Keep the car canvas above ordinary welcome UI. Welcome copy, stats, start lights, and the CTA stay below the transparent car canvas; only the blocking loader and intentional modal or easter-egg overlays may render above it.
- A visible car ray hit owns pointer interaction. Where the car does not cover an interactive control, keep the exposed control operable through the foreground-canvas pointer-forwarding path.
- Preserve the welcome ignition behavior unless the task explicitly changes the product: holding advances the original progress cadence, releasing below the threshold resets, releasing after the threshold auto-completes, and completion/handoff uses real pointer, keyboard, or browser interactions in acceptance tests.
- Do not change user-visible ignition timing, showroom lighting, camera framing, model/material ownership, or audio behavior merely to satisfy CI, Playwright, or MemLab. Fix the ownership/lifecycle defect or the test harness.

## Model and animation contracts

- `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` are the only runtime wheel-spin nodes. Do not rotate fuzzy name matches, nearby aero panels, suspension, or brake calipers.
- Treat wheel geometry ownership and `RearHardRockAeroPanel` parentage as an asset contract. Validate both in Blender and in the shipped GLB before changing the loader URL.
- Give every replacement car asset a versioned GLB filename. Keep the previous accepted model until the replacement passes validation.
- Explode/reassemble verification must show that every part remains above the floor throughout the motion and that wheel-adjacent bodywork follows its semantic body group.

## Required verification

- For every F1 model or visual change, run the focused asset, motion, wheel, airflow, studio, reflection, interaction, and model checks, then collect desktop and mobile browser evidence. See [the testing policy](../testing/ci-testing-policy.md) for commands.
- Capture the complete arrival timeline, not only the final stopped frame, so reviewers can evaluate car pose, camera framing, floor placement, and floor-reveal jumps. See [the browser acceptance guide](../showroom-browser-acceptance.md).
- Chromium mobile coverage in CI is viewport and touch emulation only. Materially new mobile WebGL behavior also needs real-device Safari and Chrome checks.
- Test and memory scenarios must not conceal leaks or failures by clearing console output, deleting application globals, mutating the DOM outside the user path, forcing WebGL context loss during normal runtime cleanup, or adding test-only imperative triggers. Explicitly document and isolate any approved test-only escape hatch from production runtime.
