# F1 Long-Press Airflow and Studio Lighting Design

## Goal

Enhance the existing welcome-scene interaction without changing its page structure, copy, exploded-view transition, or navigation. While the user holds the engine-start control, only the four named wheel groups accelerate and a restrained wind-tunnel visualization appears around the car. Releasing the control lets the wheels coast to rest and fades the airflow away. The car should read like a premium studio render through stronger soft-box highlights and a blurred floor reflection.

## Interaction

- Pointer or touch hold drives a normalized `holdIntensity` toward `1`.
- Releasing drives `holdIntensity` toward `0`; airflow opacity reaches zero in roughly 350 ms while wheel speed decays with visible inertia.
- Wheel rotation applies only to `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, and `Wheel_RR`. Their original local transforms and pivots remain intact.
- Airflow begins after a short 150 ms visual ramp, moves from the front of the car toward the rear, and exists only while the control is held.
- Existing engine-start progress semantics remain unchanged. Reaching 100% does not make airflow persist.
- Reduced-motion mode keeps the lighting and reflection but disables wheel rotation and moving flow phases; airflow uses a brief static fade while held.

## Airflow Rendering

Use 14 prebuilt `THREE.CatmullRomCurve3` paths, converted once to `TubeGeometry`. Paths are authored in the F1 model's local coordinate space and grouped under the car so orbiting, depth motion, scaling, and exploded-view transitions cannot detach them.

The curves form three families:

1. Low paths split around the front wing and front tires before rejoining behind the sidepods.
2. Mid paths follow the nose, suspension, sidepods, and rear wing.
3. High paths arc over the cockpit and halo before tapering behind the car.

All tubes share one additive `ShaderMaterial`. The vertex shader passes longitudinal UVs; the fragment shader combines a soft white-blue core, a moving dashed phase, and edge falloff. Uniforms control time, opacity, speed, and intensity. Geometry is never rebuilt in the render loop. In the current renderer, the additive emissive core supplies the perceived outer glow; no post-processing bloom pass is required.

Desktop uses 14 paths. The low-power tier uses 8 paths and fewer radial segments. Airflow materials disable depth writes but retain depth testing so portions correctly disappear behind the car.

## Wheel Motion

Resolve wheel groups once through the existing F1 model helper. Maintain a scalar wheel angular velocity and angle. Holding eases velocity toward the configured maximum; release applies exponential damping. Each frame assigns the accumulated angle to the correct local rolling axis without replacing the wheel's position, scale, pivot, or nested geometry transforms.

Missing wheel names produce one warning and do not fall back to rotating fuzzy name matches, sponsor panels, brake ducts, or aero covers.

## Studio Lighting

The lighting rig uses three deliberate sources:

- A wide overhead rectangular area light creates a continuous soft-box highlight along the nose, bodywork, and rear wing.
- Two cool rim lights define tire shoulders, suspension arms, front wing edges, and rear silhouette.
- A weak frontal fill preserves livery color and carbon-fiber detail while keeping the scene predominantly dark.

Existing HDR/environment lighting remains the base reflection source. Exposure and additive airflow intensity are tuned conservatively so white airflow cores and headlights retain detail. Holding may raise the key and rim intensities slightly, driven by `holdIntensity`, but the lighting never flashes abruptly.

## Floor Reflection

Replace the visually flat road surface beneath the hero car with a dark, rough studio floor. Desktop and balanced tiers use a half-resolution planar reflection render target. The reflected texture is vertically projected onto the floor and blurred in two passes to create the broad, imperfect reflection visible in the reference. The floor adds subtle roughness/noise so the image does not resemble polished glass.

The reflection pass excludes the floor itself and respects the existing car, lights, and airflow. The essential/mobile tier skips the extra render pass and uses environment reflection plus the existing contact shadow. Render targets resize only when the viewport changes and are disposed on component teardown.

## Architecture

- `src/components/effects/f1Airflow.ts`: create, update, and dispose airflow geometry/materials.
- `src/components/effects/studioReflection.ts`: planar reflection target, blur passes, floor material, resize, and disposal.
- `src/lib/f1-model.ts`: retain strict wheel resolution; expose pure wheel-motion helpers if needed for tests.
- `src/components/ParticleBackground.tsx`: compose the effects and feed them `isPressing`, frame delta, quality tier, and car transforms.

Each effect owns its GPU resources and exposes idempotent disposal. `ParticleBackground` remains responsible for the single animation loop and interaction state.

## Failure and Performance Behavior

- If airflow creation fails, the car and wheel interaction continue without airflow.
- If planar reflection allocation fails, the floor falls back to its non-reflective PBR material.
- Clamp frame delta after tab suspension to prevent wheel jumps and shader phase discontinuities.
- No per-frame geometry, material, texture, or render-target allocation is allowed.
- The reflection pass is capped at half viewport resolution and disabled on the essential tier.

## Verification

- Unit/contract checks confirm only the four canonical wheel nodes receive rolling transforms.
- Motion checks confirm hold accelerates wheels, release damps velocity, and no release-time snap occurs.
- Airflow checks confirm shared material use, fixed geometry allocation, hold-only opacity, correct phase direction, and complete disposal.
- Reflection checks confirm tier fallback, resize behavior, self-exclusion, and render-target disposal.
- Production build must pass.
- Browser verification covers desktop long-press, release fade, wheel-only motion, airflow occlusion, reflection alignment, reduced motion, and a mobile viewport fallback.

## Out of Scope

- Copying or redistributing shader source, models, textures, or other assets from the reference site.
- Replacing the current F1 model or changing the exploded-view choreography.
- Adding new chapters, controls, color selectors, audio behavior, route graphics, or navigation transitions.
