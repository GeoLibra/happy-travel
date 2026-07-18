# F1 Final Review Fix Report

Date: 2026-07-18 (Asia/Shanghai)

Branch: `codex/f1-airflow-lighting`

Implementation commit: `7abac2e` (`fix: harden F1 airflow and exploded controls`)

## Outcome

All requested Important findings and safe Minors were addressed:

1. `createF1Airflow` now allocates transactionally. Any material/geometry/mesh construction failure clears the partial group, disposes every created geometry and the shared material, emits one warning per module lifetime, and returns a hidden inert effect with no-op `update`/`dispose` methods.
2. Airflow phase now uses a separate accumulated clock advanced only by a non-negative, 100 ms-clamped frame delta. Absolute elapsed time remains available for unrelated scene animation.
3. Exploded view has a native, visible, focusable toggle button above the Three.js canvas with a state-specific accessible name, `aria-pressed`, focus styling, and `disabled` during reassembly. Canvas car clicks still call the same toggle callback.
4. The first manual exploded-view toggle permanently cancels the pending auto-explode timer for the welcome-page lifetime.
5. Airflow starts hidden and `group.visible` is true only when clamped `holdIntensity > 0.05`.
6. Reduced-motion coverage proves a held car keeps wheel velocity and angle at exactly zero.
7. `.gitignore` now has a trailing newline.
8. The design spec no longer claims a bloom pipeline exists. It records that the current renderer gets perceived glow from the additive emissive core. No risky post-processing pipeline was added.

One safe build-hygiene correction was also made: `tsconfig.json` now excludes ignored generated/build directories. This prevents local Playwright evidence under `output/` from contaminating product lint without modifying that user artifact.

## TDD Evidence

### Initial red checks

- `npm run check:f1-airflow`
  - Exit: `1`
  - Expected failure: `SyntaxError: ... does not provide an export named 'advanceF1AirflowTime'`.
- `npm run check:f1-welcome`
  - Exit: `1`
  - Expected failure: missing `hasManuallyToggledRef`/manual cancellation contract.
- `npm run check:f1-wheel-hold`
  - Exit: `0`
  - The newly requested reduced-motion assertion documented already-correct wheel behavior.

### Focused green checks

- `npm run check:f1-airflow` — exit `0`.
- `npm run check:f1-welcome` — exit `0`.
- `npm run check:f1-wheel-hold` — exit `0`.

The browser pass then exposed a test gap: the first native button was in the accessibility tree but visually occluded by the higher Three.js stacking context.

- `npm run check:f1-welcome` after adding the stacking contract
  - Exit: `1`
  - Expected failure: `the visible toggle must escape the content stacking context`.
- After moving the fixed control to `z-[90]` above the canvas at `z-75`:
  - `npm run check:f1-welcome` — exit `0`.
  - `npm run lint` — exit `0`.

### Deterministic allocation failure coverage

`scripts/check-f1-airflow.ts` forces the fourth geometry allocation to throw and proves:

- exactly four allocation attempts occurred;
- all three completed geometries were disposed;
- the shared material was disposed;
- no partial children remain;
- the returned group is hidden;
- the failure effect exposes no disposed material and tolerates repeated no-op disposal;
- a second forced failure does not emit a second warning.

It also proves a 30-second suspension-sized delta advances airflow time by only `0.1` seconds and a negative delta cannot rewind the phase clock.

## Lint Diagnosis

- First `npm run lint`
  - Exit: `2`.
  - Error: `output/playwright/task6/task6-transform-evidence.ts(50,3): TS2322`.
  - Root cause: `tsconfig.json` had no include/exclude boundary, so TypeScript compiled ignored local evidence under `output/`.
- After excluding ignored generated/build directories:
  - `npm run lint` — exit `0`.

## Final Automated Verification

These commands were rerun fresh on the exact tree committed as `7abac2e`:

| Command | Result |
| --- | --- |
| `npm run check:f1-motion` | Exit `0`; `PASS: F1 motion is smooth and frame-rate independent` |
| `npm run check:f1-wheel-hold` | Exit `0` |
| `npm run check:f1-airflow` | Exit `0` |
| `npm run check:f1-welcome` | Exit `0` |
| `npm run check:f1-studio` | Exit `0` |
| `npm run check:f1-reflection` | Exit `0` |
| `npm run check:showroom-assets` | Exit `0`; `PASS: showroom assets (1.88 MB model)` |
| `npm run lint` | Exit `0`; TypeScript emitted no errors |
| `npm run build` | Exit `0`; Vite transformed 2,121 modules and built in 11.80 s |
| `git diff --check` | Exit `0` |

Build output retained the existing non-blocking advisory that the main minified chunk is larger than 500 kB.

## Browser Acceptance

Preview and browser commands:

- `npm run preview -- --host 127.0.0.1 --port 4173` — served `http://127.0.0.1:4173/`.
- `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173 --headed` — exit `0`.
- `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh snapshot` — native toggle exposed with state-specific accessible name and pressed state.
- `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh mousemove 600 388`, `mousedown`, `sleep 5`, `mouseup` — completed ignition.
- `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh screenshot` — captured the visible fixed toggle above the rendered car/floor at `.playwright-cli/page-2026-07-18T09-13-22-676Z.png`.
- `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh press Enter` while the toggle was focused — toggled `aria-pressed` and accessible name.
- Entering the itinerary exposed `button "Reassembling car" [disabled]` during the 1.6 s reassembly window, then the welcome scene unmounted and itinerary navigation remained intact.

The local preview logged only the pre-existing 404s for `/_vercel/insights/script.js` and `/favicon.ico`; it emitted no airflow allocation warning.

## Self-Review

Verdict: **APPROVE**.

Scope reviewed line by line:

- `src/components/effects/f1Airflow.ts`
- `src/components/ParticleBackground.tsx`
- `src/components/WelcomePage.tsx`
- F1 regression scripts and package entry point
- `tsconfig.json`, `.gitignore`, and the F1 design spec

Checks performed:

- Failure ownership and rollback are contained inside the airflow effect; `ParticleBackground` continues with the inert group and requires no branching.
- Normal and failure disposal paths are idempotent and do not leak partial scene children.
- Airflow visibility does not submit transparent tube draws at or below the specified threshold.
- Suspension cannot jump airflow phase; reduced motion freezes phase and wheels while retaining held fade intensity.
- Manual toggle clears the exact pending timer before state mutation and prevents later rescheduling.
- One callback is shared by the native button and canvas car click, preventing divergent state rules.
- The fixed control is painted above the canvas, remains keyboard focusable, follows Enter in DOM order, exposes pressed/disabled state, and keeps navigation behavior.
- No bloom/post-processing code was introduced; the spec was narrowed to the renderer that actually exists.
- No unrelated user files or ignored Playwright evidence were modified.

## Residual Concerns

- The production bundle still reports the known chunk-size advisory; changing chunking is outside this final-fix scope.
- Local preview still reports the known Vercel Analytics and favicon 404s; neither is related to F1 rendering or navigation.
- React interaction contracts are source-level because this repository does not currently include a component-test harness. The headed Playwright acceptance pass complements those deterministic checks.
