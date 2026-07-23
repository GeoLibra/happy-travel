# F1 Showroom Model and Transition Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Red Bull car occlude ordinary welcome UI, rebuild all four semantic wheel assemblies and rear Hard Rock panel ownership in Blender, lengthen airflow, lighten the reflective floor, and remove the final arrival snap.

**Architecture:** A versioned Blender export supplies explicit `WheelSpin_*`, `WheelStatic_*`, and `RearHardRockAeroPanel` nodes. Pure TypeScript helpers own stopped-pose damping and pointer-layer arbitration; `ParticleBackground` composes those helpers with the existing scene. Airflow and floor effects retain independent resource lifecycles and are verified with contract checks plus desktop/mobile browser evidence.

**Tech Stack:** Blender 5.1, Python/bpy, glTF 2.0, glTF Transform/Meshopt, React 19, TypeScript 5.8, Three.js 0.183, Vite 6, Playwright CLI.

## Global Constraints

- Keep the existing centered welcome copy, CTA, stats, start flow, explode/reassemble, long-press interaction, and itinerary navigation.
- Car canvas z-index is `95`; ordinary welcome UI is at or below `90`; intentional modal/easter-egg is `100`; loading blocker is `110`.
- The exposed part of the CTA stays clickable; a car ray hit takes priority over CTA handling.
- Production asset filename is exactly `public/models/red_bull_f1_showroom_v2.glb`; the current showroom GLB remains untouched.
- Required rotating nodes are exactly `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR`.
- `RearHardRockAeroPanel` is a rear-body/wing child and never a `WheelSpin_*` descendant.
- Airflow tiers contain exactly 20/16/10 paths and extend from `+12%` ahead of the nose to `-32%` behind the tail.
- Floor color is `#aeb8c4`; reflective base alpha is `0.10`; reflection mix is `0.46`; fallback opacity is `0.12`; fallback roughness is `0.68`.
- Stopped pose must satisfy thresholds for four consecutive frames, hold 120 ms, then reveal the floor over 700 ms.
- Use test-first Red/Green cycles and commit after every task.

---

### Task 1: Lock project guidance and foreground-layer arbitration

**Files:**
- Create: `AGENTS.md`
- Modify: `scripts/check-f1-welcome.ts`
- Modify: `scripts/check-f1-showroom-interaction.ts`
- Modify: `src/components/WelcomePage.tsx`
- Modify: `src/components/ParticleBackground.tsx`
- Modify: `src/lib/f1-showroom-interaction.ts`

**Interfaces:**
- Consumes: existing `CarGestureInput`, car raycast, welcome root pointer events.
- Produces: `classifyShowroomPointerLayer(input: { carHit: boolean; interactiveUiHit: boolean }): 'car' | 'ui' | 'background'` and root capture handlers that preserve CTA operation.

- [ ] **Step 1: Write the failing guidance and layer tests**

Add these exact assertions:

```ts
assert.equal(classifyShowroomPointerLayer({ carHit: true, interactiveUiHit: true }), 'car');
assert.equal(classifyShowroomPointerLayer({ carHit: false, interactiveUiHit: true }), 'ui');
assert.equal(classifyShowroomPointerLayer({ carHit: false, interactiveUiHit: false }), 'background');
assert.match(particleSource, /zIndex:\s*95/);
assert.match(welcomeSource, /z-\[70\]/);
assert.match(welcomeSource, /z-\[110\]/);
assert.match(welcomeSource, /onPointerDownCapture=/);
```

Also assert that root `AGENTS.md` contains the exact phrases `car canvas stays above ordinary welcome UI`, `WheelSpin_FL`, `versioned GLB`, `desktop and mobile`, and `arrival timeline`.

- [ ] **Step 2: Run the focused checks and verify RED**

Run:

```bash
npm run check:f1-welcome
npm run check:f1-showroom-interaction
```

Expected: both exit 1 because the pure layer classifier, z-index contract, root capture handler, and `AGENTS.md` do not exist.

- [ ] **Step 3: Add the minimal classifier and guidance**

Implement:

```ts
export const classifyShowroomPointerLayer = ({
  carHit,
  interactiveUiHit,
}: {
  carHit: boolean;
  interactiveUiHit: boolean;
}): 'car' | 'ui' | 'background' => {
  if (carHit) return 'car';
  if (interactiveUiHit) return 'ui';
  return 'background';
};
```

Set the car canvas to z-index `95` and `pointerEvents: 'none'`. Add root capture-phase pointer handlers that calculate the car ray hit before the target handler. Stop propagation only for the `car` result; allow `ui` events through unchanged. Route captured car events into the existing car-gesture state machine.

Create `AGENTS.md` with the five exact invariants from the test plus the modal/loading exceptions and required F1 checks.

- [ ] **Step 4: Verify GREEN**

Run the two focused checks and `npm run lint`. Expected: exit 0 with no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md scripts/check-f1-welcome.ts scripts/check-f1-showroom-interaction.ts src/components/WelcomePage.tsx src/components/ParticleBackground.tsx src/lib/f1-showroom-interaction.ts
git commit -m "feat: keep F1 car above welcome UI"
```

---

### Task 2: Rebuild semantic wheel and rear-panel geometry in Blender

**Files:**
- Create: `scripts/prepare_f1_showroom_v2.py`
- Create: `scripts/verify-f1-showroom-v2.mjs`
- Create: `public/models/red_bull_f1_showroom_v2.glb`
- Modify: `scripts/check-showroom-assets.mjs`

**Interfaces:**
- Consumes: `public/models/red_bull_f1_rigged.glb`, Blender `bpy`, glTF Transform CLI.
- Produces: versioned GLB containing four `WheelPivot_*`, four `WheelSpin_*`, four `WheelStatic_*`, and one `RearHardRockAeroPanel` under a rear body/wing parent.

- [ ] **Step 1: Write the failing asset contract**

Extend `check-showroom-assets.mjs` and the new verifier to assert:

```js
const SPINS = ['WheelSpin_FL', 'WheelSpin_FR', 'WheelSpin_RL', 'WheelSpin_RR'];
const STATICS = ['WheelStatic_FL', 'WheelStatic_FR', 'WheelStatic_RL', 'WheelStatic_RR'];
for (const name of [...SPINS, ...STATICS, 'RearHardRockAeroPanel']) {
  assert.ok(indexByName.has(name), `Missing required node: ${name}`);
}
for (const name of SPINS) {
  assert.ok(hasMeshDescendant(nodes, indexByName.get(name)), `${name} has no rotating geometry`);
}
assert.equal(isDescendantOfAny('RearHardRockAeroPanel', SPINS), false);
assert.equal(isDescendantOfRearBody('RearHardRockAeroPanel'), true);
```

Assert model size is at most 15 MB, all four pivot transforms are finite, spin nodes have zero local translation below pivots, and the loader source refers to `red_bull_f1_showroom_v2.glb` only after the asset exists.

- [ ] **Step 2: Run the asset check and verify RED**

Run `npm run check:showroom-assets`.

Expected: exit 1 because the v2 asset and semantic nodes are missing.

- [ ] **Step 3: Implement the Blender rebuild script**

The script must expose and call these concrete functions:

- `connected_components(mesh: bpy.types.Mesh) -> list[list[int]]`: build vertex adjacency from mesh edges and return every connected vertex-index set exactly once.
- `world_points(obj: bpy.types.Object, indices: list[int]) -> list[Vector]`: multiply each selected vertex coordinate by `obj.matrix_world`.
- `classify_wheel_component(points: list[Vector], wheel_key: str) -> Literal['spin', 'static', 'reject']`: use the declared axle center/radius, side ratio, radial extent, and component center; return `spin` for tire/rim/hub/rotor, `static` for caliper/suspension/duct, and `reject` outside the wheel envelope.
- `separate_component(obj: bpy.types.Object, indices: list[int], name: str) -> bpy.types.Object`: assign the indices to a temporary vertex group, separate selected vertices in Edit Mode, remove temporary groups, and return the named mesh object.
- `create_wheel_hierarchy(key: str, rotating: list[bpy.types.Object], stationary: list[bpy.types.Object]) -> None`: create `WheelPivot_{key}`, `WheelSpin_{key}`, and `WheelStatic_{key}`, preserve world transforms during parenting, and set the spin origin to the declared axle center.
- `rebuild_semantic_wheels(meshes: list[bpy.types.Object]) -> None`: classify every connected component for each axle, separate accepted components, reject cross-axle/body components, require at least 800 rotating vertices per wheel, enforce at most 20% left/right axle vertex-count asymmetry, and call `create_wheel_hierarchy` for all four keys.
- `extract_rear_hard_rock_panel(meshes: list[bpy.types.Object]) -> bpy.types.Object`: select the isolated rear Hard Rock connected component inside the rear-wheel/body envelope, separate it, name it `RearHardRockAeroPanel`, and parent it to the nearest rear body/wing component while preserving its world matrix.
- `validate_scene_contract() -> None`: assert all required nodes exist, each spin has mesh descendants, stationary siblings and rear panel are outside spin descendants, and a temporary 90-degree spin leaves all stationary world matrices unchanged.
- `export_glb(path: Path) -> None`: export only `F1_Car` and descendants as GLB without cameras, lights, or animations, preserving normals, UVs, attributes, and materials.

Copy `reset_scene()` and the GLB import mechanics from the existing `scripts/prepare_f1_wheels.py`, but set `SOURCE_GLB` to `public/models/red_bull_f1_rigged.glb` and `OUTPUT_UNCOMPRESSED_GLB` to `public/models/red_bull_f1_showroom_v2-uncompressed.glb`. The entry point is exactly:

```py
def main() -> None:
    reset_scene()
    import_source()
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("Source GLB imported without mesh objects")
    rebuild_semantic_wheels(mesh_objects)
    rear_panel = extract_rear_hard_rock_panel(mesh_objects)
    if rear_panel.name != "RearHardRockAeroPanel":
        raise RuntimeError("Rear Hard Rock panel naming contract failed")
    validate_scene_contract()
    export_glb(OUTPUT_UNCOMPRESSED_GLB)


if __name__ == "__main__":
    main()
```

Use the existing wheel centers/radii from `scripts/prepare_f1_wheels.py`. Classify tire/rim/hub/rotor connectivity into `WheelSpin_*`; classify caliper/suspension/duct connectivity into `WheelStatic_*`. Identify the highlighted Hard Rock panel by rear-wheel spatial bounds plus its isolated connected component and texture/material continuity, remove it from the wheel result, name it `RearHardRockAeroPanel`, and parent it under the rear body/wing object selected by nearest connected body component.

Before export, rotate each `WheelSpin_*` by 90 degrees and assert the stationary sibling and rear panel world matrices are unchanged, then restore rotation.

- [ ] **Step 4: Run Blender and export a versioned intermediate**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/prepare_f1_showroom_v2.py
node scripts/verify-f1-showroom-v2.mjs public/models/red_bull_f1_showroom_v2-uncompressed.glb
npx gltf-transform optimize public/models/red_bull_f1_showroom_v2-uncompressed.glb /private/tmp/red_bull_f1_showroom_v2-webp.glb --texture-compress webp
npx gltf-transform meshopt /private/tmp/red_bull_f1_showroom_v2-webp.glb public/models/red_bull_f1_showroom_v2.glb --level medium
node scripts/verify-f1-showroom-v2.mjs public/models/red_bull_f1_showroom_v2.glb
```

Expected: both verifier runs print `PASS: semantic F1 wheel and rear-panel hierarchy`; final model is at most 15 MB.

- [ ] **Step 5: Run the asset check and inspect Blender evidence**

Run `npm run check:showroom-assets`. Expected: exit 0.

Produce four 90-degree wheel rotation renders and one exploded rear-panel render under `output/blender/f1-showroom-v2/`. Open every render and verify the complete tire/rim/hub spins, stationary aero does not, and the Hard Rock panel follows the rear body/wing.

- [ ] **Step 6: Commit**

```bash
git add -f scripts/prepare_f1_showroom_v2.py scripts/verify-f1-showroom-v2.mjs public/models/red_bull_f1_showroom_v2.glb
git add scripts/check-showroom-assets.mjs
git commit -m "feat: rebuild semantic F1 wheel assemblies"
```

---

### Task 3: Consume the v2 wheel nodes at runtime

**Files:**
- Modify: `src/components/WelcomePage.tsx`
- Modify: `src/components/showroom/showroom-assets.ts`
- Modify: `src/lib/f1-model.ts`
- Modify: `src/lib/f1-wheel-motion.ts`
- Modify: `scripts/check-f1-motion.ts`
- Modify: `scripts/check-f1-wheel-hold.ts`
- Modify: `scripts/check-f1-airflow.ts`

**Interfaces:**
- Consumes: Task 2 `WheelSpin_*` nodes and v2 asset URL.
- Produces: `F1_WHEEL_SPIN_NODE_NAMES` and strict four-node wheel rotation.

- [ ] **Step 1: Write the failing runtime-node tests**

Assert the exact node list and that `applyF1WheelAngle` changes only local `rotation.x` on spin nodes while preserving position, scale, rotation Y/Z, and stationary siblings. Assert both production asset URL sites use `/models/red_bull_f1_showroom_v2.glb?v=semantic-wheels-1`.

- [ ] **Step 2: Verify RED**

Run `npm run check:f1-motion`, `npm run check:f1-wheel-hold`, and `npm run check:f1-airflow`.

Expected: exit 1 because runtime still resolves `Wheel_FL` through `Wheel_RR` and loads the old URL.

- [ ] **Step 3: Implement strict v2 resolution**

Replace the list with:

```ts
export const F1_WHEEL_SPIN_NODE_NAMES = [
  'WheelSpin_FL',
  'WheelSpin_FR',
  'WheelSpin_RL',
  'WheelSpin_RR',
] as const;
```

Resolve these nodes once, retain the single-warning missing-node behavior, and keep `applyF1WheelAngle` focused on the verified local X axle.

- [ ] **Step 4: Verify GREEN and commit**

Run the three focused checks plus `npm run lint`; expect exit 0. Commit:

```bash
git add src/components/WelcomePage.tsx src/components/showroom/showroom-assets.ts src/lib/f1-model.ts src/lib/f1-wheel-motion.ts scripts/check-f1-motion.ts scripts/check-f1-wheel-hold.ts scripts/check-f1-airflow.ts
git commit -m "feat: animate complete F1 wheel assemblies"
```

---

### Task 4: Add a continuous stopped-pose controller

**Files:**
- Create: `src/lib/f1-arrival-motion.ts`
- Create: `scripts/check-f1-arrival-motion.ts`
- Modify: `package.json`
- Modify: `src/components/ParticleBackground.tsx`
- Modify: `src/lib/f1-showroom-interaction.ts`
- Modify: `scripts/check-f1-wheel-hold.ts`
- Modify: `scripts/check-f1-showroom-interaction.ts`

**Interfaces:**
- Produces: `createF1ArrivalState()`, `stepF1ArrivalPose(state, current, target, rawDelta)`, `isF1ArrivalSettled(state)`, `stepStudioRevealDelay(state, rawDelta)`.
- Consumes: current/target position Z/Y, scale, rotation Y/Z, racing speed, frame delta.

- [ ] **Step 1: Write the failing arrival timeline test**

Cover 30/60/120 fps and assert equivalent final values. Assert no single frame changes Z by more than `0.35`, Y by more than `0.08`, scale by more than `0.12`, or rotation by more than `0.025` radians. Require four consecutive settled frames, 120 ms hold, then 700 ms reveal.

Add source assertions that prohibit direct final assignments:

```ts
assert.doesNotMatch(source, /s\.progress\s*>=\s*100\s*\?\s*-10/);
assert.doesNotMatch(source, /if \(s\.progress >= 100\) \{\s*f1CarGroup\.position\.z = targetZ/);
assert.match(source, /stepF1ArrivalPose\(/);
assert.match(source, /hasFrozenStoppedPose/);
```

- [ ] **Step 2: Verify RED**

Run `npm run check:f1-arrival-motion`, `npm run check:f1-wheel-hold`, and `npm run check:f1-showroom-interaction`.

Expected: the first command is missing and the source assertions fail.

- [ ] **Step 3: Implement the pure arrival helper**

Use frame-rate-independent exponential damping:

```ts
const damp = (current: number, target: number, rate: number, delta: number) =>
  current + (target - current) * (1 - Math.exp(-rate * Math.min(0.05, Math.max(0, delta))));
```

Track `settledFrames`, `stableHoldMs`, `poseFrozen`, and `reveal`. Freeze exact final values only after four settled frames; accumulate 120 ms while frozen; then advance reveal by `delta / 0.7`.

- [ ] **Step 4: Integrate without late rewrites**

At progress 100, step the controller rather than assign transform values. Only after `poseFrozen` becomes true: update matrix world, compute bounds, write floor Y once, copy controls target once, call `controls.update()` once, and set `hasFrozenStoppedPose`. Keep `isOrbitInteractionReady` separate and prohibit it from changing floor or target.

- [ ] **Step 5: Verify GREEN and commit**

Run all three checks plus lint; expect exit 0. Commit:

```bash
git add src/lib/f1-arrival-motion.ts scripts/check-f1-arrival-motion.ts package.json src/components/ParticleBackground.tsx src/lib/f1-showroom-interaction.ts scripts/check-f1-wheel-hold.ts scripts/check-f1-showroom-interaction.ts
git commit -m "fix: smooth F1 arrival into studio floor"
```

---

### Task 5: Increase airflow and lighten the reflective floor

**Files:**
- Modify: `src/components/effects/f1Airflow.ts`
- Modify: `src/components/effects/studioReflection.ts`
- Modify: `scripts/check-f1-airflow.ts`
- Modify: `scripts/check-f1-reflection.ts`
- Modify: `scripts/check-f1-studio.ts`

**Interfaces:**
- Consumes: v2 model bounds, existing hold intensity, quality tier, reveal state.
- Produces: 20/16/10 extended airflow paths and pale near-transparent reflection/fallback materials.

- [ ] **Step 1: Write failing airflow/floor contracts**

Assert exact tier counts, first path Z at `bounds.max.z + size.z * 0.12`, last path Z at or below `bounds.min.z - size.z * 0.32`, paired paths, minimum floor clearance, output colorspace, and unchanged release/reduced-motion behavior.

Assert exact floor values:

```ts
assert.match(source, /const STUDIO_FLOOR_COLOR = 0xaeb8c4/);
assert.match(source, /const STUDIO_FLOOR_BASE_ALPHA = 0\.10/);
assert.match(source, /const STUDIO_REFLECTION_MIX = 0\.46/);
assert.match(source, /opacity: 0\.12/);
assert.match(source, /roughness: 0\.68/);
```

- [ ] **Step 2: Verify RED**

Run `npm run check:f1-airflow`, `npm run check:f1-reflection`, and `npm run check:f1-studio`.

Expected: exit 1 with old counts, extents, color, alpha, mix, and fallback properties.

- [ ] **Step 3: Implement denser extended paths**

Add three left-side families for upper cockpit, mid-sidepod, and lower floor wake, mirror to 20 total paths, and make tier slicing return 20/16/10. Convert normalized Z so `-0.12` begins ahead of positive-Z nose and `1.32` ends behind negative-Z tail.

- [ ] **Step 4: Implement the pale transparent floor**

Define the five exact constants from Global Constraints. In the shader, keep base alpha at `0.10 * uReveal`, blend reflection at `0.46`, and raise alpha only under nonzero reflection luminance so the reflected car remains visible without an opaque slab. Keep fallback maximum opacity at `0.12`.

- [ ] **Step 5: Verify GREEN and commit**

Run all three focused checks and lint; expect exit 0. Commit:

```bash
git add src/components/effects/f1Airflow.ts src/components/effects/studioReflection.ts scripts/check-f1-airflow.ts scripts/check-f1-reflection.ts scripts/check-f1-studio.ts
git commit -m "feat: refine F1 airflow and transparent floor"
```

---

### Task 6: Full integration and browser acceptance

**Files:**
- Modify: `.superpowers/sdd/progress.md` (ignored local ledger)
- Create: `.superpowers/sdd/f1-model-polish-report.md`
- Create artifacts: `output/playwright/f1-showroom-model-polish/`
- Create artifacts: `output/blender/f1-showroom-v2/`

**Interfaces:**
- Consumes: Tasks 1–5 complete branch.
- Produces: full automated/browser/Blender evidence and a clean merge-readiness report.

- [ ] **Step 1: Run the complete automated suite**

Run every command independently and require exit 0:

```bash
npm run lint
npm run build
npm run check:f1-motion
npm run check:f1-wheel-hold
npm run check:f1-airflow
npm run check:f1-model
npm run check:f1-welcome
npm run check:f1-studio
npm run check:f1-showroom-interaction
npm run check:f1-reflection
npm run check:f1-arrival-motion
npm run check:showroom-assets
git diff --check
```

- [ ] **Step 2: Verify Playwright prerequisites and start the app**

Run `command -v npx`. Expected: a valid executable path. Start `npm run dev` and use `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh` in a named headed session with tracing.

- [ ] **Step 3: Capture desktop acceptance**

At 1440×900 capture initial, approach, arrival 0/150/300/500/800/1100 ms, stopped, long-press, release, exploded, reassembled, maximum upward orbit, and maximum downward orbit.

Visually verify: car covers intersecting UI; exposed CTA enters; no arrival/floor/camera jump; all four whole wheel assemblies rotate; no adjacent aero rotates; Hard Rock panel follows rear body/wing; airflow is denser and extends beyond nose/tail; floor is pale/near-transparent with readable reflection; exploded parts remain above floor.

- [ ] **Step 4: Capture mobile and reduced-motion acceptance**

At 390×844 repeat arrival timeline, long-press, release, explode/reassemble, and ENTER navigation. Under reduced motion capture two held frames 800 ms apart and prove wheel angle/airflow phase remain static.

- [ ] **Step 5: Inspect artifacts and report**

Open every cited Blender and Playwright image. Record viewport, timestamp, interaction, expected result, actual result, console/network issues, trace path, complete command exits, commits, and known non-blocking warnings in `.superpowers/sdd/f1-model-polish-report.md`.

- [ ] **Step 6: Final verification commit**

```bash
git add -f .superpowers/sdd/f1-model-polish-report.md
git commit -m "test: verify F1 showroom model polish"
```

Leave `output/` and `.superpowers/sdd/progress.md` ignored. Require a clean tracked worktree before handoff.
