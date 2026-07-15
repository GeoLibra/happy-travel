# Rose Bloom Animation Design

## Goal

Transform the existing `rose.glb` into a rose that blooms once from a compact bud into its current fully open form. The animation starts when the rose scene becomes visible, lasts about 4.5 seconds, and remains on the final open pose.

## Scope

- Preserve the current flower stem, leaves, materials, textures, framing, and final open silhouette.
- Animate only the red flower head.
- Embed one glTF animation named `RoseBloom` in the model.
- Keep `src/model/rose.glb` and `public/models/rose.glb` byte-identical.
- Update `ThreeRose.tsx` to play the embedded animation once and hold its final frame.

## Animation Design

The petals are organized into outer, middle, and inner layers based on their position relative to the flower center. The closed pose is created by rotating petals inward toward the flower axis, moving them slightly toward the center, and applying only subtle scale changes so the flower reads as a bud rather than a uniformly shrunken rose.

The bloom unfolds in overlapping stages:

1. Outer petals begin opening first and establish the broad silhouette.
2. Middle petals follow with a short stagger, adding volume to the bloom.
3. Inner petals open last and more gently so the center retains its natural density.

Petals within each layer receive small timing and rotation variations. Animation curves use smooth easing with no abrupt starts or stops. Frame 1 is the closed pose and the final frame exactly restores the existing open model.

## Model Processing

The Blender processing script will inspect the imported GLB and identify flower geometry by material and spatial position. If petals are separate objects, object transforms will be animated directly. If the flower head is a connected mesh with disconnected islands, the islands will be separated into petal objects before animation. Each petal origin will be placed near its lower attachment region so rotation resembles a petal unfolding from its base.

Stem and leaf objects will remain static. Any generated helper objects will be excluded from the GLB export.

## Runtime Integration

After loading the model, `ThreeRose.tsx` creates a `THREE.AnimationMixer`, selects the `RoseBloom` clip (falling back to the first embedded clip), and configures the action with `THREE.LoopOnce`, one repetition, and `clampWhenFinished = true`. The render loop advances the mixer using frame delta time.

Opening the rose modal creates a new scene and therefore restarts the bloom from the beginning. Closing the modal stops the render loop and uncaches the animation resources together with the existing scene cleanup.

If an animated clip is unavailable, the rose still renders in its current fully open state and the particle transition continues normally.

## Verification

- Re-import the exported GLB in a clean Blender process.
- Confirm the `RoseBloom` action exists, has animation tracks, and spans the intended duration.
- Compare final-frame flower bounds with the original model to ensure the open silhouette is preserved.
- Confirm both project copies of `rose.glb` have matching checksums.
- Run the project type/build checks.
- Verify in the browser that the flower opens once, stays open, and restarts after the modal is closed and opened again.

## Out of Scope

- Continuous bloom/close looping.
- Wind, leaf, or stem sway after blooming.
- Changes to materials, lighting, particles, camera controls, or rose trigger behavior.
