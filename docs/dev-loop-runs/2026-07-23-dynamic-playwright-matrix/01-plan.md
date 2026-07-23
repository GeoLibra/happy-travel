# Dynamic Playwright Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the fixed Chromium acceptance job into standard, independently selectable Playwright projects with a safe changed-file resolver.

**Architecture:** Playwright configuration defines four projects and a shared Vite web server. Route- and viewport-focused specs write project-local evidence and summaries for the shipped `WelcomePage`. A pure path-to-project resolver is covered by Node tests and feeds a detector job whose JSON output drives the GitHub Actions matrix.

**Tech Stack:** TypeScript, Playwright Test, Node test runner, Vite, GitHub Actions.

## Global Constraints

- Showroom-sensitive changes must select the complete browser acceptance set.
- Current F1 welcome rendering, CTA/canvas presence, desktop, mobile-emulated, and WebKit evidence must be covered.
- `npm run check:showroom-acceptance` remains the full-suite command.
- No production UI or model asset changes.

---

### Task 1: Affected-project resolver

**Files:**
- Create: `scripts/lib/affected-playwright-projects.ts`
- Create: `scripts/resolve-playwright-projects.ts`
- Create: `scripts/resolve-playwright-projects.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolveAffectedPlaywrightProjects(paths: string[]): string[]`
- Produces: JSON CLI output `{ include: [{ project: string }] }`

- [ ] Write Node tests for docs-only, ordinary app, welcome UI, showroom/F1, dependency/config, and unknown-path behavior.
- [ ] Run the resolver test and verify it fails because the implementation is absent.
- [ ] Implement ordered, conservative path classification.
- [ ] Run the resolver tests and typecheck.

### Task 2: Standard Playwright projects and scenario specs

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/support/showroom.ts`
- Create: `tests/e2e/app-desktop.spec.ts`
- Create: `tests/e2e/showroom-desktop.spec.ts`
- Create: `tests/e2e/showroom-mobile.spec.ts`
- Create: `tests/e2e/showroom-webkit-smoke.spec.ts`
- Replace: `scripts/check-showroom-acceptance.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Playwright project names from Task 1.
- Produces: project-scoped screenshots and `showroom-acceptance-summary.json`.

- [ ] Add tests/specs for the default route, desktop F1 welcome arrival frame, mobile touch-emulated viewport, and WebKit smoke behavior.
- [ ] Define project-specific test matching and shared Vite web server.
- [ ] Replace the legacy runner with a thin Playwright Test launcher.
- [ ] Verify project discovery lists the intended specs exactly once.

### Task 3: Dynamic GitHub Actions matrix

**Files:**
- Modify: `.github/workflows/showroom-browser-acceptance.yml`

**Interfaces:**
- Consumes: resolver JSON matrix.
- Produces: one acceptance job per affected Playwright project and project-specific artifacts.

- [ ] Add full-history checkout and changed-file detection for pull request, push, and manual runs.
- [ ] Run the resolver and expose matrix/non-empty outputs.
- [ ] Execute only selected projects and install only the selected browser engine.
- [ ] Preserve artifact upload and add an always-present gate job.

### Task 4: Verification and audit handoff

**Files:**
- Update: `docs/dev-loop-runs/2026-07-23-dynamic-playwright-matrix/03-implementation-log.md`
- Create: `docs/dev-loop-runs/2026-07-23-dynamic-playwright-matrix/04-acceptance-report.md`
- Create: `docs/dev-loop-runs/2026-07-23-dynamic-playwright-matrix/05-pr-summary.html`

- [ ] Run resolver tests, typecheck, build, project discovery, and full showroom acceptance.
- [ ] Review actual diff against each acceptance criterion.
- [ ] Record residual risks, especially CI emulation versus real devices.

## Acceptance Mapping

- AC1, AC6, AC7 → Task 2
- AC2, AC3, AC4 → Task 1
- AC5 → Task 3
- AC8 → Task 4

## Risks

- WebKit may expose WebGL differences; its project is intentionally smoke-level.
- Changed-path classification can omit coverage; unknown source/config paths therefore conservatively select all projects.
- GitHub event SHAs differ; detector logic must explicitly handle pull request, push, and manual events.
