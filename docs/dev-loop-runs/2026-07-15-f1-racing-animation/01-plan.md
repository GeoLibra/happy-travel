# Implementation Plan

Canonical plan: `docs/superpowers/plans/2026-07-15-f1-wheel-racing-animation.md`

Execution order:

1. Build and verify a reproducible Blender wheel extraction/export script.
2. Build and verify the pure TypeScript racing-motion state.
3. Integrate the named wheel contract and shared speed signal into `ParticleBackground`.
4. Run Blender, command-line, desktop browser, and mobile browser acceptance.

The Blender asset contract precedes runtime work. The pure motion module can be verified independently, but implementation remains serial to avoid an unreviewed node/axis assumption leaking into the render loop.

