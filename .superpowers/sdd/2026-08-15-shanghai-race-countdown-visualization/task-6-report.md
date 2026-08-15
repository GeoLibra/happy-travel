# Task 6 report — itinerary countdown entry and history return

## Status

Implemented and committed. The compact itinerary countdown is now a native, keyboard-accessible button that opens the product countdown at `/countdown`. In-app return uses browser history and leaves the itinerary tree mounted, preserving its selected day. Direct `/countdown` visits retain their standalone behavior and the back control replaces the URL with `/`.

## Changes

- Added `useCountdownNavigation`, which derives open state from `location.pathname`, listens for `popstate`, pushes an app-owned `/countdown` history entry, and falls back to `replaceState('/')` for direct visits.
- Kept the itinerary mounted while its full-screen countdown overlay is open, so browser Back restores the existing React state instead of reconstructing the itinerary.
- Deferred mounting the itinerary only for a direct `/countdown` load. This prevents welcome-scene WebGL startup from interfering with the countdown's WebGL-fallback contract.
- Made the compact `RaceCountdown` surface a native button with visible focus styling and the text `查看全屏倒计时`. Its animation canvas remains pointer-inert.
- Extended page-object and Playwright coverage for compact-card entry, browser Back state restoration, and direct-route fallback back-button activation.

## TDD evidence

- Added the compact-card navigation assertion before implementing the entry surface. The baseline rendered only `Race Countdown Canvas` inside a generic container, with no `查看全屏倒计时` button.
- The initial integration run also revealed that mounting the hidden welcome scene for direct `/countdown` caused two existing WebGL-fallback tests to lose the countdown surface. The direct-route mount guard was added, and both affected tests then passed.

## Verification

- `pnpm run lint` — passed (`tsc --noEmit`).
- Focused compact-card browser-Back test — passed; it selects DAY 2, opens `/countdown`, calls browser Back, and observes the DAY 2 active indicator.
- `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium --grep "WebGL is unavailable|LIGHTS OUT"` — 2 passed after the direct-route guard.
- Fallback back-button activation test (`WebGL is unavailable`) — passed after adding the click and root-URL assertion.
- The requested particle suite was launched: `pnpm exec playwright test tests/e2e/itinerary-particles/particles-behavior.spec.ts --project=particles-e2e-chromium`. It was still running when the parent agent requested an immediate handoff; no result is asserted here.

## Concerns

- A complete post-fix run of all seven countdown-flow tests was not repeated after the parent agent requested immediate handoff. The new navigation test and every focused regression/fallback check listed above passed.

## Particle regression outcome

- `pnpm exec playwright test tests/e2e/itinerary-particles/particles-behavior.spec.ts --project=particles-e2e-chromium` — passed: 4 tests, no failed tests (`output/playwright/test-results/.last-run.json` reported `status: "passed"`).

## Fix round 1 — inactive itinerary and history focus handoff

- The retained itinerary is now wrapped in `data-itinerary-surface`. When the app-owned countdown is open, it remains mounted for state retention but is `aria-hidden`, `inert`, and `display: none`; this removes the competing itinerary landmark from the accessibility tree and suspends its covered rendering surface.
- The compact countdown effect is explicitly inactive while that surface is hidden, which cleans up its animation frame, resize listener, and intersection observer. The direct-route mount guard remains unchanged.
- `RaceCountdownPage` places focus on its visible `返回行程` control on mount. After the app-owned back control (or browser Back) closes the route, focus is restored to the retained compact trigger on the next animation frame.
- The app-opened acceptance flow now opens the compact trigger with Enter, activates `返回行程` with Enter, verifies DAY 2/state/focus/no welcome replay, then uses browser Forward to reopen and verifies the popstate focus and inactive-view boundary again. Direct-route fallback coverage remains in the WebGL-fallback test.

### Fix-round verification

- `pnpm run lint` — passed (`tsc --noEmit`).
- `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium` — passed: 7 tests, including the new app-owned keyboard Back/Forward flow.
- `pnpm exec playwright test tests/e2e/itinerary-particles/particles-behavior.spec.ts --project=particles-e2e-chromium` was launched; after the parent interruption, the latest `output/playwright/test-results/.last-run.json` reports `status: "passed"` and `failedTests: []` (the terminal had reported 4 tests running).

## Fix round 2 — suspend retained map and firework work

- `MapComponent` now receives an `active` lifecycle input. Transitioning to the countdown destroys its AMap instance, label layer, and markers while cancelling an in-flight loader result; returning reinitializes the map renderer without unmounting or resetting React itinerary state. Its `data-amap-renderer-state` exposes `initializing`, `ready`, and `suspended` runtime state.
- `MiniFirework` is now unmounted while the itinerary is inactive. This removes its `document.body` portal and runs both effect cleanups, stopping its 30 ms positioning interval and 60 ms emitter. Its active portal carries `data-mini-firework-portal` for observable browser coverage.
- The app-owned keyboard Back/Forward acceptance flow now establishes the map/firework work is present before opening, suspended/removed while the countdown owns the screen, restored after the app-owned return, and suspended/removed again after browser Forward. It continues to verify DAY 2 retention, focus transfer, and no welcome replay.

### Fix-round verification

- `pnpm run lint` — passed (`tsc --noEmit`).
- Focused app-owned lifecycle acceptance test — passed.
- `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium` — passed: 7 tests.
- `pnpm exec playwright test tests/e2e/itinerary-particles/particles-behavior.spec.ts --project=particles-e2e-chromium` — passed: 4 tests (`.last-run.json` reports passed with no failures).
- `pnpm check:webgl-lifecycle` — passed: the five-cycle F1 welcome renderer lifecycle trend. This is not AMap lifecycle evidence.

## Fix round 3 — deterministic AMap recreation evidence

- `MapComponent` now exposes app-owned resource counters for its AMap instance, labels layer, and marker collection alongside its lifecycle status. `ready` is set only after the map, one labels layer, and every itinerary marker have been recreated; cleanup resets all counts to zero before reporting `suspended`.
- The component accepts a legitimately preloaded `window.AMap` SDK before falling back to the package loader. The browser acceptance test preloads a small vendor-boundary fixture, so it executes the production map/layer/marker setup deterministically without treating an unavailable external AMap key as a successful renderer.
- The strengthened test requires `ready`, one map, one layer, and a nonzero marker count before opening; requires `suspended` with all-zero counts throughout the countdown (including after an animation frame); and requires the exact prior marker count plus `ready` again after keyboard return. Browser Forward must suspend all counts again.

### Fix-round verification

- `pnpm run lint` — passed (`tsc --noEmit`).
- Deterministic app-owned AMap resource lifecycle acceptance test — passed.
- `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-flow.spec.ts --project=app-desktop-chromium` — passed: 7 tests.
- `pnpm exec playwright test tests/e2e/itinerary-particles/particles-behavior.spec.ts --project=particles-e2e-chromium` — passed: 4 tests (`.last-run.json` reports passed with no failures).
