# F1 Wheel and Racing Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a wheel-rigged F1 GLB and drive a coherent centered-car racing effect from the existing welcome-page progress.

**Architecture:** A reproducible Blender Python script classifies baked mesh connected components against four measured wheel cylinders, moves them into named wheel nodes, creates steering-ready pivots, and exports a new GLB. A small pure TypeScript motion module owns speed damping and wheel-angle integration; `ParticleBackground` resolves wheel nodes once and applies that state to the existing effects loop.

**Tech Stack:** Blender 5.1 / `bpy`, Blender MCP, glTF 2.0 GLB, React 19, Three.js 0.183, TypeScript 5.8, Vite 6.

## Global Constraints

- Preserve `public/models/red_bull_f1.glb` unchanged.
- Export `public/models/red_bull_f1_rigged.glb` with nodes `WheelPivot_FL`, `WheelPivot_FR`, `WheelPivot_RL`, `WheelPivot_RR`, `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, and `Wheel_RR`.
- Keep the car centered; apparent travel comes from wheels, road, trails, particles, and restrained body/camera motion.
- Ease speed to zero at 100% and preserve hologram/orbit inspection.
- Do not traverse the scene or allocate objects inside the animation loop.
- Do not touch untracked `output/` and do not commit unless requested.

---

### Task 1: Reproducible Blender wheel extraction and GLB contract

**Files:**
- Create: `scripts/prepare_f1_wheels.py`
- Create: `scripts/verify-f1-glb.mjs`
- Create: `public/models/red_bull_f1_rigged.glb`

**Interfaces:**
- Consumes: the currently loaded Blender scene or `public/models/red_bull_f1.glb`.
- Produces: the eight exact pivot/wheel node names listed in Global Constraints; wheel mesh local X is the spin axis.

- [ ] **Step 1: Write the failing GLB contract check**

Create a dependency-free Node script that reads the GLB header and JSON chunk, collects `json.nodes[].name`, and throws when any required node is absent. It must also require at least one mesh descendant under every `Wheel_*` node.

- [ ] **Step 2: Verify the contract fails before export**

Run: `node scripts/verify-f1-glb.mjs public/models/red_bull_f1.glb`

Expected: exit code 1 and a message listing all eight missing nodes.

- [ ] **Step 3: Implement deterministic wheel classification**

In `scripts/prepare_f1_wheels.py`, declare these measured wheel centers in model coordinates:

```python
WHEELS = {
    "FL": (-1, -1.378, 0.253, 0.285),
    "FR": ( 1, -1.378, 0.253, 0.285),
    "RL": (-1,  1.014, 0.254, 0.260),
    "RR": ( 1,  1.014, 0.254, 0.260),
}
```

For each mesh object, build vertex adjacency from edges and enumerate connected components. Classify a component only when all of these hold:

- its side matches the sign of the wheel center;
- at least 90% of vertices have `abs(x) >= 0.28`;
- at least 92% of vertices lie within `radius * 1.08` of the wheel center in the YZ plane;
- its YZ bounding-box center lies within `0.08` model units of the wheel center;
- its YZ extent is no larger than `radius * 2.2` on either axis.

Move classified polygons, preserving material indices, UVs, normals, and vertex colors, from their source objects into one mesh per wheel. Abort without export if any wheel receives fewer than 5,000 vertices or if left/right vertex counts differ by more than 20% on an axle.

- [ ] **Step 4: Create pivots and normalize transforms**

Create `F1_Car` and four empty pivot nodes at `(0, y, z)`. Place each `Wheel_*` object's origin at `(0, y, z)` while preserving world-space vertex positions, parent it to its pivot, and parent the remaining imported hierarchy plus pivots to `F1_Car`. Verify a temporary `rotation_euler.x = 0.35` changes only the intended wheel, then restore zero.

- [ ] **Step 5: Run through Blender MCP and inspect visually**

Execute the script in the connected Blender instance. Capture viewport screenshots from front three-quarter and rear three-quarter views before export. If classification assertions fail, print per-wheel component and vertex counts and adjust only the numeric tolerance constants, not the hierarchy contract.

- [ ] **Step 6: Export and verify the GLB**

Export selected `F1_Car` hierarchy as glTF binary to `public/models/red_bull_f1_rigged.glb`, with materials, normals, UVs, and vertex colors enabled; cameras and lights excluded.

Run: `node scripts/verify-f1-glb.mjs public/models/red_bull_f1_rigged.glb`

Expected: `PASS: four wheel pivots and four wheel meshes found`.

### Task 2: Pure frame-rate-independent racing motion

**Files:**
- Create: `src/lib/f1-motion.ts`
- Create: `scripts/check-f1-motion.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:

```ts
export interface F1MotionState { speed: number; wheelAngle: number }
export function getTargetSpeed(progress: number, isPressing: boolean): number
export function stepF1Motion(state: F1MotionState, targetSpeed: number, delta: number): F1MotionState
```

- [ ] **Step 1: Write failing deterministic checks**

The check script must assert: zero progress targets zero; progress 50 targets a positive speed; progress 100 targets zero; ten 16 ms steps accelerate monotonically; stopping converges; and one 32 ms wheel-angle step is within 3% of two 16 ms steps.

- [ ] **Step 2: Verify the checks fail**

Run: `npx tsx scripts/check-f1-motion.ts`

Expected: FAIL because `src/lib/f1-motion.ts` does not exist.

- [ ] **Step 3: Implement the motion functions**

Clamp progress and delta, derive a smooth target with `smoothstep(0, 1, progress / 100)`, force the target to zero at 100%, exponentially damp speed using `1 - exp(-response * delta)`, integrate wheel angle with a constant maximum angular speed, and wrap the result into `[0, 2π)`.

- [ ] **Step 4: Add and run the verification command**

Add `"check:f1-motion": "tsx scripts/check-f1-motion.ts"` to `package.json`.

Run: `npm run check:f1-motion`

Expected: `PASS: F1 motion is smooth and frame-rate independent`.

### Task 3: Integrate wheel and environment motion into the welcome page

**Files:**
- Modify: `src/components/WelcomePage.tsx:67-78`
- Modify: `src/components/ParticleBackground.tsx:193-217`
- Modify: `src/components/ParticleBackground.tsx:450-701`

**Interfaces:**
- Consumes: `F1MotionState`, `getTargetSpeed`, `stepF1Motion`, and the exact Blender node names.
- Produces: coherent runtime wheel, road, particle, and body motion.

- [ ] **Step 1: Switch to the versioned model URL**

Change the car URL to `/models/red_bull_f1_rigged.glb`; keep the rose loading and LocalForage behavior unchanged.

- [ ] **Step 2: Resolve the wheel-node contract once**

When the car is injected, resolve the four `Wheel_*` nodes with `getObjectByName`, store them in a fixed array, and emit one `console.warn` containing missing names. Do not retry or traverse on later frames.

- [ ] **Step 3: Advance the shared motion state**

After obtaining `delta`, compute target speed and call `stepF1Motion`. Apply `wheelAngle` to each wheel's local `rotation.x`, using opposite signs on left/right only if the Blender viewport test confirms mirrored local axes.

- [ ] **Step 4: Drive all racing cues from speed**

Replace direct progress-based line acceleration with the normalized motion speed. Scale particle reverse force, road displacement, line opacity, body vertical vibration, and subtle roll from that same value. Keep all temporary numbers and vectors outside the loop.

- [ ] **Step 5: Keep the car centered and preserve completion**

Remove the deep-screen Z translation as the primary travel cue. Ease the car to its hero Z position early, retain its existing scale/reveal, and ensure vibration decays with speed. At 100%, keep hologram progression and `OrbitControls` behavior unchanged.

- [ ] **Step 6: Run static verification**

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and a generated `dist/` bundle.

### Task 4: Browser and Blender acceptance

**Files:**
- Create: `docs/dev-loop-runs/2026-07-15-f1-racing-animation/artifacts/screenshots/`
- Modify: `docs/dev-loop-runs/2026-07-15-f1-racing-animation/04-acceptance-report.md`

**Interfaces:**
- Consumes: the exported model and integrated welcome-page behavior.
- Produces: visual and command evidence for every acceptance criterion.

- [ ] **Step 1: Start the app and clear the model cache for the test origin**

Run the Vite dev server on `127.0.0.1:3000`. In the browser, clear IndexedDB/LocalForage for the local origin before the first load.

- [ ] **Step 2: Verify the complete interaction**

Capture desktop screenshots at idle, initial press, approximately 50% progress, maximum visible speed before completion, and the settled 100% inspection state. Confirm wheel motion is visible, the body remains centered, and no static-wheel ghost geometry remains.

- [ ] **Step 3: Verify responsive layouts and console health**

Repeat the acceleration and stopped checks at a mobile viewport. Confirm no new console errors, missing-node warnings, clipping, or unreadable overlays.

- [ ] **Step 4: Record final evidence**

Record GLB contract output, motion-check output, TypeScript/build results, screenshot paths, known visual limitations, and final PASS/PASS_WITH_NOTES verdict in the acceptance report.

