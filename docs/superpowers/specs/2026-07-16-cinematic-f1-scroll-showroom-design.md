# Cinematic F1 Scroll Showroom Design

## Goal

Replace the current single-screen welcome overlay with a cinematic, scroll-driven 3D showroom that keeps the existing long-press ignition interaction, gives the Red Bull F1 model materially better lighting and surface quality, and transitions into the Shanghai weekend itinerary without feeling like a separate product.

The selected direction is:

- Use the mixed F1-and-Shanghai narrative structure.
- Use the dark, performance-focused visual language of a racing launch page.
- Use a continuous route-line morph to connect performance chapters to the Shanghai itinerary.
- Allocate roughly 80% of the experience to racing performance and 20% to the Shanghai weekend.

The reference site is an inspiration for rendering quality and scroll choreography. Its models, textures, audio, copy, code, and proprietary assets must not be copied.

## Success Criteria

The experience succeeds when:

1. The long-press ignition remains the memorable entry interaction.
2. The car reads as a real PBR object rather than a model placed over a background image.
3. Scrolling feels like one continuous camera move through a single scene, not a carousel of unrelated sections.
4. Racing chapters dominate the experience while the Shanghai transition still makes the showroom relevant to the itinerary application.
5. A mid-range phone can complete the experience without blocking, overheating, or losing access to the itinerary.
6. Asset, audio, sensor, and WebGL failures all preserve a working entry path.

## Experience Principles

### One continuous drive

Ignition, material reveal, airflow, power, circuit, and itinerary are states of one scene. The canvas remains fixed while page scroll advances a normalized narrative progress value. Copy changes at chapter boundaries, but the car, camera, lighting, audio, and route line continue through the same timeline.

### Controlled cinematic contrast

The car is not evenly lit. Large soft highlights and narrow rim lights reveal its silhouette and material changes. Black and deep navy remain dominant; red communicates speed and heat; yellow is reserved for interaction and key status; cyan and magenta appear mainly when the Shanghai destination emerges.

### Performance before spectacle

The highest visual tier uses planar reflection, dense flow lines, and selective bloom. Lower tiers reduce effect density and reflection cost while preserving the same story, copy, controls, and final transition.

### A functional ending

The final chapter does not end on a marketing screen. The Shanghai track line becomes the itinerary route and exposes an explicit `ENTER WEEKEND` action that hands control to the existing application.

## Narrative and Scroll Choreography

### Phase 00: Ignition, before scroll unlock

- The page opens in a locked, full-viewport state.
- The user presses and holds the ignition control for 2.5 seconds.
- Five start lights illuminate during the hold.
- Engine audio, progress, restrained camera vibration, and optional haptic feedback rise together.
- Releasing before 30% resets the ignition. Releasing at or after 30% allows the sequence to complete, preserving the existing interaction contract.
- Completing ignition unlocks the showroom scroll rather than immediately leaving the welcome page.
- A visible Skip control becomes available after ignition begins. It never appears beneath the Three.js canvas or behind an inaccessible layer.

### Phase 01: Material reveal, scroll 0–18%

- The car begins as a dark holographic silhouette.
- A scan plane moves across the model and blends each classified material from hologram shading to its PBR material.
- A broad overhead softbox reveals the body curvature.
- Carbon, glass, wheels, and lights resolve at slightly different rates so the change has depth.
- The existing model remains centered and readable; the camera move is a restrained side-to-three-quarter reveal.

### Phase 02: Aerodynamics, scroll 18–42%

- The environment falls nearly black.
- White flow lines travel around the car and become the dominant light source.
- Flow density, shader speed, wheel speed, and engine pitch react to smoothed scroll velocity, not raw wheel events.
- Pressure regions use short red-to-yellow accents. They do not cover the entire car.
- Telemetry copy appears as small, technical annotations and remains secondary to the model.

### Phase 03: Power and braking, scroll 42–62%

- The camera moves closer to the wheel and brake area before returning to the full car.
- Brake heat increases through an emissive gradient and fades with damping.
- Wheel rotation, subtle body vibration, audio energy, and telemetry share one normalized performance signal.
- The route line behaves like an oscilloscope trace before straightening for the circuit transition.

### Phase 04: Shanghai circuit, scroll 62–82%

- Flow lines flatten into a two-dimensional plane beneath and behind the car.
- A primary line morphs into the Shanghai International Circuit outline.
- Camera and car movement suggest entering the circuit without turning the page into a driving game.
- Performance annotations transform into event date, race session, and venue information.

### Phase 05: Weekend route, scroll 82–100%

- The circuit line extends beyond the track and becomes a stylized route through the real itinerary locations.
- Distant cyan city light and small magenta destination nodes enter the otherwise dark racing palette.
- The route reveals hotel, race, concert, and dining nodes without rendering the full itinerary list inside WebGL.
- At 100%, the car settles, audio decelerates, and `ENTER WEEKEND` becomes the primary action.
- Activating it performs a 700 ms camera push and overlay fade, then calls the existing `onEnter` handoff.
- The application never auto-enters without a final user action.

## Continuous Route-Line Transition

The route line is the main visual memory and the continuity mechanism across chapters.

Three target shapes are authored with the same number of sampled points:

1. A performance waveform and airflow path.
2. The Shanghai circuit outline.
3. The simplified itinerary route.

The effect interpolates corresponding point buffers rather than destroying and recreating line geometry at each chapter. A shader uniform or preallocated CPU buffer controls the morph. The line also carries chapter progress and active-node information, so it is both an effect and a navigation cue.

## Visual System

### Palette

- Near black: `#030406`
- Deep navy: `#071A2C`
- Racing red: `#E10600`
- Interaction yellow: `#FFB800`
- Destination cyan: `#54DDFF`
- Destination magenta: `#FF4B9B`
- Highlight white: `#F4F5F7`

Black and navy occupy most of every frame. Red is used for velocity, heat, start lights, and active telemetry. Yellow is restricted to buttons, hold progress, and essential status. Cyan and magenta do not appear strongly until the Shanghai transition.

### Typography and UI layering

- Large chapter titles use a condensed, heavy, motorsport-style display face.
- Telemetry and progress use a monospaced face.
- Itinerary copy continues using the existing application typography after the handoff.
- DOM text and controls remain above the canvas. Core copy is never baked into textures or rendered only inside WebGL.
- The fixed canvas must not intercept accessible buttons. Pointer routing is explicit rather than based on approximate screen-center hit testing.

## Materials

The current rigged GLB exposes four independent wheel nodes but only one baked material shared by all body and wheel meshes. Its carbon, paint, glass-like highlights, decals, and mechanical detail are encoded into shared textures rather than separate semantic material slots. The first showroom release therefore uses an explicit object-role profile with two reliable categories: body meshes and wheel meshes. It preserves the baked texture maps, gives those roles separate physical-material clones, and adds brake heat and lights as controlled auxiliary effects. It must not guess transparent glass regions from texture color or make baked carbon areas uniformly metallic.

True paint, carbon, glass, tire, brake, and light material separation requires reauthoring the source geometry and mask textures. That reauthoring is deferred until a revised source asset is available; the runtime interfaces remain category-based so a richer profile can be introduced without changing scene code.

### Body paint

- `MeshPhysicalMaterial` cloned from the imported PBR material where possible.
- Body-role clearcoat starts at `0.55` with clearcoat roughness near `0.16`, preserving strong softbox highlights without washing out baked carbon and glass-like regions.
- Base roughness remains in a controlled mid-low range so the body reflects softboxes without becoming chrome.
- Metallic response remains physically plausible for automotive paint and does not force every body surface to full metalness.
- Original base color, normal, occlusion, and detail maps remain available when valid.

### Baked carbon and mechanical detail

- Preserve the imported base-color, occlusion, normal, and metallic-roughness textures.
- Do not apply a separate carbon material without an authored material mask.
- Keep added clearcoat restrained enough that baked carbon areas do not read as chrome.

### Baked glass-like regions

- Preserve the imported opaque treatment in the first showroom release.
- Do not enable transmission on the shared body material because it would make unrelated bodywork transparent.
- Introduce physical transmission only after a revised model provides an explicit glass material slot or authored mask.

### Wheels, tires, brakes, and lights

- Wheel metal receives narrow, controlled highlights.
- Tire rubber remains rough and does not reflect the HDR like painted bodywork.
- Brake components expose an emissive heat parameter driven by the performance state.
- Headlights and tail lights use emissive materials plus selective bloom; bloom does not apply to the entire scene.

### Hologram transition

The existing hologram behavior remains but moves into the material system. Original materials are recorded once. The shader blends hologram and PBR contributions in a single material lifecycle instead of repeatedly replacing and disposing materials as progress changes.

## Lighting and Environment

### Garage reveal

- A studio HDR environment is processed through `PMREMGenerator`.
- A wide overhead light creates the primary body highlight.
- Cool rim light separates the car from the navy background.
- A low-intensity warm accent marks the interactive side of the frame.
- Contact shadow anchors the tires.

### Aero lab

- Environment exposure drops.
- Airflow and pressure effects become the perceived light source.
- A restrained red rim light separates the rear and underbody.
- No broad ambient wash should flatten the vehicle.

### Night circuit

- A night HDR or authored environment map provides cool reflections.
- Tail lights and sparse track lights carry the brightest values.
- Distant cyan city lighting is atmospheric and never brighter than the car's key highlights.
- High quality uses a rough planar reflection at reduced resolution. Balanced quality uses a dark rough floor plus contact shadow and a low-cost mirrored impression.

## Renderer and Post-processing

- Use sRGB output color space.
- Use ACES Filmic tone mapping.
- Animate exposure only at chapter transitions and clamp it to a narrow designed range.
- Use an `EffectComposer` pipeline with a scene render pass and selective bloom.
- Add a subtle vignette and low-amplitude film grain after bloom.
- Avoid strong chromatic aberration, full-screen blur, or bloom that destroys paint detail.
- Cap pixel ratio by quality tier rather than always using device pixel ratio up to `2`.

## Architecture

The current `ParticleBackground` owns scene creation, effects, model injection, interaction, motion, and rendering. This feature splits those responsibilities without refactoring unrelated itinerary code.

### `WelcomeShowroom`

React shell for the showroom lifecycle. It owns loading UI, ignition UI, chapter copy, Skip, final Enter action, accessibility state, and the handoff to `App`.

### `CinematicCanvas`

Owns the Three.js renderer, scenes, cameras, composer, resize handling, animation frame, and disposal. It receives mutable narrative state through stable refs so React does not rerender every frame.

### `SceneDirector`

Maps normalized scroll progress and smoothed scroll velocity into chapter-local progress, camera pose, car transform, lighting exposure, effect strength, and audio parameters. Mapping functions are pure and testable.

### `AssetManager`

Loads the car model, HDR environments, compressed textures, and optional effects. It reports critical and optional progress separately. It supports cancellation and disposes resources it owns.

### `MaterialSystem`

Classifies body and wheel object roles from a vehicle profile, builds physical-material variants while preserving baked maps, manages the hologram blend, and exposes body reveal and wheel-surface controls. Brake heat and lights remain auxiliary effects until the model supplies dedicated semantic materials.

### `EffectSystem`

Owns airflow geometry, route-line morphing, telemetry-linked visual pulses, floor treatment, selective bloom layers, and effect-level disposal.

### `AudioEngine`

Starts only from a user gesture. It controls engine volume and pitch from ignition and performance signals. Failure or denial results in silent operation, not a blocked page.

### `QualityManager`

Selects an initial quality tier using reduced-motion preference, WebGL capabilities, device memory when available, hardware concurrency, and viewport characteristics. Reduced-motion preference or missing WebGL2 selects Essential. A fine-pointer viewport at least 1024 pixels wide with at least eight logical cores selects High when reported device memory is at least 8 GB or unavailable; remaining WebGL2 devices select Balanced. After startup, High steps down to Balanced when the rolling average exceeds 22 ms for 120 frames; Balanced steps down to Essential when it exceeds 38 ms for 120 frames. Quality never rises mid-sequence.

### `AppTransition`

Runs the final camera and DOM fade, then invokes `onEnter`. It also owns cancellation so a repeated click cannot fire multiple handoffs.

## State and Data Flow

The top-level showroom state is explicit:

```text
loading -> ready -> holding -> ignited -> showroom -> complete -> entering
                   \-> ready       \---------------------------> fallback
```

- React owns discrete lifecycle and accessible UI state.
- Scroll position is converted to a normalized target progress.
- The animation loop damps target progress and velocity into render progress.
- `SceneDirector` derives chapter state from render progress.
- The director writes camera, material, effect, audio, and light parameters without causing React updates per frame.
- DOM chapter changes occur only when the active chapter index changes.

## Input Behavior

### Desktop

- Pointer hold controls ignition.
- Wheel and trackpad advance the showroom.
- Pointer movement provides a small camera parallax.
- After narrative completion, drag orbits the settled model within limited angles.

### Mobile

- Touch hold controls ignition and provides light haptic feedback when the vibration API is available.
- Vertical swipes advance the showroom.
- Device orientation provides optional parallax only after permission is granted.
- Horizontal drag at completion inspects the model.
- Safe-area insets and `100svh` are respected.

### Keyboard and assistive technology

- The ignition is a real button with progress and state announced through accessible text.
- Holding Space or Enter triggers the same ignition state machine.
- Reduced-motion mode permits a single activation instead of requiring a timed hold.
- Skip and Enter are keyboard reachable.
- Core content and itinerary navigation remain available when the canvas is hidden.

## Asset Loading and Optimization

The current welcome preload includes an approximately 44 MB rigged car and a 27 MB rose model. The showroom must not preload both before becoming usable.

- The car is the only critical 3D asset for the showroom.
- The rose model loads after entering the itinerary or immediately before the easter egg is available.
- The car is compressed with Meshopt or Draco after verifying wheel-node pivots and material assignments.
- Large textures use KTX2/Basis where visual comparison confirms acceptable quality.
- HDR environments use optimized resolution and encoding; mobile does not load desktop-sized HDRs.
- Three.js showroom code is dynamically imported so the itinerary application does not pay its full parse cost when the welcome experience is skipped or unavailable.
- Critical and optional assets have separate progress. Optional effect failure never holds the loading overlay at 99%.

The target is to reduce the initial car transfer to no more than 15 MB without visible regression at the designed camera distance. If that target cannot be met safely, the loading UI must expose real progress and allow a functional fallback instead of hiding the cost.

## Quality Tiers

### High: cinematic desktop

- WebGL2 and a capable desktop GPU.
- Pixel ratio capped at `1.75`.
- Higher-resolution HDR.
- Reduced-resolution planar reflection.
- Full selective bloom, dense airflow, brake heat, grain, and shadow quality.

### Balanced: most phones and integrated GPUs

- Pixel ratio capped at `1.25`.
- Mobile-sized HDR.
- Contact shadow and rough floor instead of dynamic planar reflection.
- Airflow density reduced by at least 50%.
- Simplified glass and lower post-processing resolution.

### Essential: low power, WebGL constraints, or reduced motion

- Pixel ratio capped at `1.0` when WebGL remains active.
- Static key poses with small crossfades and optional light parallax.
- No planar reflection, continuous particles, bloom, or sensor requirement.
- The same chapter copy, Skip, and Enter actions remain available.

## Failure Handling

- **Car model failure:** show the existing hero image with CSS lighting and chapter copy; enable Skip and Enter.
- **HDR failure:** use authored hemisphere, key, and rim lights with the imported materials.
- **Optional texture or effect failure:** omit that effect and continue.
- **Audio failure or autoplay denial:** remain silent and expose a muted status; never retry in a loop.
- **Motion permission denial:** use touch and pointer parallax only.
- **WebGL unavailable or context lost:** switch to the essential DOM/CSS experience and preserve entry.
- **Slow load:** show truthful critical-asset progress, a loading explanation, and a Skip action.
- **Transition re-entry:** guard the Enter action so `onEnter` fires once.

Every async loader and animation owner must support cleanup when the welcome overlay unmounts.

## Performance Constraints

- No per-frame React state updates.
- No per-frame scene traversal or unbounded object allocation.
- Reuse geometry, materials, vectors, matrices, and typed arrays inside the animation loop.
- Render only while the showroom is visible.
- Pause or heavily reduce rendering when the document is hidden.
- Step quality down when sustained frame time exceeds the tier budget.
- Favor stable frame pacing over maintaining every effect.

Acceptance targets:

- High tier: visually stable near 60 fps on a capable desktop at the designed viewport.
- Balanced tier: at least 30 fps on representative mid-range phones.
- Essential tier: immediate access to complete content and navigation regardless of frame rate.

## Testing Strategy

### Pure logic tests

- Ignition state transitions and release thresholds.
- Scroll-to-chapter mapping at every boundary.
- Damped render progress and velocity behavior across frame rates.
- Camera, exposure, wheel speed, brake heat, and audio parameter ranges.
- Quality-tier selection and step-down rules.
- Route-line point interpolation.
- Enter transition fires `onEnter` once.

### Asset checks

- Required car nodes and four wheel pivots remain present after compression.
- Vehicle material profile resolves the body group and four wheel nodes.
- Missing role names warn and preserve imported materials.
- HDR and texture fallbacks initialize successfully.
- Optimized asset sizes are reported by a verification script.

### Browser verification

- Desktop at 1440p and a smaller laptop viewport.
- Representative phone portrait and landscape viewports.
- Long press, early release, automatic completion after 30%, Skip, scroll, drag, and final Enter.
- Audio allowed and denied.
- Motion permission allowed and denied.
- Reduced motion.
- Slow network, model failure, HDR failure, and WebGL fallback.
- Initial, material, aero, power, circuit, weekend, and handoff screenshots.

### Project verification

- `npm run lint`
- `npm run build`
- Existing F1 wheel, rose animation, and i18n checks remain green.

## Acceptance Criteria

1. The existing long-press ignition unlocks a scroll-driven showroom instead of immediately entering the itinerary.
2. The showroom contains the five confirmed post-ignition chapters and the 80/20 racing-to-Shanghai balance.
3. The car uses role-aware body and wheel PBR treatment that preserves baked texture maps, plus studio/night environment lighting, ACES tone mapping, and restrained selective bloom.
4. Hologram-to-PBR blending completes without repeatedly replacing materials or leaking GPU resources.
5. Airflow, wheel motion, brake heat, audio, and telemetry share a coherent smoothed performance signal.
6. One continuous line morphs from performance waveform to Shanghai circuit to itinerary route.
7. The final chapter exposes an explicit Enter action and hands off once to the existing itinerary.
8. High, balanced, and essential tiers preserve the same content and navigation.
9. Asset, audio, permission, and WebGL failures do not block entry.
10. Keyboard, reduced-motion, touch, pointer, and responsive layouts are verified.
11. The rose model is removed from the critical welcome preload.
12. TypeScript checking, the production build, existing checks, and browser verification pass.

## Non-goals

- Reproducing or copying the reference site's code or assets.
- Building a user-controlled racing game or vehicle physics simulation.
- Rebuilding the Red Bull model from scratch.
- Adding live race telemetry or network-dependent event data.
- Replacing the existing itinerary, map, rose easter egg, or localization systems.
- Adding a full vehicle configurator or body-color picker in this iteration.
- Refactoring unrelated application screens.

## Risks and Mitigations

- **Large car asset:** loading can dominate the experience. Mitigation: compress the car, split critical and optional loading, and lazy-load the rose.
- **Unknown material naming:** automatic classification can apply the wrong shader. Mitigation: use an explicit vehicle material profile and preserve unknown imported materials.
- **Post-processing cost:** reflection and bloom can collapse mobile frame rate. Mitigation: quality tiers, reduced-resolution passes, and automatic step-down.
- **Scroll instability:** raw wheel events can create camera jumps. Mitigation: normalize document progress and damp it inside the render loop.
- **Transparent glass artifacts:** transmission and depth order can hide interior surfaces. Mitigation: verify material order and provide a simpler mobile material.
- **Route morph mismatch:** different point counts can kink or fold. Mitigation: pre-sample all target paths to an identical ordered point count and test interpolation.
- **Canvas blocks controls:** a full-screen canvas can intercept DOM interaction. Mitigation: keep UI in a separate DOM layer with deliberate pointer-event ownership.
- **Context loss or cleanup leaks:** a large cinematic scene can leave GPU resources behind. Mitigation: centralize ownership, cancellation, and disposal in the canvas and asset systems.

## Delivery Boundary

Implementation will land as a focused showroom change. It will split the monolithic Three.js welcome renderer into the components described above and add optimized assets and tests. It must preserve unrelated user changes in the worktree and must not include the visual-companion files under `.superpowers/` in product commits.
