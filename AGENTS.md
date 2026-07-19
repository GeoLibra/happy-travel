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
