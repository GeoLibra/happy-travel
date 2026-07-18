# F1 Airflow and Studio Lighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hold-only wheel motion, aerodynamic tube flow, studio lighting, and a tiered blurred floor reflection to the existing F1 welcome scene.

**Architecture:** Keep `ParticleBackground` as the only animation-loop owner, but move wheel dynamics, airflow resources, studio lights, and reflection resources into focused modules with small update/dispose interfaces. All geometry and render targets are allocated during setup, updated through uniforms or scalar state, and released idempotently.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, GLSL, Vite 6, Node assertion scripts run with `tsx`.

## Global Constraints

- Preserve the existing page structure, copy, model replacement, exploded-view choreography, audio behavior, and navigation transition.
- Rotate only `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, and `Wheel_RR`; never fuzzy-match wheel-like names.
- Airflow appears only while held, begins with a 150 ms ramp, and fades to zero in about 350 ms after release.
- Desktop uses 14 airflow paths; low-power mode uses 8.
- Keep depth testing on and depth writes off for airflow.
- Use a half-resolution planar reflection on desktop/balanced; essential/mobile uses a non-render-target fallback.
- Clamp frame delta and perform no per-frame geometry, material, texture, or render-target allocation.
- Preserve every pre-existing uncommitted change unless a task explicitly modifies the same lines.

---

## File Map

- `src/lib/f1-wheel-motion.ts`: pure hold intensity, velocity, angle, and wheel-axis updates.
- `src/components/effects/f1Airflow.ts`: authored curves, shared shader, update, tier selection, and disposal.
- `src/components/effects/f1StudioLighting.ts`: soft-box and rim-light rig plus hold-driven intensity updates.
- `src/components/effects/studioReflection.ts`: reflective floor, mirrored camera, half-resolution targets, separable blur, fallback, resize, and disposal.
- `src/components/ParticleBackground.tsx`: composition only; inject the model, attach effects, update them each frame, render reflection before the main pass, resize, and dispose.
- `scripts/check-f1-wheel-hold.ts`, `scripts/check-f1-airflow.ts`, `scripts/check-f1-studio.ts`, `scripts/check-f1-reflection.ts`: deterministic contracts.
- `package.json`: expose the four checks.

---

### Task 1: Hold-Only Wheel Dynamics

**Files:**
- Create: `src/lib/f1-wheel-motion.ts`
- Create: `scripts/check-f1-wheel-hold.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: canonical wheel objects from `resolveF1WheelNodes(root)`.
- Produces: `createF1WheelMotionState()`, `stepF1WheelMotion(state, held, delta, reducedMotion)`, and `applyF1WheelAngle(wheels, angle)`.

- [ ] **Step 1: Write the failing behavior check**

```ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyF1WheelAngle, createF1WheelMotionState, stepF1WheelMotion } from '../src/lib/f1-wheel-motion';

const state = createF1WheelMotionState();
for (let i = 0; i < 60; i++) stepF1WheelMotion(state, true, 1 / 60, false);
assert(state.velocity > 4);
assert(state.holdIntensity > 0.95);
const releaseVelocity = state.velocity;
for (let i = 0; i < 30; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < releaseVelocity && state.velocity > 0);
for (let i = 0; i < 180; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < 0.02);
assert(state.holdIntensity < 0.02);

const wheel = new THREE.Group();
wheel.position.set(1, 2, 3);
wheel.rotation.set(0.1, 0.2, 0.3);
applyF1WheelAngle([wheel], 1.25);
assert.deepEqual(wheel.position.toArray(), [1, 2, 3]);
assert.equal(wheel.rotation.x, 1.25);
assert.equal(wheel.rotation.y, 0.2);
assert.equal(wheel.rotation.z, 0.3);
```

- [ ] **Step 2: Run the check and verify red**

Run: `node --import tsx scripts/check-f1-wheel-hold.ts`

Expected: FAIL with `Cannot find module '../src/lib/f1-wheel-motion'`.

- [ ] **Step 3: Implement the pure motion state**

```ts
export interface F1WheelMotionState { velocity: number; angle: number; holdIntensity: number; }
export const createF1WheelMotionState = (): F1WheelMotionState => ({ velocity: 0, angle: 0, holdIntensity: 0 });
export const stepF1WheelMotion = (state: F1WheelMotionState, held: boolean, rawDelta: number, reduced: boolean): void => {
  const delta = Math.min(Math.max(rawDelta, 0), 0.05);
  const targetHold = held ? 1 : 0;
  const holdRate = held ? 20 : 8.5;
  state.holdIntensity += (targetHold - state.holdIntensity) * (1 - Math.exp(-holdRate * delta));
  const targetVelocity = held && !reduced ? 13 : 0;
  const velocityRate = held ? 8 : 3.2;
  state.velocity += (targetVelocity - state.velocity) * (1 - Math.exp(-velocityRate * delta));
  state.angle = (state.angle + state.velocity * delta) % (Math.PI * 2);
};
export const applyF1WheelAngle = (wheels: THREE.Object3D[], angle: number): void => {
  for (const wheel of wheels) wheel.rotation.x = angle;
};
```

- [ ] **Step 4: Add `check:f1-wheel-hold`, run it, and run the existing motion check**

Run: `node --import tsx scripts/check-f1-wheel-hold.ts && npm run check:f1-motion`

Expected: both checks PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-f1-wheel-hold.ts src/lib/f1-wheel-motion.ts
git commit -m "feat: add hold-only F1 wheel dynamics"
```

---

### Task 2: Local-Space Aerodynamic Tubes

**Files:**
- Create: `src/components/effects/f1Airflow.ts`
- Create: `scripts/check-f1-airflow.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the injected F1 `THREE.Group`, `holdIntensity`, elapsed time, reduced-motion flag, and `AirflowTier`.
- Produces: `createF1Airflow(tier): F1AirflowEffect` with `group`, `update(input)`, and `dispose()`.

- [ ] **Step 1: Write a failing allocation and lifecycle check**

```ts
import assert from 'node:assert/strict';
import { createF1Airflow } from '../src/components/effects/f1Airflow';

const high = createF1Airflow('high');
assert.equal(high.group.children.length, 14);
const materials = new Set(high.group.children.map((child: any) => child.material));
assert.equal(materials.size, 1);
high.update({ time: 1, holdIntensity: 1, reducedMotion: false });
assert.equal(high.material.uniforms.uOpacity.value, 1);
const phase = high.material.uniforms.uTime.value;
high.update({ time: 2, holdIntensity: 0, reducedMotion: false });
assert.equal(high.material.uniforms.uOpacity.value, 0);
assert(high.material.uniforms.uTime.value > phase);
const low = createF1Airflow('low');
assert.equal(low.group.children.length, 8);
high.dispose(); high.dispose(); low.dispose();
```

- [ ] **Step 2: Run the check and verify red**

Run: `node --import tsx scripts/check-f1-airflow.ts`

Expected: FAIL because `f1Airflow.ts` does not exist.

- [ ] **Step 3: Implement authored paths and the shared shader**

Create `AIRFLOW_PATHS` as 14 arrays of 5–7 `THREE.Vector3` control points spanning local `z` from the nose to behind the rear wing, split into low/mid/high families. Build each with `new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, tier === 'high' ? 0.006 : 0.009, tier === 'high' ? 5 : 3, false)`.

Use one `ShaderMaterial` with these exact uniforms and flow rule:

```ts
uniforms: {
  uTime: { value: 0 },
  uOpacity: { value: 0 },
  uColor: { value: new THREE.Color('#dff6ff') },
  uSpeed: { value: 1 },
}
// fragment core
float phase = fract(vUv.x * 2.4 - uTime * uSpeed);
float pulse = smoothstep(0.04, 0.20, phase) * (1.0 - smoothstep(0.64, 0.94, phase));
float alpha = uOpacity * mix(0.28, 1.0, pulse);
gl_FragColor = vec4(uColor * mix(0.65, 1.6, pulse), alpha);
```

Set `transparent: true`, `depthTest: true`, `depthWrite: false`, and `blending: THREE.AdditiveBlending`. `update` assigns uniforms only. `dispose` disposes each unique geometry once and the shared material once.

- [ ] **Step 4: Run the airflow check**

Run: `node --import tsx scripts/check-f1-airflow.ts`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-f1-airflow.ts src/components/effects/f1Airflow.ts
git commit -m "feat: add hold-driven F1 airflow tubes"
```

---

### Task 3: Studio Soft-Box Lighting

**Files:**
- Create: `src/components/effects/f1StudioLighting.ts`
- Create: `scripts/check-f1-studio.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `THREE.Scene` and hold intensity.
- Produces: `createF1StudioLighting(scene): F1StudioLighting` with `update(holdIntensity)` and `dispose()`.

- [ ] **Step 1: Write the failing light-rig check**

```ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createF1StudioLighting } from '../src/components/effects/f1StudioLighting';
const scene = new THREE.Scene();
const rig = createF1StudioLighting(scene);
assert.equal(rig.group.children.length, 4);
const base = rig.key.intensity;
rig.update(1);
assert(rig.key.intensity > base);
rig.dispose(); rig.dispose();
assert(!scene.children.includes(rig.group));
```

- [ ] **Step 2: Run the check and verify red**

Run: `node --import tsx scripts/check-f1-studio.ts`

Expected: FAIL because the lighting module is missing.

- [ ] **Step 3: Implement the four-light rig**

Use a warm `RectAreaLight(0xfff4dd, 8.2, 22, 7)` at `(0, 13, 9)` aimed at the car, cool `DirectionalLight`s at `(-14, 7, -8)` and `(14, 6, -6)` with intensity `2.1`, and a weak front `DirectionalLight(0xe8f5ff, 0.65)` at `(0, 3, 18)`. `update(hold)` clamps the value and raises key/rims by at most 12%. `dispose` removes the containing group from the scene.

- [ ] **Step 4: Run the studio check**

Run: `node --import tsx scripts/check-f1-studio.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-f1-studio.ts src/components/effects/f1StudioLighting.ts
git commit -m "feat: add F1 studio soft-box lighting"
```

---

### Task 4: Tiered Blurred Planar Reflection

**Files:**
- Create: `src/components/effects/studioReflection.ts`
- Create: `scripts/check-f1-reflection.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: renderer, scene, source camera, viewport, and `'reflective' | 'fallback'` tier.
- Produces: `createStudioReflection(options): StudioReflectionEffect` with `floor`, `render()`, `resize()`, and `dispose()`.

- [ ] **Step 1: Write the failing tier/lifecycle check**

The check reads the module source and asserts the exported API, half-resolution allocation (`Math.ceil(width * 0.5)`), floor self-exclusion around reflection rendering, two blur passes, fallback without a render target, resize, and idempotent disposal. It also instantiates fallback mode without a WebGL context and confirms `render()` is a no-op.

- [ ] **Step 2: Run the check and verify red**

Run: `node --import tsx scripts/check-f1-reflection.ts`

Expected: FAIL because the reflection module is missing.

- [ ] **Step 3: Implement reflection and fallback**

Create a horizontal `PlaneGeometry(90, 80)` with a dark `MeshStandardMaterial({ color: 0x080b0f, metalness: 0.55, roughness: 0.42 })`. In reflective mode allocate two `WebGLRenderTarget`s at half viewport size, build a mirrored `PerspectiveCamera`, render the scene with `floor.visible = false` into target A, then apply horizontal and vertical five-tap Gaussian fullscreen passes A→B→A. Assign target A to a projected floor `ShaderMaterial` that mixes the blurred reflection at 42% with procedural low-frequency roughness. Restore renderer target, camera visibility, and floor visibility in `finally`.

`resize(width, height)` calls `setSize(Math.ceil(width * 0.5), Math.ceil(height * 0.5))` on both targets. Fallback mode creates only the PBR floor and never allocates targets. `dispose()` releases plane geometry, floor material, blur materials, fullscreen geometry, and both targets exactly once.

- [ ] **Step 4: Run the reflection check**

Run: `node --import tsx scripts/check-f1-reflection.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-f1-reflection.ts src/components/effects/studioReflection.ts
git commit -m "feat: add tiered studio floor reflection"
```

---

### Task 5: Compose Effects in the Existing Scene

**Files:**
- Modify: `src/components/ParticleBackground.tsx`
- Modify: `scripts/check-f1-wheel-hold.ts`

**Interfaces:**
- Consumes: all APIs from Tasks 1–4.
- Produces: the finished welcome-scene behavior without changing `ParticleBackgroundProps`.

- [ ] **Step 1: Extend the integration check before editing the scene**

Add source-level assertions that `ParticleBackground.tsx` creates each effect after renderer/scene setup, attaches `airflow.group` to `f1CarGroup`, feeds `stateRef.current.isPressing` into `stepF1WheelMotion`, uses the wheel helper, renders reflection before the main scene, resizes reflection, and disposes every effect.

- [ ] **Step 2: Run all four checks and verify the integration assertion fails**

Run: `npm run check:f1-wheel-hold && npm run check:f1-airflow && npm run check:f1-studio && npm run check:f1-reflection`

Expected: only the new `ParticleBackground` integration assertion FAILS.

- [ ] **Step 3: Integrate without replacing existing feature state**

Import the four modules. Replace the local `F1MotionState` wheel assignment with `createF1WheelMotionState`, `stepF1WheelMotion`, and `applyF1WheelAngle`, while leaving the existing racing-speed state available for road/particle behavior. Create the studio rig and reflection immediately after renderer setup. Create airflow once; on model injection call `f1CarGroup.add(airflow.group)` before compilation.

Each frame:

```ts
stepF1WheelMotion(wheelMotion, s.isPressing, delta, prefersReducedMotion);
applyF1WheelAngle(f1Wheels, wheelMotion.angle);
airflow.update({ time, holdIntensity: s.isPressing ? wheelMotion.holdIntensity : 0, reducedMotion: prefersReducedMotion });
studioLighting.update(wheelMotion.holdIntensity);
reflection.render();
```

On resize call `reflection.resize(window.innerWidth, window.innerHeight)`. During cleanup call `airflow.dispose()`, `studioLighting.dispose()`, and `reflection.dispose()` before renderer disposal. Do not modify the existing exploded-part logic, model URL, progress rules, orbit controls, or navigation callbacks.

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm run check:f1-wheel-hold
npm run check:f1-airflow
npm run check:f1-studio
npm run check:f1-reflection
npm run check:f1-motion
npm run lint
npm run build
```

Expected: all checks PASS; TypeScript reports no errors; Vite build succeeds with only the existing chunk-size advisory.

- [ ] **Step 5: Commit**

```bash
git add src/components/ParticleBackground.tsx scripts/check-f1-wheel-hold.ts
git commit -m "feat: integrate F1 airflow lighting and reflection"
```

---

### Task 6: Browser Acceptance and Performance Fallback

**Files:**
- Modify only if acceptance reveals a defect: files from Tasks 1–5.

**Interfaces:**
- Consumes: production preview.
- Produces: recorded acceptance evidence and any narrowly scoped fixes.

- [ ] **Step 1: Start the production preview**

Run: `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`

Expected: preview serves `http://127.0.0.1:4173/` with HTTP 200.

- [ ] **Step 2: Verify desktop hold and release**

At 1440×900, hold the start control for at least one second. Confirm only four wheels rotate, 14 white-blue curves follow the car, curve phase travels nose-to-tail, tubes occlude behind bodywork, soft-box highlights remain controlled, and the floor reflection aligns with the car. Release and confirm flow is invisible within 450 ms while wheel motion coasts without snapping.

- [ ] **Step 3: Verify interaction compatibility**

Complete ignition, toggle exploded view, orbit the car, reassemble, and enter. Confirm airflow remains attached during transforms, is absent when not held, reflection does not recursively reflect itself, and existing transitions behave unchanged.

- [ ] **Step 4: Verify reduced motion and mobile fallback**

At 390×844 with reduced motion enabled, confirm wheel rotation is disabled, held airflow uses a static fade, no live planar reflection pass is visible, the fallback floor/contact shadow remains, and the page stays responsive.

- [ ] **Step 5: Final verification and commit any acceptance fixes**

Run: `git diff --check && npm run lint && npm run build`.

Expected: no whitespace errors, no TypeScript errors, build succeeds. If fixes were necessary, commit only their files with `git commit -m "fix: refine F1 airflow presentation"`; otherwise create no empty commit.
