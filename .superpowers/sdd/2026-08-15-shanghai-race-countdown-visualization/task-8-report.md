# Task 8 report — countdown browser projects, observability, and lifecycle coverage

## Status

DONE_WITH_CONCERNS

## Implementation

- Added stable `window.__HAPPY_TRAVEL_TEST__.countdown()` telemetry with readiness, active-scene, owned-resource, frame, viewport, and animation-frame fields. A closed countdown returns an explicit zero baseline rather than a missing API.
- Registered only product-mode countdown canvases as `race-countdown`; cleanup keeps the registration active through scene disposal and unregisters it afterward. Ordinary cleanup cancels the owned animation frame and never forces WebGL context loss.
- Added a real `webglcontextlost` listener that routes the existing product page into its accessible DOM fallback, plus a browser test that verifies four countdown units and the return affordance remain navigable.
- Added `race-countdown-desktop-chromium` at 1280 x 720 and `race-countdown-mobile-chromium` at 390 x 844. Their glob is relative to the Playwright test directory, preventing the worktree name `shanghai-race-countdown` from accidentally selecting unrelated specs.
- Added affected-project routing for countdown implementation/tests and the shared RB20 asset. Added `check:countdown` for the six countdown unit suites plus both dedicated projects.
- Added a five-cycle open/close lifecycle test using the product entry/back flow. It asserts one active scene/animation frame while open and exact zero-baseline equality after each close.
- Updated integrated product design QA without changing visual implementation.

## TDD evidence

- Resolver RED: `pnpm check:playwright-project-resolver` failed the new countdown route assertion; actual output was only `app-desktop-chromium` instead of desktop/mobile countdown plus lifecycle.
- Browser RED: the new context-loss spec failed waiting for `__HAPPY_TRAVEL_TEST__.countdown().ready` because countdown observability did not exist.
- Resolver GREEN: `pnpm check:playwright-project-resolver` — 11/11 passed.
- Context-loss GREEN: `pnpm exec playwright test tests/e2e/race-countdown/race-countdown-context-loss.spec.ts --project=race-countdown-desktop-chromium` — 1 passed in 22.7s.
- Lifecycle GREEN: focused desktop five-cycle test — 1 passed in 2.8m; every close returned the exact initial zero snapshot.
- Project-scope regression: the first full run revealed that a regex matched the absolute worktree directory and selected 76 unrelated tests. After changing to a relative glob, `pnpm exec playwright test --list --project=race-countdown-desktop-chromium --project=race-countdown-mobile-chromium` passed and listed exactly 30 cases from the three countdown specs.

## Final verification

- `pnpm test:fast` — passed: TypeScript, 69 unit tests, 11 resolver tests, 6/6 asset validators, and production build.
- `pnpm lint` — passed independently before the full fast gate.
- `pnpm check:playwright-project-resolver` — passed independently and again inside `test:fast`.
- `git diff --check` — passed.
- `pnpm check:f1` — blocked after `PASS: F1 motion`; the existing `scripts/check-f1-welcome.ts` requires the literal phrase `car canvas stays above ordinary welcome UI` in root `AGENTS.md`, but the current root guidance links that contract from `docs/agent-guides/f1-showroom.md`. Task 8 does not modify `AGENTS.md` or this checker.
- `pnpm check:countdown` — countdown units passed 32/32. The first browser phase could not start Vite in the sandbox (`listen EPERM 0.0.0.0:3000`). A later sandboxed browser attempt exposed and led to the project-glob fix but Chromium itself was denied Mach rendezvous (`Permission denied (1100)`). A final escalated attempt was interrupted without a usable result; per controller instruction no further browser/server retry was made.
- `pnpm check:webgl-lifecycle` and `pnpm test:impact` — not re-run after the bounded browser stop instruction. Their Task 8-specific behavior is covered by the focused five-cycle countdown pass and resolver output, but the complete commands remain unverified in this environment.

## Design QA

- Re-inspected the available desktop/mobile RB20 product captures and the approved exact Phase 1 comparisons. Digit readability, liquid reflection, top safe area, and return affordance remain intact; no P1/P2 issue was found.
- Task 8 changes no visual constants. The dedicated projects lock the exact requested viewports, while the final two-project capture run remains part of the browser-environment concern above.
- `design-qa.md` ends with `final result: passed`.

## Self-review

- No existing Playwright project name or package script was renamed or removed.
- Countdown paths resolve deterministically in global project order and shared RB20 model changes select both showroom and countdown safety coverage.
- The context-loss escape hatch is exercised only in the explicit context-loss spec; normal unmount cleanup never calls `WEBGL_lose_context`.
- Test interaction remains inside page objects, uses observable state/polling, and contains no fixed sleep.
- Output artifacts remain under ignored `output/` paths.

## Concerns

- The required aggregate browser gates do not have a final clean result due the exact environment blockers above. The focused browser tests did pass before the environment stopped allowing stable launches.
- The currently available mobile PNG predates Task 7's final smaller/lower midpoint car pose; Task 8 did not change that pose. This limitation is called out in design QA rather than presenting the PNG as a fresh final capture.

## Fix round 1

### Findings addressed

- Replaced the synthetic scene-derived lifecycle baseline with an app-owned resource registry. Countdown renderer, composer, floor, geometry, material, environment, pending animation frame, context listener, and vehicle clone are incremented at their actual creation sites and decremented only after their corresponding real cleanup succeeds.
- The scene audit stays registered while `cancelRequest()` performs disposal and unregisters in `finally` afterward. If `scene.dispose()` is removed, skips a resource, or throws, the persistent registry remains non-zero and the five-cycle assertion fails instead of disappearing with the scene registration.
- The browser test now requires the actual renderer, composer, vehicle, rAF, and listener counts while open and full-object equality with the initial zero registry after each close.
- Added full-matrix routing for `src/lib/test-observability.ts`. Shared `showroom-quality.ts`, `asset-manager.ts`, and `showroom-assets.ts` now add both countdown projects alongside their showroom/F1 coverage.

### Red/green evidence

- RED resolver: 2 new cases failed. `src/lib/test-observability.ts` selected only `app-desktop-chromium`; shared showroom dependencies omitted both countdown projects.
- RED resources: the direct countdown scene test received zero/undefined renderer, composer, rAF, and vehicle counts.
- GREEN focused units: `time-viz-lifecycle.test.ts` and `countdown-vehicle.test.ts` — 19/19 passed.
- GREEN resolver: 13/13 passed.
- Dedicated project list: exactly 30 cases from the three countdown specs.
- `pnpm test:fast` — passed with 70 unit tests, 13 resolver tests, 6/6 asset validators, and a successful production build.
- Focused real five-cycle Playwright lifecycle — 1 passed in 3.7m.
- `pnpm lint` — passed independently and inside `test:fast`.

### Remaining concerns

- No new concern from the fix. The previously documented aggregate browser/environment and stale final-mobile-capture limitations remain unchanged.

## Fix round 2

### Findings addressed

- Added dedicated countdown desktop/mobile and WebGL lifecycle routing for the direct countdown dependencies `showroom-resource-lifecycle.ts`, `digit.ts`, and `lythwood_room_1k.hdr`. The lifecycle helper retains its existing showroom/F1 coverage, and the shared digit module retains app-desktop coverage.
- Audited the nearby direct import chain and added `model-loader.ts`, which is consumed by countdown/showroom asset loading and Rose, to all of those browser consumers.
- Corrected the stale implementation summary above: the countdown scene registration remains active through disposal, then unregisters.

### Red/green evidence

- RED resolver: all 4 new dependency-routing cases failed, proving each omission before the mapping change.
- GREEN resolver: 17/17 passed, including explicit assertions for the lifecycle helper, digit glyphs, HDR environment, and shared model loader.
- Dedicated project list: exactly 30 cases from the three countdown specs.
- `pnpm lint` passed independently; `pnpm test:fast` passed with 70 unit tests, 17 resolver tests, 6/6 asset validators, and a successful production build.
- No production code changed in this round, so the already-passing real five-cycle lifecycle browser test was not rerun.
