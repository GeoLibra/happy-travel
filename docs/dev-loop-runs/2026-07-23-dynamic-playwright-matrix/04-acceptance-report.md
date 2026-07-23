# Acceptance Report

## Verdict

PASS_WITH_NOTES

## Scope Checked

- Resolver behavior and deterministic matrix shape
- Standard Playwright project discovery
- Desktop Chromium welcome route
- Desktop Chromium F1 welcome evidence
- Mobile Chromium touch-enabled viewport evidence
- Desktop WebKit welcome smoke coverage
- TypeScript compilation and production build
- GitHub Actions empty/non-empty matrix structure

## Reviewers Run

- Requirements acceptance: inline
- Test coverage: inline
- Code quality: inline
- CI/config compatibility: inline

## Tests Run

- Resolver: 7 passed, 0 failed
- Playwright: 4 passed, 0 failed
- TypeScript: passed
- Vite build: passed

## Requirement Coverage

- AC1: four standard projects in `playwright.config.ts`
- AC2–AC4: resolver tests and CLI samples
- AC5: detector, dynamic matrix, and stable gate workflow jobs
- AC6: project-local JSON summaries and screenshots
- AC7: full-suite npm command preserved
- AC8: all required verification commands passed

## Findings

- MINOR: The legacy acceptance script referenced an inactive `?showroom=v2` overlay/skip flow. The migration now tests the shipped `WelcomePage` route.
- MINOR: Chromium mobile is viewport/touch emulation only.
- MINOR: WebKit is smoke coverage, not the full Chromium scenario set.

## Fixes Applied

- Corrected resolver stdin typing after typecheck identified an invalid numeric `readFile` path.
- Added fail-safe full-matrix handling for empty/unknown implementation changes.
- Corrected browser specs to current runtime selectors after the first full run exposed legacy selector drift.
- Removed trailing workflow whitespace reported by `git diff --check`.

## Residual Risks

- GitHub Actions syntax and event expressions are reviewable statically here but only execute on GitHub.
- Real-device Safari/Chrome checks remain required for materially new mobile WebGL behavior.
- Hold-to-start and app-handoff browser automation should be addressed separately rather than hidden inside this CI refactor.

## Follow-ups

- Consider adding a dedicated interaction-focused test after the hold gesture has a stable automation contract.
- Consider caching Playwright browser downloads if matrix duration becomes material.

