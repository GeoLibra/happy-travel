# Happy Travel CI/CD Testing Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Vitest, Playwright, asset-validation, WebGL lifecycle, GitHub Actions, and Vercel delivery platform covering F1, itinerary particles, and the rose experience.

**Architecture:** GitHub Actions owns deterministic quality gates while the existing Vercel Git Integration owns Preview and Production deployment. Tests are discovered by directory globs and selected by a fail-open impact resolver; pure TypeScript contracts run in Vitest, browser behavior runs against `vite preview` in Playwright, binary/Blender contracts remain specialized validators behind one manifest runner, and expensive visual/memory scenarios run nightly or manually.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest, Playwright Test, Three.js, MemLab, GitHub Actions, Vercel Hobby Git Integration.

## Global Constraints

- Work only in `/Users/hgis/myproject/happy-travel/.worktrees/ci-cd-testing-pipeline` on `codex/ci-cd-testing-pipeline`; preserve unrelated changes in the main checkout.
- Use Node 22 and `npm ci`; do not run `npm audit fix --force` as part of this work.
- PRs run Fast Gate and impact-selected browser tests; nightly/manual workflows run visual and memory suites.
- Production E2E runs against `vite preview`, never the Vite development server.
- Playwright tests must not use `waitForTimeout`, fixed sleeps, or retries; synchronize on observable application state.
- Mobile Chromium and Mobile WebKit are simulations, not real-device certification.
- Particle tests inject a deterministic random source or seed; production retains real randomness.
- The car canvas remains above ordinary welcome UI and pointer forwarding must preserve exposed control interaction.
- Only `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` may rotate at runtime.
- F1 visual evidence covers the complete arrival timeline and explode/reassemble must keep all parts above the floor.
- A full successful run must not require Vercel tokens; Vercel Git Integration remains the deployment authority.
- Success artifacts stay small; traces, video, screenshots, renderer audit, and heap evidence upload only on failure unless a nightly summary explicitly requires them.

---

## File Map

- `vitest.config.ts`: unit/contract test discovery, coverage, aliases, and deterministic environment.
- `playwright.config.ts`: four browser projects, production preview server, artifact policy, and zero retries.
- `tests/unit/**`: migrated pure behavior and source-contract tests.
- `tests/e2e/pages/**`: stable Page Objects and observable phase waits.
- `tests/e2e/f1/**`, `tests/e2e/itinerary-particles/**`, `tests/e2e/rose/**`, `tests/e2e/smoke/**`: browser scenarios by behavior domain.
- `tests/memory/**`: repeated lifecycle trend tests and MemLab scenarios.
- `src/lib/test-observability.ts`: test-mode-only read API for phase and resource snapshots.
- `src/lib/particle-runtime.ts`: deterministic particle helpers and lifecycle counters shared by particle components.
- `src/components/ParticleBackground.tsx`, `src/components/RaceCountdown.tsx`, `src/components/ThreeRose.tsx`: resource lifecycle instrumentation and observable state integration.
- `ci/asset-validators.json`: specialized asset validator manifest.
- `ci/impact-map.json`: source-to-suite mapping with explicit full-suite fallback.
- `scripts/ci/*.mjs`: manifest execution, impact resolution/execution, memory orchestration, and GitHub summary output.
- `.github/workflows/*.yml`: fast, browser, and nightly visual/memory workflows.
- `.github/dependabot.yml`: weekly npm and Actions updates.
- `vercel.json`: SPA rewrite only; no credentials.
- `AGENTS.md`: concise mandatory testing contract.
- `docs/testing/ci-testing-policy.md`: developer/Codex operating guide and real-device boundary.

---

### Task 1: Install and configure the reusable test toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/unit/setup.ts`
- Create: `tests/e2e/smoke/app.spec.ts`

**Interfaces:**
- Produces: npm commands `test:unit`, `test:assets`, `test:fast`, `test:e2e`, `test:impact`, `test:full`, `test:visual`, and `test:memory`.
- Produces: Playwright projects `chromium-desktop`, `chromium-mobile`, `webkit-desktop`, `webkit-mobile`.

- [ ] **Step 1: Add one smoke test before configuring the runner**

```ts
// tests/e2e/smoke/app.spec.ts
import {expect, test} from '@playwright/test';

test('loads the welcome experience without page errors', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Install pinned test dependencies**

Run: `npm install --save-dev vitest @vitest/coverage-v8 @playwright/test @memlab/cli`

Expected: `package.json` and `package-lock.json` contain the four dev dependencies and npm exits 0.

- [ ] **Step 3: Configure Vitest discovery**

```ts
// vitest.config.ts
import path from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {alias: {'@': path.resolve(__dirname, '.')}},
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    coverage: {provider: 'v8', reporter: ['text-summary', 'json-summary']},
  },
});
```

```ts
// tests/unit/setup.ts
import {afterEach} from 'vitest';

afterEach(() => {
  delete process.env.HAPPY_TRAVEL_TEST_MODE;
});
```

- [ ] **Step 4: Configure Playwright against the production preview**

```ts
// playwright.config.ts
import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? [['line'], ['github']] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {name: 'chromium-desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}},
    {name: 'chromium-mobile', use: {...devices['Pixel 7']}},
    {name: 'webkit-desktop', use: {...devices['Desktop Safari'], viewport: {width: 1440, height: 900}}},
    {name: 'webkit-mobile', use: {...devices['iPhone 14']}},
  ],
});
```

- [ ] **Step 5: Add stable npm commands**

Set scripts to call the new runners, including `test:e2e` as `npm run build && playwright test`, while retaining legacy `check:*` entries until their migrations pass. Set `test:fast` to `npm run lint && npm run test:unit && npm run test:assets && npm run build`.

- [ ] **Step 6: Verify discovery and browser startup**

Run: `npm run test:unit -- --run --passWithNoTests`

Expected: Vitest exits 0 while Task 1 has no unit tests. Task 2 adds real tests and all later commands omit `--passWithNoTests`, so broken discovery cannot be hidden permanently.

Run: `npm run build && npx playwright test tests/e2e/smoke/app.spec.ts --project=chromium-desktop`

Expected: one passing smoke test with no retained success video/trace.

- [ ] **Step 7: Commit the toolchain**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/unit/setup.ts tests/e2e/smoke/app.spec.ts
git commit -m "test: add Vitest and Playwright foundations"
```

### Task 2: Migrate pure `check:*` contracts directly to Vitest

**Files:**
- Create: `tests/unit/f1/glitch-sequence.test.ts`
- Create: `tests/unit/f1/welcome-sequence.test.ts`
- Create: `tests/unit/f1/motion.test.ts`
- Create: `tests/unit/f1/wheel-motion.test.ts`
- Create: `tests/unit/f1/airflow.test.ts`
- Create: `tests/unit/f1/studio-lighting.test.ts`
- Create: `tests/unit/f1/reflection.test.ts`
- Create: `tests/unit/f1/arrival-motion.test.ts`
- Create: `tests/unit/f1/showroom-interaction.test.ts`
- Create: `tests/unit/f1/resource-lifecycle.test.ts`
- Create: `tests/unit/rose/rose-animation.test.ts`
- Create: `tests/unit/rose/shake-detection.test.ts`
- Create: `tests/unit/i18n/i18n-contract.test.ts`
- Modify: `package.json`
- Delete after parity: corresponding `scripts/check-*.ts` files migrated by this task.

**Interfaces:**
- Consumes: exported functions/constants from `src/lib/**` and `src/components/effects/**`.
- Produces: all pure behavior tests discoverable under `tests/unit/**/*.test.ts`.

- [ ] **Step 1: Convert each script assertion into named `describe`/`it` behavior tests**

Use table-driven cases rather than top-level throws. For example:

```ts
import {describe, expect, it} from 'vitest';
import {advanceF1GlitchSequence, createF1GlitchSequence} from '@/src/lib/f1-glitch-sequence';

describe('F1 glitch sequence', () => {
  it.each([16.67, 33.33])('keeps clean recovery independent at %sms frames', frameMs => {
    let state = createF1GlitchSequence();
    for (let elapsed = 0; elapsed < 8_000; elapsed += frameMs) {
      state = advanceF1GlitchSequence(state, frameMs);
    }
    expect(state.phase).toBe('complete');
    expect(state.cleanFrameObserved).toBe(true);
  });
});
```

- [ ] **Step 2: Keep only architectural source contracts that cannot be expressed behaviorally**

```ts
it('does not schedule the automatic welcome sequence with setTimeout', () => {
  const source = readFileSync('src/lib/f1-welcome-sequence.ts', 'utf8');
  expect(source).not.toMatch(/setTimeout\s*\(/);
  expect(source).toMatch(/requestAnimationFrame\s*\(/);
});
```

- [ ] **Step 3: Run migrated tests and compare with legacy scripts**

Run: `npm run test:unit -- --run tests/unit/f1 tests/unit/rose tests/unit/i18n`

Expected: all migrated tests pass.

Run each legacy script once before deletion using its existing npm command.

Expected: legacy and Vitest results agree.

- [ ] **Step 4: Remove migrated scripts and legacy package entries**

Delete only pure TypeScript check scripts with passing Vitest parity. Retain GLB, Blender, media, and WebGL probe validators for Task 3.

- [ ] **Step 5: Verify no obsolete references remain**

Run: `rg 'check:(f1-glitch|f1-welcome|f1-motion|f1-wheel-hold|f1-airflow|f1-studio|f1-reflection|f1-arrival-motion|f1-showroom-interaction|showroom-resources|rose-animation|shake|i18n)' package.json .github README.md AGENTS.md`

Expected: no stale command references, except compatibility aliases intentionally documented and tested.

- [ ] **Step 6: Commit the direct migration**

```bash
git add package.json tests/unit scripts
git commit -m "test: migrate behavior checks to Vitest"
```

### Task 3: Unify specialized asset validators behind a manifest

**Files:**
- Create: `ci/asset-validators.json`
- Create: `scripts/ci/run-asset-validators.mjs`
- Create: `tests/unit/ci/asset-validator-runner.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `runAssetValidators({groups?: string[]}): Promise<ValidatorResult[]>` where every result has `id`, `group`, `status`, `durationMs`, and `command`.
- Produces: portable `npm run test:assets -- --group f1|rose|all` and local model-change command `npm run test:assets:deep`; routine CI never assumes Blender is installed.

- [ ] **Step 1: Write failing manifest-runner tests**

Test that unknown groups fail, a non-zero child status fails the run, JSON summaries contain duration/status, and `all` includes F1 showroom plus rose GLB validators.

```ts
expect(selectValidators(manifest, ['rose']).map(item => item.id)).toContain('rose-glb');
expect(() => selectValidators(manifest, ['missing'])).toThrow(/Unknown validator group/);
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `npm run test:unit -- --run tests/unit/ci/asset-validator-runner.test.ts`

Expected: FAIL because the runner module does not exist.

- [ ] **Step 3: Define the explicit manifest**

Include shipped asset validators only: showroom asset paths, RB20 showroom v5 ownership, and rose GLB animation/morph contract in the portable tier. Keep the Blender/Python geometry verifier in the explicit deep tier. Preparation/export scripts are not validators and must not run in CI.

- [ ] **Step 4: Implement sequential execution and JSON summary**

Use `spawn(command, args, {stdio: 'inherit'})`; reject shell strings, validate every manifest entry, stop on failure, and write `output/test-results/asset-validators.json`.

- [ ] **Step 5: Run all shipped asset validation**

Run: `npm run test:assets -- --group all`

Expected: all portable manifest entries pass and the JSON summary lists each portable validator. When a model asset changes, separately run `npm run test:assets:deep` on a local machine with Blender and retain its result; do not install Blender in routine GitHub CI.

- [ ] **Step 6: Commit the asset runner**

```bash
git add ci/asset-validators.json scripts/ci/run-asset-validators.mjs tests/unit/ci/asset-validator-runner.test.ts package.json
git commit -m "test: unify asset contract validation"
```

### Task 4: Build the fail-open impact resolver and command orchestrator

**Files:**
- Create: `ci/impact-map.json`
- Create: `scripts/ci/resolve-impact.mjs`
- Create: `scripts/ci/run-impact-tests.mjs`
- Create: `tests/unit/ci/impact-resolver.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolveImpact({files, map}): ImpactSelection` with `unit`, `assets`, `e2e`, `memory`, `projects`, `full`, and `reasons`.
- Produces: `npm run test:impact -- --base <sha> --head <sha>`.

- [ ] **Step 1: Write table-driven resolver tests**

Cover at least F1, particles, rose, docs-only, shared Three.js, truncated diff, invalid configuration, and unmatched source files.

```ts
it.each([
  ['src/components/ThreeRose.tsx', ['rose'], false],
  ['src/components/ParticleBackground.tsx', ['itinerary-particles'], false],
  ['src/components/showroom/showroom-particles.ts', ['f1'], false],
  ['src/unknown-feature.ts', ['all'], true],
])('%s resolves safely', (file, suites, full) => {
  const result = resolveImpact({files: [file], map});
  expect(result.e2e).toEqual(expect.arrayContaining(suites));
  expect(result.full).toBe(full);
});
```

- [ ] **Step 2: Verify the resolver tests fail**

Run: `npm run test:unit -- --run tests/unit/ci/impact-resolver.test.ts`

Expected: FAIL because resolver exports do not exist.

- [ ] **Step 3: Implement deterministic union rules and safe fallback**

Never return an empty selection for unknown production changes. Emit compact JSON to stdout and optionally append a Markdown table to `$GITHUB_STEP_SUMMARY`.

- [ ] **Step 4: Implement the local orchestrator**

Resolve `git diff --name-only <base>...<head>`, run selected unit/assets/browser commands serially, and accept `--all` for deterministic full local validation.

- [ ] **Step 5: Verify representative selections and full fallback**

Run: `npm run test:unit -- --run tests/unit/ci/impact-resolver.test.ts`

Expected: all resolver cases pass.

Run: `node scripts/ci/resolve-impact.mjs --files src/unknown-feature.ts`

Expected: JSON has `"full": true` and a reason naming the unmatched file.

- [ ] **Step 6: Commit impact selection**

```bash
git add ci/impact-map.json scripts/ci tests/unit/ci package.json
git commit -m "ci: add fail-open impact test selection"
```

### Task 5: Add test-only observability and resource lifecycle accounting

**Files:**
- Create: `src/lib/test-observability.ts`
- Create: `tests/unit/f1/test-observability.test.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/components/WelcomePage.tsx`
- Modify: `src/components/ParticleBackground.tsx`
- Modify: `src/components/RaceCountdown.tsx`
- Modify: `src/components/ThreeRose.tsx`
- Modify: `src/components/RoseModal.tsx`

**Interfaces:**
- Produces: `window.__HAPPY_TRAVEL_TEST__?.snapshot(): HappyTravelTestSnapshot` only when `VITE_TEST_OBSERVABILITY=true`.
- Produces: scene snapshots for `f1-welcome`, `itinerary-particles`, and `rose`, each containing observable `phase`, active rAF/listener counts, and owned WebGL/Canvas resources.
- Test API is read-only; it cannot advance animation or mutate application state.

- [ ] **Step 1: Write failing registry lifecycle tests**

```ts
const audit = createResourceAudit('rose');
const disposeFrame = audit.trackAnimationFrame(42);
expect(audit.snapshot().activeAnimationFrames).toBe(1);
disposeFrame();
expect(audit.snapshot().activeAnimationFrames).toBe(0);
```

Also assert double disposal is idempotent and scene unregister removes its snapshot.

- [ ] **Step 2: Run the focused tests and observe missing exports**

Run: `npm run test:unit -- --run tests/unit/f1/test-observability.test.ts`

Expected: FAIL because `createResourceAudit` is absent.

- [ ] **Step 3: Implement the test-gated read API**

Define exact snapshot types for phases, `activeAnimationFrames`, `activeListeners`, `activeRenderTargets`, `activeMaterials`, `activeGeometries`, `activeTextures`, `contexts`, `contextLosses`, `contextRestores`, `particles`, and Three renderer memory values. Do not expose setters on `window`.

- [ ] **Step 4: Wire owned-resource create/dispose pairs into all three domains**

Track each request/cancel animation frame pair, resize/orientation/visibility listener, owned material/geometry/texture/render target, and modal mount/unmount. Preserve current production behavior and F1 invariants.

- [ ] **Step 5: Build with observability disabled and enabled**

Run: `npm run lint && npm run build`

Expected: PASS and normal production does not install `window.__HAPPY_TRAVEL_TEST__`.

Run: `VITE_TEST_OBSERVABILITY=true npm run build`

Expected: PASS and the test build contains the read-only bridge.

- [ ] **Step 6: Commit observability**

```bash
git add src/lib/test-observability.ts src/vite-env.d.ts src/components tests/unit/f1/test-observability.test.ts
git commit -m "test: expose read-only scene resource audits"
```

### Task 6: Make itinerary and countdown particles deterministic and testable

**Files:**
- Create: `src/lib/particle-runtime.ts`
- Create: `tests/unit/particles/particle-runtime.test.ts`
- Modify: `src/components/ParticleBackground.tsx`
- Modify: `src/components/RaceCountdown.tsx`

**Interfaces:**
- Produces: `createSeededRandom(seed: number): () => number`.
- Produces: `advanceParticle(particle, deltaSeconds, bounds): Particle` with finite, frame-rate-independent updates.
- Produces: `clampParticleCount(requested, maximum): number`.

- [ ] **Step 1: Write failing deterministic particle tests**

Assert equal seeds produce equal fields, different frame subdivisions converge within tolerance, invalid sizes never produce NaN/Infinity, requested counts clamp, and dispose cancels rAF/listeners.

```ts
const oneFrame = advanceParticle(start, 1 / 30, bounds);
const twoFrames = advanceParticle(advanceParticle(start, 1 / 60, bounds), 1 / 60, bounds);
expect(twoFrames.x).toBeCloseTo(oneFrame.x, 5);
```

- [ ] **Step 2: Verify failure before implementation**

Run: `npm run test:unit -- --run tests/unit/particles/particle-runtime.test.ts`

Expected: FAIL because particle runtime exports do not exist.

- [ ] **Step 3: Extract pure particle generation/update helpers**

Inject `random = Math.random` in production call sites. Use monotonic rAF timestamps and delta seconds, clamp extreme deltas after tab restoration, and keep render-only code in the components.

- [ ] **Step 4: Add resize, orientation, visibility, and reduced-motion lifecycle handling**

On resize/orientation, rebuild only buffers whose dimensions require it; on hidden state pause rAF; on visible state reset the previous timestamp; on reduced motion reduce or freeze decorative motion without hiding required content.

- [ ] **Step 5: Run unit, lint, and build validation**

Run: `npm run test:unit -- --run tests/unit/particles && npm run lint && npm run build`

Expected: all commands pass with no behavior regression.

- [ ] **Step 6: Commit deterministic particle behavior**

```bash
git add src/lib/particle-runtime.ts src/components/ParticleBackground.tsx src/components/RaceCountdown.tsx tests/unit/particles
git commit -m "test: make page particles deterministic and observable"
```

### Task 7: Build reusable Playwright Page Objects and state contracts

**Files:**
- Create: `tests/e2e/fixtures/test.ts`
- Create: `tests/e2e/pages/welcome-page.ts`
- Create: `tests/e2e/pages/itinerary-page.ts`
- Create: `tests/e2e/pages/rose-modal.ts`
- Create: `tests/e2e/pages/test-observability.ts`
- Modify: UI components only where stable roles, labels, or `data-testid` landmarks are missing.

**Interfaces:**
- Produces: `WelcomePage`, `ItineraryPage`, `RoseModal`, and `TestObservability` fixtures.
- Page Object waits read ARIA/DOM landmarks first and the read-only audit for WebGL-only phase state.

- [ ] **Step 1: Add fixture contract tests through the existing smoke spec**

Replace the raw body assertion with `welcome.waitUntilReady()` and assert that the Page Object resolves a visible landmark. The test should fail until Page Objects exist.

- [ ] **Step 2: Implement role-first locators and phase waits**

```ts
async waitForScenePhase(sceneId: string, phase: string) {
  await expect.poll(async () => {
    return this.page.evaluate(([id]) => window.__HAPPY_TRAVEL_TEST__?.snapshot().scenes[id]?.phase, [sceneId]);
  }).toBe(phase);
}
```

Do not add timeouts tied to the nominal animation durations; use Playwright assertion timeouts only as upper bounds.

- [ ] **Step 3: Implement canvas hit-point selection by bounding box**

Compute target points from current canvas/target rectangles and verify the resulting phase/ARIA state. Do not hard-code screen coordinates.

- [ ] **Step 4: Verify desktop and mobile smoke navigation**

Run: `npm run build && npx playwright test tests/e2e/smoke --project=chromium-desktop --project=chromium-mobile`

Expected: smoke tests pass in both projects without fixed waits.

- [ ] **Step 5: Enforce the no-sleep contract**

Run: `! rg -n 'waitForTimeout|setTimeout\s*\(' tests/e2e`

Expected: exit 0 with no matches.

- [ ] **Step 6: Commit Page Objects**

```bash
git add tests/e2e src/components
git commit -m "test: add observable browser page objects"
```

### Task 8: Implement the F1 browser regression suite

**Files:**
- Create: `tests/e2e/f1/welcome-timeline.spec.ts`
- Create: `tests/e2e/f1/interaction.spec.ts`
- Create: `tests/e2e/f1/reduced-motion.spec.ts`
- Create: `tests/e2e/f1/visual-timeline.spec.ts`

**Interfaces:**
- Consumes: `WelcomePage` and `TestObservability` from Task 7.
- Produces: `@f1`, `@visual`, and `@webgl-heavy` tagged tests selectable by impact runner.

- [ ] **Step 1: Write the complete arrival timeline test**

Cover hold/cancel, successful hold, 4.5s hologram, 100ms clean hold, 1.8s three-pulse glitch, clean rAF recovery, automatic explode, and ray-hit reassembly. Assert observable phase order and clean-frame counters, not wall-clock sleeps.

- [ ] **Step 2: Add trusted input and pointer forwarding tests**

Cover mouse, touch, Enter, car-visible hit ownership, and exposed CTA forwarding. Assert only the four runtime wheel nodes change rotation and wheel-adjacent bodywork stays in its semantic body group.

- [ ] **Step 3: Add explode/reassemble floor and resource assertions**

Poll minimum world-space Y throughout motion and fail if any part crosses the floor; compare pre/post resource audit after reassembly and unmount.

- [ ] **Step 4: Add timeline screenshots and black-frame analysis hooks**

Capture arrival, hologram complete, clean hold, each glitch pulse, clean recovery, exploded, and reassembled landmarks. Feed screenshots to an image-luminance helper and reject fully black/unexpectedly blank frames.

- [ ] **Step 5: Run focused Chromium then full browser matrix**

Run: `npm run build && npx playwright test tests/e2e/f1 --project=chromium-desktop --workers=1`

Expected: all F1 cases pass.

Run: `npx playwright test tests/e2e/f1 --workers=1`

Expected: desktop/mobile Chromium and WebKit pass, with context-loss probes skipped by capability only outside Chromium.

- [ ] **Step 6: Commit F1 E2E coverage**

```bash
git add tests/e2e/f1
git commit -m "test: cover the complete F1 browser timeline"
```

### Task 9: Implement itinerary particle browser and visual coverage

**Files:**
- Create: `tests/e2e/itinerary-particles/interaction.spec.ts`
- Create: `tests/e2e/itinerary-particles/responsive.spec.ts`
- Create: `tests/e2e/itinerary-particles/visual.spec.ts`

**Interfaces:**
- Consumes: `ItineraryPage` and scene `itinerary-particles` audit.
- Produces: `@particles`, `@visual`, and `@lifecycle` tests.

- [ ] **Step 1: Test navigation and particle visibility**

Enter the next page through the real UI, wait for the itinerary landmark and positive particle count, and assert the canvas has a non-zero bounding box.

- [ ] **Step 2: Test pointer/touch pass-through**

Click and touch an interactive itinerary control whose visual rectangle overlaps the decorative canvas. Assert the intended control action occurs and the canvas does not own pointer events.

- [ ] **Step 3: Test resize, orientation, hidden/resume, and reduced motion**

Change viewport dimensions, dispatch orientation/visibility through supported browser APIs, and assert finite particle data, configured caps, stable content layout, paused hidden rAF, and clean timestamp reset on resume.

- [ ] **Step 4: Add deterministic visual snapshots**

Enable a fixed test seed, capture desktop/mobile portrait/mobile landscape/reduced-motion landmarks, and use bounded screenshot regions so dynamic clocks or maps do not destabilize comparisons.

- [ ] **Step 5: Run particle tests in Chromium and Mobile WebKit**

Run: `npm run build && npx playwright test tests/e2e/itinerary-particles --project=chromium-desktop --project=chromium-mobile --project=webkit-mobile`

Expected: all particle interaction and responsive tests pass.

- [ ] **Step 6: Commit particle browser coverage**

```bash
git add tests/e2e/itinerary-particles
git commit -m "test: cover itinerary particle behavior"
```

### Task 10: Implement rose trigger, animation, asset, and browser coverage

**Files:**
- Create: `tests/e2e/rose/trigger.spec.ts`
- Create: `tests/e2e/rose/timeline.spec.ts`
- Create: `tests/e2e/rose/modal-interaction.spec.ts`
- Create: `tests/e2e/rose/visual.spec.ts`
- Modify: `ci/asset-validators.json`

**Interfaces:**
- Consumes: `RoseModal`, rose audit phases, and the specialized `rose-glb` validator.
- Produces: `@rose`, `@visual`, `@webkit-mobile`, and `@lifecycle` tests.

- [ ] **Step 1: Test secret clicks and shake fallbacks**

Use trusted clicks to open the modal. For DeviceMotion, test permission allowed, denied, missing API, threshold crossing, cooldown, and modal-open suppression; skip only APIs the engine cannot emulate and always assert the fallback path remains usable.

- [ ] **Step 2: Test the full rose timeline**

Wait in order for `assembling`, `handoff`, `blooming`, and `presented`. Assert particle count is positive during assembly, `RoseBloom` becomes active once, all 25 `Petal_*` channels remain in `[0,1]`, and the final bounds do not clip the modal viewport.

- [ ] **Step 3: Test modal interaction and accessibility**

Cover close button, backdrop click, Escape when implemented, focus entry/return, scroll lock, z-index over page content, and two consecutive open/close cycles.

- [ ] **Step 4: Add deterministic key-stage screenshots**

Capture empty/assembly, handoff, bloom midpoint, presented, desktop, mobile portrait, and Mobile WebKit. Reject black frames and unexpected overflow; do not pixel-compare nondeterministic particle locations without the fixed seed.

- [ ] **Step 5: Run rose unit, asset, and browser gates**

Run: `npm run test:unit -- --run tests/unit/rose && npm run test:assets -- --group rose`

Expected: animation, shake, GLB, morph-channel, duration, and open-pose bounds contracts pass.

Run: `npm run build && npx playwright test tests/e2e/rose --project=chromium-desktop --project=chromium-mobile --project=webkit-mobile --workers=1`

Expected: all supported interaction and timeline cases pass.

- [ ] **Step 6: Commit rose coverage**

```bash
git add tests/e2e/rose ci/asset-validators.json
git commit -m "test: cover rose triggers bloom and modal lifecycle"
```

### Task 11: Add repeated resource trend and MemLab suites

**Files:**
- Create: `tests/memory/renderer-lifecycle.spec.ts`
- Create: `tests/memory/particle-lifecycle.spec.ts`
- Create: `tests/memory/rose-lifecycle.spec.ts`
- Create: `tests/memory/memlab/welcome.js`
- Create: `tests/memory/memlab/particles.js`
- Create: `tests/memory/memlab/rose.js`
- Create: `scripts/ci/run-memlab.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: resource trend JSON under `output/test-results/memory/`.
- Produces: MemLab scenario selector `--scenario welcome|particles|rose|all`.

- [ ] **Step 1: Add five-cycle Playwright lifecycle tests**

Treat cycle one as warm-up. For cycles two through five, assert owned rAF/listener/material/geometry/texture/render-target counts return to baseline and shared renderer values do not increase monotonically.

```ts
expect(samples.slice(1).every(sample => sample.activeAnimationFrames === 0)).toBe(true);
expect(hasStrictMonotonicGrowth(samples.slice(1).map(sample => sample.geometries))).toBe(false);
```

- [ ] **Step 2: Add domain-specific loops**

F1: enter → start → glitch → explode → reassemble → leave.

Particles: enter itinerary → run → resize/orient → leave.

Rose: open → assemble → bloom → close → open/close → leave.

- [ ] **Step 3: Implement MemLab scenarios and compact leak summaries**

Each scenario defines `url`, `action`, and `back`/cleanup; write `leaks.txt`, retainer trace, and heap snapshots only on a reported leak or explicit `--keep-heaps`.

- [ ] **Step 4: Verify Playwright trends locally**

Run: `npm run build && npm run test:memory -- --playwright-only --project=chromium-desktop`

Expected: all three domains return owned resources to baseline.

- [ ] **Step 5: Verify one MemLab scenario manually**

Run: `npm run test:memory -- --memlab-only --scenario rose`

Expected: scenario completes and writes a compact summary; any baseline leak is documented with an exact retainer path before changing thresholds.

- [ ] **Step 6: Commit memory coverage**

```bash
git add tests/memory scripts/ci/run-memlab.mjs package.json
git commit -m "test: add WebGL and DOM lifecycle leak checks"
```

### Task 12: Add GitHub Actions quality gates and artifact policy

**Files:**
- Create: `.github/workflows/ci-fast.yml`
- Create: `.github/workflows/ci-browser.yml`
- Create: `.github/workflows/ci-visual-memory.yml`
- Create: `scripts/ci/write-summary.mjs`

**Interfaces:**
- Produces stable checks `Fast Gate`, `Impact Resolver`, `Chromium Desktop`, `WebKit Desktop`, plus non-required mobile jobs initially.
- Produces manual inputs `suite=visual|memory|all` and `domain=f1|particles|rose|all`.

- [ ] **Step 1: Add Fast Gate workflow**

Use `pull_request`, `push` to `main`, and `workflow_dispatch`; Node 22; `npm ci`; minimal `contents: read`; explicit timeout; npm cache; and `npm run test:fast`. This workflow runs portable asset validators only and never installs Blender.

- [ ] **Step 2: Add Browser Impact workflow**

Checkout full enough history for diff resolution, run resolver first, pass its JSON outputs into a browser matrix, install only required Playwright engines, build once per job, and run selected tags/directories. Use standard `ubuntu-latest` and `workers=1` for WebGL-heavy jobs.

- [ ] **Step 3: Add nightly visual/memory workflow**

Schedule once nightly in an off-peak UTC hour and support manual suite/domain inputs. Install Chromium for memory and the required matrix for visual tests. Set longer but finite timeouts.

- [ ] **Step 4: Configure concurrency and failure-only artifacts**

All workflows use `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. Upload Playwright and memory output under `if: failure()` with 3-day retention; upload compact nightly JSON summaries for 7 days.

- [ ] **Step 5: Validate workflow syntax and local entry points**

Run: `npm run test:fast`

Expected: lint, unit, assets, and production build pass.

Run: `npx playwright test --list`

Expected: tests are listed under all four configured projects and no workflow contains secrets for Vercel.

- [ ] **Step 6: Commit workflows**

```bash
git add .github/workflows scripts/ci/write-summary.mjs
git commit -m "ci: add fast browser visual and memory gates"
```

### Task 13: Add Vercel SPA configuration and dependency governance

**Files:**
- Create: `vercel.json`
- Create: `.github/dependabot.yml`
- Modify: `.env.example`

**Interfaces:**
- Produces: Vercel rewrite from all SPA routes to `/index.html`.
- Produces: weekly npm and GitHub Actions update PRs.

- [ ] **Step 1: Add the SPA rewrite without deployment credentials**

```json
{
  "rewrites": [{"source": "/(.*)", "destination": "/index.html"}]
}
```

- [ ] **Step 2: Configure weekly Dependabot updates**

Use two entries, `npm` at `/` and `github-actions` at `/`, with a small open-PR limit and weekly schedule. Do not auto-merge dependency updates.

- [ ] **Step 3: Document build-only environment behavior**

Keep production `GEMINI_API_KEY` in Vercel only. `.env.example` names the variable without a real value; CI must build with an empty or non-privileged placeholder if required.

- [ ] **Step 4: Verify deep-link production preview behavior**

Run: `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`

In a second command run: `curl -I http://127.0.0.1:4173/itinerary`

Expected: local preview serves the SPA entry or the application documents why Vercel rewrite is the deployment-only fallback.

- [ ] **Step 5: Commit delivery configuration**

```bash
git add vercel.json .github/dependabot.yml .env.example
git commit -m "ci: configure Vercel routes and dependency updates"
```

### Task 14: Codify the testing contract and operator documentation

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/testing/ci-testing-policy.md`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: one concise agent contract and a detailed human/Codex runbook.

- [ ] **Step 1: Add concise mandatory rules to `AGENTS.md`**

Require behavior tests for behavior changes, discovery directories, impact-map updates, fail-open unknown mappings, no fixed E2E sleeps, `npm run test:impact` before handoff, F1/particle/rose lifecycle coverage, and failure-only browser media.

- [ ] **Step 2: Write the detailed testing policy**

Document command selection, test naming/tags, Page Object conventions, deterministic particle seeds, browser simulation versus real devices, F1 invariants, rose asset validators, renderer audit interpretation, MemLab/Spector roles, flaky-test policy, artifact locations, and failure investigation steps.

- [ ] **Step 3: Update README contributor commands**

List `npm ci`, `test:unit`, `test:assets`, `test:impact`, `test:e2e`, `test:memory`, and `test:full`, with expected duration classes and the fact that Vercel deployment remains native.

- [ ] **Step 4: Track documentation while ignoring generated evidence**

Remove the broad `docs/` ignore rule. Ignore only generated paths such as `output/`, `test-results/`, `playwright-report/`, MemLab work directories, heap snapshots, traces, and videos.

- [ ] **Step 5: Verify policy references and ignored outputs**

Run: `git check-ignore docs/testing/ci-testing-policy.md; test $? -eq 1`

Expected: documentation is not ignored.

Run: `git check-ignore output/example.zip playwright-report/index.html`

Expected: generated evidence paths are ignored.

- [ ] **Step 6: Commit policy documentation**

```bash
git add AGENTS.md docs/testing/ci-testing-policy.md README.md .gitignore
git commit -m "docs: codify reusable testing workflow"
```

### Task 15: Complete local verification and prepare repository settings handoff

**Files:**
- Modify only if verification exposes defects in files owned by Tasks 1–14.
- Create: `docs/testing/github-vercel-setup.md`

**Interfaces:**
- Produces: reproducible verification evidence and exact GitHub/Vercel UI settings that cannot be committed through repository files.

- [ ] **Step 1: Run static and fast gates from a clean dependency install**

Run: `npm ci && npm run test:fast`

Expected: clean install, lint, all Vitest suites, all specialized validators, and production build pass.

- [ ] **Step 2: Run the complete browser matrix**

Run: `npm run test:e2e`

Expected: smoke, F1, itinerary particles, and rose tests pass in all configured projects; capability skips are explicit and limited.

- [ ] **Step 3: Run impact and memory validation**

Run: `npm run test:impact -- --all`

Expected: resolver explains full selection and all selected gates pass.

Run: `npm run test:memory -- --playwright-only --project=chromium-desktop`

Expected: all owned resource counters return to baseline after warm-up.

- [ ] **Step 4: Check repository hygiene**

Run: `git diff --check && git status --short && ! rg -n 'waitForTimeout|\.only\(|\.skip\(' tests .github`

Expected: no whitespace errors, no generated artifacts staged, no focused tests, no unexplained skips, and only intended source changes.

- [ ] **Step 5: Document remote settings**

Write exact GitHub `main` rules: PR required, branch current, required checks `Fast Gate`, `Impact Resolver`, `Chromium Desktop`, `WebKit Desktop`, no force push/delete. Document that mobile jobs become required after stability observation. Record Vercel Production Branch=`main`, Preview deployments enabled, and no GitHub Action Vercel secrets.

- [ ] **Step 6: Commit final verification documentation**

```bash
git add docs/testing/github-vercel-setup.md
git commit -m "docs: add GitHub and Vercel setup checklist"
```

- [ ] **Step 7: Review branch diff before merge or PR**

Run: `git log --oneline --decorate main..HEAD && git diff --stat main...HEAD`

Expected: small reviewable commits covering test foundations, migrations, asset/impact runners, domain E2E/memory suites, workflows, and documentation; no unrelated main-checkout changes.
