# Implementation Log

## Task 1 — Affected-project resolver

- Added `scripts/lib/affected-playwright-projects.ts` with an ordered four-project contract and conservative path classification.
- Added stdin/argument CLI `scripts/resolve-playwright-projects.ts`.
- Added seven Node tests covering docs-only, app-only, showroom/F1, infrastructure, unknown paths, and deterministic ordering.
- RED evidence: initial test failed with `ERR_MODULE_NOT_FOUND`.
- GREEN evidence: seven tests pass.

## Task 2 — Playwright projects

- Added `playwright.config.ts` with one worker for WebGL stability, shared Vite server, traces/video on failure, and four projects.
- Added project-specific specs and shared evidence utilities under `tests/e2e`.
- Replaced the 351-line custom Chromium launcher with a thin Playwright Test entry point while preserving `npm run check:showroom-acceptance`.
- Project discovery lists four tests in four projects.
- The first migration run proved the old `?showroom=v2`/`ShowroomOverlay` selectors no longer exist in the active runtime. Specs were corrected to the current `WelcomePage` CTA and car canvas.
- Attempts to preserve the old hold/handoff assertion exposed a separate existing input-sequence issue. All temporary product-code experiments were reverted; `src/components/WelcomePage.tsx` has no final diff.

## Task 3 — Dynamic CI

- Replaced workflow-level static path filters with a detector job.
- Pull request and push events diff their event SHAs; manual runs provide an empty list, which intentionally resolves to the full matrix.
- Browser jobs install only Chromium or WebKit as required and upload project-named artifacts.
- An always-present gate succeeds for a deliberately empty docs-only matrix and fails detector or selected-project failures.

## Verification

- `npm run check:playwright-project-resolver` — PASS, 7/7.
- `npm run lint` — PASS.
- `npm run build` — PASS; existing Vite large-chunk warning remains.
- `npm run check:showroom-acceptance -- --list` — PASS.
- `npm run check:showroom-acceptance` — PASS, 4/4 in approximately one minute.

