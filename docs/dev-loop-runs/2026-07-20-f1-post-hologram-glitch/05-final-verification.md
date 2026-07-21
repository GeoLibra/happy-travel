# F1 Post-Hologram Glitch Final Verification

Date: 2026-07-21

## Result

PASS. The automatic welcome sequence renders the 4.5-second hologram, a 100 ms clean hold, a 1.2-second two-pulse canvas glitch, and a clean direct-render frame scheduled by `requestAnimationFrame` before automatic model explosion. No product timer owns the sequence.

## Real WebGL lifecycle probe

The mounted showroom probe passed both deterministic scenarios:

- Context restoration before sequence start re-prewarmed the real model and reported `firstPulseProgramDeltas: [0]`, `modelSourceMisses: 0`, and `unavailableCount: 0`.
- Context loss during an active pulse entered direct-render fallback, restored and re-prewarmed the real model, retained `modelSourceMisses: 0`, and allowed keyboard reassembly after restoration.

The probe captured full-page screenshots at:

- `output/playwright/f1-glitch-probe-restore-before-sequence.png`
- `output/playwright/f1-glitch-probe-active-loss-restored.png`

These media remain ignored local evidence and are not committed.

## Complete browser timelines

Fresh continuous recordings were captured with the checked-in scripts:

| Profile | Viewport / input | Result |
| --- | --- | --- |
| Desktop | 1440×900, trusted mouse hold and car ray click | PASS; explosion reached `aria-pressed=true`, ray reassembly reached `false` |
| Mobile | 390×844, coarse pointer, `maxTouchPoints=5`, trusted CDP touches | PASS; explosion reached `true`, touch ray reassembly reached `false` |
| Reduced motion | 1440×900, `prefers-reduced-motion: reduce` before initialization | PASS; complete arrival/glitch/explosion interval captured |

Local ignored recordings:

- `output/playwright/final-fixes/desktop-arrival-final.webm`
- `output/playwright/final-fixes/mobile-arrival-final.webm`
- `output/playwright/final-fixes/reduced-arrival-final.webm`

After the 2026-07-21 tuning pass, the phase contract relative to startup completion is: hologram complete at +4500 ms, glitch start at +4600 ms, glitch end at +5800 ms, and explosion eligibility only after the subsequent clean rAF frame.

## Fresh required checks

All commands exited 0 on 2026-07-21:

- `npm run check:f1-glitch`
- `npm run check:f1-welcome`
- `npm run check:showroom-resources`
- `npm run check:f1-motion`
- `npm run check:f1-wheel-hold`
- `npm run check:f1-airflow`
- `npm run check:f1-studio`
- `npm run check:f1-reflection`
- `npm run check:f1-showroom-interaction`
- `npm run check:f1-model`
- `npm run check:showroom-assets`
- `npm run check:f1-showroom-v5`
- `npm run check:f1-arrival-motion`
- `npm run lint`
- `npm run build`

The production build transformed 2,131 modules and completed with only the existing chunk-size advisory.
