# Rose Particle Assembly and Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make particles fly in from all directions to assemble the complete closed rose, then crossfade to the solid model while it blooms toward the viewer and continues an extremely slow rotation.

**Architecture:** Keep all deterministic timing and easing in `src/lib/rose-animation.ts`, so boundary behavior can be tested without WebGL. `ThreeRose.tsx` will sample every rose mesh by surface area once, store particle start/target/path data in typed arrays, and apply the pure timeline results to Three.js objects each frame. A shared presentation group will keep the particle silhouette and solid model aligned during rotation and crossfade.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, `MeshSurfaceSampler`, Vite, Node assertions via `tsx`.

## Global Constraints

- Assembly lasts exactly 3,000 ms; particle-to-model handoff lasts 600 ms; the existing `RoseBloom` clip lasts 4,500 ms.
- The bloom starts at 3,600 ms and ends at 8,100 ms.
- Include petals, leaves, and the complete stem in the assembled particle silhouette.
- Keep the camera distance, model scale, modal interaction, and GLB animation unchanged.
- Begin at a 35-degree three-quarter yaw, face the viewer by the end of the bloom, then rotate at 0.05 radians per second.
- Keep the existing 40,000-particle ceiling and avoid per-frame random generation or temporary vector allocation.
- Do not modify the homepage F1 animation or stage any existing unrelated worktree changes.

---

### Task 1: Define and test the rose presentation timeline

**Files:**
- Modify: `src/lib/rose-animation.ts`
- Modify: `scripts/check-rose-animation.ts`

**Interfaces:**
- Consumes: the existing `createRoseBloomAction(root, animations)` API and `ROSE_MODEL_URL`.
- Produces: `ROSE_ASSEMBLY_MS`, `ROSE_HANDOFF_MS`, `ROSE_BLOOM_START_MS`, `ROSE_BLOOM_END_MS`, `getRoseAssemblyProgress(elapsedMs, heightRatio, delayJitter)`, `getRoseHandoffProgress(elapsedMs)`, `getRosePresentationYaw(elapsedMs)`, `getRoseArcStrength(progress)`, and the revised `getRoseBloomDelta(elapsedMs, frameDeltaSeconds)`.

- [ ] **Step 1: Extend the assertion script with failing timeline tests**

Replace the timing assertions in `scripts/check-rose-animation.ts` with assertions that cover each boundary and keep the existing GLB playback assertions:

```ts
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createRoseBloomAction,
  getRoseArcStrength,
  getRoseAssemblyProgress,
  getRoseBloomDelta,
  getRoseHandoffProgress,
  getRosePresentationYaw,
  ROSE_ASSEMBLY_MS,
  ROSE_BLOOM_END_MS,
  ROSE_BLOOM_START_MS,
  ROSE_HANDOFF_MS,
  ROSE_INITIAL_YAW,
  ROSE_MODEL_URL,
} from "../src/lib/rose-animation";

const closeTo = (actual: number, expected: number, tolerance = 1e-6) => {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

assert.equal(ROSE_MODEL_URL, "/models/rose.glb?v=1ba2e7a");
assert.equal(ROSE_ASSEMBLY_MS, 3_000);
assert.equal(ROSE_HANDOFF_MS, 600);
assert.equal(ROSE_BLOOM_START_MS, 3_600);
assert.equal(ROSE_BLOOM_END_MS, 8_100);

assert.equal(getRoseAssemblyProgress(-10, 0, 0), 0);
assert.equal(getRoseAssemblyProgress(0, 0, 0), 0);
assert(getRoseAssemblyProgress(1_500, 0, 0) > getRoseAssemblyProgress(1_500, 1, 1));
assert.equal(getRoseAssemblyProgress(ROSE_ASSEMBLY_MS, 1, 1), 1);
assert.equal(getRoseAssemblyProgress(9_000, 0.5, 0.5), 1);
assert.equal(getRoseArcStrength(0), 0);
assert(getRoseArcStrength(0.5) > 0.5);
closeTo(getRoseArcStrength(1), 0);

assert.equal(getRoseHandoffProgress(2_999), 0);
assert.equal(getRoseHandoffProgress(3_000), 0);
assert(getRoseHandoffProgress(3_300) > 0 && getRoseHandoffProgress(3_300) < 1);
assert.equal(getRoseHandoffProgress(3_600), 1);

closeTo(getRosePresentationYaw(0), ROSE_INITIAL_YAW);
closeTo(getRosePresentationYaw(3_600), ROSE_INITIAL_YAW);
assert(getRosePresentationYaw(5_850) < ROSE_INITIAL_YAW);
closeTo(getRosePresentationYaw(8_100), 0);
closeTo(getRosePresentationYaw(9_100), 0.05);

assert.equal(getRoseBloomDelta(3_599, 0.016), 0);
closeTo(getRoseBloomDelta(3_608, 0.016), 0.008);
closeTo(getRoseBloomDelta(4_000, 0.1), 0.1);
closeTo(getRoseBloomDelta(8_108, 0.016), 0.008);
assert.equal(getRoseBloomDelta(8_200, 0.016), 0);

const root = new THREE.Group();
const clip = new THREE.AnimationClip("RoseBloom", 4.5, []);
const playback = createRoseBloomAction(root, [clip]);

assert(playback, "RoseBloom playback should be created");
assert.equal(playback.action.loop, THREE.LoopOnce);
assert.equal(playback.action.repetitions, 1);
assert.equal(playback.action.clampWhenFinished, true);
assert.equal(playback.action.isRunning(), true);
assert.equal(playback.mixer.time, 0);
assert.equal(createRoseBloomAction(root, []), null);

console.log("PASS: rose assembly, handoff, bloom, and presentation timing verified");
```

- [ ] **Step 2: Run the assertion script and verify the new contract fails**

Run: `npm run check:rose-animation`

Expected: TypeScript compilation fails because the new constants and helper exports do not exist yet.

- [ ] **Step 3: Implement the minimal pure timeline helpers**

Update `src/lib/rose-animation.ts` to retain `ROSE_MODEL_URL` and replace the old particle-phase constant with:

```ts
export const ROSE_ASSEMBLY_MS = 3_000;
export const ROSE_HANDOFF_MS = 600;
export const ROSE_BLOOM_DURATION_MS = 4_500;
export const ROSE_BLOOM_START_MS = ROSE_ASSEMBLY_MS + ROSE_HANDOFF_MS;
export const ROSE_BLOOM_END_MS = ROSE_BLOOM_START_MS + ROSE_BLOOM_DURATION_MS;
export const ROSE_INITIAL_YAW = THREE.MathUtils.degToRad(35);
export const ROSE_SLOW_SPIN_RADIANS_PER_MS = 0.00005;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getRoseAssemblyProgress(
  elapsedMs: number,
  heightRatio: number,
  delayJitter: number,
): number {
  const delay = 100 + clamp01(heightRatio) * 450 + clamp01(delayJitter) * 250;
  const linear = clamp01((elapsedMs - delay) / (ROSE_ASSEMBLY_MS - delay));
  return easeInOutCubic(linear);
}

export function getRoseArcStrength(progress: number): number {
  const t = clamp01(progress);
  return Math.sin(Math.PI * t) * (1 - t * 0.25);
}

export function getRoseHandoffProgress(elapsedMs: number): number {
  return easeInOutCubic((elapsedMs - ROSE_ASSEMBLY_MS) / ROSE_HANDOFF_MS);
}

export function getRosePresentationYaw(elapsedMs: number): number {
  if (elapsedMs <= ROSE_BLOOM_START_MS) return ROSE_INITIAL_YAW;
  if (elapsedMs < ROSE_BLOOM_END_MS) {
    const progress = easeInOutCubic(
      (elapsedMs - ROSE_BLOOM_START_MS) / ROSE_BLOOM_DURATION_MS,
    );
    return ROSE_INITIAL_YAW * (1 - progress);
  }
  return (elapsedMs - ROSE_BLOOM_END_MS) * ROSE_SLOW_SPIN_RADIANS_PER_MS;
}
```

Replace `getRoseBloomDelta` with an overlap calculation so frames crossing a phase boundary advance only by their active portion:

```ts
export function getRoseBloomDelta(
  elapsedMs: number,
  frameDeltaSeconds: number,
): number {
  const current = Math.max(elapsedMs, 0);
  const previous = Math.max(current - Math.max(frameDeltaSeconds, 0) * 1_000, 0);
  const activeStart = Math.max(previous, ROSE_BLOOM_START_MS);
  const activeEnd = Math.min(current, ROSE_BLOOM_END_MS);
  return Math.max(activeEnd - activeStart, 0) / 1_000;
}
```

After `action.reset().play()`, add `mixer.setTime(0)` so model matrices and surface samples use the closed first-frame pose.

- [ ] **Step 4: Run focused tests and static type checking**

Run: `npm run check:rose-animation && npm run lint`

Expected: both commands exit 0; the assertion script prints `PASS: rose assembly, handoff, bloom, and presentation timing verified`.

- [ ] **Step 5: Commit the timeline contract**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "feat: define rose presentation timeline"
```

---

### Task 2: Sample the complete closed rose and build deterministic flight data

**Files:**
- Modify: `src/components/ThreeRose.tsx:1-240`

**Interfaces:**
- Consumes: `getRoseAssemblyProgress`, `getRoseArcStrength`, `ROSE_INITIAL_YAW`, and `MeshSurfaceSampler`.
- Produces: initialized `startPositions`, `targetPositions`, `arcOffsets`, `heightRatios`, `delayJitters`, and `particlePhases` typed arrays for all 40,000 particles.

- [ ] **Step 1: Add a source-level regression assertion that initially fails**

Append this source-contract check to `scripts/check-rose-animation.ts`:

```ts
import fs from "node:fs";

const threeRoseSource = fs.readFileSync(
  new URL("../src/components/ThreeRose.tsx", import.meta.url),
  "utf8",
);
assert.match(threeRoseSource, /MeshSurfaceSampler/);
assert.match(threeRoseSource, /startPositions/);
assert.match(threeRoseSource, /targetPositions/);
assert.match(threeRoseSource, /getRoseAssemblyProgress/);
assert.doesNotMatch(threeRoseSource, /allVertices/);
```

- [ ] **Step 2: Run the assertion script and verify it fails on the old vertex sampler**

Run: `npm run check:rose-animation`

Expected: FAIL because `ThreeRose.tsx` does not contain `MeshSurfaceSampler` or particle flight buffers and still contains `allVertices`.

- [ ] **Step 3: Replace vertex-biased targets with area-weighted whole-model sampling**

In `ThreeRose.tsx`, import `MeshSurfaceSampler` from `three/examples/jsm/math/MeshSurfaceSampler.js` and import the Task 1 helpers. Replace `originalPositions` with these once-allocated arrays:

```ts
const startPositions = new Float32Array(particleCount * 3);
const targetPositions = new Float32Array(particleCount * 3);
const arcOffsets = new Float32Array(particleCount * 3);
const heightRatios = new Float32Array(particleCount);
const delayJitters = new Float32Array(particleCount);
const particlePhases = new Float32Array(particleCount);
const baseSizes = new Float32Array(particleCount);
```

After creating the bloom action and forcing the model to the first frame, update world matrices and create one sampler per visible mesh. Use the last value of each sampler's cumulative `distribution` as that mesh's surface-area weight:

```ts
const samplerEntries = meshes.flatMap((mesh) => {
  const sampler = new MeshSurfaceSampler(mesh).build();
  const distribution = sampler.distribution;
  const area = distribution?.[distribution.length - 1] ?? 0;
  return area > 0 ? [{ mesh, sampler, area }] : [];
});
const totalArea = samplerEntries.reduce((sum, entry) => sum + entry.area, 0);
```

For each particle, select a mesh by cumulative area, sample a local surface point, convert it with `mesh.localToWorld(samplePoint)`, and store it in `targetPositions`. Track the sampled minimum and maximum Y; in a second pass normalize every target Y into `heightRatios`, which makes the lower stem and leaves settle before the upper flower.

Generate start and flight data once. Use evenly distributed base angles plus random jitter so all directions are populated, and vary Z across foreground and background:

```ts
const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
const radius = 3.4 + Math.random() * 2.2;
startPositions[i3] = Math.cos(angle) * radius;
startPositions[i3 + 1] = Math.sin(angle) * radius * 0.72;
startPositions[i3 + 2] = -2.8 + Math.random() * 5.6;
arcOffsets[i3] = -Math.sin(angle) * (0.35 + Math.random() * 0.9);
arcOffsets[i3 + 1] = Math.cos(angle) * (0.2 + Math.random() * 0.65);
arcOffsets[i3 + 2] = (Math.random() - 0.5) * 1.3;
delayJitters[i] = Math.random();
particlePhases[i] = Math.random() * Math.PI * 2;
```

Initialize the live `position` attribute from `startPositions`. Keep the existing 40,000 count and color palette. Store the original random size in `baseSizes[i]` and stop reading a size value that was modified on the prior frame.

- [ ] **Step 4: Animate each particle from its start point to its whole-rose target**

During the assembly phase, update the existing position array without allocating vectors:

```ts
const progress = getRoseAssemblyProgress(elapsed, heightRatios[i], delayJitters[i]);
const inverse = 1 - progress;
const arcStrength = getRoseArcStrength(progress);
const drift = Math.sin(elapsed * 0.003 + particlePhases[i]) * inverse * 0.06;

positions[i3] = startPositions[i3] * inverse
  + targetPositions[i3] * progress
  + arcOffsets[i3] * arcStrength
  + drift;
positions[i3 + 1] = startPositions[i3 + 1] * inverse
  + targetPositions[i3 + 1] * progress
  + arcOffsets[i3 + 1] * arcStrength
  + drift * 0.6;
positions[i3 + 2] = startPositions[i3 + 2] * inverse
  + targetPositions[i3 + 2] * progress
  + arcOffsets[i3 + 2] * arcStrength;
sizes[i] = baseSizes[i] * (0.9 + 0.1 * Math.sin(elapsed * 0.004 + particlePhases[i]));
```

At and after 3,000 ms, copy exact target positions and stop applying drift so the assembled silhouette remains aligned throughout handoff.

- [ ] **Step 5: Run the focused assertion, type checking, and production build**

Run: `npm run check:rose-animation && npm run lint && npm run build`

Expected: all commands exit 0; Vite prints a successful production build without a `MeshSurfaceSampler` resolution error.

- [ ] **Step 6: Commit whole-model particle assembly**

```bash
git add src/components/ThreeRose.tsx scripts/check-rose-animation.ts
git commit -m "feat: assemble full rose from particles"
```

---

### Task 3: Crossfade, turn toward the viewer, and continue the slow rotation

**Files:**
- Modify: `src/components/ThreeRose.tsx:130-340`
- Modify: `scripts/check-rose-animation.ts`

**Interfaces:**
- Consumes: Task 1 timeline helpers and Task 2 particle buffers.
- Produces: one presentation transform shared by particles and solid rose, a 600 ms aligned handoff, a bloom-timed turn to the viewer, and post-bloom slow rotation.

- [ ] **Step 1: Add failing source assertions for the shared presentation transform**

Add these assertions to the `ThreeRose.tsx` source checks:

```ts
assert.match(threeRoseSource, /presentationGroup/);
assert.match(threeRoseSource, /getRoseHandoffProgress/);
assert.match(threeRoseSource, /getRosePresentationYaw/);
assert.doesNotMatch(threeRoseSource, /elapsed \* 0\.0002/);
```

- [ ] **Step 2: Run the focused test and verify the old continuous rotation fails**

Run: `npm run check:rose-animation`

Expected: FAIL because the source still rotates both objects with `elapsed * 0.0002` and has no shared presentation group.

- [ ] **Step 3: Put particles and the solid model under one presentation group**

Create `presentationGroup`, add it to the scene, then add both `particleSystem` and `modelGroup` to it instead of directly to the scene:

```ts
const presentationGroup = new THREE.Group();
scene.add(presentationGroup);
presentationGroup.add(particleSystem);
presentationGroup.add(modelGroup);
```

Set `presentationGroup.rotation.y = getRosePresentationYaw(elapsed)` once per frame. Do not apply an additional Y rotation to `particleSystem` or `modelGroup`; local particle arcs provide motion without breaking the handoff alignment.

- [ ] **Step 4: Apply the exact assembly, handoff, and bloom visibility states**

Capture each unique mesh material with its original `opacity` and `transparent` values once after load. Apply states as follows:

```ts
if (elapsed < ROSE_ASSEMBLY_MS) {
  particleSystem.visible = true;
  particleMaterial.opacity = 0.8;
  modelGroup.visible = false;
} else if (elapsed < ROSE_BLOOM_START_MS) {
  const handoff = getRoseHandoffProgress(elapsed);
  particleSystem.visible = handoff < 0.99;
  particleMaterial.opacity = 0.8 * (1 - handoff);
  modelGroup.visible = true;
  materialStates.forEach(({ material, opacity }) => {
    material.transparent = true;
    material.opacity = opacity * handoff;
  });
} else {
  particleSystem.visible = false;
  modelGroup.visible = true;
  materialStates.forEach(({ material, opacity, transparent }) => {
    material.opacity = opacity;
    material.transparent = transparent;
  });
}
```

Call `getRoseBloomDelta(elapsed, frameDelta)` exactly once per frame and update the mixer only when it returns a positive value. This starts the GLB bloom at 3,600 ms and clamps playback at its 8,100 ms end.

- [ ] **Step 5: Dispose every rose-owned graphics resource on cleanup**

Keep a reference to the glow texture. During cleanup, call `controls.dispose()`, `particleGeometry.dispose()`, `particleMaterial.dispose()`, `glowTexture.dispose()`, stop and uncache the animation, and dispose the renderer. Do not dispose cached GLB geometry or model materials because `loadModelWithCache` may share them with another scene instance.

- [ ] **Step 6: Run the complete local verification set**

Run: `npm run check:rose-animation && npm run check:rose-glb && npm run lint && npm run build`

Expected: all four commands exit 0; the GLB verifier reports one 4.5-second `RoseBloom` clip with 252 channels.

- [ ] **Step 7: Commit the presentation sequence**

```bash
git add src/components/ThreeRose.tsx scripts/check-rose-animation.ts
git commit -m "feat: present rose bloom toward viewer"
```

---

### Task 4: Browser visual verification and final regression check

**Files:**
- Modify only if verification exposes a defect: `src/components/ThreeRose.tsx`, `src/lib/rose-animation.ts`, `scripts/check-rose-animation.ts`
- Create screenshots outside tracked source: `output/rose-assembly/`

**Interfaces:**
- Consumes: the complete rose presentation sequence from Tasks 1–3.
- Produces: visual evidence at the assembly, handoff, bloom, and final-rotation stages.

- [ ] **Step 1: Start the application for visual verification**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite serves the application at `http://127.0.0.1:3000` without runtime errors.

- [ ] **Step 2: Capture and inspect four timeline checkpoints**

Using the browser verification tooling, open the rose modal and capture images approximately 1.0, 3.2, 5.9, and 9.2 seconds after the rose model finishes loading into `output/rose-assembly/`.

Expected visual results:

- 1.0 s: particles are visibly distributed around the frame and across foreground/background depth while moving inward.
- 3.2 s: a recognizable closed full rose includes a continuous lower stem and leaves; the solid model is beginning to crossfade without a silhouette jump.
- 5.9 s: the solid flower is opening and partway between the 35-degree start and front-facing orientation.
- 9.2 s: the flower is fully open, has passed smoothly through front-facing, and has begun only a few degrees of slow rotation.

- [ ] **Step 3: Verify interaction and scope constraints**

Drag the rose once and zoom within the existing 2–10 control range, then close and reopen the modal.

Expected: controls still work; reopening restarts at incoming particles; camera framing and final rose size match the current version; the homepage car behavior is unchanged.

- [ ] **Step 4: Run final automated checks after browser verification**

Run: `npm run check:rose-animation && npm run check:rose-glb && npm run check:f1-motion && npm run lint && npm run build`

Expected: all commands exit 0. `check:f1-motion` confirms the unrelated homepage car depth and wheel behavior remain intact.

- [ ] **Step 5: Commit only if verification required a correction**

If a correction was necessary, stage only rose-related files and commit it:

```bash
git add src/components/ThreeRose.tsx src/lib/rose-animation.ts scripts/check-rose-animation.ts
git commit -m "fix: refine rose assembly presentation"
```

If no correction was necessary, do not create an empty commit.
