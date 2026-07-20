# Task 4 Report — Desktop and Mobile Arrival Evidence

Status: PASS (evidence gaps resolved; no product-code changes)

Previous blocked-report commit: `988401c` (`docs: verify F1 post-hologram glitch timeline`)

Evidence/tests: all 14 requested automated commands pass in a fresh run; raw output is tracked at `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/task-4-required-checks.txt`. The SHA supplement identifies product implementation `0450c44503b2311ac8b491133a8181190f48c023` and proves the evidence checkout has the same product paths. Fresh accepted desktop, replacement mobile v2, and reduced-motion evidence is tracked under `output/playwright/task-4-verified/`. Focused mobile v2 ffprobe/blackdetect covers 2,834 frames with no black event.

Concerns: the former 85.28 s mobile clip is rejected because its result contradicted its tracked script. Replacement v2 is 113.36 s because bounded CLI round trips are retained as idle frames. Its exact executed actions and final result agree on trusted touch `(120,450)`, trusted pointer events at 1:49.770–1:49.902, and `aria-pressed: true → false` by 1:49.966. Rejected artifacts remain explicitly inventoried.

Report: `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/04-acceptance-report.md`

## Evidence-gap resolution

- Corrected every report-to-output link to `../../../output/...` and verified all linked local targets.
- Added an explicit inventory of every Task 4 image/video present at verification time, including original CLI-stall screenshots, the rejected partial desktop video, the rejected held-touch mobile video, diagnostic screenshots/contact sheets, accepted primary recordings, and accepted extracted phase frames. Each entry has viewport/dimensions, time/provenance, and trust status.
- Recorded a fresh 1440×900 desktop sequence with a single in-browser monotonic clock. The accepted 18.40 s video covers 100%, hologram completion, clean hold, all three pulses, clean recovery, automatic explosion start/settle, trusted car ray-hit reassembly, and settle. The interaction result records `aria-pressed: true → false`.
- Rejected the contradictory 85.28 s mobile evidence and recorded replacement v2 at 390×844. The exact three-step action record and final result agree with the media: trusted CDP engine touch, automatic completion/explosion, and trusted `(120,450)` car touch with state `true → false`.
- Recorded a fresh reduced-motion sequence with `prefers-reduced-motion: reduce` active before initialization. The full 1.8 s glitch interval shows mild nonspatial flicker without RGB split or geometry displacement; the automated welcome check independently asserts spatial amount zero with low-amplitude brightness/noise retained.
- Extracted desktop/mobile/reduced phase frames with checked-in timestamp provenance and retained continuous contact sheets for reviewer scanning.
- Verified floor clearance and semantic grouping through full visual timelines/contact sheets plus `check:f1-model`, which evaluates every simulated explosion/reassembly frame.
- Retained the car-owned probe and added a separate successful live forwarding result. After trusted zoom-out, trusted foreground-canvas pointer-up at `(580,438)` ray-missed and activated the exposed CTA (`ENTER → REASSEMBLING...`); the expected forwarded `HTMLElement.click()` is recorded separately from the trusted source pointer.
- Ran black-frame scans over all 460 accepted desktop frames, 2,834 replacement mobile frames, and 411 accepted reduced-motion frames; there are no `black_start`, `black_end`, or `black_duration` events.

## Fresh required-command results

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

Raw run terminates with `FINAL STATUS: 0`.
