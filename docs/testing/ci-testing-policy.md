# Happy Travel CI & Testing Policy

This document outlines the testing strategy, commands, directory layout, browser simulation boundaries, and CI quality gates for the `GeoLibra/happy-travel` project.

---

## 1. Stack & Package Manager

- **Package Manager**: `pnpm` (`packageManager: pnpm@10.15.0`) with lockfile `pnpm-lock.yaml`.
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
| `pnpm check:showroom-acceptance` | Generates browser acceptance evidence & screenshots | Showroom / F1 changes |

---

## 3. Directory Conventions

- `tests/unit/`: Unit & pure TypeScript contract tests (`*.test.ts`, `*.test.tsx`).
- `tests/e2e/pages/`: Page Object Models (`WelcomePage.ts`, `ShowroomPage.ts`, `ItineraryPage.ts`, `RoseModalPage.ts`).
- `tests/e2e/f1/`: F1 interaction, sequence, and context-loss browser specs.
- `tests/e2e/itinerary-particles/`: Particle background, layout, and responsiveness specs.
- `tests/e2e/rose/`: Rose easter egg, bloom animation timeline, and modal lifecycle specs.
- `tests/memory/`: WebGL resource lifecycle & MemLab leak audit specs.

---

## 4. Testing Rules & Invariants

1. **No Fixed Sleep / Timeouts**: Playwright tests must await observable application state (ARIA landmarks, DOM elements, or `window.__HAPPY_TRAVEL_TEST__` phase state). Never use `waitForTimeout` or hardcoded `setTimeout`.
2. **Page Objects**: All E2E specs must interact with the application using structured Page Objects located in `tests/e2e/pages/`.
3. **Deterministic Randomness**: Tests involving particles or animations must use fixed seeds or deterministic mocks; real randomness is reserved for production runtime.
4. **F1 Canvas Invariants**: The transparent car canvas remains above welcome UI elements. Exposed UI controls must remain clickable via pointer event forwarding.
5. **Wheel Node Target Invariants**: Only `WheelSpin_FL`, `WheelSpin_FR`, `WheelSpin_RL`, and `WheelSpin_RR` are valid runtime wheel-spin nodes.
6. **Artifact Storage**: Test results, traces, videos, and screenshots are output to ignored `output/playwright/` or `output/test-results/` directories and uploaded to CI artifacts only on failure.
