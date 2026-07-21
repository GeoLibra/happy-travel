# First-pulse renderer audit debug report

## Scope

- Investigated committed head `c0b01853caf8b9cea94ecf12f01672b42a2d97f5`.
- Limited production changes to the renderer audit measurement boundary. The glitch render pipeline, model asset, material prewarm, reflection, wheel, floor, and interaction implementations were not changed.
- Updated only the focused check and mounted-showroom probe around that audit behavior.
- Did not modify, delete, or stage the three pre-existing untracked capture scripts or any evidence media.

## Reproduction and instrumentation evidence

The real mounted-showroom probe supplied this reproducible failure snapshot at the investigated head:

```text
status: prewarmed
sourcePrewarms: 4
modelSourcePrewarms: 3
modelSourceMisses: 0
contextLosses: 1
contextRestores: 1
directFallbackFrames: 6
activePulseFrames: 4
unavailableCount: 1
firstPulseProgramDeltas: [14]
```

It failed with `initial and restored first pulses were not both measured` and also appeared to report 14 first-pulse program compilations.

The code-timing trace showed:

1. `renderShowroomForGlitchPrewarm` completed the target-bound real-model pass and stored `renderer.info.programs.length` in `prewarmProgramCount`.
2. `expectsPrewarmedFirstPulse` remained armed across the following clean hold. Those clean frames took the direct `renderShowroom(null)` path.
3. The direct screen path legitimately created target-specific screen variants after the HDR-target prewarm. Those programs were outside the later active-pulse render but inside the audit's long measurement window.
4. Only after `renderF1GlitchFrame` completed the first active pulse did the audit subtract the stale prewarm count. The reported `14` therefore included clean-interval screen variants.
5. `modelSourcePrewarms: 3` with `modelSourceMisses: 0` confirms the real model participated in every target prewarm; the snapshot did not demonstrate a missed model-source shader prewarm.

The old restore expectation had a separate timing flaw. It lost context after the initial active pulse, restored, waited 250 ms, and required two entries in one sequence. Context restoration can complete after the finite glitch window has ended, so a second active pulse is not guaranteed and must not be fabricated by the probe.

## Prewarm versus pulse state comparison

- Target prewarm: the real model is temporarily made renderable, frustum culling is disabled for its meshes, the HDR source target is bound, reflection rendering is exercised, and the identity composite renders to the screen with color writes disabled.
- Clean hold: `getF1GlitchPulse` is zero, so the showroom renders directly to the screen target. This is a different target/output path and may create legitimate screen variants.
- Active pulse: the showroom renders to the same HDR source target used by prewarm, then the glitch composite renders to the screen with the production tone-mapping configuration.
- Audit requirement: measure `renderer.info.programs.length` immediately before and immediately after that one active-pulse callback. Program creation before the callback is unrelated, regardless of whether it occurred after prewarm.

## Root cause

The `14` delta was an audit-baseline bug, not evidence of a cold compile owned by the first active pulse. The audit compared two different lifecycle moments: after offscreen prewarm and after a later active render, with clean direct frames between them. The probe then compounded the misleading result by requiring a restored active pulse even when the sequence had already ended.

## Hypothesis and minimal test

Hypothesis: wrapping exactly one expected active render with immediate program-count reads will report zero when that render is warm, even if 14 programs compiled during the preceding clean interval; a program created inside the wrapped render must still report a non-zero delta.

The behavioral contract uses a fake program count:

- advance it by 14 before measurement, then render without incrementing: expected delta `0`;
- increment once inside the measured render: expected delta `1`.

This confirmed the measurement boundary independently of Three.js driver behavior before the component was changed.

## RED

First RED, before production changes:

```text
npm run check:f1-welcome
AssertionError [ERR_ASSERTION]: first-pulse program auditing must measure only the active render it owns
actual: 'undefined'
expected: 'function'
```

After implementing only that helper and component boundary, the next prewritten probe contract became RED:

```text
AssertionError [ERR_ASSERTION]: the real probe must restore before starting a deterministic first-pulse scenario
```

A final recovery-baseline contract was also observed RED before its probe correction:

```text
AssertionError [ERR_ASSERTION]: active-pulse restoration must prove a new model prewarm after the loss snapshot
```

## Focused fix

- Added `measureF1RendererProgramDelta`, which reads the count immediately around one owned render callback and returns both its result and same-render delta.
- Removed `prewarmProgramCount` from `ParticleBackground`.
- The component arms measurement after prewarm as before, but now samples immediately before and after the first active `renderF1GlitchFrame` only.
- Split the real probe into two fresh-page scenarios:
  - restore before sequence start, then require the restored pipeline's first active-pulse delta to be zero;
  - start a fresh sequence, trigger context loss on the next observed active-pulse frame, prove direct fallback, restore and require a new real-model prewarm relative to the post-loss snapshot, prove non-black output, and prove keyboard reassembly continuity even if the glitch window has ended.
- Removed the invalid requirement for two pulse deltas from one finite sequence. No shader-compile assertion was weakened: the deterministic restored-first-pulse scenario still requires an exact zero.

## GREEN

Fresh verification after implementation:

```text
node --check scripts/run-f1-glitch-webgl-probe.mjs  # exit 0
npm run check:f1-welcome                            # exit 0
npm run check:f1-glitch                             # exit 0
npm run lint                                        # exit 0, tsc --noEmit
npm run build                                       # exit 0, 2131 modules transformed
```

The build emitted only the pre-existing chunk-size advisory and completed in 1 minute 27 seconds.

## Browser status and remaining concern

The parent task explicitly directed this subtask not to run the browser after the shell could not start the sandboxed Vite listener. Therefore the rewritten two-scenario mounted-WebGL probe was syntax-checked and contract-checked but not executed here. Its real-browser result remains the sole unverified item in this subtask and should be recorded with the final commit SHA when the owning task runs it.

`git diff --check` passed. The F1 welcome asset and interaction invariants remain untouched.
