# Mobile Controls, Shake-to-Rose, and Particle Background Refactor

## Goal

Restore the mobile shake-to-rose easter egg, replace the wide language text control with a compact recognizable icon, and reduce `ParticleBackground.tsx` complexity without changing the accepted F1 showroom behavior or asset contract.

## Scope

### Language control

- Replace the current text label with Lucide's `Languages` icon (the “文/A” symbol).
- Keep the control at 36 by 36 CSS pixels so it aligns with the adjacent mobile view controls and does not consume extra horizontal space.
- Preserve the existing locale toggle behavior.
- Provide a localized accessible name through `aria-label` and a localized desktop hover hint through `title`.
- Keep visible focus treatment and a minimum usable touch target through the button's existing surrounding header layout.

### Shake-to-rose permission flow

The regression is caused by requesting `DeviceMotionEvent` permission after the 1.6-second reassembly timer. iOS accepts that permission request only inside a direct user gesture.

- Add a preparation callback from `App` to `WelcomePage`.
- Invoke the callback synchronously from the ENTER button's click handler, before starting the reassembly timer.
- Request motion permission in that callback. Permission success, denial, absence, or an exception must not prevent the reassembly animation or application entry.
- Keep the final `onEnter` callback responsible only for completing application entry after reassembly.
- Continue supporting browsers that do not require explicit motion permission.
- Preserve the five-click title fallback for opening the rose modal.

### Shake detection

- Move sampling and threshold calculation into a pure utility module.
- Preserve the current minimum sample interval of 100 ms and threshold of 1000.
- Prefer `event.acceleration`, falling back to `event.accelerationIncludingGravity`.
- Reject incomplete samples without changing the prior accepted sample.
- Prevent repeated triggers while the rose modal is already open.
- Keep success audio best-effort; audio playback failure must not block the modal.

## ParticleBackground Refactor

Use a conservative extraction strategy. The core animation loop, vehicle assembly, arrival choreography, explosion/reassembly behavior, studio floor placement, wheel ownership, airflow attachment, reflection render order, and pointer-forwarding lifecycle remain in `ParticleBackground.tsx` for this change.

Extract only cohesive code with explicit resource ownership:

1. Showroom constants
   - Shared colors and particle/line counts.
   - No mutable Three.js scene state.

2. Ambient particle and speed-line factories
   - Allocate their geometry, materials, typed arrays, and Three.js objects.
   - Return typed handles used by the existing animation loop.
   - Expose idempotent disposal owned by the factory.

3. Track/tunnel factory
   - Allocate the instanced track geometry, material, per-instance metadata, and scratch object.
   - Return the existing data required by the animation loop and an idempotent disposer.

Pure pointer classification and timing helpers already live in `src/lib/f1-showroom-interaction.ts`; new pure helpers should extend that module or a narrowly named sibling. DOM listener registration and pointer capture stay in the component because they share component-owned refs and renderer lifecycle.

The expected result is a materially shorter component, approximately 850–950 lines, without a broad controller/class rewrite.

## Data Flow

1. The user clicks ENTER.
2. `WelcomePage` immediately calls `onPrepareEnter` in the click event.
3. `App` requests motion permission and records the result asynchronously.
4. `WelcomePage` starts reassembly immediately and calls `onEnter` after 1.6 seconds regardless of the permission result.
5. Once permission is granted, `App` registers the motion listener.
6. Accepted shake samples pass through the pure detector and open `RoseModal` if it is closed.

## Error Handling

- Motion permission denial or errors are non-fatal and leave the normal itinerary usable.
- Unsupported motion APIs are treated as not requiring explicit permission; the listener is installed normally.
- Missing or partial acceleration data is ignored.
- Three.js factories must dispose partially created resources if setup fails and expose idempotent cleanup for normal unmounts.
- Existing foreground-canvas pointer forwarding remains the only route for exposed welcome controls beneath the car canvas.

## Verification

### Automated checks

- Add unit coverage for the shake sample interval, threshold, fallback acceleration source, incomplete samples, and modal-open guard.
- Add a source or component check proving motion permission is requested synchronously from ENTER rather than the delayed completion callback.
- Verify the language button contains `Languages`, has no visible locale text, remains 36 by 36 pixels, and retains localized accessibility attributes.
- Add focused resource tests for extracted Three.js factories, including idempotent disposal.
- Run all existing focused F1 asset, motion, wheel, airflow, studio, reflection, interaction, arrival, and model checks.
- Run TypeScript and the production build.

### Browser evidence

- Desktop and mobile screenshots for the compact language control.
- Mobile ENTER flow showing permission requested from the click gesture.
- Simulated mobile motion samples proving the rose modal opens.
- Complete desktop and mobile F1 arrival timelines (idle, accelerating, arriving, and stopped) so pose, framing, floor placement, and reflection remain reviewable.
- Mobile long-press verification remains selection-free after the refactor.

## Non-goals

- No new language picker menu.
- No change to supported locales.
- No redesign of the rose modal or bloom animation.
- No tuning of shake sensitivity beyond preserving the current behavior.
- No F1 model replacement, loader URL change, wheel-node change, or `RearHardRockAeroPanel` hierarchy change.
- No wholesale scene-controller architecture rewrite.
