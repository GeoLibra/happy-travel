# Task 7 report — RB20 countdown vehicle

## Status

DONE_WITH_CONCERNS

## Implementation

- Added `loadCountdownVehicle()` around the accepted `/models/2024_redbull_rb20_showroom_v5.glb` asset and existing `ShowroomAssetManager` semantics.
- Each call clones the model hierarchy, shares cached geometry, clones mutable materials, applies countdown-only environment intensity, and returns an idempotent disposer that removes only its clone and disposes only cloned materials.
- No welcome-scene wheel spin, exploded-view, raycast, or pointer-forwarding handlers are attached.
- Added named desktop/mobile poses and scene resize application. Desktop accepted pose is `(0, -2.1, 5.6)`, rotation `(0, -0.18, 0)`, scale `1.15`; final mobile calibration is `(0, -5.8, 4.4)`, rotation `(0, -0.08, 0)`, scale `0.9`.
- `RaceCountdownPage` owns the async vehicle lifecycle, exposes loading/ready/unavailable state, passes the clone into `CountdownCanvas`, and disposes it on unmount.
- Added ownership, asset URL/failure, and pose tests plus responsive desktop/mobile product-page coverage and screenshots.

## Verification completed

- RED observed: `pnpm vitest run tests/unit/race-countdown/countdown-vehicle.test.ts` failed because the loader module did not exist.
- GREEN: `pnpm vitest run tests/unit/race-countdown/countdown-vehicle.test.ts` — 3 passed (repeated during implementation).
- `pnpm lint` — passed after implementation.
- `pnpm check:f1-model` — passed.
- `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-responsive.spec.ts --project=app-desktop-chromium` — 5 passed in 2.0m using the worktree-owned Vite webServer.
- Focused calibrated-mobile run — 1 passed in 27.2s.
- Desktop evidence: `output/reference/countdown-rb20-desktop.png` (1280×800). Visual check: full car visible in front of the center digits; reflection present; footprint is approximately one unit.
- Mobile evidence: `output/reference/countdown-rb20-mobile.png` (390×844). The first calibration was too small; a second was too large. The committed `0.9 / y=-5.8` pose is the final midpoint calibration.
- `git diff --check` — passed.

## Concern / exact blocker

- Direct sandboxed server start `pnpm exec vite --port 4175 --host 127.0.0.1` failed with `Error: listen EPERM: operation not permitted 127.0.0.1:4175`.
- Escalated Playwright subsequently succeeded and produced the evidence above. A final full screenshot refresh after the last mobile midpoint adjustment was requested but remained pending/was interrupted; per controller instruction no further browser/server commands were run. The final mobile constants are covered by the committed literal pose test, but the evidence PNG on disk reflects the preceding `scale: 1.05, y: -5` calibration rather than the final midpoint.

## Self-review

- Change scope is limited to the five Task 7 implementation/test files plus this report.
- Shared geometry and source materials are never disposed by countdown clones.
- Vehicle and asset-manager cleanup are idempotent and do not depend on the scene disposer.
- The optional car load cannot turn a functioning countdown into the DOM WebGL fallback.
