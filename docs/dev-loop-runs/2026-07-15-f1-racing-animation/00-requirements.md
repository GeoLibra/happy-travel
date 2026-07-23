# Requirements Baseline

## Goal

Make the existing Red Bull F1 car feel as though it is travelling at high speed while remaining centered in the welcome page.

## Non-goals

- Vehicle physics, steering controls, or a complete racetrack.
- Replacing the original GLB or redesigning its materials.
- Aggressive mesh decimation.

## User-visible Behavior

- Four physical wheel nodes rotate during acceleration.
- Road, particles, trails, wheel speed, and restrained body vibration respond to one speed signal.
- At 100% progress the motion settles smoothly and the existing inspection state remains usable.

## Acceptance Criteria

1. Four independently transformable wheel nodes exist in a new GLB.
2. Each pivot rotates only its intended wheel geometry around the local X axle.
3. The welcome page loads the new asset without a material regression.
4. Runtime motion is frame-rate independent and tied to the existing progress.
5. Missing wheel nodes warn and degrade gracefully.
6. TypeScript checking, production build, GLB structure validation, and browser visual checks pass.

## Constraints

- Preserve `public/models/red_bull_f1.glb` unchanged.
- Do not touch the unrelated untracked `output/` directory.
- Resolve scene nodes only once, never traverse the scene per frame.
- Do not commit, push, or open a PR unless explicitly requested.

## Assumptions

- The car stays centered and the environment supplies most apparent translation.
- Speed eases to zero at 100% so the current hologram and orbit-inspection state remains intact.
- Wheel axle is the model-local X axis; measured wheel centers are symmetric and confirm this orientation.

## Open Questions

None.

## Source Request

Add Blender-authored movable wheels and a three.js racing effect to the existing F1 welcome-page model. The user selected the centered-car approach and approved the written design.

## Repo Context

- Base SHA: `b4f137a`
- Branch: `main`
- Existing unrelated dirty state: untracked `output/`
- Design: `docs/superpowers/specs/2026-07-15-f1-wheel-racing-animation-design.md`

