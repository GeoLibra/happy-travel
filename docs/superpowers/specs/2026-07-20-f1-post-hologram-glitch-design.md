# F1 Post-Hologram Glitch Design

## Goal

Insert a deliberate signal-failure beat between the completed hologram reveal and the automatic exploded view. The effect should feel like the showroom camera feed is breaking down, last 1.2 seconds, and leave the existing car model, interaction, and exploded-part contracts unchanged.

## Experience and Timeline

The automatic arrival sequence becomes:

1. The car reaches 100% progress and completes the existing 4.5-second hologram-to-solid reveal.
2. The clean solid car holds for 100 milliseconds.
3. A 1.2-second full-canvas digital glitch runs across the Three.js foreground render.
4. The glitch render path is disabled and one clean frame is established.
5. The existing automatic exploded-view transition begins.

The glitch contains two broad pronounced pulses separated by a short lower-energy interval. Pulses combine horizontal image displacement, RGB channel separation, block noise, scan distortion, and brief brightness dropouts. The effect applies only to the foreground Three.js canvas, so welcome copy, statistics, start lights, and the CTA remain visually stable and below the transparent car canvas.

## Architecture

### Sequence ownership

`WelcomePage` remains the owner of the automatic sequence. Replace the single hologram-to-explode delay with explicit phase timing for the clean hold, glitch window, and explode trigger. Pass a boolean or normalized glitch progress value to `ParticleBackground`; do not infer the effect independently from wall-clock time in two components.

Manual car interaction must cancel every pending automatic-sequence timer before toggling the exploded state or starting hold behavior. Once manually cancelled, the sequence must not restart during the same welcome-scene visit.

### Rendering

`ParticleBackground` adds a scoped post-processing pipeline for the foreground Three.js scene. The normal scene and camera render into an off-screen target, then a full-screen shader composites the final canvas. The shader receives elapsed glitch progress, resolution, and a deterministic pulse envelope.

When the glitch is inactive, use the existing direct render path rather than continuously paying for post-processing. At glitch completion, dispose or retain-and-disable resources according to the component's existing renderer-resource lifecycle, with complete disposal on unmount. The final glitch frame must not feed into the exploded animation; the scene returns to a clean direct-render frame before `exploded` becomes true.

The implementation must not mutate model node transforms, model materials, wheel angles, explode offsets, GLB contents, or the model URL. `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` remain the only runtime wheel-spin nodes.

### Responsive and accessibility behavior

Desktop uses the full two-pulse profile. Mobile keeps the same 1.2-second chronology but reduces render-target pixel ratio and displacement/noise amplitude to limit GPU cost and visual harshness.

With `prefers-reduced-motion: reduce`, preserve the sequence ordering and duration but replace spatial tearing and RGB displacement with two low-amplitude brightness/noise flickers. This prevents a sudden timing jump into the exploded view.

## Interaction and Layering

The canvas remains at its existing foreground stacking level. The post-process quad is internal to that canvas and must not introduce a DOM overlay above it. Existing ray-hit pointer ownership and forwarding to exposed welcome controls remain unchanged throughout the effect.

If the user manually interacts before the glitch begins, cancel the automatic glitch and explosion. If an accepted manual interaction occurs during the glitch, stop the glitch, restore the direct render path, cancel automatic explosion, and then apply the existing interaction classification. Entry transition behavior continues to force reassembly through the existing path.

## Failure Handling

If render-target or shader initialization fails, log a focused warning, skip the visual glitch, retain the 1.2-second sequencing interval, and continue to the automatic exploded view. A rendering failure must never leave a black canvas or block interaction.

On resize or device-pixel-ratio changes, resize the post-processing target using the same bounded pixel-ratio policy as the renderer. On context loss or unmount, release the render target, shader material, screen quad geometry, and any auxiliary textures.

## Verification

Add focused automated checks for:

- the exact phase order: hologram completion, 100 ms clean hold, 1.2-second glitch, clean frame, explosion;
- manual cancellation before and during the glitch;
- reduced-motion timing and reduced shader profile;
- inactive direct rendering and active off-screen post-processing paths;
- resource resizing and disposal;
- unchanged pointer forwarding, wheel-node allowlist, model URL, and exploded-part floor guards.

Run the existing focused asset, motion, wheel, airflow, studio, reflection, interaction, model, and welcome checks. Browser evidence must cover desktop and mobile viewports and record the complete arrival timeline, including hologram completion, both glitch pulses, the clean recovery frame, and the start of the exploded motion. Explode and reassemble evidence must continue to show every part above the floor and wheel-adjacent bodywork following its semantic group.

## Out of Scope

- Replacing or editing the GLB asset.
- Adding audio to the glitch.
- Distorting ordinary welcome UI.
- Changing the existing exploded pose, reassembly behavior, car controls, or entry transition.
