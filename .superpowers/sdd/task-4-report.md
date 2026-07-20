# Task 4 Report — Desktop and Mobile Arrival Evidence

Status: PASS (evidence gaps resolved; no product-code changes)

Previous blocked-report commit: `988401c` (`docs: verify F1 post-hologram glitch timeline`)

Evidence/tests: all 14 requested automated commands pass in a fresh run; raw output is tracked at `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/task-4-required-checks.txt`. Fresh accepted desktop, touch-enabled mobile, and reduced-motion videos plus extracted phase frames are tracked under `output/playwright/task-4-verified/`. Raw ffprobe/blackdetect output is tracked at `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/task-4-black-frame-results.txt`; no black event was emitted.

Concerns: the accepted 85.28 s mobile video retains a long settled-explosion hold caused by the bounded recovery from an initial missed part-touch coordinate. The required automatic arrival is intact at 0:00–0:15 and the successful trusted touch reassembly occurs at 1:08.30–1:10.00. Rejected/diagnostic attempts are retained and explicitly inventoried rather than relabeled.

Report: `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/04-acceptance-report.md`

## Evidence-gap resolution

- Corrected every report-to-output link to `../../../output/...` and verified all linked local targets.
- Added an explicit inventory of every Task 4 image/video present at verification time, including original CLI-stall screenshots, the rejected partial desktop video, the rejected held-touch mobile video, diagnostic screenshots/contact sheets, accepted primary recordings, and accepted extracted phase frames. Each entry has viewport/dimensions, time/provenance, and trust status.
- Recorded a fresh 1440×900 desktop sequence with a single in-browser monotonic clock. The accepted 18.40 s video covers 100%, hologram completion, clean hold, all three pulses, clean recovery, automatic explosion start/settle, trusted car ray-hit reassembly, and settle. The interaction result records `aria-pressed: true → false`.
- Recorded a fresh 390×844 coarse-pointer touch sequence. A trusted CDP touch starts the engine, releases after 35%, and allows the application’s documented auto-complete path to 100%. The clip then shows completion, hold, all pulses, clean recovery, automatic explosion, a trusted visible-part touch, and settled reassembly.
- Recorded a fresh reduced-motion sequence with `prefers-reduced-motion: reduce` active before initialization. The full 1.8 s glitch interval shows mild nonspatial flicker without RGB split or geometry displacement; the automated welcome check independently asserts spatial amount zero with low-amplitude brightness/noise retained.
- Extracted desktop/mobile/reduced phase frames with checked-in timestamp provenance and retained continuous contact sheets for reviewer scanning.
- Verified floor clearance and semantic grouping through full visual timelines/contact sheets plus `check:f1-model`, which evaluates every simulated explosion/reassembly frame.
- Verified ray ownership live with trusted pointer/touch input; verified exposed-control forwarding through the required interaction and welcome automated checks. A desktop pointer probe that landed on visible car geometry is explicitly recorded as car-owned, not mislabeled as forwarding.
- Ran black-frame scans over all 460 accepted desktop frames, 2,132 accepted mobile frames, and 411 accepted reduced-motion frames; there are no `black_start`, `black_end`, or `black_duration` events.

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
