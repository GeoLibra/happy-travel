# F1 Showroom Interaction Refinement

## Goal

Refine the welcome-scene F1 interaction so the final presentation feels like a controlled studio reveal rather than a continuously visible effects demo. The floor must appear only after the car stops, airflow must be a deliberate final-stage long-press interaction, exploded parts must remain above the floor, and vertical camera movement must never flip the scene.

## Scope

This change affects the Three.js welcome scene and its focused verification scripts. It does not change the itinerary application, the start-progress rules, model assets, audio assets, or the overall welcome-page composition.

## Scene States

The existing numeric start progress remains the source of truth for the arrival sequence. The scene derives these interaction phases from it:

1. `idle`: progress is zero; the car and studio floor are hidden.
2. `approaching`: progress is above zero and below 100; the car approaches with the existing racing background, while the studio floor and car-local airflow remain hidden.
3. `stopped`: progress is 100; the car is stationary, the studio floor fades in, and car interaction becomes available.
4. `exploded`: the stopped car has its parts separated; direct car activation reassembles it.
5. `carHold`: the stopped, assembled car is being held; its wheels spin in place and model-relative airflow fades in. Releasing the car lets both effects decay smoothly.

The existing automatic exploded-view reveal remains after the car stops. A manual car interaction cancels the pending automatic toggle as it does today.

## Ground and Reflection

The studio floor exists as a scene resource from initialization so reflective render targets remain stable, but it starts visually hidden. When progress reaches 100, its visibility intensity eases from zero to one over 600 ms. It remains visible through stopped, exploded, and reassembly interactions.

The floor uses a charcoal-black base rather than opaque pure black. Its reflection is blurred, low contrast, and mixed conservatively with subtle low-frequency surface variation. The result should resemble the dark studio floor in reference images 5 and 7 without becoming a large flat black silhouette.

The high-speed hairline road belongs only to the approach sequence. It fades away as the car finishes its arrival and does not compete with the final studio floor.

Reduced-motion and low-power fallbacks use the same reveal timing and dark-gray material direction without requiring reflective render targets.

## Direct Car Interaction

The dedicated exploded-view button is removed. After the car stops, pointer interaction is resolved against the actual car meshes with raycasting rather than an approximate screen-center hit area.

- A short press on an assembled car toggles exploded view.
- A short press on an exploded car reassembles it.
- A sustained press on an assembled car enters `carHold`: the car remains stationary, the wheels accelerate, and airflow appears.
- Releasing after a sustained press does not also toggle exploded view.
- Dragging to orbit the camera does not count as a short press or long press.
- Pointer cancellation or leaving the canvas safely ends the hold.

The hold state is separate from the start-button press state. Therefore pressing the start button can never show the car-local airflow, and holding the stopped car can never restart forward motion.

The Three.js interaction container is keyboard-focusable and exposes an accessible name. Enter or Space performs the same exploded/reassembled toggle as a short press, but no visible bottom button is rendered.

## Wheel Motion and Airflow

Wheel motion after arrival is driven only by `carHold`. The existing acceleration and release damping are retained so wheel speed builds and decays naturally.

Airflow paths are rebuilt in the F1 model's local coordinate system and normalized against its measured bounds. Symmetric path families follow the nose, front-wing shoulders, sidepods, cockpit/engine cover, and rear exit. They stay close to the body silhouette before peeling away behind the car. This avoids paths floating above or cutting arbitrarily across the body when the model is scaled or rotated.

Airflow opacity follows the wheel hold intensity. It begins hidden, fades in during a valid stopped-car hold, and decays after release. Reduced-motion mode keeps wheels static and shows only a restrained non-animated airflow highlight while held.

## Exploded-View Floor Safety

Exploded directions are biased outward and upward. No part receives a negative world-space vertical exploded offset.

In addition, final exploded targets receive a floor-clearance guard. The predicted world-space lower bound of every independently movable mesh must remain above the studio floor by a small clearance. Any target that would cross the floor is raised before interpolation. This guard applies during the entire explode/reassemble animation, so delayed parts cannot briefly pass below the floor.

The calculation is based on model/world transforms rather than a hard-coded screen coordinate, preserving the constraint when the car is scaled or rotated.

## Camera Constraints

Orbit controls become available only after the car stops. Their target is aligned to the stopped car rather than an unrelated world origin.

Vertical orbit uses a restricted polar-angle range: the camera may move from a moderately elevated view down toward the horizon but cannot cross beneath the car or floor. Horizontal orbit remains available. Panning stays disabled, and distance limits are tightened around useful showroom framing. Damping remains enabled.

## Failure and Cleanup Behavior

If reflective resources fail, the fallback floor still respects reveal intensity. If airflow allocation fails, holding the car still spins the wheels and produces no runtime error. Pointer-up, pointer-cancel, window blur, component unmount, and model disposal all clear the car-hold state and release pointer capture where applicable.

All new geometries, materials, listeners, timers, and raycasting helpers are disposed or detached with the existing scene cleanup.

## Verification

Automated checks will cover:

- the floor starts hidden and is driven by stopped-state reveal intensity;
- the approach hairline road is not visible in the final studio state;
- airflow receives car-hold intensity rather than start-button press state;
- short press and long press cannot trigger each other;
- the dedicated exploded-view button is absent;
- exploded offsets do not move parts downward and the floor guard is applied;
- orbit controls define bounded polar angles and cannot pan below the floor;
- low-power and failure fallbacks retain safe behavior;
- TypeScript compilation and the existing F1 checks continue to pass.

Browser verification will exercise the complete sequence at desktop and mobile-sized viewports: initial scene, approach, stopped-floor fade, tap explode/reassemble, long-press wheel and airflow response, release decay, and maximum vertical camera drag.
