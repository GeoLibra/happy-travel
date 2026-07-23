# Showroom F1 Arrival Timeline Acceptance Spec & Design

Date: 2026-07-23

## 1. Context & Rationale

Playwright's default screenshot assertion stabilizes CSS transitions and Web Animations, but Three.js / WebGL canvas rendering driven by `requestAnimationFrame` falls outside CSS animation lifecycle hooks. For the F1 car arrival sequence in `GeoLibra/happy-travel`:
- The car arrives via a multi-phase rAF motion trajectory before settling.
- Simple single-frame `pixelmatch` or static screenshot assertions can pass at an arbitrary moment or miss progression bugs (e.g. car frozen on arrival, off-center camera framing, canvas rendering black/blank frames, or CTA becoming unclickable due to incorrect z-index/canvas pointer overlay).

To address this, we introduce a dedicated `showroom-arrival-timeline-chromium` Playwright project and spec (`tests/e2e/showroom-arrival-timeline.spec.ts`) that captures 4–5 timestamped arrival frames and performs structural visual and interactive assertions.

## 2. Design Architecture & Requirements

### 2.1 Timeline Frame Capture Strategy (4–5 Timepoints)

The test will sample 5 timestamped frames across the arrival timeline:
1. **T0 (Initial / Start)**: Immediately after welcome page DOM load and race prep completion (0% progress / pre-arrival pose).
2. **T1 (Early Motion)**: ~300ms after load (active entry motion, car dynamic pose).
3. **T2 (Mid Arrival)**: ~800ms after load (car approaching camera framing).
4. **T3 (Settled Frame)**: ~1500ms / post-arrival (car damped, locked in position, level polar angle).
5. **T4 (Studio / Post-Arrival State)**: ~2500ms (studio ambient lights active, settled floor reveal).

### 2.2 Four Core Verification Rules

Each captured frame and the sequence as a whole must satisfy:

1. **Canvas Non-Empty Verification (`checkCanvasNonEmpty`)**:
   - Sample WebGL canvas pixels across a uniform grid.
   - Verify non-background / non-transparent / non-zero RGB pixel ratio exceeds threshold (>= 1.5%), ensuring WebGL canvas is rendering active geometry rather than blank/black/transparent frames.

2. **Centered Composition Verification (`checkCenteredComposition`)**:
   - Compute bounding box or centroid (center of mass) of non-background car pixels in the WebGL canvas.
   - Verify the car centroid lies within reasonable horizontal center tolerances (e.g. within 15% of viewport horizontal center) and reasonable vertical bounds.

3. **Frame-to-Frame Motion Delta Verification (`checkFrameMotionDelta`)**:
   - Calculate pixel difference ratio (mean absolute pixel change) between consecutive captured frames ($T_0 \to T_1$, $T_1 \to T_2$, $T_2 \to T_3$, $T_3 \to T_4$).
   - Require active motion ($\Delta > \text{threshold}$) during early/mid phases ($T_0 \to T_1 \to T_2$), and stabilization ($\Delta < \text{settle\_threshold}$) after arrival settles ($T_3 \to T_4$).

4. **CTA Operability Verification (`checkCtaOperability`)**:
   - Verify the main CTA button (`[data-f1-welcome-action="enter"]`) is visible, clickable, and pointer-operable across the arrival sequence.
   - Test pointer interaction forwarding when clicking CTA through foreground car canvas overlay.

## 3. Playwright & Safety Matrix Integration

- Add project `showroom-arrival-timeline-chromium` to `playwright.config.ts`.
- Update `scripts/lib/affected-playwright-projects.ts` to include `showroom-arrival-timeline-chromium` in `ALL_PLAYWRIGHT_PROJECTS` and safety matrix routing.
- Update `scripts/resolve-playwright-projects.test.ts` to assert inclusion.
- Output screenshot evidence and timeline metric report into `output/playwright/showroom-arrival-timeline-chromium/`.
- Document project in `docs/showroom-browser-acceptance.md`.
