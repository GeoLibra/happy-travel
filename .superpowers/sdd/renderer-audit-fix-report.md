# Renderer audit fix report

## Scope

- Preserved committed head `fc76381` and the F1 welcome invariants.
- Did not modify, delete, or stage the three untracked final-capture scripts.
- Limited changes to the glitch renderer, its mounted showroom integration, focused checks, and a Playwright CLI component probe.

## RED

Command:

```text
PATH=/Users/hgis/.nvm/versions/node/v24.3.0/bin:$PATH npm run check:f1-welcome
```

Observed failure:

```text
AssertionError [ERR_ASSERTION]: the actual late GLB must be made renderable only inside the target-bound prewarm pass
```

The failing contracts were written before production changes. They cover:

- target binding before a hidden model is temporarily made renderable;
- participation of a real model mesh in the source pass;
- restoration of visibility, frustum-culling, render callback, and previous render target on success and failure;
- a second prewarm after the hologram clones are replaced by the original GLB materials;
- transactional disposal of an allocated render target, shader material, and plane geometry after injected mesh-construction failure;
- presence of the mounted-canvas renderer audit hook.

## GREEN

Fresh bounded verification after implementation:

```text
npm run check:f1-welcome  # exit 0
npm run check:f1-glitch   # exit 0
npm run lint              # exit 0, tsc --noEmit
npm run build             # exit 0, 2131 modules transformed
```

The build retained the pre-existing chunk-size advisory; it reported no build error.

Per the parent task's final instruction, no browser/probe process was run and the broader original matrix was not rerun in this subtask.

## Implementation

- `renderF1GlitchPrewarmSource` binds the HDR target before revealing the source, disables mesh frustum culling for that pass, instruments actual mesh participation with temporary `onBeforeRender` wrappers, and restores all touched state in `finally`.
- `ParticleBackground` uses that target-bound source pass for initial, resize, late-model, original-material, and context-restoration prewarms. A missed model draw fails closed to the direct showroom route.
- Original GLB materials are re-prewarmed immediately after `revertHologramMaterial`, during the clean hold and before the first pulse.
- Query parameter `?f1RendererAudit=1` installs a scoped `canvas.__f1RendererAudit` hook. It can force loss/restore through `WEBGL_lose_context` and reports direct fallback frames, real-model prewarms/misses, unavailable transitions, and first-pulse program-count deltas.
- `createF1GlitchPostProcess` accepts a partial resource factory and transactionally disposes every resource created before a construction/validation failure escapes.
- `scripts/run-f1-glitch-webgl-probe.mjs` is a focused Playwright CLI page probe for the real mounted showroom canvas. It checks loss during an active pulse, direct fallback, restoration/re-prewarm, zero first-pulse program deltas, non-black pixels, and post-restore interaction continuity.

## Browser status and commit tagging

The mounted-canvas probe was intentionally not executed after the instruction to stop browser work. It remains the sole unverified integration item. The script returns a result with an explicit reminder to record `git rev-parse HEAD` beside the result. It was not wired into `package.json` because this project has no project-owned Playwright dependency or stable repository-local CLI runner; adding one would require lockfile/dependency scope and browser installation that were explicitly excluded from the bounded finish.

## Self-review

- The helper never renders the temporarily visible model to `null`; it binds the supplied offscreen target first.
- Exceptional source renders restore model visibility, mesh culling/callbacks, and the previous renderer target.
- The only runtime wheel-spin path remains the four exact `WheelSpin_*` nodes; no model asset, hierarchy, wheel, floor, or loader URL changed.
- Context loss still avoids disposing invalidated GPU handles. Restoration creates, validates, and target-prewarms a fresh resource set.
- Construction failures preserve the original thrown error while best-effort cleanup releases independent resources.
- Audit exposure is opt-in by query parameter and is removed during component teardown.
- `git diff --check` passed.

## Remaining concern

Run the focused component probe in a real WebGL browser on the final commit, save its returned JSON with the final commit SHA, and then run the broader F1 asset/reflection/showroom matrix before claiming complete browser evidence.

## Review follow-up

RED was re-established with `npm run check:f1-welcome`: the new production contract failed because `WEBGL_lose_context` was requested on ordinary visits. The same test now also contracts the probe ordering and exceptional `onBeforeRender` restoration.

The follow-up changes:

- request `WEBGL_lose_context` only when `?f1RendererAudit=1` enables the audit hook;
- release the probe's trusted hold after progress reaches the 30–99% auto-complete range, before the canvas can forward a 100% pointer release to the ENTER CTA;
- wait for automatic completion/ENTER after release and assert that the URL and welcome showroom remain intact before waiting for `activePulseFrames`;
- assert that an exceptional target-bound source render restores the mesh's original `onBeforeRender` callback.

Fresh follow-up GREEN evidence:

```text
npm run check:f1-welcome  # exit 0
npm run check:f1-glitch   # exit 0
npm run lint              # exit 0, tsc --noEmit
npm run build             # exit 0, 2131 modules transformed
```

No browser or WebGL probe process was run, as instructed. The build again emitted only the existing chunk-size advisory.
