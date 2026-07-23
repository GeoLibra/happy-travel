# Vehicle Model Abstraction Design

## Goal

Remove F1-specific naming and constants from reusable runtime code so another vehicle model can be introduced by supplying a model configuration. Preserve the current Red Bull F1 asset, appearance, motion, hologram transition, and interaction behavior.

## Selected Design

Use a generic runtime plus an explicit per-model adapter. Automatic wheel detection is intentionally out of scope because glTF node names and axle semantics cannot be inferred reliably.

- `src/lib/vehicle-model.ts` owns generic model-node resolution and applies wheel rotation on a configured local axis and direction.
- `src/lib/vehicle-motion.ts` owns generic progress-to-depth mapping, target-speed calculation, damping, and wheel-angle integration. Scene values are supplied through configuration.
- `src/config/vehicle-models.ts` owns the Red Bull F1 asset URL, wheel-node contract, wheel axis/direction, placement, scale range, depth range, progress threshold, speed response, and maximum wheel angular speed.
- `WelcomePage` loads the active vehicle URL from configuration.
- `ParticleBackground` consumes the active configuration and generic helpers. Existing local variable names that describe a car may remain where they are UI-specific, but reusable APIs must not contain `F1`.

## Public Interfaces

The configuration contains only currently required differences:

```ts
type VehicleAxis = 'x' | 'y' | 'z';

interface VehicleModelConfig {
  id: string;
  url: string;
  wheelNodes: readonly string[];
  wheelAxis: VehicleAxis;
  wheelDirection: number;
  position: { x: number; y: number };
  scale: { start: number; end: number };
  depth: { start: number; end: number };
  autoMotionProgress: number;
  speedResponse: number;
  maxWheelAngularSpeed: number;
}
```

Generic helpers accept configuration instead of importing a specific vehicle profile. Missing wheel nodes degrade gracefully: available nodes continue to animate and one warning identifies the model and missing nodes.

## Compatibility

The Red Bull profile retains the current values: four `Wheel_*` nodes, local X rotation, scale 8 to 12, Y position -10, depth -150 to 0, 30% auto-motion threshold, response 5.5, and maximum angular speed 85. This refactor must not introduce automatic bounding-box normalization because that would alter the current presentation; normalization can be added later as an opt-in profile strategy.

## Testing

Rename the existing F1 motion check to a generic vehicle check and make it exercise a synthetic non-F1 configuration. Verify configurable depth endpoints, configurable speed response, configurable wheel speed, axis-aware wheel rotation, missing-node warnings, frame-rate independence, TypeScript checking, and the production build.

## Non-goals

- Selecting models dynamically in the UI.
- Automatically discovering wheels or axle orientation.
- Changing the GLB hierarchy or asset.
- Changing the visible racing effect.
- Refactoring unrelated F1 branding in itinerary cards and map markers.
