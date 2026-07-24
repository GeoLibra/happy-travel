# Happy Travel CI & Testing Policy

This document outlines the testing strategy, commands, directory layout, browser simulation boundaries, and CI quality gates for the `GeoLibra/happy-travel` project.

---

## 1. Stack & Package Manager

- **Package Manager**: `pnpm` (`packageManager: pnpm@10.15.0`) with lockfile `pnpm-lock.yaml`.
- **Node.js Runtime**: Node 24 is the project runtime in local development and GitHub Actions.
- **Unit Test Runner**: Vitest (`pnpm test:unit`).
- **Browser E2E Runner**: Playwright Test (`pnpm test:e2e`).
- **CI Container Image**: Official Playwright Docker image `mcr.microsoft.com/playwright:v1.61.1-jammy`.

---

## 2. Command Reference

| Command | Purpose | When to Run |
| --- | --- | --- |
| `pnpm test:fast` | Fast quality gate (lint, unit tests, assets, build) | Local pre-commit, PR CI |
| `pnpm test:assets` | Runs specialized asset validators (models, media, resources) | Asset updates |
| `pnpm test:impact` | Dynamically resolves and runs affected Playwright browser projects | Pre-push, PR CI |
| `pnpm test:unit` | Executes Vitest unit & contract suites | Core logic changes |
| `pnpm test:e2e` | Executes Playwright E2E suites across browser projects | Full browser validation |
| `pnpm test:full` | Runs `test:fast` followed by `test:e2e` | Pre-release sanity check |
| `pnpm test:memory` | Runs WebGL lifecycle & heap leak audit checks | Nightly / Memory debugging |
| `pnpm check:showroom` | Runs showroom static/runtime contract checks | Showroom implementation changes |
| `pnpm check:showroom-acceptance` | Generates browser acceptance evidence & screenshots | Showroom / F1 changes |
| `pnpm check:f1` | Runs F1 motion, interaction, model, studio, reflection, and asset contracts | F1 showroom behavior/model changes |
| `pnpm check:rose` | Runs rose GLB, bloom animation, and shake detection contracts | Rose/easter-egg changes |

The package-level scripts intentionally expose grouped quality gates instead of every individual check file. If a focused diagnostic is needed, run the underlying script directly, for example `node --import tsx scripts/check-f1-motion.ts`.

`pnpm test:memory` uses the Playwright test observability API for the F1 WebGL renderer lifecycle gate, so it should run against the default Vite dev/test server or an explicit `APP_URL`/`TEST_TARGET_URL` that exposes the same test hooks. MemLab scenario filters then focus on scenario-specific JavaScript leaks while WebGL native resource stability is covered by the 5-cycle lifecycle trend.

---

## 3. Affected Browser Acceptance Matrix

Pull requests and pushes run an affected Playwright matrix instead of a fixed browser-smoke list. The resolver is implemented in `scripts/lib/affected-playwright-projects.ts` and emits projects for `.github/workflows/showroom-browser-acceptance.yml`.

Configured Playwright projects:

- `app-desktop-chromium`
- `showroom-desktop-chromium`
- `showroom-mobile-chromium`
- `showroom-arrival-timeline-chromium`
- `webgl-renderer-lifecycle-chromium`
- `showroom-webkit-smoke`
- `f1-e2e-chromium`
- `particles-e2e-chromium`
- `rose-e2e-chromium`

Routing expectations:

- Documentation-only changes select no browser projects.
- Generic application UI changes select `app-desktop-chromium`.
- F1/showroom/model changes select the showroom acceptance projects plus `f1-e2e-chromium` and `webgl-renderer-lifecycle-chromium`.
- Particle itinerary changes select `app-desktop-chromium` and `particles-e2e-chromium`.
- Rose easter egg changes select `app-desktop-chromium` and `rose-e2e-chromium`.
- Unknown code/configuration paths fail safe with the full browser matrix.

Check the resolver locally with:

```bash
pnpm check:playwright-project-resolver
git diff --name-only main...HEAD | pnpm run --silent resolve:playwright-projects
```

---

## 4. Docker / CI Reproduction

Use the same official Playwright container as CI when browser or memory behavior differs locally:

```bash
docker run --rm -it \
  --ipc=host \
  -v "$PWD":/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm test:fast"
```

Affected browser matrix resolver:

```bash
docker run --rm -i \
  --ipc=host \
  -v "$PWD":/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm check:playwright-project-resolver"
```

Focused browser project example:

```bash
docker run --rm -it \
  --ipc=host \
  -v "$PWD":/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm exec playwright test --project=f1-e2e-chromium"
```

---

## 5. Directory Conventions

- `tests/unit/`: Unit & pure TypeScript contract tests (`*.test.ts`, `*.test.tsx`).
- `tests/e2e/pages/`: Page Object Models (`WelcomePage.ts`, `ShowroomPage.ts`, `ItineraryPage.ts`, `RoseModalPage.ts`).
- `tests/e2e/f1/`: F1 interaction, sequence, and context-loss browser specs.
- `tests/e2e/itinerary-particles/`: Particle background, layout, and responsiveness specs.
- `tests/e2e/rose/`: Rose easter egg, bloom animation timeline, and modal lifecycle specs.
- `tests/memory/`: WebGL resource lifecycle & MemLab leak audit specs.

---

## 6. Testing Rules & Invariants

1. **No Fixed Sleep / Timeouts**: Playwright tests must await observable application state (ARIA landmarks, DOM elements, or `window.__HAPPY_TRAVEL_TEST__` phase state). Never use `waitForTimeout` or hardcoded `setTimeout`.
2. **Page Objects**: All E2E specs must interact with the application using structured Page Objects located in `tests/e2e/pages/`.
3. **Deterministic Randomness**: Tests involving particles or animations must use fixed seeds or deterministic mocks; real randomness is reserved for production runtime.
4. **F1 Canvas Invariants**: The transparent car canvas remains above welcome UI elements. Exposed UI controls must remain clickable via pointer event forwarding.
5. **Wheel Node Target Invariants**: Only `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` are valid runtime wheel-spin nodes.
6. **Artifact Storage**: Test results, traces, videos, and screenshots are output to ignored `output/playwright/` or `output/test-results/` directories and uploaded to CI artifacts only on failure.
