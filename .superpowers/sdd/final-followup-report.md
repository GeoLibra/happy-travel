# F1 Showroom Final Follow-Up Report

Date: 2026-07-18 (Asia/Shanghai)

Branch: `codex/f1-airflow-lighting`

Starting commit: `68cccd6`

Production/test commit: `11fa977` (`fix: stabilize F1 showroom follow-up interactions`)

## Outcome

DONE. The two Important findings and four Minors from the final review are addressed in one scoped follow-up:

1. `classifyCarRelease` no longer rejects every exploded-state release. A short exploded-state press returns `toggle` and reassembles; an exploded-state long press remains inert and cannot start wheel/airflow hold behavior.
2. The first progress-100 frame commits final car depth/Y/scale, measures and places the floor, derives the final controls target, calls `controls.update()`, and commits target readiness before reveal opacity can advance. User OrbitControls enablement has a separate settling flag.
3. The final-fix report now describes the control's stable accessible label and state-specific `aria-pressed` accurately.
4. The zero-byte airflow WebM is no longer cited as evidence; the valid airflow PNG sequence remains the evidence set.
5. `check:f1-airflow` parses the actual shipped showroom GLB and verifies `WheelPivot_FL`/`FR` are +Z while `WheelPivot_RL`/`RR` are -Z before applying front/rear airflow assertions.
6. Exploded-part floor guards have an explicit `1e-4` endpoint-settling contract and cache a safe endpoint pose/floor/parent transform. Stable exploded and reassembled updates skip matrix/corner work, while changed amount, floor, position, or parent transforms invalidate the cache.

## Files

Production:

- `src/lib/f1-showroom-interaction.ts`
- `src/components/ParticleBackground.tsx`
- `src/lib/f1-model.ts`

Executable checks:

- `scripts/check-f1-showroom-interaction.ts`
- `scripts/check-f1-wheel-hold.ts`
- `scripts/check-f1-model.ts`
- `scripts/check-f1-airflow.ts`
- `scripts/check-showroom-assets.mjs`

Reports:

- `.superpowers/sdd/final-fix-report.md`
- `.superpowers/sdd/final-followup-report.md`

## RED evidence

All owning tests were changed before production:

| Command | Expected RED result |
| --- | --- |
| `npm run check:f1-showroom-interaction` | Exit 1: exploded short press expected `toggle`, received `ignore`. |
| `npm run check:f1-wheel-hold` | Exit 1: camera target initialization and OrbitControls interaction readiness were not separate. |
| `npm run check:f1-model` | Exit 1: a threshold-settled exploded pose still performed two matrix/corner guard updates. |
| `npm run check:showroom-assets` | Exit 1: `check-f1-airflow.ts` did not read `public/models/red_bull_f1_showroom.glb`. |

The interaction check also specifies assembled short press -> explode, exploded short press -> reassemble, and exploded long press -> no hold/no delayed toggle. The model check drives near-endpoint values (`1 - 5e-5` and `5e-5`) to cover the asymptotic animation rather than relying on exact 0/1 input.

## Focused GREEN evidence

After the owning implementation changes:

| Command | Result |
| --- | --- |
| `npm run check:f1-showroom-interaction` | Exit 0. |
| `npm run check:f1-wheel-hold` | Exit 0. |
| `npm run check:f1-model` | Exit 0. |
| `npm run check:f1-airflow` | Exit 0. |
| `npm run check:showroom-assets` | Exit 0; `PASS: showroom assets (1.88 MB model)`. |
| `npm run lint` | Exit 0. |
| `git diff --check` | Exit 0. |

The existing frame-by-frame explosion and reassembly floor-clearance loops remain unchanged and green. New matrix-call instrumentation proves the next update at each threshold-settled endpoint performs zero part matrix updates.

## Complete final suite

The complete 11-command Task 4 suite was rerun after the last production/test edit. Functional checks ran together; lint/build were captured sequentially for unambiguous exit codes.

| Command | Final result |
| --- | --- |
| `npm run lint` | Exit 0; `tsc --noEmit`, no diagnostics. |
| `npm run build` | Exit 0; 2,122 modules transformed, built in 11.11 s. Only the existing >500 kB chunk advisory remains. |
| `npm run check:f1-motion` | Exit 0; `PASS: F1 motion is smooth and frame-rate independent`. |
| `npm run check:f1-wheel-hold` | Exit 0. |
| `npm run check:f1-airflow` | Exit 0. |
| `npm run check:f1-welcome` | Exit 0. |
| `npm run check:f1-studio` | Exit 0. |
| `npm run check:f1-reflection` | Exit 0. |
| `npm run check:f1-model` | Exit 0. |
| `npm run check:f1-showroom-interaction` | Exit 0. |
| `npm run check:showroom-assets` | Exit 0; `PASS: showroom assets (1.88 MB model)`. |
| `git diff --check` / `git diff --cached --check` | Exit 0 before the production/test commit. |

## Browser verification

Harness:

- App: `http://127.0.0.1:3000/`
- Wrapper: `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh`
- Named headed session: `f1-showroom-final-followup`
- Desktop viewport: 1440 x 900
- Mobile viewport: 390 x 844, normal motion
- Artifact root: `output/playwright/f1-showroom-final-followup/`
- Trace: `output/playwright/f1-showroom-final-followup/.playwright-cli/traces/trace-1784385360496.trace` (2.8 MB)
- Network log: `output/playwright/f1-showroom-final-followup/.playwright-cli/traces/trace-1784385360496.network` (1.0 MB)

Acceptance observations:

- Desktop 0/300/600/900 ms reveal captures keep the floor horizon, car location, scale, and camera framing fixed across 300 -> 600 ms. Only the intended floor opacity and hologram/material progression change.
- Mobile 0/300/600/900 ms captures likewise keep the floor horizon and car framing fixed; no whole-car recentering occurs as the floor reaches full opacity.
- The deterministic desktop canvas-listener tap flow recorded `aria-pressed` `false -> true` for assembled short press, then `true -> false` for an exploded rear-wheel short press. The screenshots show the fully separated and reassembled endpoints.
- The mobile assembled-car short press recorded `false -> true` and produced a separated mobile endpoint above the floor.
- The stable accessibility snapshot continues to expose `button "Interactive Formula One showroom car"` with state represented separately by `aria-pressed`.

Final inspected evidence:

- `desktop-floor-reveal-000ms.png`
- `desktop-floor-reveal-300ms.png`
- `desktop-floor-reveal-600ms.png`
- `desktop-floor-reveal-900ms.png`
- `mobile-floor-reveal-000ms.png`
- `mobile-floor-reveal-300ms.png`
- `mobile-floor-reveal-600ms.png`
- `mobile-floor-reveal-900ms.png`
- `desktop-assembled-short-tap-exploded.png`
- `desktop-exploded-short-tap-reassembled.png`
- `mobile-assembled-short-tap-exploded.png`

Every cited PNG was opened and visually inspected. Exploratory/missed-coordinate captures are not cited.

## Self-review

Verdict: **APPROVE**.

- Release classification now orders shared invalid-state checks first, then handles exploded duration explicitly; assembled exact-threshold hold behavior is unchanged.
- `canStartCarHold` still rejects exploded state, so the release fix cannot enable airflow in exploded view.
- Final target initialization is one-time and precedes reveal. `isOrbitInteractionReady` alone controls when user orbit input can be enabled, preserving the existing speed-settling gate.
- The target is measured from the same final transformed bounds used for floor placement, and `controls.update()` occurs before `hasSetOrbitTarget` allows reveal.
- The GLB check validates the shipped named axle pivots directly rather than inferring orientation from a synthetic `Box3`; synthetic translated/path-family tests remain for geometry math.
- Settled guard reuse requires matching endpoint, floor Y, clearance, local position, and parent matrix. Any relevant change falls back to the full guard.
- Full frame-by-frame clearance coverage remains green through explosion and reassembly.
- Only owning production/check/report files changed; ignored browser artifacts are not staged.

## Concerns

- Vite retains the pre-existing large-chunk advisory; build succeeds.
- The final normal browser reload reports only the unrelated `/favicon.ico` 404 and zero warnings.
- Deterministic `dispatchEvent` probes against the real canvas listeners use synthetic pointer IDs; Chromium logs `setPointerCapture` `NotFoundError` for those injected IDs even though the classifier transitions and screenshots complete. Normal OS-backed pointer input does not produce that error. This is a harness limitation, not an application exception path.
- The old zero-byte WebM remains an ignored local artifact, but neither report cites it as evidence.
- No remaining functional or visual acceptance blocker was observed.
