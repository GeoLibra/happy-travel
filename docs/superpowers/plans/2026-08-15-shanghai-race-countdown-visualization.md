# Shanghai Race Countdown Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the referenced Three.js time visualization as an isolated local scene, pass desktop and mobile visual comparison, then integrate it as a Shanghai Grand Prix countdown page with the RB20 car and itinerary navigation.

**Architecture:** Keep pure countdown/date and digit-layout logic outside React and Three.js. A self-owned `TimeVizScene` controls all GPU resources and is hosted by a small React canvas component; the reference route uses clock digits, while the product route supplies race-countdown digits and an independently cloned RB20 model. App-level History API navigation opens and closes the product route without replaying the welcome showroom.

**Tech Stack:** Node.js 24, pnpm 10.15.0, React 19, TypeScript 5.8, Three.js 0.183, Motion 12, Vitest 3, Playwright 1.61.

## Global Constraints

- Use `pnpm`; do not add a second package manager or lockfile.
- Keep the reference recreation isolated until its `1280 x 720` and `390 x 844` comparisons pass.
- Do not hotlink reference assets. Copy only permitted assets into `public/environments/`; otherwise use a project-owned equivalent.
- The production page must not ship the reference author avatar/link, FPS monitor, or debug controls.
- Query Jolpica only when the countdown page loads; do not add polling or a scheduled backend.
- Use `Asia/Shanghai` for fallback-year decisions and display.
- Treat March 15 at 15:00 as estimated unless returned by the API.
- The countdown scene owns and disposes every Three.js resource it creates; do not share mutable objects with the welcome showroom.
- Preserve the welcome canvas/pointer/ignition contracts in `docs/agent-guides/f1-showroom.md`.
- Playwright tests must wait on observable state, never fixed sleeps.
- Do not claim pixel-level completion until side-by-side source/local design QA passes.

---

## File Structure

### New production files

- `src/features/race-countdown/countdown-time.ts` — pure remaining-time formatting and event-start transition.
- `src/features/race-countdown/event-resolver.ts` — Jolpica request, validation, official selection, and estimated fallback.
- `src/features/race-countdown/digit-layout.ts` — digit matrices, instance placement, desktop/mobile grouping.
- `src/features/race-countdown/time-viz-types.ts` — renderer interfaces shared by the scene and React host.
- `src/features/race-countdown/time-viz-scene.ts` — renderer, camera, lights, instanced digit cubes, liquid reflector, post-processing, resize, and disposal.
- `src/features/race-countdown/CountdownCanvas.tsx` — React lifecycle wrapper for `TimeVizScene`.
- `src/features/race-countdown/ReferenceTimeVizPage.tsx` — isolated reference clock route and development controls.
- `src/features/race-countdown/RaceCountdownPage.tsx` — product overlay, event resolution, ARIA countdown, and WebGL fallback.
- `src/features/race-countdown/useCountdownNavigation.ts` — History API entry/back behavior.
- `src/features/race-countdown/countdown-page.css` — overlay, safe-area, and fallback styling.
- `public/environments/lythwood_room_1k.hdr` — permitted local copy of the observed reference environment, or documented project-owned substitute.

### New tests and evidence

- `tests/unit/race-countdown/event-resolver.test.ts`
- `tests/unit/race-countdown/countdown-time.test.ts`
- `tests/unit/race-countdown/digit-layout.test.ts`
- `tests/unit/race-countdown/time-viz-lifecycle.test.ts`
- `tests/e2e/pages/RaceCountdownPage.ts`
- `tests/e2e/race-countdown/race-countdown-flow.spec.ts`
- `tests/e2e/race-countdown/race-countdown-responsive.spec.ts`
- `tests/e2e/race-countdown/race-countdown-context-loss.spec.ts`
- `output/reference/time-viz-source/desktop-1280x720.png` — ignored source evidence.
- `output/reference/time-viz-source/mobile-390x844.png` — ignored source evidence.
- `output/reference/time-viz-local/desktop-1280x720.png` — ignored local evidence.
- `output/reference/time-viz-local/mobile-390x844.png` — ignored local evidence.
- `design-qa.md` — required Product Design comparison report.

### Existing files modified

- `src/App.tsx` — surface selection, countdown route rendering, and itinerary-card entry callback.
- `src/components/RaceCountdown.tsx` — make the existing card keyboard/click navigable; retain the compact preview.
- `src/i18n.tsx` — countdown labels in both supported locales.
- `src/lib/test-observability.ts` — expose countdown readiness and lifecycle snapshots to browser tests.
- `playwright.config.ts` — add desktop/mobile countdown projects.
- `scripts/lib/affected-playwright-projects.ts` and its test — route countdown changes to new browser projects.
- `package.json` — add grouped focused countdown checks without changing existing gates.

---

### Task 1: Resolve the next Shanghai race safely

**Files:**
- Create: `src/features/race-countdown/event-resolver.ts`
- Create: `src/features/race-countdown/countdown-time.ts`
- Test: `tests/unit/race-countdown/event-resolver.test.ts`
- Test: `tests/unit/race-countdown/countdown-time.test.ts`

**Interfaces:**
- Produces: `resolveNextShanghaiRace(options: ResolveRaceOptions): Promise<ResolvedRaceEvent>`
- Produces: `splitRemainingTime(targetMs: number, nowMs: number): CountdownParts`
- Produces: `formatCountdownDigits(parts: CountdownParts): string[]`

- [ ] **Step 1: Write failing resolver tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { resolveNextShanghaiRace } from '@/src/features/race-countdown/event-resolver';

it('chooses the earliest future official Shanghai race', async () => {
  const fetchImpl = vi.fn(async (url: string) => new Response(JSON.stringify({
    MRData: { RaceTable: { Races: url.includes('/2027/') ? [{
      season: '2027', date: '2027-03-21', time: '07:00:00Z',
      Circuit: { circuitId: 'shanghai' },
    }] : [] } },
  })));
  const result = await resolveNextShanghaiRace({
    now: new Date('2026-08-15T00:00:00+08:00'), fetchImpl,
  });
  expect(result).toMatchObject({ source: 'official', season: 2027 });
  expect(result.startsAt.toISOString()).toBe('2027-03-21T07:00:00.000Z');
});

it('falls back to next March 15 after this years fallback passed', async () => {
  const result = await resolveNextShanghaiRace({
    now: new Date('2026-08-15T00:00:00+08:00'),
    fetchImpl: vi.fn(async () => { throw new Error('offline'); }),
  });
  expect(result.source).toBe('estimated');
  expect(result.startsAt.toISOString()).toBe('2027-03-15T07:00:00.000Z');
});
```

- [ ] **Step 2: Run the resolver tests and verify failure**

Run: `pnpm vitest run tests/unit/race-countdown/event-resolver.test.ts`

Expected: FAIL because `event-resolver.ts` does not exist.

- [ ] **Step 3: Implement the resolver contract**

```ts
export interface ResolvedRaceEvent {
  startsAt: Date;
  season: number;
  source: 'official' | 'estimated';
}

export interface ResolveRaceOptions {
  now?: Date;
  fetchImpl?: typeof fetch;
}

export async function resolveNextShanghaiRace(
  { now = new Date(), fetchImpl = fetch }: ResolveRaceOptions = {},
): Promise<ResolvedRaceEvent>;
```

Fetch `/ergast/f1/{year}/circuits/shanghai/races.json` for the Shanghai current year and next year concurrently, validate `date` and `time`, discard invalid/past events, and select the earliest future instant. Catch network and shape errors together and return the documented March 15 fallback. Construct fallback instants with `Date.UTC(year, 2, 15, 7)` so the result is exactly 15:00 at UTC+8 and does not depend on the browser locale.

- [ ] **Step 4: Write countdown-math tests**

```ts
it('keeps three day digits and two digits for other units', () => {
  const parts = splitRemainingTime(
    Date.parse('2027-03-15T07:00:00Z'),
    Date.parse('2026-08-15T07:00:00Z'),
  );
  expect(formatCountdownDigits(parts)).toEqual(['2','1','2','0','0','0','0','0','0']);
});

it('clamps elapsed countdowns to zero', () => {
  expect(splitRemainingTime(100, 101)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, elapsed: true });
});
```

- [ ] **Step 5: Implement countdown math and run both suites**

Run: `pnpm vitest run tests/unit/race-countdown/event-resolver.test.ts tests/unit/race-countdown/countdown-time.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the pure event logic**

```bash
git add src/features/race-countdown/event-resolver.ts src/features/race-countdown/countdown-time.ts tests/unit/race-countdown
git commit -m "feat: resolve next Shanghai race countdown"
```

---

### Task 2: Build deterministic digit geometry and responsive layout

**Files:**
- Create: `src/features/race-countdown/digit-layout.ts`
- Test: `tests/unit/race-countdown/digit-layout.test.ts`

**Interfaces:**
- Produces: `buildDigitInstances(input: DigitLayoutInput): DigitInstance[]`
- Produces: `getTimeVizLayout(mode: 'reference' | 'countdown', viewport: ViewportKind): LayoutMetrics`
- Consumes: `formatCountdownDigits()` output from Task 1.

- [ ] **Step 1: Write failing placement tests**

```ts
it('places six reference digits in one desktop row', () => {
  const result = buildDigitInstances({ digits: ['1','2','3','4','5','6'], mode: 'reference', viewport: 'desktop' });
  expect(new Set(result.map((item) => item.groupRow))).toEqual(new Set([0]));
});

it('places reference digits as three mobile pairs', () => {
  const result = buildDigitInstances({ digits: ['1','2','3','4','5','6'], mode: 'reference', viewport: 'mobile' });
  expect([...new Set(result.map((item) => item.groupRow))]).toEqual([0, 1, 2]);
});

it('returns stable colors for a fixed seed', () => {
  const a = buildDigitInstances({ digits: ['8'], mode: 'reference', viewport: 'desktop', seed: 26 });
  const b = buildDigitInstances({ digits: ['8'], mode: 'reference', viewport: 'desktop', seed: 26 });
  expect(a.map((x) => x.color)).toEqual(b.map((x) => x.color));
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest run tests/unit/race-countdown/digit-layout.test.ts`

Expected: FAIL because the layout module does not exist.

- [ ] **Step 3: Implement the matrix/layout module**

```ts
export type ViewportKind = 'desktop' | 'mobile';
export interface DigitInstance {
  key: string;
  digitIndex: number;
  groupRow: number;
  position: readonly [number, number, number];
  color: string;
  visible: boolean;
}

export function buildDigitInstances(input: {
  digits: string[];
  mode: 'reference' | 'countdown';
  viewport: ViewportKind;
  seed?: number;
}): DigitInstance[];
```

Reuse the existing 10×7 glyph matrices from `src/components/digit.ts` through a named export; do not duplicate them. Use a small seeded PRNG for repeatable pastel color assignment and reserve enough instances for the maximum nine countdown digits so updates mutate matrices/colors without recreating geometry.

- [ ] **Step 4: Run unit tests**

Run: `pnpm vitest run tests/unit/race-countdown/digit-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit layout logic**

```bash
git add src/components/digit.ts src/features/race-countdown/digit-layout.ts tests/unit/race-countdown/digit-layout.test.ts
git commit -m "feat: add responsive cube digit layout"
```

---

### Task 3: Implement the self-owned Three.js reference scene

**Files:**
- Create: `src/features/race-countdown/time-viz-types.ts`
- Create: `src/features/race-countdown/time-viz-scene.ts`
- Create: `src/features/race-countdown/CountdownCanvas.tsx`
- Create: `public/environments/lythwood_room_1k.hdr`
- Test: `tests/unit/race-countdown/time-viz-lifecycle.test.ts`

**Interfaces:**
- Produces: `createTimeVizScene(options: TimeVizSceneOptions): Promise<TimeVizScene>`
- Produces: React component `CountdownCanvas(props: CountdownCanvasProps)`.
- Consumes: `buildDigitInstances()` from Task 2.

- [ ] **Step 1: Write the lifecycle contract test**

```ts
it('disposes every owned resource exactly once', async () => {
  const tracker = createFakeTimeVizDependencies();
  const scene = await createTimeVizScene({ canvas: tracker.canvas, dependencies: tracker.dependencies, mode: 'reference' });
  scene.dispose();
  scene.dispose();
  expect(tracker.rendererDispose).toHaveBeenCalledTimes(1);
  expect(tracker.renderTargetDispose).toHaveBeenCalledTimes(1);
  expect(tracker.geometryDispose).toHaveBeenCalledTimes(1);
  expect(tracker.materialDispose).toHaveBeenCalledTimes(1);
  expect(tracker.cancelAnimationFrame).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the lifecycle test and verify failure**

Run: `pnpm vitest run tests/unit/race-countdown/time-viz-lifecycle.test.ts`

Expected: FAIL because the scene factory and dependency seam do not exist.

- [ ] **Step 3: Define the renderer contract**

```ts
export interface TimeVizScene {
  setDigits(digits: string[]): void;
  setVehicle(vehicle: THREE.Object3D | null): void;
  resize(width: number, height: number, pixelRatio: number): void;
  getSnapshot(): { ready: boolean; frameCount: number; resourceCount: number; mode: 'reference' | 'countdown' };
  dispose(): void;
}

export interface TimeVizSceneOptions {
  canvas: HTMLCanvasElement;
  mode: 'reference' | 'countdown';
  reducedMotion?: boolean;
  onReady?: () => void;
  dependencies?: TimeVizDependencies;
}
```

- [ ] **Step 4: Implement the visual scene**

Use one `THREE.InstancedMesh` with beveled box geometry for all illuminated cells. Assign per-instance matrices and colors, use physically based materials with HDR environment lighting, and update only changed digit instance matrices once per second. Build the floor with `Reflector` plus a custom normal/displacement shader and a blurred lower-resolution reflection target. Add `EffectComposer`, `RenderPass`, and `UnrealBloomPass` for the colored glow visible in the reference.

Use the existing showroom quality selector to cap pixel ratio and disable bloom/reflection animation for reduced motion or low quality. Register every disposable with the existing `createIdempotentDisposer` pattern. Do not force context loss during production cleanup.

- [ ] **Step 5: Add the React canvas host**

```tsx
export interface CountdownCanvasProps {
  digits: string[];
  mode: 'reference' | 'countdown';
  vehicle?: THREE.Object3D | null;
  onReady?: () => void;
  onWebGLFailure?: (error: Error) => void;
}
```

`CountdownCanvas` creates the scene once, forwards digit/vehicle updates, uses `ResizeObserver`, observes `prefers-reduced-motion`, and disposes on unmount. It must render only a canvas and no product copy.

- [ ] **Step 6: Run lifecycle and type checks**

Run: `pnpm vitest run tests/unit/race-countdown/time-viz-lifecycle.test.ts && pnpm lint`

Expected: PASS.

- [ ] **Step 7: Commit the renderer**

```bash
git add src/features/race-countdown/time-viz-types.ts src/features/race-countdown/time-viz-scene.ts src/features/race-countdown/CountdownCanvas.tsx public/environments/lythwood_room_1k.hdr tests/unit/race-countdown/time-viz-lifecycle.test.ts
git commit -m "feat: recreate Three.js time visualization scene"
```

---

### Task 4: Add the isolated reference route and pass Phase 1 visual QA

**Files:**
- Create: `src/features/race-countdown/ReferenceTimeVizPage.tsx`
- Create: `src/features/race-countdown/countdown-page.css`
- Modify: `src/App.tsx`
- Create: `tests/e2e/pages/RaceCountdownPage.ts`
- Create: `tests/e2e/race-countdown/race-countdown-responsive.spec.ts`
- Create/Update: `design-qa.md`

**Interfaces:**
- Produces: development route `/time-viz-reference`.
- Produces: `RaceCountdownPageObject.waitForSceneReady()` and `captureReferenceFrame(path)`.
- Consumes: `CountdownCanvas` from Task 3.

- [ ] **Step 1: Write the failing responsive browser spec**

```ts
test('reference route exposes one ready canvas and desktop layout', async ({ page }) => {
  await page.goto('/time-viz-reference');
  await expect(page.locator('[data-time-viz-state="ready"]')).toBeVisible();
  await expect(page.locator('canvas[data-time-viz-canvas]')).toHaveCount(1);
  await expect(page.locator('[data-time-viz-layout]')).toHaveAttribute('data-time-viz-layout', 'desktop-row');
});
```

- [ ] **Step 2: Run the browser spec and verify failure**

Run: `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-responsive.spec.ts --project=app-desktop-chromium`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the reference page and route selection**

Render `ReferenceTimeVizPage` before the normal `App` surfaces when `window.location.pathname === '/time-viz-reference'`. It derives six `HHMMSS` digits from a one-second clock, supplies deterministic seed `26`, exposes readiness attributes for tests, and shows FPS/debug controls only when `import.meta.env.DEV` is true.

- [ ] **Step 4: Capture source and local evidence at matching viewports**

Use the approved in-app browser capture workflow for the source and local route. Save exact frames to the four documented `output/reference` paths. Capture at a moment with matching six digits; do not compare screenshots that show different time values.

- [ ] **Step 5: Run blocking design QA and fix P0–P2 mismatches**

Place each source/local pair in one comparison image. Review camera framing, digit scale, cube bevel, color distribution, bloom, black level, horizon, floor distortion, reflection depth, and mobile three-row grouping. Record every finding in `design-qa.md`; repeat until the report ends with exactly `final result: passed`.

- [ ] **Step 6: Run focused browser and build checks**

Run: `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-responsive.spec.ts --project=app-desktop-chromium && pnpm test:fast`

Expected: PASS.

- [ ] **Step 7: Commit the Phase 1 gate**

```bash
git add src/App.tsx src/features/race-countdown/ReferenceTimeVizPage.tsx src/features/race-countdown/countdown-page.css tests/e2e/pages/RaceCountdownPage.ts tests/e2e/race-countdown/race-countdown-responsive.spec.ts design-qa.md
git commit -m "feat: add verified reference time visualization"
```

---

### Task 5: Build the product countdown page and accessible fallback

**Files:**
- Create: `src/features/race-countdown/RaceCountdownPage.tsx`
- Modify: `src/features/race-countdown/countdown-page.css`
- Modify: `src/i18n.tsx`
- Test: `tests/unit/i18n/i18n.test.ts`
- Create: `tests/e2e/race-countdown/race-countdown-flow.spec.ts`

**Interfaces:**
- Produces: `RaceCountdownPage({ onBack }: { onBack(): void })`.
- Consumes: `resolveNextShanghaiRace`, `splitRemainingTime`, `formatCountdownDigits`, and `CountdownCanvas`.

- [ ] **Step 1: Write failing page-state tests**

```ts
test('shows official status for a future API race', async ({ page }) => {
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', route => route.fulfill({ json: officialShanghaiFixture }));
  await page.goto('/countdown');
  await expect(page.getByText('官方正赛时间')).toBeVisible();
  await expect(page.locator('[data-countdown-source="official"]')).toBeVisible();
});

test('shows estimated status when the API is unavailable', async ({ page }) => {
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', route => route.abort());
  await page.goto('/countdown');
  await expect(page.getByText('暂定日期 · 等待官方赛程确认')).toBeVisible();
});
```

- [ ] **Step 2: Run the flow spec and verify failure**

Run: `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium`

Expected: FAIL because `/countdown` has no product page.

- [ ] **Step 3: Implement the product state machine**

Use explicit states:

```ts
type CountdownPageState =
  | { status: 'loading' }
  | { status: 'ready'; event: ResolvedRaceEvent; parts: CountdownParts }
  | { status: 'webgl-fallback'; event: ResolvedRaceEvent; parts: CountdownParts };
```

Resolve once on mount. Tick display values once per second. When elapsed, show `LIGHTS OUT`, call the resolver once more, and never leave frozen zero digits. Update the ARIA live text at minute boundaries rather than every second.

- [ ] **Step 4: Add overlay and non-WebGL rendering**

Add the back button, event title, Shanghai-local target time, official/estimated label, unit captions, loading skeleton, and DOM digit fallback. Canvas is `aria-hidden="true"`; semantic time stays in the overlay. Add both locale dictionaries and assertions to the existing i18n unit test.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run tests/unit/race-countdown tests/unit/i18n/i18n.test.ts && pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium`

Expected: PASS.

- [ ] **Step 6: Commit the product page**

```bash
git add src/features/race-countdown/RaceCountdownPage.tsx src/features/race-countdown/countdown-page.css src/i18n.tsx tests/unit/i18n/i18n.test.ts tests/e2e/race-countdown/race-countdown-flow.spec.ts
git commit -m "feat: add Shanghai race countdown page"
```

---

### Task 6: Add itinerary entry and browser-history return

**Files:**
- Create: `src/features/race-countdown/useCountdownNavigation.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/RaceCountdown.tsx`
- Modify: `tests/e2e/pages/ItineraryPage.ts`
- Modify: `tests/e2e/race-countdown/race-countdown-flow.spec.ts`

**Interfaces:**
- Produces: `useCountdownNavigation(): { countdownOpen: boolean; openCountdown(): void; closeCountdown(): void }`.
- Consumes: `RaceCountdownPage` and existing compact `RaceCountdown` card.

- [ ] **Step 1: Add failing navigation assertions**

```ts
test('opens from the compact countdown and restores itinerary with browser back', async ({ page }) => {
  await itinerary.completeWelcomeIgnition();
  await itinerary.openFullCountdown();
  await expect(page).toHaveURL(/\/countdown$/);
  await page.goBack();
  await expect(itinerary.daySelector).toBeVisible();
});
```

- [ ] **Step 2: Run the navigation test and verify failure**

Run: `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium`

Expected: FAIL because the compact card is not an entry control.

- [ ] **Step 3: Implement History API navigation**

`openCountdown()` pushes `/countdown`; `closeCountdown()` calls `history.back()` when the current entry was pushed by the app, otherwise replaces with `/`. Listen to `popstate` and derive `countdownOpen` from `location.pathname`. Do not reset itinerary React state when the overlay opens or closes.

- [ ] **Step 4: Make the compact card accessible**

Change `RaceCountdown` to accept `onOpen?: () => void`, render its outer interactive surface as a semantic button, add “查看全屏倒计时”, visible focus styling, and prevent its canvas from capturing pointer events. Preserve its compact animation until the full-screen scene mounts.

- [ ] **Step 5: Run navigation and existing particle tests**

Run: `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts tests/e2e/itinerary-particles/particles-behavior.spec.ts --project=particles-e2e-chromium`

Expected: PASS.

- [ ] **Step 6: Commit navigation integration**

```bash
git add src/App.tsx src/components/RaceCountdown.tsx src/features/race-countdown/useCountdownNavigation.ts tests/e2e/pages/ItineraryPage.ts tests/e2e/race-countdown/race-countdown-flow.spec.ts
git commit -m "feat: open race countdown from itinerary"
```

---

### Task 7: Place the RB20 in the countdown scene

**Files:**
- Create: `src/features/race-countdown/countdown-vehicle.ts`
- Modify: `src/features/race-countdown/time-viz-scene.ts`
- Modify: `src/features/race-countdown/RaceCountdownPage.tsx`
- Create: `tests/unit/race-countdown/countdown-vehicle.test.ts`
- Modify: `tests/e2e/race-countdown/race-countdown-responsive.spec.ts`

**Interfaces:**
- Produces: `loadCountdownVehicle(options: CountdownVehicleOptions): Promise<CountdownVehicle>`.
- Produces: `CountdownVehicle.dispose(): void` and `CountdownVehicle.object: THREE.Group`.
- Consumes: `/models/2024_redbull_rb20_showroom_v5.glb` and existing `ShowroomAssetManager` loading semantics.

- [ ] **Step 1: Write failing ownership tests**

```ts
it('returns independent model clones and disposes only owned clone resources', async () => {
  const first = await loadCountdownVehicle({ loader: fakeLoader });
  const second = await loadCountdownVehicle({ loader: fakeLoader });
  expect(first.object).not.toBe(second.object);
  first.dispose();
  expect(second.object.parent).not.toBeNull();
});
```

- [ ] **Step 2: Run the ownership test and verify failure**

Run: `pnpm vitest run tests/unit/race-countdown/countdown-vehicle.test.ts`

Expected: FAIL because the countdown vehicle loader does not exist.

- [ ] **Step 3: Implement independent model ownership**

Clone the accepted model hierarchy and clone mutable materials before applying scene-specific environment intensity. Do not attach wheel animation, exploded-view handlers, or welcome pointer forwarding. Return an idempotent disposer that removes the clone and disposes only cloned materials; shared cached geometry stays owned by the asset manager.

- [ ] **Step 4: Add desktop and mobile framing**

Add named pose constants:

```ts
export const COUNTDOWN_VEHICLE_POSES = {
  desktop: { position: [0, -2.1, 5.6], rotation: [0, -0.18, 0], scale: 1.15 },
  mobile: { position: [0, -6.8, 4.4], rotation: [0, -0.08, 0], scale: 0.72 },
} as const;
```

Tune these values through same-viewport screenshots; constants are starting values, and final accepted values must be recorded in the implementation rather than a hidden debug preset. Ensure the floor reflects the car and digits without the car obscuring more than one countdown unit.

- [ ] **Step 5: Run model, responsive, and lifecycle checks**

Run: `pnpm vitest run tests/unit/race-countdown/countdown-vehicle.test.ts && pnpm check:f1-model && pnpm exec playwright test tests/e2e/race-countdown/race-countdown-responsive.spec.ts --project=app-desktop-chromium`

Expected: PASS.

- [ ] **Step 6: Commit the vehicle integration**

```bash
git add src/features/race-countdown/countdown-vehicle.ts src/features/race-countdown/time-viz-scene.ts src/features/race-countdown/RaceCountdownPage.tsx tests/unit/race-countdown/countdown-vehicle.test.ts tests/e2e/race-countdown/race-countdown-responsive.spec.ts
git commit -m "feat: place RB20 in race countdown scene"
```

---

### Task 8: Add browser projects, observability, and lifecycle coverage

**Files:**
- Modify: `src/lib/test-observability.ts`
- Modify: `playwright.config.ts`
- Modify: `scripts/lib/affected-playwright-projects.ts`
- Modify: `scripts/resolve-playwright-projects.test.ts`
- Create: `tests/e2e/race-countdown/race-countdown-context-loss.spec.ts`
- Modify: `tests/e2e/race-countdown/race-countdown-responsive.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `window.__HAPPY_TRAVEL_TEST__.countdown` readiness/resource snapshot.
- Produces Playwright projects `race-countdown-desktop-chromium` and `race-countdown-mobile-chromium`.

- [ ] **Step 1: Write failing resolver and lifecycle assertions**

```ts
it('routes countdown changes to desktop, mobile, and WebGL lifecycle projects', () => {
  expect(resolveProjects(['src/features/race-countdown/time-viz-scene.ts'])).toEqual(expect.arrayContaining([
    'race-countdown-desktop-chromium',
    'race-countdown-mobile-chromium',
    'webgl-renderer-lifecycle-chromium',
  ]));
});
```

Add a browser test that opens/closes the countdown scene five times and asserts renderer/resource counts return to baseline through the observability snapshot. Add a context-loss test that verifies the DOM fallback remains navigable; do not force context loss during ordinary unmount cleanup.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm check:playwright-project-resolver && pnpm exec playwright test tests/e2e/race-countdown --project=app-desktop-chromium`

Expected: FAIL because countdown projects and observability are absent.

- [ ] **Step 3: Implement project routing and observability**

Add the two projects with exact viewports `1280 x 720` and `390 x 844`. Add `check:countdown` to run the countdown unit suite plus both projects. Keep existing project names and scripts unchanged.

- [ ] **Step 4: Run focused and global gates**

Run:

```bash
pnpm check:countdown
pnpm check:playwright-project-resolver
pnpm check:f1
pnpm check:webgl-lifecycle
pnpm test:fast
pnpm test:impact
```

Expected: every command exits 0. Save Playwright artifacts only under the configured ignored `output/` directories.

- [ ] **Step 5: Repeat integrated design QA**

Compare product desktop/mobile captures against the approved Phase 1 composition. Confirm that the added car and overlay preserve digit readability, reflection quality, safe areas, and return affordance. Update `design-qa.md`; the final line must remain `final result: passed`.

- [ ] **Step 6: Commit verification infrastructure**

```bash
git add src/lib/test-observability.ts playwright.config.ts scripts/lib/affected-playwright-projects.ts scripts/resolve-playwright-projects.test.ts tests/e2e/race-countdown package.json design-qa.md
git commit -m "test: verify race countdown experience"
```

---

## Final Verification Checklist

- [ ] `pnpm test:fast` passes.
- [ ] `pnpm check:countdown` passes at `1280 x 720` and `390 x 844`.
- [ ] `pnpm check:f1` and `pnpm check:webgl-lifecycle` pass.
- [ ] `pnpm test:impact` passes the affected browser matrix.
- [ ] Jolpica official, missing-season, malformed-response, and offline cases are covered.
- [ ] Fallback resolves to current/next March 15 at 15:00 Asia/Shanghai and is labelled estimated.
- [ ] Countdown transitions through `LIGHTS OUT` and never freezes at zero.
- [ ] Itinerary state survives open/back navigation.
- [ ] Reduced-motion and WebGL fallback states remain usable.
- [ ] Countdown renderer resources return to baseline after five open/close cycles.
- [ ] `design-qa.md` exists and ends with `final result: passed`.
