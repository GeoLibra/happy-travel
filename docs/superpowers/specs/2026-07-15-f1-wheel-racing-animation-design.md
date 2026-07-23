# F1 Wheel and Racing Animation Design

## Goal

Make the Red Bull F1 model feel as though it is travelling at high speed while it remains framed near the center of the welcome page. The wheels must rotate physically, and the wheel speed, road motion, speed lines, particles, and subtle body motion must respond to the existing press progress.

## Current State

- `public/models/red_bull_f1.glb` contains no animation clips.
- The four wheels are not independent scene nodes. The car is baked into seven large mesh objects whose origins are all at the scene origin.
- `WelcomePage` stores only `carGltf.scene`, so any clips exported later would currently be discarded.
- `ParticleBackground` already implements the car scene, road hairlines, particles, speed trails, lighting, hologram transition, and final inspection controls.
- The browser caches the GLB by URL through LocalForage.

## Selected Approach

Use Blender to restructure the model and three.js to drive its motion procedurally.

Blender will isolate the visible geometry for each wheel, give each wheel a correct center and axle, and export named nodes. Three.js will calculate wheel rotation every frame from a runtime speed value. This is preferred over a baked loop because it allows continuous acceleration, deceleration, stopping, and future steering without animation-clip discontinuities.

## Blender Model Structure

The original GLB remains unchanged. Blender produces a new versioned asset:

`public/models/red_bull_f1_rigged.glb`

Required exported hierarchy:

```text
F1_Car
├── Body
├── WheelPivot_FL
│   └── Wheel_FL
├── WheelPivot_FR
│   └── Wheel_FR
├── WheelPivot_RL
│   └── Wheel_RL
└── WheelPivot_RR
    └── Wheel_RR
```

The pivot nodes preserve a future steering axis. The wheel nodes rotate around their local axle. The export must preserve the existing appearance and world-space wheel placement.

Because the source mesh is baked into large chunks, isolation will use geometry connectivity and spatial bounds around the four wheel locations. The result must be visually checked before export to ensure bodywork, suspension, and wings were not accidentally assigned to wheel nodes.

## Runtime Motion

`ParticleBackground` will own one normalized racing-speed value. It will ease toward a target derived from the existing progress and interaction state.

During acceleration:

- Wheel angular displacement advances from frame delta and current speed.
- Road hairlines and speed trails move backward faster as speed rises.
- Existing particles react more strongly to speed.
- The car receives subtle high-frequency vertical vibration and lower-frequency roll.
- Camera shake remains restrained so text and controls stay readable.

At `progress === 100`, speed eases smoothly to zero. The wheel rotation, road motion, and body vibration settle without snapping. The existing hologram completion and orbit-inspection behavior remain available.

Wheel animation will be frame-rate independent. Rotation uses accumulated radians and wraps periodically to avoid unbounded values.

## Loading and Cache Behavior

`WelcomePage` will load `/models/red_bull_f1_rigged.glb`. The new filename prevents existing LocalForage entries for the original model URL from masking the change.

The runtime does not require a glTF `AnimationMixer` for wheel movement. The scene node names are the contract between the Blender export and the three.js code. If a required wheel node is absent, the page must continue rendering the car and emit a clear console warning rather than failing the welcome screen.

## Performance Constraints

- Do not add per-frame scene traversal; wheel nodes are resolved once when the model is injected.
- Reuse the existing single animation loop and its frame delta.
- Avoid new allocations inside the animation loop.
- Preserve the existing renderer and post-processing behavior.
- Model optimization is limited to safe export cleanup; aggressive decimation is out of scope because it may damage the baked appearance.

## Acceptance Criteria

1. The exported GLB contains four independently transformable wheel nodes with correct pivots.
2. Rotating each wheel node in Blender or three.js rotates only the intended wheel geometry.
3. The welcome page loads the new model without visual material regressions.
4. Wheels accelerate and decelerate smoothly in response to the existing interaction.
5. Wheel motion, road motion, trails, particles, and body vibration share one coherent speed signal.
6. Reaching 100% settles the car and wheels smoothly and preserves final inspection behavior.
7. Missing wheel nodes degrade gracefully without breaking rendering.
8. `npm run lint` and `npm run build` pass.
9. Browser verification covers initial load, acceleration, maximum-speed appearance, stopping, and responsive layouts.

## Non-goals

- Physics simulation of tire grip, suspension, or vehicle dynamics.
- User-controlled steering or driving.
- A full racetrack environment.
- Rebuilding or replacing the original car materials.
- Destructive replacement of the original GLB.

## Risks and Mitigations

- **Baked wheel geometry:** spatial extraction may capture nearby suspension or body panels. Mitigation: inspect each isolated node from multiple viewport angles before export.
- **Unknown local axle orientation:** imported glTF transforms may not align with Blender axes. Mitigation: determine the axle from wheel bounds and verify a test rotation for all four wheels.
- **Large source asset:** export and browser loading can be expensive. Mitigation: preserve current mesh data, remove unused Blender scene data from the export, and avoid runtime cloning.
- **Material changes during separation:** splitting mesh objects can alter material assignments or normals. Mitigation: preserve mesh attributes and compare the exported asset visually with the original.

## Verification Strategy

- Use Blender MCP scene inspection and viewport screenshots before and after wheel extraction.
- Programmatically inspect exported glTF node names and transforms.
- Test individual wheel rotations in Blender before export.
- Run TypeScript checking and production build.
- Run the app in a real browser and capture visual evidence at idle, accelerating, high speed, and stopped states.

