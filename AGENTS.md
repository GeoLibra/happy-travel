# Project Agent Guidance

## F1 welcome-scene invariants

- The car canvas stays above ordinary welcome UI. Welcome copy, stats, start lights, and the CTA must remain below the transparent car canvas; only the blocking loader and intentional modal/easter-egg overlays may render above it.
- A visible car ray hit owns pointer interaction. When the car does not cover an interactive control, the exposed control must remain operable through the foreground-canvas pointer forwarding path.
- `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` are the only runtime wheel-spin nodes. Do not rotate fuzzy name matches, adjacent aero panels, suspension, or brake calipers.
- Treat wheel geometry ownership and `RearHardRockAeroPanel` parentage as an asset contract. Validate them in Blender and in the shipped GLB before changing the loader URL.
- Every replacement car asset must use a versioned GLB filename and preserve the previous accepted model until the new asset passes validation.
- Every F1 model or visual change requires the focused asset, motion, wheel, airflow, studio, reflection, interaction, and model checks plus desktop and mobile browser evidence.
- Browser evidence must include the complete arrival timeline, not only the final stopped frame, so car pose, camera framing, floor placement, and floor reveal jumps remain visible to reviewers.
- Explode and reassemble verification must prove every part stays above the floor for the entire motion and that wheel-adjacent bodywork follows its semantic body group.

## Testing and CI workflow

- Run `npm run check:showroom-acceptance` for code changes that affect the showroom or F1 handoff flow, including `src/App.tsx`, `src/components/WelcomePage.tsx`, `src/components/ParticleBackground.tsx`, files under `src/components/showroom/**`, files under `src/lib/showroom-*.ts`, or any change to ignition, skip, enter-app handoff, overlay visibility, scroll lock, or keyboard/pointer showroom controls. Treat `output/playwright/showroom-acceptance-summary.json` or the GitHub Actions artifact as the reviewable evidence.
- Chromium mobile coverage in CI is viewport and touch emulation only; it does not replace real-device Safari/Chrome checks when shipping materially new mobile WebGL behavior.
- Prefer `node --import tsx <script>` in npm scripts over the bare `tsx` CLI so local sandbox runs and GitHub Actions behave consistently.
- Canonical implementation plans and design specs must live in the main checkout under `docs/superpowers/**`; `.worktrees/**` and `output/**` are disposable execution artifacts, not the long-term source of truth.
