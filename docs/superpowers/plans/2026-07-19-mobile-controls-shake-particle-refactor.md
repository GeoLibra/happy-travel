# Mobile Controls, Shake-to-Rose, and Particle Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wide locale label with a compact Languages icon, restore iOS shake-to-rose permission timing, and safely extract owned Three.js resources from `ParticleBackground.tsx`.

**Architecture:** Keep React orchestration and the showroom animation loop in their current components. Move shake classification into a pure library and move self-contained Three.js resource allocation/disposal into typed factories, preserving the current animation data interfaces and render order.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, Motion, Lucide React, Node assertion scripts, Playwright CLI, Vite.

## Global Constraints

- Keep `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` as the only runtime wheel-spin nodes.
- Do not change F1 model geometry ownership, `RearHardRockAeroPanel` parentage, or the versioned GLB URL.
- Keep the transparent car canvas above ordinary welcome UI and preserve pointer forwarding to exposed controls.
- Preserve the 100 ms shake sample interval and threshold 1000.
- Permission denial, unsupported APIs, or exceptions must never block application entry.
- Do not redesign the rose modal, add locales, or rewrite the showroom as controller classes.

## File Structure

- Create `src/lib/shake-detection.ts`: pure motion sample selection and shake-state transition.
- Create `scripts/check-shake-detection.ts`: deterministic unit checks for shake detection and permission wiring.
- Modify `src/App.tsx`: language icon, permission preparation callback, and use of the shake utility.
- Modify `src/components/WelcomePage.tsx`: synchronous `onPrepareEnter` invocation from ENTER click.
- Create `src/components/showroom/showroom-constants.ts`: immutable colors and counts.
- Create `src/components/showroom/showroom-particles.ts`: CPU particles, trails, and speed-line factories with typed handles and idempotent disposal.
- Create `src/components/showroom/showroom-track.ts`: instanced track/tunnel factory with typed metadata and idempotent disposal.
- Modify `src/components/ParticleBackground.tsx`: consume extracted factories while retaining animation and lifecycle orchestration.
- Modify `scripts/check-f1-welcome.ts`: source-contract checks for the synchronous permission path and extracted modules.
- Modify `package.json`: add the shake check command.

---

### Task 1: Compact Languages icon control

**Files:**
- Modify: `src/App.tsx:2-30,285-299`
- Modify: `scripts/check-i18n.ts`

**Interfaces:**
- Consumes: `toggleLocale(): void`, `t('language.label'): string` from `useI18n()`.
- Produces: a 36×36 `button` containing Lucide `Languages`, with localized `aria-label` and `title`.

- [ ] **Step 1: Add a failing source-contract check**

Append to `scripts/check-i18n.ts` after loading `App.tsx` source:

```ts
assert.match(appSource, /import[\s\S]*Languages[\s\S]*from 'lucide-react'/);
assert.match(appSource, /aria-label=\{t\('language\.label'\)\}/);
assert.match(appSource, /title=\{t\('language\.label'\)\}/);
assert.match(appSource, /className="h-9 w-9/);
assert.match(appSource, /<Languages[^>]*size=\{18\}/);
assert.doesNotMatch(appSource, /\{t\('language\.switchLabel'\)\}/);
```

- [ ] **Step 2: Verify the check fails**

Run: `npm run check:i18n`

Expected: FAIL because `Languages`, `title`, and `w-9` are absent and visible switch text remains.

- [ ] **Step 3: Implement the icon button**

Add `Languages` to the Lucide import and replace the visible text:

```tsx
<button
  type="button"
  onClick={toggleLocale}
  aria-label={t('language.label')}
  title={t('language.label')}
  className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white/80 inline-flex items-center justify-center text-slate-700 shadow-sm transition-colors hover:border-[#E10600]/40 hover:text-[#E10600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/40"
>
  <Languages size={18} aria-hidden="true" />
</button>
```

- [ ] **Step 4: Verify the locale check and types**

Run: `npm run check:i18n && npm run lint`

Expected: both commands PASS.

- [ ] **Step 5: Commit the control**

```bash
git add src/App.tsx scripts/check-i18n.ts
git commit -m "feat: compact the language switcher"
```

### Task 2: Restore synchronous motion permission and pure shake detection

**Files:**
- Create: `src/lib/shake-detection.ts`
- Create: `scripts/check-shake-detection.ts`
- Modify: `src/App.tsx:65-195,230-241`
- Modify: `src/components/WelcomePage.tsx:43-48,82-94,370-402`
- Modify: `package.json`

**Interfaces:**
- Produces: `ShakeState`, `EMPTY_SHAKE_STATE`, and `stepShakeDetection(state, sample, now, modalOpen)` returning `{ state, detected }`.
- Produces: `WelcomeProps.onPrepareEnter?: () => void | Promise<void>` invoked synchronously without awaiting.
- Consumes: `requestMotionPermission(): Promise<boolean>` in `App`.

- [ ] **Step 1: Write failing deterministic shake and wiring checks**

Create `scripts/check-shake-detection.ts` with assertions covering: first sample initializes state without detection; a sample at 50 ms is ignored; a large delta after 120 ms detects; incomplete coordinates preserve state; `accelerationIncludingGravity` is accepted by the App adapter; modal-open suppresses detection. Also read component sources and assert this ordering inside ENTER `onClick`:

```ts
assert.match(
  welcomeSource,
  /onClick=\{\(\) => \{[\s\S]*?onPrepareEnter\?\.\(\);[\s\S]*?enterAfterReassembly\(\);[\s\S]*?\}\}/,
);
assert.doesNotMatch(appSource, /onEnter=\{async \(\) => \{[\s\S]*requestMotionPermission/);
```

- [ ] **Step 2: Verify the new check fails**

Run: `node --import tsx scripts/check-shake-detection.ts`

Expected: FAIL because `src/lib/shake-detection.ts` does not exist.

- [ ] **Step 3: Implement the pure detector**

Create `src/lib/shake-detection.ts`:

```ts
export interface ShakeState { lastX: number; lastY: number; lastZ: number; lastTime: number; initialized: boolean }
export interface MotionSample { x: number | null; y: number | null; z: number | null }
export const SHAKE_SAMPLE_INTERVAL_MS = 100;
export const SHAKE_THRESHOLD = 1000;
export const EMPTY_SHAKE_STATE: ShakeState = { lastX: 0, lastY: 0, lastZ: 0, lastTime: 0, initialized: false };

export function stepShakeDetection(state: ShakeState, sample: MotionSample, now: number, modalOpen: boolean) {
  const { x, y, z } = sample;
  if (x === null || y === null || z === null) return { state, detected: false };
  if (!state.initialized) return { state: { lastX: x, lastY: y, lastZ: z, lastTime: now, initialized: true }, detected: false };
  const elapsed = now - state.lastTime;
  if (elapsed <= SHAKE_SAMPLE_INTERVAL_MS) return { state, detected: false };
  const speed = ((Math.abs(x - state.lastX) + Math.abs(y - state.lastY) + Math.abs(z - state.lastZ)) / elapsed) * 10000;
  return { state: { lastX: x, lastY: y, lastZ: z, lastTime: now, initialized: true }, detected: speed > SHAKE_THRESHOLD && !modalOpen };
}
```

- [ ] **Step 4: Rewire App and WelcomePage**

In `App`, replace inline shake math with `stepShakeDetection`, choosing `event.acceleration ?? event.accelerationIncludingGravity`. Pass permission separately:

```tsx
<WelcomePage
  key="welcome"
  onPrepareEnter={() => { void requestMotionPermission(); }}
  onEnter={() => {
    console.log('[App] Entering application...');
    setShowWelcome(false);
  }}
/>
```

In the ENTER click handler:

```tsx
if (progress >= 100) {
  onPrepareEnter?.();
  enterAfterReassembly();
}
```

- [ ] **Step 5: Register and run checks**

Add `"check:shake": "node --import tsx scripts/check-shake-detection.ts"` to `package.json`.

Run: `npm run check:shake && npm run check:f1-welcome && npm run lint`

Expected: all commands PASS.

- [ ] **Step 6: Commit shake restoration**

```bash
git add package.json src/App.tsx src/components/WelcomePage.tsx src/lib/shake-detection.ts scripts/check-shake-detection.ts scripts/check-f1-welcome.ts
git commit -m "fix: restore mobile shake permission flow"
```

### Task 3: Extract owned showroom particle and track resources

**Files:**
- Create: `src/components/showroom/showroom-constants.ts`
- Create: `src/components/showroom/showroom-particles.ts`
- Create: `src/components/showroom/showroom-track.ts`
- Create: `scripts/check-showroom-resources.ts`
- Modify: `src/components/ParticleBackground.tsx:42-50,176-247,561-781,907-944,1080-1131,1178-1193`
- Modify: `package.json`

**Interfaces:**
- `createCpuParticleField(pixelRatio): CpuParticleField` returns `points`, `phases`, `positions`, `material`, and idempotent `dispose()`.
- `createTrailField(): TrailField` returns `geometry`, `positionAttribute`, `alphaAttribute`, `material`, and idempotent `dispose()`.
- `createSpeedLineField(): SpeedLineField` returns `points`, `geometry`, `positions`, `speeds`, `material`, and idempotent `dispose()`.
- `createShowroomTrack(): ShowroomTrack` returns `mesh`, `data`, `scratch`, `material`, and idempotent `dispose()`.

- [ ] **Step 1: Write failing factory ownership checks**

Create `scripts/check-showroom-resources.ts`. Instantiate every factory, assert expected counts and object types, replace each geometry/material `dispose` with counters, call the returned disposer twice, and assert every owned resource is disposed exactly once. Read `ParticleBackground.tsx` and assert it imports all three factory modules and no longer declares `HAIRLINE_COUNT`, `SIDE_LINE_COUNT`, or the local `COLORS` object.

- [ ] **Step 2: Verify the factory check fails**

Run: `node --import tsx scripts/check-showroom-resources.ts`

Expected: FAIL because the factory modules do not exist.

- [ ] **Step 3: Extract constants and particle factories**

Move the exact current shader strings, initialization ranges, color probabilities, and counts into the new modules. Each factory must guard disposal:

```ts
let disposed = false;
const dispose = () => {
  if (disposed) return;
  disposed = true;
  geometry.dispose();
  material.dispose();
};
```

Do not alter numeric values or shader source during extraction.

- [ ] **Step 4: Extract the track factory**

Move the existing instanced-mesh creation loop unchanged into `createShowroomTrack()`. Preserve every generated metadata property:

```ts
export interface TrackDatum {
  x: number;
  y: number;
  z: number;
  speedMultiplier: number;
  length: number;
  width: number;
  isVertical: boolean;
}
```

- [ ] **Step 5: Rewire component animation and cleanup**

Create resources once inside the existing effect, add returned objects to the same scenes, keep updates in the same order, and replace individual geometry/material cleanup with factory `dispose()` calls. Do not move `animate`, reflection rendering, vehicle assembly, pointer listeners, or floor placement.

- [ ] **Step 6: Register and run focused checks**

Add `"check:showroom-resources": "node --import tsx scripts/check-showroom-resources.ts"`.

Run:

```bash
npm run check:showroom-resources
npm run check:f1-motion
npm run check:f1-wheel-hold
npm run check:f1-airflow
npm run check:f1-studio
npm run check:f1-reflection
npm run check:f1-showroom-interaction
npm run check:f1-arrival-motion
npm run check:f1-model
npm run check:f1-showroom-v4
npm run lint
```

Expected: every command PASS and `wc -l src/components/ParticleBackground.tsx` reports no more than 950 lines.

- [ ] **Step 7: Commit resource extraction**

```bash
git add package.json src/components/ParticleBackground.tsx src/components/showroom/showroom-constants.ts src/components/showroom/showroom-particles.ts src/components/showroom/showroom-track.ts scripts/check-showroom-resources.ts
git commit -m "refactor: extract showroom render resources"
```

### Task 4: Browser regression evidence and final verification

**Files:**
- Create: `output/playwright/mobile-language.png`
- Create: `output/playwright/mobile-rose-shake.png`
- Create: `output/playwright/mobile-arrival-{idle,accelerating,arriving,stopped}.png`
- Create: `output/playwright/desktop-arrival-{idle,accelerating,arriving,stopped}.png`
- Modify only if a verified regression is found.

**Interfaces:**
- Consumes all prior task outputs.
- Produces browser evidence and a passing production build; screenshots remain untracked unless repository policy says otherwise.

- [ ] **Step 1: Start the local site and open mobile browser**

Run `npm run dev -- --host 127.0.0.1`, then use the Playwright CLI session at 390×844. Snapshot before referencing controls.

Expected: locale control is exposed by its localized accessible name and renders as a square icon.

- [ ] **Step 2: Capture mobile control and arrival timeline**

Capture idle, 30–50% acceleration, arrival transition, and stopped frames. Assert `getSelection()?.toString()` stays empty after a 1.8-second hold and visually inspect stopped reflection and floor placement.

- [ ] **Step 3: Simulate iOS permission and motion**

Before page load, inject a `DeviceMotionEvent.requestPermission` spy returning `granted`. Click ENTER and assert the spy is called before the delayed welcome unmount. Dispatch two `devicemotion` events more than 100 ms apart with a delta large enough to exceed 1000, then assert the rose dialog/canvas becomes visible and capture `mobile-rose-shake.png`.

- [ ] **Step 4: Capture desktop timeline**

Repeat idle, accelerating, arriving, and stopped evidence at 1440×1000. Confirm the language icon, car pose, camera framing, floor reveal, reflection, and exposed-control forwarding remain correct.

- [ ] **Step 5: Run the complete verification set**

Run:

```bash
npm run check:i18n
npm run check:shake
npm run check:showroom-resources
npm run check:f1-welcome
npm run check:f1-motion
npm run check:f1-wheel-hold
npm run check:f1-airflow
npm run check:f1-studio
npm run check:f1-reflection
npm run check:f1-showroom-interaction
npm run check:f1-arrival-motion
npm run check:f1-model
npm run check:f1-showroom-v4
npm run lint
npm run build
```

Expected: all checks PASS. Vite may report its existing large-chunk warning, but no error.

- [ ] **Step 6: Review final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors, no unexpected model/GLB changes, and only scoped source/test changes plus untracked browser evidence.
