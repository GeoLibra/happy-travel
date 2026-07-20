# F1 Post-Hologram Glitch Acceptance Report

## Disposition

**BLOCKED — visual acceptance evidence is incomplete.** All required automated checks pass, and the retained Task 3 desktop/mobile recordings are usable supporting evidence. However, this verifier could not produce a trustworthy fresh, timestamped capture of all required glitch phases or a visual reduced-motion recording: the Playwright CLI repeatedly stalled for minutes between commands, invalidating the intended phase timing. This is an evidence-infrastructure limitation, not a demonstrated product defect. Do not treat the automated reduced-motion coverage below as a replacement for the required visual reduced-motion interval.

## Automated checks

Run from commit `0450c44` on 2026-07-20:

- `npm run check:f1-glitch`: PASS
- `npm run check:f1-welcome`: PASS
- `npm run check:showroom-resources`: PASS
- `npm run check:f1-motion`: PASS
- `npm run check:f1-wheel-hold`: PASS
- `npm run check:f1-airflow`: PASS
- `npm run check:f1-studio`: PASS
- `npm run check:f1-reflection`: PASS
- `npm run check:f1-showroom-interaction`: PASS
- `npm run check:f1-model`: PASS
- `npm run check:showroom-assets`: PASS
- `npm run check:f1-showroom-v5`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

Relevant behavioral coverage:

- `check:f1-glitch` asserts the 4,500 ms hologram duration, 100 ms clean hold, 1,800 ms glitch interval, the clean frame before explosion, and exactly three envelope peaks.
- `check:f1-welcome` asserts the foreground canvas/UI forwarding contract plus reduced-motion post-process selection and shader behavior.
- `check:f1-wheel-hold` asserts that reduced motion keeps wheel velocity and rendered wheel angle at zero.
- `check:f1-showroom-interaction` asserts car-ray-hit ownership, exposed-control forwarding, and floor reveal/hide completion.
- `check:f1-model` simulates every explosion and reassembly frame, asserting floor clearance and semantic grouping (including rear-body ownership and exclusion of adjacent wheel/aero children).

## Browser evidence

### Retained Task 3 evidence (trusted prior-review artifacts; independently checked for dimensions, duration, and black-frame absence)

- [Desktop review arrival video](../../../../output/playwright/task-3/review-desktop-arrival.webm) — 1440×900, captured 2026-07-20 17:19:30 +0800, 50.48 s. Its duration covers the full hold, hologram, glitch, explosion, and manual interaction window; `ffmpeg blackdetect=d=0.05:pix_th=0.10` emitted no `blackdetect` events across all 1,262 frames. It is supporting full-timeline evidence, but its individual pulse timestamps were not recoverable from the artifact metadata in this verification pass.
- [Desktop stopped start](../../../../output/playwright/task-3/review-desktop-start.png) — 1440×900, captured 17:18:42 +0800. Shows welcome copy and green start lights below the foreground car canvas.
- [Desktop exploded state](../../../../output/playwright/task-3/review-desktop-exploded.png) — 1440×900, captured 17:19:27 +0800. Shows the separated car parts while ordinary welcome copy remains visible. Floor clearance and semantic group continuity are additionally proven for every animation frame by `check:f1-model`; a still cannot prove the complete motion by itself.
- [Mobile review arrival video](../../../../output/playwright/task-3/review-mobile-arrival.webm) — 390×844, captured 2026-07-20 17:20:40 +0800, 46.12 s. `ffmpeg blackdetect=d=0.05:pix_th=0.10` emitted no `blackdetect` events across all 1,153 frames. This is supporting full mobile timeline evidence; it does not establish the required fresh touch-input or reduced-motion run.
- [Mobile stopped start](../../../../output/playwright/task-3/review-mobile-start.png) — 390×844, captured 17:19:56 +0800. Shows the mobile welcome scene and stopped car.
- [Mobile exploded state](../../../../output/playwright/task-3/review-mobile-exploded.png) — 390×844, captured 17:20:36 +0800. Shows the mobile separated-part state with no black frame.

### This verifier’s fresh desktop attempt

- [Desktop pre-start baseline](../../../../output/playwright/task-4-desktop-ready.png) — 1440×900, captured 18:11:30 +0800. Normal welcome scene before the hold.
- [Attempted hologram-start capture](../../../../output/playwright/task-4-desktop-hologram-start.png) — 1440×900, captured 18:18:35 +0800.
- [Attempted hologram-completion capture](../../../../output/playwright/task-4-desktop-hologram-complete.png) — 1440×900, captured 18:18:41 +0800.

The last two are retained for debugging provenance only, **not** accepted phase evidence: browser command stalls meant that nominal shell sleeps did not correspond to browser elapsed time. The completed capture run was stopped rather than mislabelled. No fresh mobile touch or `prefers-reduced-motion: reduce` browser artifact was produced for the same reason.

## Required-observation status

- Canvas-only distortion / stable welcome UI: source and `check:f1-welcome` PASS; visual supporting evidence exists in the retained desktop clip, but this verifier did not capture each pulse independently.
- Three pulses and clean recovery before explosion: `check:f1-glitch` PASS; missing trustworthy phase-level browser captures.
- Initial and settled explosion; manual reassembly: retained Task 3 clips are supporting evidence; missing fresh timestamped phase captures and a fresh reassembly still.
- Floor clearance and semantic body grouping: `check:f1-model` PASS over simulated explosion/reassembly frames; retained exploded stills are consistent supporting visual evidence.
- Interaction forwarding and car-ray ownership: `check:f1-showroom-interaction` PASS; no new live pointer-forwarding recording was possible.
- No black frames: black-frame scan of both retained full videos found none.
- Mobile reduced spatial amplitude/render resolution: retained mobile artifacts show the 390×844 route, but no fresh run was captured to measure the reduced profile.
- Reduced motion: behavioral assertions PASS (no visible wheel rotation; post-process reduced branch suppresses spatial scan bands), but the required brightness/noise-only visual glitch interval is **missing**.

## Follow-up required for acceptance

Re-run the fresh browser evidence using a responsive Playwright session and record timestamped desktop (1440×900) and touch mobile (390×844) timelines, including every named glitch/explosion/reassembly phase. Then emulate `prefers-reduced-motion: reduce` and capture the whole glitch interval to verify brightness/noise flicker with neither RGB separation nor spatial tearing.
