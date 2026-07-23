# Showroom Arrival Timeline Acceptance Implementation Plan

Date: 2026-07-23

## Goal
Implement a dedicated Playwright `showroom-arrival-timeline-chromium` project and spec that captures 4–5 timestamp screenshots during F1 car arrival and performs canvas non-empty, centered composition, frame-to-frame delta, and CTA operability checks.

## Proposed Changes

### Playwright Configuration & Project Resolver
- Modify `playwright.config.ts` to register `showroom-arrival-timeline-chromium`.
- Modify `scripts/lib/affected-playwright-projects.ts` to include `showroom-arrival-timeline-chromium` in `ALL_PLAYWRIGHT_PROJECTS`.
- Update `scripts/resolve-playwright-projects.test.ts` unit tests.

### Support & Spec Implementation
- Add helper functions in `tests/e2e/support/showroom.ts` or `tests/e2e/support/arrival-timeline.ts` for canvas screenshot decoding, non-empty pixel checks, centroid computation, and frame delta calculation.
- Create `tests/e2e/showroom-arrival-timeline.spec.ts` to run the 5-frame arrival timeline sequence.

### Documentation & Summary Verification
- Update `docs/showroom-browser-acceptance.md`.
- Verify execution via `npm run check:showroom-acceptance`.

## Verification Plan
1. Run `npm run check:playwright-project-resolver` to verify project matrix resolution.
2. Run `npm run check:showroom-acceptance -- --project=showroom-arrival-timeline-chromium` to execute the new timeline acceptance spec and record screenshot evidence.
