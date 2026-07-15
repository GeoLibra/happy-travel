# Rose Close-Up Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the blooming rose finish in a reference-like close-up by pitching the complete plant 70 degrees toward the viewer and smoothly scaling it from 1.0 to 1.5 without deleting or clipping the stem geometry.

**Architecture:** Extend the existing pure rose presentation timeline with one scale function and update the final pitch constant. Apply pitch and uniform scale to the existing shared `presentationGroup`, so flower, leaves, stem, and model transform together; the stem becomes less visible through depth, foreshortening, and flower occlusion rather than geometry removal.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, Vite, Node assertions via `tsx`.

## Global Constraints

- Preserve the existing 0–3,000 ms particle assembly and 3,000–3,600 ms particle/model handoff.
- During the existing 3,600–8,100 ms bloom, pitch from 0 degrees to exactly 70 degrees and scale uniformly from exactly 1.0 to exactly 1.5 using the existing cubic easing.
- After 8,100 ms, hold the 70-degree pitch and 1.5 scale while preserving the existing 0.05 radians/second yaw rotation.
- Keep the full flower, leaves, and stem geometry; do not delete, hide, mask, or clip stem meshes.
- Keep camera position, OrbitControls limits, model normalization, modal interaction, particle count, and GLB animation unchanged.
- Do not modify or stage the user's unrelated F1 files or other dirty worktree content.

---

### Task 1: Add close-up pitch and scale to the presentation timeline

**Files:**
- Modify: `src/lib/rose-animation.ts`
- Modify: `src/components/ThreeRose.tsx`
- Test: `scripts/check-rose-animation.ts`

**Interfaces:**
- Consumes: `easeInOutCubic(value)`, `ROSE_BLOOM_START_MS`, `ROSE_BLOOM_END_MS`, `ROSE_BLOOM_DURATION_MS`, and the existing `presentationGroup`.
- Produces: `ROSE_FINAL_PITCH = THREE.MathUtils.degToRad(70)`, `ROSE_FINAL_SCALE = 1.5`, and `getRosePresentationScale(elapsedMs): number`.

- [ ] **Step 1: Write failing assertions for the exact close-up endpoint**

Update the imports and presentation assertions in `scripts/check-rose-animation.ts`:

```ts
import {
  getRosePresentationPitch,
  getRosePresentationScale,
  ROSE_FINAL_PITCH,
  ROSE_FINAL_SCALE,
} from "../src/lib/rose-animation";

closeTo(ROSE_FINAL_PITCH, THREE.MathUtils.degToRad(70));
closeTo(ROSE_FINAL_SCALE, 1.5);
closeTo(getRosePresentationScale(0), 1);
closeTo(getRosePresentationScale(ROSE_BLOOM_START_MS), 1);
assert(getRosePresentationScale(5_850) > 1);
assert(getRosePresentationScale(5_850) < ROSE_FINAL_SCALE);
closeTo(getRosePresentationScale(ROSE_BLOOM_END_MS), ROSE_FINAL_SCALE);
closeTo(getRosePresentationScale(9_100), ROSE_FINAL_SCALE);

const finalPlantAxis = new THREE.Vector3(0, 1, 0).applyAxisAngle(
  new THREE.Vector3(1, 0, 0),
  ROSE_FINAL_PITCH,
);
assert(finalPlantAxis.z > 0.9, "the flower end of the plant must turn toward the +Z camera");

assert.match(
  threeRoseSource,
  /presentationGroup\.scale\.setScalar\(getRosePresentationScale\(elapsed\)\)/,
);
```

Retain the existing pitch boundary assertions and source assertion for `presentationGroup.rotation.x`.

- [ ] **Step 2: Run the focused check and verify RED**

Run: `node --import tsx scripts/check-rose-animation.ts`

Expected: FAIL because `ROSE_FINAL_PITCH` is still 32 degrees and `ROSE_FINAL_SCALE` / `getRosePresentationScale` do not exist.

- [ ] **Step 3: Implement the minimal scale timeline and 70-degree endpoint**

In `src/lib/rose-animation.ts`, replace the current pitch constant and add the scale constant:

```ts
export const ROSE_FINAL_PITCH = THREE.MathUtils.degToRad(70);
export const ROSE_FINAL_SCALE = 1.5;
```

Add this pure helper next to `getRosePresentationPitch`:

```ts
export function getRosePresentationScale(elapsedMs: number): number {
  if (elapsedMs <= ROSE_BLOOM_START_MS) return 1;
  if (elapsedMs < ROSE_BLOOM_END_MS) {
    const progress = easeInOutCubic(
      (elapsedMs - ROSE_BLOOM_START_MS) / ROSE_BLOOM_DURATION_MS,
    );
    return 1 + (ROSE_FINAL_SCALE - 1) * progress;
  }
  return ROSE_FINAL_SCALE;
}
```

Do not alter `getRosePresentationYaw` or `getRosePresentationPitch` beyond the constant change.

- [ ] **Step 4: Apply the scale to the complete shared presentation group**

Import `getRosePresentationScale` in `src/components/ThreeRose.tsx` and apply it immediately after the yaw/pitch assignments:

```ts
presentationGroup.rotation.y = getRosePresentationYaw(elapsed);
presentationGroup.rotation.x = getRosePresentationPitch(elapsed);
presentationGroup.scale.setScalar(getRosePresentationScale(elapsed));
```

Do not traverse meshes or change stem visibility. Because the full plant remains in `presentationGroup`, the stem rotates into depth and is naturally foreshortened/occluded by the closer flower.

- [ ] **Step 5: Verify GREEN and all regressions**

Run:

```bash
node --import tsx scripts/check-rose-animation.ts
npm run check:rose-glb
node --import tsx scripts/check-f1-motion.ts
npm run lint
npm run build
git diff --check -- scripts/check-rose-animation.ts src/components/ThreeRose.tsx src/lib/rose-animation.ts
```

Expected: all commands exit 0; the rose check prints `PASS: rose assembly, handoff, bloom, and presentation timing verified`; GLB and F1 checks print PASS; Vite completes the production build with only the existing chunk-size advisory.

- [ ] **Step 6: Commit only the close-up implementation**

```bash
git add scripts/check-rose-animation.ts src/components/ThreeRose.tsx src/lib/rose-animation.ts
git commit -m "feat: bring rose bloom closer to viewer"
```

---

### Task 2: Visual and interaction verification

**Files:**
- Create untracked evidence only: `output/playwright/rose-close-up/`
- Modify source only if verification exposes a concrete defect: `src/lib/rose-animation.ts`, `src/components/ThreeRose.tsx`, `scripts/check-rose-animation.ts`

**Interfaces:**
- Consumes: Task 1's 70-degree pitch and 1.0→1.5 scale timeline.
- Produces: evidence that the final flower is close and front-facing while the intact stem is naturally behind it.

- [ ] **Step 1: Start the existing app and reopen the rose from a fresh timeline**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite serves the main workspace at `http://127.0.0.1:3000`; closing and reopening the rose restarts particle assembly at 1.0 scale and 0-degree pitch.

- [ ] **Step 2: Capture bloom-start and final close-up states**

Capture screenshots near 3.6 seconds and after 8.1 seconds into `output/playwright/rose-close-up/`.

Expected:

- At 3.6 seconds, the complete solid plant matches the particle silhouette at 1.0 scale with no transform jump.
- After 8.1 seconds, the open flower is the visual focus, its center faces the camera, and its on-screen size is approximately 1.5 times the pre-bloom presentation.
- Stem and leaves still exist; the stem recedes in depth and is naturally hidden behind the flower rather than disappearing through visibility, clipping, or mesh removal.

- [ ] **Step 3: Verify post-bloom motion and controls**

Observe for at least two additional seconds, then drag and zoom once.

Expected: pitch and scale remain fixed, yaw continues slowly without a jump, OrbitControls still respond, and the modal remains open during drag.

- [ ] **Step 4: Re-run focused checks if visual verification required a correction**

For any correction, first add a failing assertion to `scripts/check-rose-animation.ts`, then run the complete Task 1 Step 5 command set and commit only the corrected rose files. If no correction is required, create no additional commit.
