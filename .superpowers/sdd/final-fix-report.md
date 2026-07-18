# F1 Showroom Whole-Feature Final-Fix Report

Date: 2026-07-18 (Asia/Shanghai)

Branch: `codex/f1-airflow-lighting`

Base: `542f06d`

Production/test commit: `25ffc93` (`fix: refine F1 showroom interaction flow`)

## Outcome

DONE. All six sections of the final-fix brief are implemented and verified as one cross-module interaction update:

1. Airflow now starts at the shipped model's positive-Z nose, travels toward the negative-Z rear, and exits behind the car. The pulse follows increasing curve UV, the shader performs output color conversion, and tone mapping is explicit.
2. The studio floor is measured and placed on the first progress-100 frame after the final car transform. Reveal begins only after that placement, and no later orbit-target settling path rewrites floor Y.
3. An accepted hold, including an exact-deadline release, notifies `WelcomePage`, marks manual interaction, and cancels the pending 4.6-second automatic explosion. The untouched no-interaction path still auto-explodes.
4. Gesture arbitration is atomic for additional pointers, exact-threshold release, captured-pointer exit, cancellation, blur, lost capture, drag, and release decay.
5. The canvas keeps the bottom exploded-view button absent while supporting repeat-safe Enter, Space-on-keyup, zero-detail assistive-technology clicks, `aria-pressed`, a state-specific label, and a visible inset yellow focus treatment.
6. Exploded-floor guards reuse cached local corners and scratch math objects; model coverage checks every sampled explosion and reassembly frame. Task 4 wording and follow-up evidence were corrected in the local Task 4 report.

## Changed files

Production:

- `src/components/effects/f1Airflow.ts`
- `src/components/ParticleBackground.tsx`
- `src/components/WelcomePage.tsx`
- `src/lib/f1-model.ts`
- `src/lib/f1-showroom-interaction.ts`

Executable regression coverage:

- `scripts/check-f1-airflow.ts`
- `scripts/check-f1-model.ts`
- `scripts/check-f1-showroom-interaction.ts`
- `scripts/check-f1-welcome.ts`
- `scripts/check-f1-wheel-hold.ts`

Documentation:

- `.superpowers/sdd/final-fix-report.md`
- `.superpowers/sdd/task-4-report.md` (local ignored verification artifact)

## TDD evidence

Regression contracts were added before their owning production changes. The expected RED runs were:

| Command | RED result |
| --- | --- |
| `npm run check:f1-airflow` | Exit 1: `paths must begin near the shipped model positive-Z front nose`. |
| `npm run check:f1-model` | Exit 1: `each exploded part must cache its eight local bounds corners once`; received `undefined` instead of `8`. |
| `npm run check:f1-showroom-interaction` | Exit 1: exact 260 ms expected `end-hold`, received `ignore`; the next RED run also proved the new pointer/bounds helpers were not yet exported. |
| `npm run check:f1-welcome` | Exit 1: missing `markF1ManualInteraction` export and accepted-hold cancellation contract. |
| `npm run check:f1-wheel-hold` | Exit 1: `ParticleBackground must expose a focused accepted-hold callback`. |

After implementation, every focused command above exited 0. The unchanged neighboring checks `check:f1-motion`, `check:f1-studio`, and `check:f1-reflection` also remained green.

Deterministic coverage now proves:

- named positive-Z front/negative-Z rear airflow semantics, descending path Z, wake endpoint, pulse sign, shader output conversion, explicit tone mapping, and tier-specific path/radius behavior;
- eight cached part corners and stable scratch-object identity, with clearance on every sampled frame from 0 through 120 in both explosion and reassembly;
- exact-deadline hold resolution plus pure additional-pointer and canvas-boundary decisions;
- no-interaction auto explosion at 4,600 ms and an accepted first hold at 4,560 ms that remains assembled across the original deadline;
- floor placement before the first positive reveal update, exactly one floor-Y write, separate orbit-target gating, accepted-hold notification, multi-pointer/outside cancellation, and accessible keyboard/AT semantics.

## Final automated verification

The complete Task 4 suite was rerun after the last production/test edit. The first parallel collection returned while lint/build were still active; those two were immediately rerun sequentially so every entry below has an explicit final exit code.

| Command | Final result |
| --- | --- |
| `npm run lint` | Exit 0; `tsc --noEmit`, no diagnostics. |
| `npm run build` | Exit 0; 2,122 modules transformed, built in 13.11 s. Only the existing >500 kB chunk advisory remains. |
| `npm run check:f1-motion` | Exit 0; `PASS: F1 motion is smooth and frame-rate independent`. |
| `npm run check:f1-wheel-hold` | Exit 0. |
| `npm run check:f1-airflow` | Exit 0. |
| `npm run check:f1-welcome` | Exit 0. |
| `npm run check:f1-studio` | Exit 0. |
| `npm run check:f1-reflection` | Exit 0. |
| `npm run check:f1-model` | Exit 0. |
| `npm run check:f1-showroom-interaction` | Exit 0. |
| `npm run check:showroom-assets` | Exit 0; `PASS: showroom assets (1.88 MB model)`. |
| `git diff --check` | Exit 0 before staging; `git diff --cached --check` also exited 0. |

## Browser verification

Harness:

- Wrapper: `/Users/hgis/.codex/skills/playwright/scripts/playwright_cli.sh`
- Named headed session: `f1-showroom-final-fix`
- App: `http://127.0.0.1:3000/`
- Desktop viewport: 1440 x 900
- Mobile viewport: 390 x 844
- Reduced motion: `page.emulateMedia({ reducedMotion: "reduce" })`
- Artifact root: `output/playwright/f1-showroom-refinement-final-fix/`
- Trace: `output/playwright/f1-showroom-refinement-final-fix/.playwright-cli/traces/trace-1784381284713.trace`
- Network log: `output/playwright/f1-showroom-refinement-final-fix/.playwright-cli/traces/trace-1784381284713.network`

Acceptance results:

- Desktop and mobile airflow remained white/cyan, close-fitting, and not overbright; sequential active frames and a WebM show front-to-rear motion, while decay frames show complete removal after release.
- Desktop and mobile floor captures at approximately 0/300/600/900 ms show the final horizon established before opacity rises, with no intersection or vertical jump during reveal.
- A first valid hold crossed the original 4.6-second automatic deadline without explosion and decayed normally on release.
- An exact-260 ms release completed the hold/manual-interaction path without toggling explosion.
- A second pointer synchronously canceled a pending car gesture before OrbitControls saw it; leaving the canvas with a captured pointer canceled an active hold and removed airflow.
- Repeat Enter toggled once, Space activated on keyup, a zero-detail synthetic click toggled exactly once, and an ordinary pointer tap also toggled once without double activation.
- Keyboard focus produced the visible inset yellow ring (`rgb(255, 184, 0)` in computed box shadow).
- In reduced motion, two active-hold frames captured 800 ms apart preserve wheel orientation and airflow phase; the decay frame removes airflow.
- After the interaction matrix, the visible `ENTER` button still opened the itinerary; the final accessibility snapshot exposed `Shanghai Weekend Itinerary` with no welcome overlay.

Representative evidence:

- Airflow: `desktop-airflow-direction-a.png`, `desktop-airflow-direction-b.png`, `desktop-airflow-direction-c.png`, `desktop-airflow-direction.webm`, `desktop-airflow-decayed.png`, and the corresponding `mobile-airflow-*` captures.
- Floor: `desktop-floor-reveal-000ms.png`, `desktop-floor-reveal-300ms.png`, `desktop-floor-reveal-600ms.png`, `desktop-floor-reveal-900ms.png`, plus matching mobile captures.
- Hold/gesture arbitration: `desktop-hold-before-auto-deadline.png`, `desktop-hold-across-auto-deadline.png`, `desktop-hold-after-auto-deadline-decayed.png`, `desktop-exact-threshold-release.png`, `desktop-two-pointer-cancelled.png`, `desktop-outside-cancel-active.png`, and `desktop-outside-cancelled.png`.
- Accessibility: `desktop-enter-repeat-safe.png`, `desktop-space-keyup-activation.png`, `desktop-at-zero-detail-click.png`, `desktop-pointer-tap-single-toggle.png`, and `desktop-accessible-focus-visible.png`.
- Reduced motion/navigation: `mobile-reduced-airflow-static-a.png`, `mobile-reduced-airflow-static-b.png`, `mobile-reduced-airflow-decayed.png`, and `mobile-reduced-entered.png`.

All cited final screenshots were opened and visually inspected. Invalid exploratory captures were overwritten and are not cited.

## Self-review

Verdict: **APPROVE**.

- Reviewed the complete 10-file production/test diff and confirmed each change maps directly to a brief item.
- Airflow path orientation, pulse direction, material output behavior, low-tier legibility, and path counts remain independently asserted.
- Floor placement and reveal use separate state from orbit-target enablement; floor Y has one assignment site and cannot jump later.
- Manual interaction is marked before state mutation, clears the exact pending timer, and leaves the no-interaction auto path intact.
- Pointer state is invalidated synchronously on a second pointer or boundary exit, while tap/drag/cancel/lost-capture/blur cleanup and decay remain covered.
- Synthetic click activation is restricted to `detail === 0`, so ordinary pointer events cannot double-fire the canvas toggle.
- Cached exploded-part math eliminates the eight-per-mesh/per-frame corner allocation while retaining clearance through both motion directions.
- Output artifacts remain ignored and were not staged. The branch is intentionally preserved as requested.

## Concerns

- Vite still reports its pre-existing main-chunk-size advisory; the production build succeeds.
- The headed development browser reports only the unrelated `/favicon.ico` 404 (one or two entries after reload), with zero warnings and no model/runtime errors.
- The Playwright trace resource directory is large because it contains the complete multi-viewport interaction session; it is ignored and remains under the requested artifact root.
- No remaining functional, accessibility, or visual acceptance blocker was observed.
