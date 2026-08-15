# Shanghai Race Countdown Visualization Design

## Purpose

Create a dedicated, immersive countdown page for the next Formula 1 Chinese Grand Prix in Shanghai. The visual foundation will faithfully recreate the public reference at `https://gnanasai-threejs-time-viz-02.vercel.app/` as an isolated local Three.js scene before Happy Travel-specific content is introduced.

The user enters the page by selecting the existing countdown card in the itinerary. The finished page places the project's RB20 car in front of the countdown digits and provides an explicit return path to the itinerary.

This work assumes the project has permission to recreate the reference experience and use any source assets retained in the local implementation. Third-party author branding is not part of the product.

## Delivery Sequence

### Phase 1: Isolated reference recreation

Build an isolated `TimeVizScene` that reproduces the reference without Happy Travel product UI:

- six cube-built clock digits;
- per-instance pastel/rainbow coloring;
- dark studio environment;
- reflective, animated liquid floor;
- matching camera, depth, lighting, bloom, and reflection scale;
- desktop horizontal layout;
- mobile two-digits-per-row vertical layout;
- once-per-second digit transitions;
- development-only FPS and scene tuning controls.

The recreation is not accepted from memory or a single screenshot. Desktop and mobile renders must be compared with captured reference states at the same viewport and time layout.

### Phase 2: Happy Travel integration

After the isolated recreation passes visual comparison:

- replace clock time with Shanghai Grand Prix countdown values;
- place the existing versioned RB20 asset in front of the digits and on the reflective floor;
- add the event title, official/estimated date status, and return control;
- make the existing itinerary countdown card navigate to the full-screen experience;
- hide reference development UI in production;
- preserve independent scene ownership so the welcome showroom and countdown scene do not share mutable Three.js resources.

## Reference Evidence

The captured reference has one full-viewport WebGL canvas and no meaningful content flow below the fold.

At `1280 x 720`, the six digits are arranged in one horizontal row above a broad liquid reflection. At `390 x 844`, the digits are arranged as three vertical rows with two digits per row. The source also exposes an FPS monitor, author-avatar link, and collapsible tuning controls; these are evidence and development aids, not production requirements.

Observed runtime assets include a dark-room HDR environment and a bundled JavaScript renderer. The implementation must not hotlink source assets. Assets may be copied only when reuse is permitted; otherwise an equivalent project-owned environment asset must be produced and visually compared.

## Page Structure

The integrated page has three visual layers:

1. `CountdownEnvironment`: camera, HDR environment, lights, liquid floor, post-processing.
2. `CountdownDigits`: instanced cube geometry driven by countdown values.
3. `CountdownVehicle`: a separately owned clone of the accepted RB20 model, positioned between the camera and digits.

A lightweight DOM overlay sits above the canvas and contains:

- a top-left back button labelled “返回行程”;
- “NEXT SHANGHAI GRAND PRIX” event identification;
- the resolved event date in Asia/Shanghai time;
- either “官方正赛时间” or “暂定日期 · 等待官方赛程确认”.

The car remains the foreground hero but must not obscure the legibility of more than one countdown unit. On mobile, its framing is adjusted independently rather than scaling the desktop pose.

## Navigation

The existing `RaceCountdown` card becomes an interactive entry point and gains the hint “查看全屏倒计时”. Activating it opens the countdown page without replaying the welcome ignition sequence.

The back control returns to the same itinerary state. Browser back navigation must produce the same result. The design must not create a second, competing header entry.

## Event Time Resolution

Resolution runs once whenever the countdown page loads; no background or daily job is required.

1. Determine the current year in `Asia/Shanghai`.
2. Request the Jolpica `shanghai` race records for the current year and next year.
3. Combine each race `date` and `time` as UTC, then choose the earliest event later than the current instant.
4. If a future API event exists, use it and label the date as official.
5. If the API fails or contains no future Shanghai event, use March 15 at 15:00 Asia/Shanghai:
   - use the current year when that instant has not passed;
   - otherwise use the next year.
6. Label fallback time as estimated. A later page load automatically replaces it when official data becomes available.

The 2026 API record is `2026-03-15T07:00:00Z`, equivalent to `2026-03-15 15:00` in Shanghai.

The fallback is intentionally approximate and must never be presented as an official race time.

## Countdown States

- `loading`: render the scene while the event resolver runs; do not flash zeroes.
- `official`: show the API-backed countdown and official label.
- `estimated`: show the March 15 fallback and estimated label.
- `event-started`: show a short “LIGHTS OUT” state rather than frozen zeroes, then re-run resolution for a future event.
- `unavailable`: if WebGL cannot initialize, show a DOM countdown using the same resolved event time.

Network failure must not block the page or prevent navigation back to the itinerary.

## Responsive Behavior

Desktop preserves the reference's one-row digit composition. The integrated vehicle occupies the lower central foreground, with the liquid plane extending toward the viewer.

Mobile preserves the reference's three-row, two-digit grouping. The vehicle sits in the lower foreground and is framed below the middle pair so the time remains readable. Product overlay controls respect safe areas and do not overlap the debug/FPS controls in development.

The countdown may use a day value wider than two digits. The digit renderer must support at least three day digits without compressing individual cubes; layout spacing and camera framing adapt instead.

## Motion and Accessibility

- Respect `prefers-reduced-motion` by removing camera drift, liquid displacement animation, and animated digit transitions while retaining a stable reflective scene.
- The DOM overlay exposes the target event and remaining time to assistive technology; the WebGL canvas is decorative.
- Announce changes no more than once per minute to avoid a screen-reader update every second.
- Back navigation and the countdown-card entry work with pointer and keyboard input.
- Text and controls must meet visible contrast requirements independently of the scene underneath.

## Resource Ownership and Performance

The countdown renderer owns and disposes its renderer, animation frame, render targets, environment maps, materials, instanced meshes, model clone, event listeners, and WebGL context references when leaving the page.

The scene may reuse the accepted RB20 file URL but must not reuse a mutable model instance from the welcome showroom. Quality tiers may lower reflection resolution, pixel ratio, and post-processing on constrained devices without changing the composition.

No test may mask leaks by forcing context loss or deleting globals during normal cleanup.

## Verification and Acceptance

### Phase 1 visual gate

- Compare source and local screenshots together at `1280 x 720`.
- Compare source and local screenshots together at `390 x 844`.
- Match composition, cube proportions, color distribution, camera perspective, lighting, depth, floor material, reflection scale, and responsive grouping.
- Verify the once-per-second digit change and liquid motion.
- Allow only small stochastic and GPU-dependent differences.

### Phase 2 product gate

- Verify the countdown card opens the full-screen page.
- Verify the back control and browser back restore the itinerary.
- Verify official Jolpica data is preferred when available.
- Verify API failure and missing next-season data choose the documented fallback.
- Verify the countdown does not freeze at zero.
- Verify desktop and mobile car framing keeps the countdown legible.
- Verify reduced-motion and non-WebGL fallbacks.
- Run the focused showroom/resource lifecycle tests required by the F1 agent guide because the integrated page introduces another Three.js car scene.
- Run `pnpm test:fast` as the main local quality gate.

## Out of Scope

- Replacing or redesigning the welcome showroom.
- Showing live telemetry, driver standings, or race results.
- Running a backend scheduler or periodically polling while the user is elsewhere in the app.
- Publishing or deploying the project.
- Shipping the reference author's avatar, external profile link, FPS monitor, or debug controls in production.
