# F1 Showroom Model and Transition Polish Design

Date: 2026-07-18

## Goal

Correct the remaining welcome-scene visual and model defects without replacing the existing centered copy or CTA layout. The Formula One car must visually occlude ordinary welcome text and controls where they overlap; all four complete wheel assemblies must spin; the rear Hard Rock aero panel must belong to the rear body/wing rather than a wheel; airflow must be denser and longer; the studio floor must be lighter and nearly transparent while retaining a readable reflection; and the arrival-to-studio transition must be continuous.

## Scope and invariants

- Preserve the existing centered welcome copy, progress button, stats, background image, start interaction, short-press explode/reassemble, long-press wheel/airflow interaction, and itinerary navigation.
- The car scene is visually above all ordinary welcome copy, stats, and CTA content. Loading blockers, intentional modal/easter-egg overlays, and accessibility focus feedback are the only allowed layers above it.
- When the car overlaps the CTA, the visible car wins both visually and interactively. Exposed CTA pixels remain operable.
- The four wheel assemblies are semantic assets, not fuzzy runtime guesses.
- Every exported GLB is versioned. The current production asset remains available until the replacement passes asset, runtime, and browser checks.
- The floor and camera receive their final placement once. No later reveal or orbit-readiness path may rewrite them.

## 1. Foreground car compositing and interaction

Keep the existing welcome layout rather than moving text or buttons around the car. Raise the transparent Three.js presentation canvas above the ordinary welcome UI. The floor is redesigned to be nearly transparent so the canvas does not turn into an opaque panel over the copy; opaque car pixels naturally cover any underlying text or CTA.

The canvas itself does not own normal DOM hit testing. Pointer handling moves to capture-phase listeners on the welcome root:

1. Convert pointer coordinates to the render viewport and raycast the car.
2. If the ray hits a visible car mesh, the car gesture owns the pointer and normal CTA handling is stopped.
3. If the ray misses the car, the event continues to the underlying button or other ordinary UI.
4. Existing long-press, drag cancellation, second-pointer cancellation, pointer capture, keyboard activation, and assistive-technology activation contracts remain intact.

The loading overlay and intentional full-screen modal remain above the car. No other welcome element may raise its z-index above the car canvas.

## 2. Blender wheel and rear-panel hierarchy

Use the current high-quality rigged source asset as the editable input and export a new production showroom GLB. The replacement hierarchy is explicit:

```text
CarRoot
├── Body / rear-body and wing groups
│   └── RearHardRockAeroPanel
├── WheelPivot_FL
│   ├── WheelSpin_FL
│   │   ├── tire / sidewall / tread
│   │   ├── rim and center hub
│   │   └── brake rotor where separable
│   └── WheelStatic_FL
│       ├── brake caliper
│       ├── suspension
│       └── stationary aero cover or duct
├── WheelPivot_FR
├── WheelPivot_RL
└── WheelPivot_RR
```

The same `WheelSpin_*` / `WheelStatic_*` contract applies to every corner.

Geometry assignment rules:

- The entire visible tire circumference, both sidewalls, rim, center hub, and separable rotor rotate as one assembly around the axle center.
- Brake calipers, suspension links, body panels, winglets, and wheel-adjacent aero surfaces never rotate.
- The highlighted rear Hard Rock panel is removed from the rear wheel geometry and assigned to the rear body/wing explosion group. It follows the rear wing/body during explosion and reassembly.
- Connectivity, spatial bounds, texture continuity, and multi-angle visual inspection determine component membership. A broad wheel bounding box alone is insufficient.
- Every spin node uses a local rolling axis verified in Blender and Three.js. Pivot translation, scale, and parent transforms remain stable.

Export to the new filename `red_bull_f1_showroom_v2.glb`, then update the loader only after validation. Retain the previous GLB as a recoverable fallback.

## 3. Runtime wheel contract

Resolve exactly four `WheelSpin_*` nodes once when the model is injected. `applyF1WheelAngle` rotates those nodes on the verified local axle without changing position, scale, other rotation axes, or stationary siblings.

Failure behavior remains graceful: missing nodes emit one focused warning, available wheel nodes continue to animate, and the car remains renderable. No fuzzy fallback may rotate sponsor panels, aero covers, or body geometry.

## 4. Airflow density and extent

Extend model-relative airflow beyond both ends of the car and add more silhouette families:

- high tier: 20 paths;
- mid tier: 16 paths;
- low/mobile tier: 10 paths;
- start 12% of car length ahead of the positive-Z nose;
- finish 32% of car length behind the negative-Z tail.

Paths cover roof, cockpit, sidepods, front wing shoulders, floor edges, and outer wake. They remain paired left/right, descend from nose to wake in the shipped model coordinate system, and stay above the floor clearance. Long-press hold remains the only trigger; release retains smooth decay; reduced motion keeps phase static.

## 5. Near-transparent reflective floor

Replace the charcoal slab appearance with a pale neutral-grey studio surface (`#aeb8c4`) whose base contribution is deliberately weak. The reflective tier uses a `0.10` maximum base alpha and a `0.46` localized reflection mix so the floor is nearly invisible away from the car but the softened car reflection remains readable underneath it.

The fallback tier uses the same pale neutral hue, `0.12` maximum opacity, `0.68` roughness, and no dark opaque rectangle. Both tiers preserve output colorspace conversion, explicit tone-mapping behavior, `depthWrite: false`, reveal intensity, runtime fallback, disposal, and resize safety.

## 6. Arrival and floor-reveal timeline

Remove the progress-100 pose snap. Arrival uses one damped stopped-pose controller for Z, Y, scale, and final rotation:

1. Below 100%, the current approach animation continues.
2. At 100%, final pose values become targets; the current values continue toward them with frame-rate-independent damping rather than direct assignment.
3. The pose must remain within position, scale, rotation, and speed thresholds for four consecutive frames before it is considered settled.
4. On the first settled frame, freeze the final car transform, compute the world-space assembled bounds, place the floor, set the final camera/orbit target, and call `controls.update()` once.
5. After a 120 ms stable hold, reveal the floor over 700 ms.
6. Enable user orbit input separately after the stopped pose is stable. Orbit readiness cannot change the floor or camera target.

Car pose, floor position, camera framing, and copy layout therefore never change abruptly in the same frame.

## 7. Project guidance

Create a root `AGENTS.md` containing F1 welcome-scene invariants:

- the car canvas stays above ordinary welcome UI;
- only loading blockers and intentional modals may exceed it;
- wheel node names and geometry ownership are an asset contract;
- GLB replacements use new versioned filenames and preserve the previous asset;
- every F1 visual/model change must run asset checks, wheel-only rotation checks, explode/reassemble checks, and desktop/mobile browser screenshots;
- arrival screenshots must include the transition timeline rather than only stable endpoints.

## 8. Verification

Use test-first changes for every runtime behavior.

Automated checks cover:

- layer ordering and capture-phase car-versus-CTA arbitration;
- exactly four `WheelSpin_*` nodes with preserved stationary siblings;
- real shipped GLB hierarchy, pivot orientation, and Hard Rock panel ownership;
- each wheel's complete rotating bounds and absence of body-panel rotation;
- frame-rate-independent stopped-pose damping and absence of direct progress-100 transform assignments;
- one-time floor/camera placement before reveal;
- airflow counts, front/rear extent, direction, floor clearance, material behavior, and disposal;
- pale low-alpha floor plus readable reflection and fallback behavior;
- exploded parts remaining above the floor through explosion and reassembly.

Blender verification rotates each `WheelSpin_*` node by 90 degrees individually, captures multiple angles, and confirms stationary aero/body geometry does not move. Explosion verification confirms the rear Hard Rock panel follows the rear body/wing rather than the rear tire.

Playwright verification covers desktop and mobile viewports, including:

- initial/start/arrival/stopped timeline captures;
- car occlusion of welcome text and CTA plus exposed CTA operation;
- all four wheel assemblies during long press;
- airflow density, length, fit, release decay, and reduced motion;
- pale near-transparent floor and reflection;
- explode/reassemble ownership and floor clearance;
- maximum vertical orbit limits;
- final itinerary navigation.

## Failure and rollback behavior

- Blender writes to a new asset path; it never overwrites the last accepted production GLB in place.
- If model export, compression, node validation, or browser inspection fails, keep the old loader URL and report the exact failing contract.
- If the reflective render path fails, use the near-transparent fallback floor without breaking car interaction.
- If airflow allocation fails, wheel motion and the rest of the scene continue.
- All GPU, gesture, render-target, and model resources retain idempotent cleanup.
