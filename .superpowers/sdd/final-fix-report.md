# Mobile controls/showroom final-review fix report

Date: 2026-07-19 (Asia/Shanghai)

Worktree: `/Users/hgis/myproject/happy-travel/.worktrees/mobile-controls-shake-refactor`

Branch: `codex/mobile-controls-shake-refactor`

Commit: `f8bd772` (`fix: harden showroom entry and resource cleanup`)

## Outcome

All final-review findings are fixed and verified.

1. Every particle/track factory now registers geometry and material ownership as soon as construction succeeds. Any subsequent setup exception attempts disposal of every registered resource and rethrows the original exception. Normal cleanup remains one-shot and attempts all owned disposals.
2. `check:showroom-resources` injects deterministic failures at `geometry-ready`, `material-ready`, `object-ready` where applicable, and `setup-complete` for all four factories. It proves partial cleanup, original-error identity, and double-dispose idempotence.
3. `WelcomePage` now sets `hasStartedEntryRef` before permission preparation. Three synchronous ENTER activations therefore produce one preparation call, one reassembly timer, and one final entry. Synchronous throws and rejected preparation promises are logged without blocking reassembly.
4. Shake checks now cover exactly 100 ms, exactly threshold 1000, and modal-open state advancement.
5. `check:f1-model` samples 121 explosion frames and 121 reassembly frames for both ordinary parts and the semantic rear-body fixture. Every sampled part remains above the floor, while wheel-adjacent Hard Rock cover/shroud fixtures retain exactly the `RearBodyAssembly` world translation.
6. New desktop/mobile stopped screenshots were captured in the assembled state before the 4.6-second automatic explosion. Permission browser audits cover denied, rejected, unsupported, granted, and repeated-click behavior.

No GLB/model URL, wheel-node ownership, `RearHardRockAeroPanel` parentage, canvas stacking, or pointer-forwarding behavior changed.

## TDD evidence

RED runs before production edits:

- `npm run check:showroom-resources` — exit 1: `Missing expected exception: CPU particle field setup failure must rethrow the original setup error`.
- `npm run check:shake` — exit 1: missing `hasStartedEntryRef` synchronous guard.
- `npm run check:f1-welcome` — exit 1: `WelcomePage must synchronously reject repeated ENTER activation`.

Focused GREEN runs:

- `npm run check:showroom-resources` — exit 0, `Showroom resource checks passed.`
- `npm run check:shake` — exit 0, `Shake detection and permission wiring checks passed.`
- `npm run check:f1-welcome` — exit 0.
- `npm run check:f1-model` — exit 0.
- `npm run lint` — exit 0.

## Complete fresh verification

Every command below was run after the final source/test edits and exited 0:

- `npm run check:i18n` — `i18n checks passed for 37 locations`
- `npm run check:shake` — `Shake detection and permission wiring checks passed.`
- `npm run check:showroom-resources` — `Showroom resource checks passed.`
- `npm run check:f1-welcome` — silent assertion pass
- `npm run check:f1-motion` — `PASS: F1 motion is smooth and frame-rate independent`
- `npm run check:f1-wheel-hold` — silent assertion pass
- `npm run check:f1-airflow` — silent assertion pass
- `npm run check:f1-studio` — silent assertion pass
- `npm run check:f1-reflection` — silent assertion pass
- `npm run check:f1-showroom-interaction` — silent assertion pass
- `npm run check:f1-arrival-motion` — `PASS: F1 arrival settles for four frames and holds before studio reveal`
- `npm run check:f1-model` — silent assertion pass; full bidirectional floor/semantic sampling
- `npm run check:f1-showroom-v4` — `PASS: semantic F1 wheel and Hard Rock aero hierarchy`
- `npm run check:showroom-assets` — `PASS: showroom assets (4.10 MB model)`
- `npm run lint` — TypeScript `tsc --noEmit` pass
- `npm run build` — Vite production build pass; 2,128 modules transformed in 3.34 s
- `git diff --check` — exit 0, no output

The build emitted only Vite's existing advisory for the 1,189.89 kB minified application chunk.

## Browser verification

Artifact root:

`/Users/hgis/myproject/happy-travel/.worktrees/mobile-controls-shake-refactor/output/playwright/final-review-fixes`

### Assembled stopped evidence

- `mobile-arrival-stopped-pre-hologram.png` — 390×844; captured 96 ms after ENTER appeared; car `aria-pressed="false"`.
- `desktop-arrival-stopped-pre-hologram.png` — 1440×1000; captured 365 ms after ENTER appeared; car `aria-pressed="false"`.
- `mobile-arrival-accelerating-fix.png` — additional mobile arrival sample.
- Arrival trace: `.playwright-cli/traces/trace-1784463401404.trace`
- Arrival network log: `.playwright-cli/traces/trace-1784463401404.network`

Visual inspection confirms the assembled car, unchanged framing, visible floor, and reflection in both stopped captures. Both measured capture delays are far below `HOLOGRAM_REVEAL_MS = 4600`.

### Permission/listener matrix

Each mobile scenario used a fresh browser context with an init-script audit of permission requests, `devicemotion` listener registration, and the `[App] Entering application...` completion log. Each exercised three synchronous `element.click()` calls after progress reached 100.

| Scenario | permission requests | listener adds | entries | Result |
| --- | ---: | ---: | ---: | --- |
| denied | 1 | 0 | 1 | entry continued exactly once |
| rejected promise | 1 | 0 | 1 | exception logged; entry continued exactly once |
| unsupported API | 0 | 1 | 1 | listener installed without permission prompt |
| granted + repeated clicks | 1 | 1 | 1 | one-shot guard prevented duplicate preparation/entry |

Screenshots:

- `permission-denied-entry.png`
- `permission-rejected-entry.png`
- `permission-unsupported-entry.png`
- `permission-granted-repeated-click-entry.png`

Traces:

- denied: `.playwright-cli/traces/trace-1784463823406.trace`
- rejected: `.playwright-cli/traces/trace-1784463878618.trace`
- unsupported: `.playwright-cli/traces/trace-1784463980934.trace`
- granted/repeated: `.playwright-cli/traces/trace-1784464074226.trace`

Corresponding `.network` logs share the same numeric stems.

## Files in the scoped commit

- `src/components/WelcomePage.tsx`
- `src/components/showroom/showroom-resource-lifecycle.ts`
- `src/components/showroom/showroom-particles.ts`
- `src/components/showroom/showroom-track.ts`
- `scripts/check-showroom-resources.ts`
- `scripts/check-shake-detection.ts`
- `scripts/check-f1-welcome.ts`
- `scripts/check-f1-model.ts`

## Concerns

- Vite's pre-existing large-chunk advisory remains; the production build succeeds.
- The development browser reports the unrelated missing `/favicon.ico`; entered-app screenshots may also log the expected missing local AMap API key. Neither affects welcome, permission, shake, or showroom behavior.
- Browser artifacts and `.superpowers` reports are ignored by repository policy and were intentionally not included in commit `f8bd772`.

No functional or visual acceptance blocker remains from the final review.
