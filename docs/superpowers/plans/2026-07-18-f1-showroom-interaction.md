# F1 Showroom Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reveal a refined studio floor only after the F1 car stops, move wheel/airflow effects to a direct long-press car interaction, keep exploded parts above that floor, remove the redundant visible control, and prevent vertical camera flipping.

**Architecture:** Keep `WelcomePage` responsible for progress and exploded-view state, while `ParticleBackground` owns Three.js hit testing, gesture state, camera control, and frame-by-frame scene transitions. Put reusable math in focused helpers: showroom interaction timing in `f1-showroom-interaction.ts`, model bounds/floor safety in `f1-model.ts`, and model-relative airflow construction in `f1Airflow.ts`. Extend the reflection effect with a reveal interface so reflective and fallback floors share identical state behavior.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, OrbitControls, Motion, Node assertion scripts, Vite.

## Global Constraints

- Start progress behavior, model assets, audio assets, and the itinerary application must remain unchanged.
- The studio floor reveal duration is exactly 600 ms after progress reaches 100.
- The existing automatic exploded-view reveal remains after the car stops.
- Start-button presses must never drive car-local airflow or stationary wheel motion.
- Car long-press is available only when progress is 100 and the car is assembled.
- Exploded parts must not receive downward world-space offsets and must remain above the measured studio floor.
- Vertical orbit must remain above the floor; horizontal orbit stays enabled and panning stays disabled.
- No visible bottom exploded-view button is rendered.
- Reduced-motion mode keeps wheels static and uses restrained, non-animated held airflow.

---

### Task 1: Pure showroom state helpers and reflection reveal

**Files:**
- Create: `src/lib/f1-showroom-interaction.ts`
- Create: `scripts/check-f1-showroom-interaction.ts`
- Modify: `src/components/effects/studioReflection.ts`
- Modify: `scripts/check-f1-reflection.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `stepStudioReveal(current: number, stopped: boolean, delta: number): number`.
- Produces: `canStartCarHold(input: CarGestureInput): boolean`.
- Produces: `classifyCarRelease(input: CarGestureInput & { holdStarted: boolean }): 'toggle' | 'end-hold' | 'ignore'`.
- Extends `StudioReflectionEffect` with `setReveal(reveal: number): void`.

- [ ] **Step 1: Add failing pure-state checks**

Create `scripts/check-f1-showroom-interaction.ts`:

```ts
import assert from 'node:assert/strict';
import {
  CAR_DRAG_TOLERANCE_PX,
  CAR_HOLD_DELAY_MS,
  canStartCarHold,
  classifyCarRelease,
  stepStudioReveal,
} from '../src/lib/f1-showroom-interaction';

let reveal = 0;
for (let index = 0; index < 36; index += 1) reveal = stepStudioReveal(reveal, true, 1 / 60);
assert(reveal > 0.98, 'floor must finish its 600 ms reveal');
for (let index = 0; index < 36; index += 1) reveal = stepStudioReveal(reveal, false, 1 / 60);
assert(reveal < 0.02, 'floor must hide before the stopped state');

const base = {
  elapsedMs: CAR_HOLD_DELAY_MS,
  travelPx: 0,
  startedOnCar: true,
  stopped: true,
  exploded: false,
};
assert.equal(canStartCarHold(base), true);
assert.equal(canStartCarHold({ ...base, exploded: true }), false);
assert.equal(canStartCarHold({ ...base, travelPx: CAR_DRAG_TOLERANCE_PX + 1 }), false);
assert.equal(classifyCarRelease({ ...base, holdStarted: true }), 'end-hold');
assert.equal(classifyCarRelease({ ...base, elapsedMs: 100, holdStarted: false }), 'toggle');
assert.equal(classifyCarRelease({ ...base, travelPx: CAR_DRAG_TOLERANCE_PX + 1, holdStarted: false }), 'ignore');
```

Add `"check:f1-showroom-interaction": "node --import tsx scripts/check-f1-showroom-interaction.ts"` to `package.json`.

- [ ] **Step 2: Run the pure-state check and confirm failure**

Run: `npm run check:f1-showroom-interaction`

Expected: FAIL because `src/lib/f1-showroom-interaction.ts` does not exist.

- [ ] **Step 3: Implement gesture and 600 ms reveal helpers**

Create `src/lib/f1-showroom-interaction.ts`:

```ts
export const STUDIO_REVEAL_MS = 600;
export const CAR_HOLD_DELAY_MS = 260;
export const CAR_DRAG_TOLERANCE_PX = 8;

export interface CarGestureInput {
  elapsedMs: number;
  travelPx: number;
  startedOnCar: boolean;
  stopped: boolean;
  exploded: boolean;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const stepStudioReveal = (
  current: number,
  stopped: boolean,
  rawDelta: number,
): number => {
  const delta = Math.min(0.1, Math.max(0, rawDelta));
  const step = delta / (STUDIO_REVEAL_MS / 1000);
  return clamp01(current + (stopped ? step : -step));
};

export const canStartCarHold = (input: CarGestureInput): boolean =>
  input.startedOnCar
  && input.stopped
  && !input.exploded
  && input.elapsedMs >= CAR_HOLD_DELAY_MS
  && input.travelPx <= CAR_DRAG_TOLERANCE_PX;

export const classifyCarRelease = (
  input: CarGestureInput & { holdStarted: boolean },
): 'toggle' | 'end-hold' | 'ignore' => {
  if (input.holdStarted) return 'end-hold';
  if (
    input.startedOnCar
    && input.stopped
    && input.travelPx <= CAR_DRAG_TOLERANCE_PX
    && input.elapsedMs < CAR_HOLD_DELAY_MS
  ) return 'toggle';
  return 'ignore';
};
```

- [ ] **Step 4: Add failing reflection reveal assertions**

Extend `scripts/check-f1-reflection.ts` after fallback creation:

```ts
assert.equal(fallback.floor.visible, false, 'fallback floor must start hidden');
fallback.setReveal(0.5);
assert.equal(fallback.floor.visible, true);
assert.equal((fallback.floor.material as THREE.MeshStandardMaterial).opacity, 0.5);
fallback.setReveal(0);
assert.equal(fallback.floor.visible, false);
assert.match(source, /uReveal/);
assert.match(source, /setReveal: \(reveal\) =>/);
```

Run: `npm run check:f1-reflection`

Expected: FAIL because `setReveal` is missing and the floor starts visible.

- [ ] **Step 5: Implement reveal-aware charcoal reflection and fallback**

In `src/components/effects/studioReflection.ts`:

```ts
export interface StudioReflectionEffect {
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  setReveal: (reveal: number) => void;
  render: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

const createFallbackMaterial = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  color: 0x15191e,
  metalness: 0.32,
  roughness: 0.58,
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
```

Add a `uReveal` uniform initialized to zero to the shader, multiply the reflection mix by `uReveal`, output alpha `uReveal`, and set `transparent: true` plus `depthWrite: false`. Both returned effect branches implement:

```ts
setReveal: (rawReveal) => {
  const reveal = THREE.MathUtils.clamp(rawReveal, 0, 1);
  floor.visible = reveal > 0.001;
  if (floor.material instanceof THREE.ShaderMaterial) {
    floor.material.uniforms.uReveal.value = reveal;
  } else {
    floor.material.opacity = reveal;
  }
},
```

Initialize `floor.visible = false`. Skip reflection rendering while the floor is hidden. Preserve reveal opacity when switching to the runtime fallback material.

- [ ] **Step 6: Run focused checks**

Run: `npm run check:f1-showroom-interaction && npm run check:f1-reflection`

Expected: both commands PASS with no output.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/check-f1-showroom-interaction.ts scripts/check-f1-reflection.ts src/lib/f1-showroom-interaction.ts src/components/effects/studioReflection.ts
git commit -m "feat: add stopped-state studio reveal"
```

---

### Task 2: Model-relative airflow and exploded-part floor safety

**Files:**
- Modify: `src/lib/f1-model.ts`
- Modify: `src/components/effects/f1Airflow.ts`
- Create: `scripts/check-f1-model.ts`
- Modify: `scripts/check-f1-airflow.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getF1LocalBounds(root: THREE.Object3D): THREE.Box3`.
- Extends `F1ExplodedPart` with `localBounds: THREE.Box3`.
- Extends `updateF1ExplodedParts(parts, amount, delta, options?: { floorY: number; clearance: number }): void`.
- Produces: `createF1AirflowPaths(bounds: THREE.Box3): THREE.Vector3[][]`.
- Extends `createF1Airflow(tier, options)` with `options.bounds?: THREE.Box3`.

- [ ] **Step 1: Write failing model safety checks**

Create `scripts/check-f1-model.ts` with a scaled/rotated root, two mesh parts, and these assertions:

```ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createF1ExplodedParts,
  getF1LocalBounds,
  updateF1ExplodedParts,
} from '../src/lib/f1-model';

const root = new THREE.Group();
const upper = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2));
upper.position.set(0.8, 1.2, 0);
const lower = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1));
lower.position.set(-0.8, 0.25, 0);
root.add(upper, lower);
root.rotation.z = 0.08;
root.scale.setScalar(3);
root.updateMatrixWorld(true);

const bounds = getF1LocalBounds(root);
assert(bounds.min.x < bounds.max.x && bounds.min.y < bounds.max.y && bounds.min.z < bounds.max.z);

const parts = createF1ExplodedParts(root);
for (const part of parts) assert(part.explodedOffset.y >= 0, 'exploded offset must not point downward');
for (let index = 0; index < 120; index += 1) {
  updateF1ExplodedParts(parts, 1, 1 / 60, { floorY: -0.01, clearance: 0.01 });
  root.updateMatrixWorld(true);
}
for (const part of parts) {
  assert(new THREE.Box3().setFromObject(part.object).min.y >= -1e-4, 'part must stay above floor');
}
```

Add `"check:f1-model": "node --import tsx scripts/check-f1-model.ts"` to `package.json`.

- [ ] **Step 2: Run the model check and confirm failure**

Run: `npm run check:f1-model`

Expected: FAIL because `getF1LocalBounds` and floor options do not exist.

- [ ] **Step 3: Implement local bounds and world-floor correction**

In `src/lib/f1-model.ts`, implement `getF1LocalBounds` by updating world matrices, transforming each mesh geometry bounding-box corner through `root.matrixWorld.clone().invert().multiply(object.matrixWorld)`, and expanding one root-local `Box3`.

When computing exploded directions, replace negative vertical movement with a minimum upward component before normalization:

```ts
directionWorld.x *= 1.35;
directionWorld.y = Math.max(EXPLODE_LIFT, directionWorld.y * 1.8 + EXPLODE_LIFT);
directionWorld.z *= 0.72;
```

Store a cloned geometry bounding box in each `F1ExplodedPart`. After interpolating a part position, update its world matrix, transform all eight local-bound corners to find `worldMinY`, and convert any positive floor correction back through the inverse parent world matrix as a direction:

```ts
const correction = Math.max(0, floorY + clearance - worldMinY);
if (correction > 0 && part.object.parent) {
  const parentInverse = part.object.parent.matrixWorld.clone().invert();
  const localOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(parentInverse);
  const localLift = new THREE.Vector3(0, correction, 0).applyMatrix4(parentInverse).sub(localOrigin);
  part.object.position.add(localLift);
}
```

Only apply the guard when the part's local exploded amount is greater than zero.

- [ ] **Step 4: Add failing model-relative airflow checks**

Extend `scripts/check-f1-airflow.ts`:

```ts
import { createF1AirflowPaths } from '../src/components/effects/f1Airflow';

const compactBounds = new THREE.Box3(
  new THREE.Vector3(-2, -0.5, -5),
  new THREE.Vector3(2, 1.5, 5),
);
const paths = createF1AirflowPaths(compactBounds);
assert.equal(paths.length, 14);
for (const path of paths) {
  assert(path[0].z <= compactBounds.min.z + 1.5, 'paths must begin near the nose');
  assert(path.at(-1)!.z > compactBounds.max.z, 'paths must exit behind the rear');
  assert(path.every((point) => point.y >= compactBounds.min.y), 'paths must not run below the car');
}
const bounded = createF1Airflow('high', { bounds: compactBounds });
assert.equal(bounded.group.children.length, 14);
```

Run: `npm run check:f1-airflow`

Expected: FAIL because `createF1AirflowPaths` and `bounds` are missing.

- [ ] **Step 5: Replace fixed airflow coordinates with normalized silhouette families**

In `src/components/effects/f1Airflow.ts`, export `createF1AirflowPaths(bounds)`. Use bounds center/size to map normalized points into model-local coordinates. Define seven left-side families around the nose shoulder, front wing, sidepod, cockpit, engine cover, floor edge, and outer wake, then mirror their X coordinates for seven right-side families. Use `bodyHalfWidth = size.x * 0.34`, start Z near `bounds.min.z`, and finish Z at `bounds.max.z + size.z * 0.16`. Keep all Y values at or above `bounds.min.y + size.y * 0.12`.

Change the factory path loop to:

```ts
const paths = createF1AirflowPaths(options.bounds ?? DEFAULT_F1_BOUNDS);
for (const points of paths.slice(0, pathCountForTier(tier))) {
  const geometry = createGeometry(
    new THREE.CatmullRomCurve3(points),
    72,
    Math.max(0.004, options.bounds ? options.bounds.getSize(new THREE.Vector3()).x * 0.0018 : 0.006),
    tier === 'high' ? 5 : 3,
    false,
  );
  geometries.add(geometry);
  group.add(new THREE.Mesh(geometry, material));
}
```

Keep the existing allocation-failure transaction and shared material behavior.

- [ ] **Step 6: Run model and airflow checks**

Run: `npm run check:f1-model && npm run check:f1-airflow`

Expected: both commands PASS with no output.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/check-f1-model.ts scripts/check-f1-airflow.ts src/lib/f1-model.ts src/components/effects/f1Airflow.ts
git commit -m "feat: fit F1 airflow and protect exploded parts"
```

---

### Task 3: Integrate stopped-floor, raycast gestures, and bounded camera

**Files:**
- Modify: `src/components/ParticleBackground.tsx`
- Modify: `src/components/WelcomePage.tsx`
- Modify: `scripts/check-f1-wheel-hold.ts`
- Modify: `scripts/check-f1-welcome.ts`

**Interfaces:**
- Consumes: Task 1 gesture/reveal helpers and `StudioReflectionEffect.setReveal`.
- Consumes: Task 2 `getF1LocalBounds`, model-relative `createF1Airflow`, and exploded floor options.
- Preserves: `ParticleBackgroundProps.onCarClick?: () => void` as the short-press action.

- [ ] **Step 1: Add failing integration-source checks**

Update `scripts/check-f1-wheel-hold.ts` to require:

```ts
assert.match(particleBackgroundSource, /carHeld:\s*false/);
assert.match(particleBackgroundSource, /stepF1WheelMotion\(wheelMotion, s\.carHeld, delta, prefersReducedMotion\)/);
assert.match(particleBackgroundSource, /holdIntensity: wheelMotion\.holdIntensity/);
assert.doesNotMatch(particleBackgroundSource, /stepF1WheelMotion\(wheelMotion, s\.isPressing/);
assert.match(particleBackgroundSource, /new THREE\.Raycaster\(\)/);
assert.match(particleBackgroundSource, /raycaster\.intersectObject\(f1CarGroup, true\)/);
assert.match(particleBackgroundSource, /controls\.minPolarAngle = Math\.PI \/ 3/);
assert.match(particleBackgroundSource, /controls\.maxPolarAngle = Math\.PI \/ 2 - 0\.04/);
assert.match(particleBackgroundSource, /controls\.enablePan = false/);
assert.match(particleBackgroundSource, /reflection\.setReveal\(studioReveal\)/);
assert.match(particleBackgroundSource, /updateF1ExplodedParts\([\s\S]*?floorY: reflection\.floor\.position\.y/);
```

Update `scripts/check-f1-welcome.ts` to replace the visible-button assertions with:

```ts
assert.doesNotMatch(source, /\{\/\* Exploded view toggle \*\/\}/);
assert.doesNotMatch(source, /CLICK CAR TO REASSEMBLE/);
assert.match(source, /onCarClick=\{toggleExplodedView\}/);
```

- [ ] **Step 2: Run integration checks and confirm failure**

Run: `npm run check:f1-wheel-hold && npm run check:f1-welcome`

Expected: FAIL because start-button state still drives wheels, center-distance clicking remains, camera polar limits are absent, and the visible button still exists.

- [ ] **Step 3: Separate start progress from stopped-car hold**

In `ParticleBackground.tsx`, add `carHeld: false` to `stateRef`, keep a `onCarClickRef`, and update wheels/airflow with car-held state:

```ts
stepF1WheelMotion(wheelMotion, s.carHeld, delta, prefersReducedMotion);
airflow?.update({
  time: airflowTime,
  holdIntensity: prefersReducedMotion
    ? wheelMotion.holdIntensity * 0.35
    : wheelMotion.holdIntensity,
  reducedMotion: prefersReducedMotion,
});
studioLighting.update(wheelMotion.holdIntensity);
```

Create airflow only after model injection:

```ts
airflow = createF1Airflow(usesLowPowerEffects ? 'low' : 'high', {
  bounds: getF1LocalBounds(f1CarGroup),
});
f1CarGroup.add(airflow.group);
```

Drive the floor independently:

```ts
studioReveal = stepStudioReveal(studioReveal, s.progress >= 100, delta);
reflection.setReveal(studioReveal);
```

When the car first reaches its final transform, measure its assembled world lower bound and set `reflection.floor.position.y` slightly below it. Pass that Y value and a `0.03` clearance into `updateF1ExplodedParts`.

- [ ] **Step 4: Add native raycast tap/hold/drag handling**

Inside the Three.js setup effect, create one `THREE.Raycaster`, one normalized pointer vector, and a gesture record `{ pointerId, startedAt, startX, startY, travelPx, startedOnCar, holdStarted }`. Resolve a hit with the canvas rectangle and `raycaster.intersectObject(f1CarGroup, true)`.

On pointer down over a stopped car, start a 260 ms timer. The timer calls `canStartCarHold`, sets `stateRef.current.carHeld = true`, and temporarily disables orbit controls. Pointer movement updates maximum travel; movement past 8 px cancels the timer. Pointer release calls `classifyCarRelease`: `toggle` invokes `onCarClickRef.current`, `end-hold` clears `carHeld`, and `ignore` leaves the exploded state untouched. Pointer cancel, lost capture, window blur, and cleanup clear the timer and hold state.

Remove the React `onClick` center-distance approximation. Make the container focusable only after stop:

```tsx
tabIndex={progress >= 100 ? 0 : -1}
aria-label="Interactive Formula One showroom car"
onKeyDown={(event) => {
  if (progress >= 100 && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    onCarClick?.();
  }
}}
```

Set the Three.js container to `zIndex: 65`, below the existing `z-[70]` main content, so the start/enter button remains directly clickable without synthetic forwarding.

- [ ] **Step 5: Apply final camera and road constraints**

Configure OrbitControls once:

```ts
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.minDistance = 28;
controls.maxDistance = 68;
controls.enablePan = false;
```

When controls first enable, set their target to the assembled car world bounding-box center with a small downward bias toward the chassis. Preserve full horizontal orbit. Keep the high-speed hairline opacity driven by approach `racingSpeed`, which reaches zero at progress 100.

- [ ] **Step 6: Remove the visible exploded-view button**

Delete `explodedToggleLabel` and the entire `Exploded view toggle` button block from `WelcomePage.tsx`. Keep `toggleExplodedView`, automatic explosion, click-to-toggle behavior, reassembly-before-enter behavior, and `ParticleBackground onCarClick={toggleExplodedView}`.

- [ ] **Step 7: Run focused integration checks**

Run: `npm run check:f1-wheel-hold && npm run check:f1-welcome && npm run check:f1-airflow && npm run check:f1-reflection && npm run check:f1-model && npm run check:f1-showroom-interaction`

Expected: all six commands PASS with no assertion output.

- [ ] **Step 8: Commit**

```bash
git add src/components/ParticleBackground.tsx src/components/WelcomePage.tsx scripts/check-f1-wheel-hold.ts scripts/check-f1-welcome.ts
git commit -m "feat: refine stopped F1 showroom interactions"
```

---

### Task 4: Full verification and visual regression pass

**Files:**
- Modify if defects are found: `src/components/ParticleBackground.tsx`
- Modify if defects are found: `src/components/effects/studioReflection.ts`
- Modify if defects are found: `src/components/effects/f1Airflow.ts`
- Modify if defects are found: `src/lib/f1-model.ts`
- Modify if defects are found: focused check scripts associated with the corrected behavior

**Interfaces:**
- Consumes the completed stopped-scene interaction.
- Produces a buildable, visually verified welcome experience.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm run lint
npm run build
npm run check:f1-motion
npm run check:f1-wheel-hold
npm run check:f1-airflow
npm run check:f1-welcome
npm run check:f1-studio
npm run check:f1-reflection
npm run check:f1-model
npm run check:f1-showroom-interaction
npm run check:showroom-assets
```

Expected: TypeScript and Vite complete successfully; every check exits with status zero.

- [ ] **Step 2: Launch the app for browser verification**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL on port 3000.

- [ ] **Step 3: Verify desktop behavior at 1440 × 900**

Use browser automation to confirm:

1. Before holding the start button, no dark floor block is visible.
2. During approach, the car and speed environment appear but no car-local airflow is visible.
3. At 100%, the charcoal reflective floor fades in without covering the lower half in pure black.
4. A short car press explodes/reassembles; there is no visible bottom button.
5. Every separated part remains visibly above the floor throughout the animation.
6. A 260+ ms stationary hold on the assembled car spins wheels and reveals close-fitting airflow; releasing decays both.
7. A camera drag does not toggle exploded view or start airflow.
8. Maximum vertical drags stop above the floor and cannot invert the car.
9. The Enter button remains clickable after the canvas becomes interactive.

- [ ] **Step 4: Verify mobile behavior at 390 × 844 and reduced motion**

Repeat stopped-floor, tap, hold, and camera-limit checks. Emulate `prefers-reduced-motion: reduce`; confirm the wheel remains static while held airflow is restrained and non-animated, and all controls remain usable.

- [ ] **Step 5: Fix only observed regressions and rerun their focused checks**

For each defect, first add or tighten the nearest assertion script, run it to confirm failure, apply the smallest correction in the owning file, then rerun the focused check plus `npm run lint` and `npm run build`.

- [ ] **Step 6: Commit verification fixes if needed**

```bash
git add src scripts package.json
git commit -m "fix: polish F1 showroom interaction verification"
```

If no fixes were needed, do not create an empty commit.
