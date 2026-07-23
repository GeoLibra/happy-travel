# Requirements Baseline

## Goal

Adopt an affected-project Playwright E2E matrix so CI runs only browser projects relevant to a change, while retaining the full F1/showroom acceptance gate for every showroom-sensitive change.

## Non-goals

- Do not weaken the F1 welcome-scene invariants or focused deterministic checks.
- Do not claim CI mobile emulation is real-device Safari/Chrome coverage.
- Do not change application UI, assets, or runtime behavior.
- Do not add commit, push, or pull-request automation.

## User-visible Behavior

There is no production UI change. Contributors get standard Playwright projects, selectively scheduled CI jobs, and project-scoped evidence artifacts.

## Acceptance Criteria

1. Standard Playwright projects cover app desktop Chromium, showroom desktop Chromium, showroom mobile Chromium, and a WebKit showroom smoke test.
2. A deterministic, unit-tested resolver maps changed paths to the minimum safe project set.
3. F1/showroom, model, renderer, interaction, workflow, dependency, and resolver changes select every showroom project.
4. Ordinary application changes select app desktop coverage; documentation-only changes select no browser project.
5. GitHub Actions generates a dynamic matrix and safely succeeds when it is empty.
6. Each selected project emits screenshots/test artifacts and a machine-readable acceptance summary for the currently shipped F1 welcome route.
7. The existing `npm run check:showroom-acceptance` command remains the full local/CI acceptance entry point.
8. Typecheck, resolver tests, Playwright discovery, build, and full showroom acceptance are verified.

## Constraints

- Use `node --import tsx` for TypeScript utility scripts.
- Preserve the F1 acceptance selection scope required by `AGENTS.md`; this CI-only change does not alter the car model or visual implementation.
- Keep browser evidence under `output/playwright`.
- Chromium mobile remains viewport/touch emulation and does not replace real-device checks.

## Assumptions

- `playwright/test` from the installed `playwright` package is the supported runner.
- A WebKit smoke project is useful cross-engine coverage but can remain narrower than Chromium.
- The legacy acceptance script's `?showroom=v2`, `ShowroomOverlay`, ignition, and skip selectors no longer describe the current `WelcomePage` runtime. The migrated specs must target the shipped welcome CTA and foreground car canvas instead of preserving dead selectors.
- Workflow path filtering is replaced by an always-created detector job so required checks do not remain pending on irrelevant changes.

## Open Questions

None blocking. The user explicitly requested implementation after reviewing the proposed architecture.

## Source Request

“请实施” following agreement to adopt an AetherEngine-style affected Playwright project matrix.

## Repo Context

- Base SHA: `907b568af533e3b1a998f7d6b61dadec75de78b6`
- Branch: `main`
- Initial worktree: clean
- Existing acceptance: one custom Chromium script containing desktop, showroom, skip, and mobile scenarios.
