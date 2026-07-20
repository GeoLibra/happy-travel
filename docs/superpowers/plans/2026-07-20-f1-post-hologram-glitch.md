# F1 Post-Hologram Glitch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1.8-second full-canvas digital glitch after the hologram reveal and before the automatic F1 exploded view.

**Architecture:** `WelcomePage` owns an explicit cancellable automatic sequence and passes normalized glitch progress into `ParticleBackground`. A focused Three.js post-process module renders the existing background and car composition into an off-screen target only while active, then composites it through a full-screen glitch shader; inactive frames retain the current direct render path.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, Vite 6, Node assertion scripts, Playwright browser evidence.

## Global Constraints

- Sequence exactly: existing 4.5-second hologram reveal, 100 ms clean hold, 1.8-second glitch, at least one clean direct-render frame, then automatic explode.
- Use three pronounced glitch pulses with horizontal displacement, RGB separation, block noise, scan distortion, and brightness dropouts.
- The post-process affects only the foreground Three.js canvas; ordinary welcome UI remains stable and below the canvas.
- Manual car interaction before or during the glitch cancels the remaining automatic glitch/explode sequence for the current welcome-scene visit.
- Mobile retains the 1.8-second chronology with a lower render-target pixel ratio and lower effect amplitude.
- `prefers-reduced-motion: reduce` retains the chronology but uses low-amplitude brightness/noise flickers without spatial tearing or RGB displacement.
- Do not change the GLB, model URL, model materials, exploded offsets, part ownership, or wheel-node allowlist.
- Preserve foreground-canvas ray-hit ownership and pointer forwarding.
- Complete the focused asset, motion, wheel, airflow, studio, reflection, interaction, model, welcome, desktop, mobile, and full-arrival-timeline checks required by `AGENTS.md`.

---

## File Structure

- Create `src/lib/f1-glitch-sequence.ts`: pure timing constants, phase derivation, and normalized glitch progress.
- Create `src/lib/f1-glitch-postprocess.ts`: Three.js render target, full-screen shader, pulse profile, resize, render, and disposal.
- Modify `src/components/WelcomePage.tsx`: own cancellable automatic glitch/explode timers and pass progress to the canvas.
- Modify `src/components/ParticleBackground.tsx`: accept glitch progress and switch between direct and post-processed rendering.
- Create `scripts/check-f1-glitch-sequence.ts`: deterministic phase and pulse assertions.
- Modify `scripts/check-f1-welcome.ts`: source-contract assertions for cancellation, layering, rendering fallback, resize, and disposal.
- Modify `package.json`: add `check:f1-glitch`.
- Create `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/04-acceptance-report.md`: record commands and desktop/mobile timeline evidence.

### Task 1: Pure Glitch Sequence Contract

**Files:**
- Create: `src/lib/f1-glitch-sequence.ts`
- Create: `scripts/check-f1-glitch-sequence.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `HOLOGRAM_REVEAL_MS`, `GLITCH_CLEAN_HOLD_MS`, `GLITCH_DURATION_MS`, `GLITCH_CLEAN_FRAME_MS`, and `AUTO_EXPLODE_DELAY_MS` numeric constants.
- Produces: `getF1GlitchProgress(elapsedSinceProgressCompleteMs: number): number | null`, where `null` means inactive and an active result is clamped to `[0, 1]`.
- Produces: `getF1GlitchPulse(progress: number): number`, a deterministic three-pulse envelope clamped to `[0, 1]`.

- [ ] **Step 1: Write the failing deterministic sequence check**

Create `scripts/check-f1-glitch-sequence.ts`:

```ts
import assert from 'node:assert/strict';
import {
  AUTO_EXPLODE_DELAY_MS,
  GLITCH_CLEAN_FRAME_MS,
  GLITCH_CLEAN_HOLD_MS,
  GLITCH_DURATION_MS,
  HOLOGRAM_REVEAL_MS,
  getF1GlitchProgress,
  getF1GlitchPulse,
} from '../src/lib/f1-glitch-sequence';

assert.equal(HOLOGRAM_REVEAL_MS, 4500);
assert.equal(GLITCH_CLEAN_HOLD_MS, 100);
assert.equal(GLITCH_DURATION_MS, 1800);
assert(GLITCH_CLEAN_FRAME_MS > 0);
assert.equal(
  AUTO_EXPLODE_DELAY_MS,
  HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + GLITCH_CLEAN_FRAME_MS,
);
assert.equal(getF1GlitchProgress(HOLOGRAM_REVEAL_MS + 99), null);
assert.equal(getF1GlitchProgress(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS), 0);
assert.equal(
  getF1GlitchProgress(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS / 2),
  0.5,
);
assert.equal(
  getF1GlitchProgress(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS),
  null,
);

const samples = Array.from({ length: 101 }, (_, index) => getF1GlitchPulse(index / 100));
const peaks = samples.filter((value, index) => (
  index > 0 && index < samples.length - 1 && value > samples[index - 1] && value >= samples[index + 1] && value > 0.9
));
assert.equal(peaks.length, 3, 'the glitch envelope must contain exactly three pronounced pulses');
assert(samples.every((value) => value >= 0 && value <= 1));
```

- [ ] **Step 2: Register and run the check to verify it fails**

Add to `package.json` scripts:

```json
"check:f1-glitch": "node --import tsx scripts/check-f1-glitch-sequence.ts"
```

Run: `npm run check:f1-glitch`

Expected: FAIL with `Cannot find module '../src/lib/f1-glitch-sequence'`.

- [ ] **Step 3: Implement the pure timing and pulse module**

Create `src/lib/f1-glitch-sequence.ts`:

```ts
export const HOLOGRAM_REVEAL_MS = 4500;
export const GLITCH_CLEAN_HOLD_MS = 100;
export const GLITCH_DURATION_MS = 1800;
export const GLITCH_CLEAN_FRAME_MS = 34;
export const AUTO_EXPLODE_DELAY_MS =
  HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + GLITCH_CLEAN_FRAME_MS;

export function getF1GlitchProgress(elapsedSinceProgressCompleteMs: number): number | null {
  const start = HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS;
  const elapsed = elapsedSinceProgressCompleteMs - start;
  if (elapsed < 0 || elapsed >= GLITCH_DURATION_MS) return null;
  return Math.min(1, Math.max(0, elapsed / GLITCH_DURATION_MS));
}

function triangularPulse(progress: number, center: number, halfWidth: number): number {
  return Math.max(0, 1 - Math.abs(progress - center) / halfWidth);
}

export function getF1GlitchPulse(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.max(
    triangularPulse(clamped, 0.16, 0.08),
    triangularPulse(clamped, 0.50, 0.10),
    triangularPulse(clamped, 0.82, 0.09),
  );
}
```

- [ ] **Step 4: Run the focused check and typecheck**

Run: `npm run check:f1-glitch && npm run lint`

Expected: both commands PASS.

- [ ] **Step 5: Commit the sequence contract**

```bash
git add package.json scripts/check-f1-glitch-sequence.ts src/lib/f1-glitch-sequence.ts
git commit -m "test: define F1 glitch sequence contract"
```

### Task 2: Cancellable Welcome Sequence

**Files:**
- Modify: `src/components/WelcomePage.tsx:46-155`
- Modify: `scripts/check-f1-welcome.ts:45-190`

**Interfaces:**
- Consumes: `AUTO_EXPLODE_DELAY_MS`, `GLITCH_CLEAN_HOLD_MS`, `GLITCH_DURATION_MS`, `HOLOGRAM_REVEAL_MS` from `src/lib/f1-glitch-sequence.ts`.
- Produces: `glitchProgress: number | null` passed to `ParticleBackground`.
- Produces: one `cancelAutomaticShowroomSequence()` callback used by every accepted manual car interaction.

- [ ] **Step 1: Extend the welcome source-contract checks**

Add assertions to `scripts/check-f1-welcome.ts` that require:

```ts
assert.match(source, /const \[glitchProgress, setGlitchProgress\] = useState<number \| null>\(null\)/);
assert.match(source, /const glitchFrameRef = React\.useRef<number \| null>\(null\)/);
assert.match(source, /cancelAutomaticShowroomSequence/);
assert.match(source, /cancelAnimationFrame\(glitchFrameRef\.current\)/);
assert.match(source, /glitchProgress=\{glitchProgress\}/);
assert.match(source, /setIsCarExploded\(true\)/);
assert.match(source, /AUTO_EXPLODE_DELAY_MS/);
```

Replace the old `AUTO_EXPLODE_DELAY_MS = 4600` fake-scheduler assumption with the imported sequence constants, and assert no explosion at the end of hologram or glitch, followed by explosion only after `GLITCH_CLEAN_FRAME_MS`.

- [ ] **Step 2: Run the welcome check to verify it fails**

Run: `npm run check:f1-welcome`

Expected: FAIL because `WelcomePage` has no `glitchProgress` state or animation-frame driver.

- [ ] **Step 3: Implement one cancellable automatic sequence**

In `WelcomePage.tsx`, import the sequence constants and `getF1GlitchProgress`, then replace `HOLOGRAM_REVEAL_MS = 4600` with:

```ts
const [glitchProgress, setGlitchProgress] = useState<number | null>(null);
const glitchFrameRef = React.useRef<number | null>(null);
const sequenceStartedAtRef = React.useRef<number | null>(null);

const cancelAutomaticShowroomSequence = useCallback(() => {
  if (autoExplodeTimerRef.current) {
    clearTimeout(autoExplodeTimerRef.current);
    autoExplodeTimerRef.current = null;
  }
  if (glitchFrameRef.current !== null) {
    cancelAnimationFrame(glitchFrameRef.current);
    glitchFrameRef.current = null;
  }
  sequenceStartedAtRef.current = null;
  setGlitchProgress(null);
}, []);
```

Have `handleCarManualInteraction` call `markF1ManualInteraction(...)` and then `cancelAutomaticShowroomSequence()`. Start the sequence only when progress reaches 100 and no manual/entry transition exists:

```ts
sequenceStartedAtRef.current = performance.now();
const updateGlitch = (now: number) => {
  const startedAt = sequenceStartedAtRef.current;
  if (startedAt === null) return;
  setGlitchProgress(getF1GlitchProgress(now - startedAt));
  if (now - startedAt < AUTO_EXPLODE_DELAY_MS) {
    glitchFrameRef.current = requestAnimationFrame(updateGlitch);
  }
};
glitchFrameRef.current = requestAnimationFrame(updateGlitch);
autoExplodeTimerRef.current = setTimeout(() => {
  autoExplodeTimerRef.current = null;
  glitchFrameRef.current = null;
  sequenceStartedAtRef.current = null;
  setGlitchProgress(null);
  setIsCarExploded(true);
}, AUTO_EXPLODE_DELAY_MS);
```

Call `cancelAutomaticShowroomSequence()` during unmount and before the entry reassembly path. Pass `glitchProgress={glitchProgress}` to `ParticleBackground`.

- [ ] **Step 4: Run focused interaction and timing checks**

Run: `npm run check:f1-glitch && npm run check:f1-welcome && npm run check:f1-showroom-interaction && npm run lint`

Expected: all commands PASS; the welcome check proves cancellation before and during the 1.8-second window.

- [ ] **Step 5: Commit sequence ownership**

```bash
git add src/components/WelcomePage.tsx scripts/check-f1-welcome.ts
git commit -m "feat: sequence F1 glitch before auto explode"
```

### Task 3: Scoped Three.js Glitch Post-Process

**Files:**
- Create: `src/lib/f1-glitch-postprocess.ts`
- Modify: `src/components/ParticleBackground.tsx:32-70,120-160,840-910`
- Modify: `scripts/check-f1-welcome.ts:1-120`

**Interfaces:**
- Consumes: `glitchProgress?: number | null` from `WelcomePage`.
- Consumes: `getF1GlitchPulse(progress: number): number`.
- Produces: `createF1GlitchPostProcess(renderer, width, height, pixelRatio, profile)` returning `{ render(input), resize(width, height, pixelRatio), dispose() }`.
- `render(input)` consumes `{ progress, renderSource }`; `renderSource(target)` renders the existing background/reflection/car composition into the supplied `THREE.WebGLRenderTarget`.

- [ ] **Step 1: Add rendering lifecycle source checks**

Extend `scripts/check-f1-welcome.ts` to load `src/lib/f1-glitch-postprocess.ts` and assert:

```ts
assert.match(particleSource, /glitchProgress\?: number \| null/);
assert.match(particleSource, /createF1GlitchPostProcess/);
assert.match(particleSource, /glitchPostProcess\.render/);
assert.match(particleSource, /glitchPostProcess\.resize/);
assert.match(particleSource, /glitchPostProcess\.dispose\(\)/);
assert.match(glitchPostSource, /new THREE\.WebGLRenderTarget/);
assert.match(glitchPostSource, /getF1GlitchPulse/);
assert.match(glitchPostSource, /prefersReducedMotion/);
assert.match(glitchPostSource, /mobile/);
assert.match(glitchPostSource, /renderer\.setRenderTarget\(null\)/);
```

- [ ] **Step 2: Run the welcome check to verify it fails**

Run: `npm run check:f1-welcome`

Expected: FAIL because the post-process module does not exist.

- [ ] **Step 3: Implement the focused post-process resource**

Create `src/lib/f1-glitch-postprocess.ts` with:

```ts
import * as THREE from 'three';
import { getF1GlitchPulse } from './f1-glitch-sequence';

export interface F1GlitchProfile {
  mobile: boolean;
  prefersReducedMotion: boolean;
}

export interface F1GlitchRenderInput {
  progress: number;
  renderSource: (target: THREE.WebGLRenderTarget) => void;
}

export function createF1GlitchPostProcess(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  pixelRatio: number,
  profile: F1GlitchProfile,
) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    colorSpace: THREE.SRGBColorSpace,
  });
  const uniforms = {
    uTexture: { value: target.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uProgress: { value: 0 },
    uPulse: { value: 0 },
    uAmplitude: { value: profile.mobile ? 0.65 : 1 },
    uReducedMotion: { value: profile.prefersReducedMotion ? 1 : 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform float uProgress;
      uniform float uPulse;
      uniform float uAmplitude;
      uniform float uReducedMotion;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        float band=floor(vUv.y*42.0);
        float noise=hash(vec2(band,floor(uProgress*90.0)));
        float spatial=1.0-uReducedMotion;
        float shift=(noise-0.5)*0.055*uPulse*uAmplitude*spatial;
        vec2 uv=vUv+vec2(shift,0.0);
        float split=0.012*uPulse*uAmplitude*spatial;
        vec4 base=texture2D(uTexture,uv);
        vec4 color=vec4(texture2D(uTexture,uv+vec2(split,0.0)).r,base.g,texture2D(uTexture,uv-vec2(split,0.0)).b,base.a);
        float scan=step(0.94,hash(vec2(floor(vUv.y*uResolution.y/3.0),floor(uProgress*120.0))));
        color.rgb*=1.0-(0.22*uPulse+0.08*scan)*uAmplitude;
        gl_FragColor=color;
      }
    `,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const resize = (nextWidth: number, nextHeight: number, nextPixelRatio: number) => {
    const ratio = profile.mobile ? Math.min(nextPixelRatio, 1) : Math.min(nextPixelRatio, 2);
    const renderWidth = Math.max(1, Math.floor(nextWidth * ratio));
    const renderHeight = Math.max(1, Math.floor(nextHeight * ratio));
    target.setSize(renderWidth, renderHeight);
    uniforms.uResolution.value.set(renderWidth, renderHeight);
  };
  resize(width, height, pixelRatio);

  return {
    render({ progress, renderSource }: F1GlitchRenderInput) {
      renderSource(target);
      uniforms.uProgress.value = progress;
      uniforms.uPulse.value = getF1GlitchPulse(progress);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}
```

- [ ] **Step 4: Integrate active/inactive render paths**

In `ParticleBackground`, add `glitchProgress?: number | null` to props and state mirroring. Create one `glitchPostProcess` after reduced-motion/mobile detection. Extract the current dual-pass block into:

```ts
const renderShowroom = (target: THREE.WebGLRenderTarget | null) => {
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(bgScene, bgCamera);
  const previousAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  reflection.render();
  renderer.autoClear = previousAutoClear;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
};
```

Then select the path per frame:

```ts
const activeGlitchProgress = stateRef.current.glitchProgress;
if (activeGlitchProgress === null || activeGlitchProgress === undefined) {
  renderShowroom(null);
} else {
  glitchPostProcess.render({ progress: activeGlitchProgress, renderSource: renderShowroom });
}
```

Call `glitchPostProcess.resize(...)` in `handleResize` and `glitchPostProcess.dispose()` before `renderer.dispose()` in cleanup. If initialization throws, retain a nullable resource and render directly for the full phase while `WelcomePage` timing continues; log one `[F1 glitch] Post-process unavailable` warning.

- [ ] **Step 5: Run focused rendering and invariant checks**

Run:

```bash
npm run check:f1-glitch
npm run check:f1-welcome
npm run check:showroom-resources
npm run check:f1-motion
npm run check:f1-wheel-hold
npm run check:f1-airflow
npm run check:f1-studio
npm run check:f1-reflection
npm run check:f1-showroom-interaction
npm run check:f1-model
npm run check:showroom-assets
npm run check:f1-showroom-v5
npm run lint
npm run build
```

Expected: every command PASS. Asset checks retain the v5 model and the exact four runtime wheel nodes.

- [ ] **Step 6: Commit the renderer integration**

```bash
git add src/lib/f1-glitch-postprocess.ts src/components/ParticleBackground.tsx scripts/check-f1-welcome.ts
git commit -m "feat: render post-hologram F1 signal glitch"
```

### Task 4: Desktop and Mobile Arrival Evidence

**Files:**
- Create: `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/04-acceptance-report.md`

**Interfaces:**
- Consumes: the completed welcome sequence in the built application.
- Produces: complete desktop/mobile timeline evidence and an acceptance report linked to captured artifacts.

- [ ] **Step 1: Start the app and record the complete desktop timeline**

Run: `npm run dev -- --host 127.0.0.1`

Use Playwright at a 1440×900 viewport. Hold the start interaction through 100%, then capture video or timestamped screenshots showing: stopped hologram start, hologram completion, 100 ms clean hold, each of the three glitch pulses, clean recovery, initial explosion, settled explosion, manual reassembly, and settled reassembly.

Expected: welcome UI remains visually stable; the canvas alone tears; the car returns cleanly before parts move; every exploded and reassembling part remains above the floor.

- [ ] **Step 2: Record the complete mobile and reduced-motion timelines**

Repeat at 390×844 with touch input. Then emulate `prefers-reduced-motion: reduce` and repeat the glitch interval.

Expected: mobile uses reduced spatial amplitude and reduced render resolution without black frames; reduced motion shows brightness/noise flickers without RGB separation or spatial tearing; pointer forwarding and car ray-hit ownership remain operable.

- [ ] **Step 3: Write the acceptance report**

Create `docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/04-acceptance-report.md` containing:

```markdown
# F1 Post-Hologram Glitch Acceptance Report

## Automated checks

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

## Browser evidence

List each desktop, mobile, and reduced-motion artifact with its viewport, capture time, and the sequence phases visible in it. Record explicit observations for canvas-only distortion, three pulses, clean recovery before explosion, floor clearance, semantic body grouping, interaction forwarding, and absence of black frames.
```

- [ ] **Step 4: Commit verified evidence**

```bash
git add docs/dev-loop-runs/2026-07-20-f1-post-hologram-glitch/04-acceptance-report.md
git commit -m "docs: verify F1 post-hologram glitch timeline"
```

### Task 5: Final Regression and Review

**Files:**
- Modify only files needed to correct regressions found by this task.

**Interfaces:**
- Consumes: all prior task deliverables.
- Produces: a clean, review-ready branch with no unexplained worktree changes.

- [ ] **Step 1: Re-run the complete focused suite in one command**

Run:

```bash
npm run check:f1-glitch && npm run check:f1-welcome && npm run check:showroom-resources && npm run check:f1-motion && npm run check:f1-wheel-hold && npm run check:f1-airflow && npm run check:f1-studio && npm run check:f1-reflection && npm run check:f1-showroom-interaction && npm run check:f1-model && npm run check:showroom-assets && npm run check:f1-showroom-v5 && npm run lint && npm run build
```

Expected: command exits 0 with all checks passing.

- [ ] **Step 2: Inspect the final diff and repository state**

Run: `git diff --check && git status --short && git log -5 --oneline`

Expected: no whitespace errors, no unexpected generated files, and commits limited to the approved design, sequence contract, renderer integration, and verification evidence.

- [ ] **Step 3: Commit any review-only correction**

If the final review required a correction, stage only the affected files and run:

```bash
git commit -m "fix: address F1 glitch verification findings"
```

If no correction was required, do not create an empty commit.
