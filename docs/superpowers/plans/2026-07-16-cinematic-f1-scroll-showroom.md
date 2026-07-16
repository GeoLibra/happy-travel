# Cinematic F1 Scroll Showroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic, scroll-driven F1 showroom that retains long-press ignition, upgrades the car's physical lighting and materials, devotes 80% of the story to racing performance, and morphs into the Shanghai itinerary before an explicit final handoff.

**Architecture:** Keep React responsible for lifecycle, accessible UI, and chapter copy while a fixed Three.js canvas owns rendering. Pure story, quality, route, camera, and audio functions feed stable refs consumed by one animation loop; focused asset, material, effect, audio, and transition modules replace the current monolithic `ParticleBackground` responsibilities.

**Tech Stack:** React 19, TypeScript 5.8, Three.js 0.183, Motion 12, Vite 6, Tailwind CSS 4, LocalForage, glTF Transform CLI, Node/TSX assertion scripts, browser-based visual verification.

## Global Constraints

- Preserve the existing 2.5-second long-press ignition and the release contract: release before 30% resets; release at or after 30% completes automatically.
- Completing ignition unlocks the showroom scroll; it does not enter the itinerary.
- Preserve the confirmed chapter weighting: roughly 80% racing performance and 20% Shanghai weekend.
- Use five post-ignition chapters: Material, Aero, Power, Circuit, Weekend.
- Require an explicit `ENTER WEEKEND` action and a 700 ms transition before `onEnter` fires exactly once.
- Do not copy the reference site's code, model, textures, audio, or proprietary assets.
- The current GLB has one baked material; implement reliable body-versus-wheel PBR roles and preserve baked carbon/glass detail. Do not guess transparency masks.
- Use ACES Filmic tone mapping, sRGB output, luminance-selective bloom, restrained vignette, and subtle grain.
- High tier: DPR cap `1.75`; Balanced: `1.25`; Essential: `1.0`.
- High steps down after 120 frames averaging over 22 ms; Balanced steps down after 120 frames averaging over 38 ms; quality never steps up mid-sequence.
- WebGL context antialiasing is selected only at renderer construction. Runtime step-down reduces DPR, post scale, bloom, airflow count, and reflection cost without rebuilding the context.
- Compress the showroom car to at most 15 MB without changing four wheel node names or pivots.
- Remove the 27 MB rose model from the critical welcome preload.
- No per-frame React updates, scene traversal, or unbounded allocations.
- Preserve all unrelated worktree changes. Never stage `.superpowers/` visual-companion files.
- Each task ends in one focused commit after its own checks pass.

## Execution Order

Implement strictly by numeric task ID: **Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12**. The task sections are self-contained and searchable by their numbered headings; do not follow their physical position in this document.

## File Structure

### New runtime files

- `src/lib/showroom-story.ts` — ignition and chapter progress state.
- `src/lib/showroom-quality.ts` — initial tier selection and frame-budget step-down.
- `src/lib/showroom-route.ts` — equal-point path resampling and morph interpolation.
- `src/lib/showroom-director.ts` — pure mapping from story state to camera/effect/audio frame.
- `src/components/showroom/showroom-assets.ts` — asset manifest and progress contracts.
- `src/components/showroom/asset-manager.ts` — car and HDR lifecycle.
- `src/components/showroom/vehicle-profile.ts` — stable body and wheel node contract.
- `src/components/showroom/material-system.ts` — physical material clones and hologram reveal.
- `src/components/showroom/route-line.ts` — preallocated route morph geometry.
- `src/components/showroom/airflow.ts` — preallocated airflow line geometry.
- `src/components/showroom/audio-engine.ts` — gesture-started engine audio.
- `src/components/showroom/showroom-renderer.ts` — renderer, cameras, lights, post-processing, quality changes, disposal.
- `src/components/showroom/CinematicCanvas.tsx` — React mount boundary for the renderer.
- `src/components/showroom/ShowroomOverlay.tsx` — DOM chapter copy and accessible controls.
- `src/components/showroom/useIgnition.ts` — pointer, touch, and keyboard ignition hook.
- `src/components/showroom/showroom.css` — fixed-canvas, scroll, responsive, reduced-motion styling.

### Modified runtime files

- `src/components/WelcomePage.tsx` — compose showroom UI and remove rose preload.
- `src/lib/model-loader.ts` — support Meshopt-compressed GLB and cancellation.
- `src/App.tsx` — separate motion permission from final entry handoff.
- `src/i18n.tsx` — localize showroom copy and status.
- `src/index.css` — import showroom styles and preserve global behavior.
- `package.json`, `package-lock.json` — checks and glTF Transform dev dependency.

### New assets and checks

- `public/models/red_bull_f1_showroom.glb`
- `public/environments/ferndale_studio_09_1k.hdr`
- `public/environments/rooftop_night_1k.hdr`
- `scripts/check-showroom-story.ts`
- `scripts/check-showroom-quality.ts`
- `scripts/check-showroom-route.ts`
- `scripts/check-showroom-director.ts`
- `scripts/check-showroom-audio.ts`
- `scripts/check-showroom-assets.mjs`

---

### Task 9: Gesture-started engine audio

**Files:**
- Create: `src/components/showroom/audio-engine.ts`
- Create: `scripts/check-showroom-audio.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ShowroomFrame.audio` from Task 7.
- Produces: `getAudioTarget()`, `ShowroomAudioEngine.start()`, `update()`, `dispose()`.
- Consumers: `WelcomePage` for gesture start and `ShowroomRenderer` frame callback.

- [ ] **Step 1: Add the failing audio mapping check**

Create `scripts/check-showroom-audio.ts`:

```ts
import assert from 'node:assert/strict';
import { getAudioTarget } from '../src/components/showroom/audio-engine';

assert.deepEqual(getAudioTarget(0, 0.85), { volume: 0, playbackRate: 0.85 });
assert.deepEqual(getAudioTarget(1, 1.3), { volume: 0.55, playbackRate: 1.3 });
assert.deepEqual(getAudioTarget(2, 3), { volume: 0.55, playbackRate: 1.4 });
console.log('PASS: showroom audio targets are clamped');
```

Add:

```json
"check:showroom-audio": "tsx scripts/check-showroom-audio.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-audio`

Expected: FAIL with missing `audio-engine`.

- [ ] **Step 3: Implement the audio engine**

Create `src/components/showroom/audio-engine.ts`:

```ts
import engineUrl from '../../audio/f1-engine.mp3';

export function getAudioTarget(energy: number, pitch: number) {
  const clampedEnergy = Math.min(1, Math.max(0, energy));
  return {
    volume: clampedEnergy * 0.55,
    playbackRate: Math.min(1.4, Math.max(0.7, pitch)),
  };
}

export class ShowroomAudioEngine {
  private readonly audio = new Audio(engineUrl);
  private started = false;

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = 0;
  }

  async start() {
    if (this.started) return true;
    try {
      await this.audio.play();
      this.started = true;
      return true;
    } catch (error) {
      console.warn('[Showroom] Audio unavailable:', error);
      return false;
    }
  }

  update(energy: number, pitch: number, deltaSeconds: number) {
    if (!this.started) return;
    const target = getAudioTarget(energy, pitch);
    const mix = 1 - Math.exp(-6 * Math.min(0.1, Math.max(0, deltaSeconds)));
    this.audio.volume += (target.volume - this.audio.volume) * mix;
    this.audio.playbackRate += (target.playbackRate - this.audio.playbackRate) * mix;
  }

  dispose() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.started = false;
  }
}
```

- [ ] **Step 4: Run checks and commit**

Run:

```bash
npm run check:showroom-audio
npm run lint
```

Expected: PASS and exit `0`.

Commit:

```bash
git add package.json scripts/check-showroom-audio.ts src/components/showroom/audio-engine.ts
git commit -m "feat: add showroom audio engine"
```

---

### Task 10: Cinematic renderer, lighting, floor, and post-processing

**Files:**
- Create: `src/components/showroom/renderer-config.ts`
- Create: `src/components/showroom/showroom-renderer.ts`
- Create: `src/components/showroom/CinematicCanvas.tsx`
- Create: `scripts/check-showroom-renderer-config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1–9 runtime interfaces and `LoadedShowroomAssets`.
- Produces: `getRendererConfig()`, `ShowroomRenderer`, and `CinematicCanvas`.
- Consumers: `WelcomePage` in Task 11.

- [ ] **Step 1: Add the failing renderer-config check**

Create `scripts/check-showroom-renderer-config.ts`:

```ts
import assert from 'node:assert/strict';
import { getRendererConfig } from '../src/components/showroom/renderer-config';

assert.deepEqual(getRendererConfig('high'), {
  dpr: 1.75, antialias: true, reflection: true,
  airflowLines: 64, bloomStrength: 0.55, postScale: 1,
});
assert.deepEqual(getRendererConfig('balanced'), {
  dpr: 1.25, antialias: true, reflection: false,
  airflowLines: 32, bloomStrength: 0.32, postScale: 0.75,
});
assert.deepEqual(getRendererConfig('essential'), {
  dpr: 1, antialias: false, reflection: false,
  airflowLines: 0, bloomStrength: 0, postScale: 0.5,
});
console.log('PASS: showroom renderer configs');
```

Add:

```json
"check:showroom-renderer-config": "tsx scripts/check-showroom-renderer-config.ts"
```

- [ ] **Step 2: Run the config check and verify it fails**

Run: `npm run check:showroom-renderer-config`

Expected: FAIL with missing `renderer-config`.

- [ ] **Step 3: Implement exact tier configs**

Create `src/components/showroom/renderer-config.ts`:

```ts
import type { QualityTier } from '../../lib/showroom-quality';

export interface ShowroomRendererConfig {
  dpr: number;
  antialias: boolean;
  reflection: boolean;
  airflowLines: number;
  bloomStrength: number;
  postScale: number;
}

export const getRendererConfig = (tier: QualityTier): ShowroomRendererConfig => ({
  high: {
    dpr: 1.75, antialias: true, reflection: true,
    airflowLines: 64, bloomStrength: 0.55, postScale: 1,
  },
  balanced: {
    dpr: 1.25, antialias: true, reflection: false,
    airflowLines: 32, bloomStrength: 0.32, postScale: 0.75,
  },
  essential: {
    dpr: 1, antialias: false, reflection: false,
    airflowLines: 0, bloomStrength: 0, postScale: 0.5,
  },
}[tier]);
```

- [ ] **Step 4: Implement the renderer**

Create `src/components/showroom/showroom-renderer.ts` with the following complete class structure. Keep the helper methods private and use the exact ownership shown so every resource is disposed once:

```ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { getShowroomFrame, type ShowroomFrame } from '../../lib/showroom-director';
import { stepStorySignal, type StorySignal } from '../../lib/showroom-story';
import {
  stepFrameBudget,
  type FrameBudgetState,
  type QualityTier,
} from '../../lib/showroom-quality';
import { stepF1Motion, type F1MotionState } from '../../lib/f1-motion';
import type { LoadedShowroomAssets } from './asset-manager';
import { AirflowEffect } from './airflow';
import { ShowroomAudioEngine } from './audio-engine';
import { ShowroomMaterialSystem } from './material-system';
import { getRendererConfig } from './renderer-config';
import { RouteLineEffect } from './route-line';
import { resolveVehicleRoles } from './vehicle-profile';

const grainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uTime)*43758.5453);}
    void main(){
      vec2 centered=vUv-0.5;
      float vignette=smoothstep(0.82,0.25,length(centered));
      vec4 color=texture2D(tDiffuse,vUv);
      color.rgb*=mix(0.82,1.0,vignette);
      color.rgb+=(hash(gl_FragCoord.xy)-0.5)*0.018;
      gl_FragColor=color;
    }
  `,
};

export interface ShowroomRenderInput {
  progress: number;
  pointerX: number;
  pointerY: number;
}

export class ShowroomRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grain: ShaderPass;
  private readonly car: THREE.Group;
  private readonly materials: ShowroomMaterialSystem;
  private readonly airflow: AirflowEffect;
  private readonly route = new RouteLineEffect(128);
  private readonly audio = new ShowroomAudioEngine();
  private readonly roles: ReturnType<typeof resolveVehicleRoles>;
  private readonly fallbackFloor: THREE.Mesh;
  private readonly reflectionFloor: Reflector | null;
  private readonly brakeGlows: THREE.Sprite[];
  private readonly studioEnvironment: THREE.Texture | null;
  private readonly nightEnvironment: THREE.Texture | null;
  private readonly story: StorySignal = { progress: 0, velocity: 0 };
  private readonly motion: F1MotionState = { speed: 0, wheelAngle: 0 };
  private readonly frameBudget: FrameBudgetState;
  private frameId = 0;
  private previousTime = 0;
  private activeChapter = -1;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    assets: LoadedShowroomAssets,
    tier: QualityTier,
  ) {
    if (!assets.car) throw new Error('ShowroomRenderer requires a car model');
    const config = getRendererConfig(tier);
    this.frameBudget = { tier, overBudgetFrames: 0, averageMs: 0 };
    this.renderer = new THREE.WebGLRenderer({
      antialias: config.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.76;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.dpr));
    this.container.appendChild(this.renderer.domElement);

    this.car = assets.car;
    this.roles = resolveVehicleRoles(this.car);
    this.materials = new ShowroomMaterialSystem(this.car);
    this.brakeGlows = this.createBrakeGlows();
    this.scene.add(this.car);
    this.airflow = new AirflowEffect(config.airflowLines || 1, 28);
    this.airflow.visible = config.airflowLines > 0;
    this.scene.add(this.airflow, this.route);

    RectAreaLightUniformsLib.init();
    this.scene.add(new THREE.HemisphereLight(0x8ab9dc, 0x030406, 0.24));
    const softbox = new THREE.RectAreaLight(0xffffff, 7, 8, 2.5);
    softbox.position.set(0, 6, 2);
    softbox.lookAt(0, 0, 0);
    this.scene.add(softbox);
    const rim = new THREE.DirectionalLight(0x2fbfff, 2.2);
    rim.position.set(-5, 2, -4);
    this.scene.add(rim);
    const redRim = new THREE.DirectionalLight(0xe10600, 1.7);
    redRim.position.set(5, 1, -3);
    this.scene.add(redRim);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.studioEnvironment = assets.studioHdr
      ? pmrem.fromEquirectangular(assets.studioHdr).texture
      : null;
    this.nightEnvironment = assets.nightHdr
      ? pmrem.fromEquirectangular(assets.nightHdr).texture
      : null;
    pmrem.dispose();
    this.scene.environment = this.studioEnvironment;
    this.fallbackFloor = this.createFallbackFloor();
    this.fallbackFloor.visible = !config.reflection;
    this.scene.add(this.fallbackFloor);
    this.reflectionFloor = config.reflection ? this.createReflectionFloor() : null;
    if (this.reflectionFloor) this.scene.add(this.reflectionFloor);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(config.postScale);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), config.bloomStrength, 0.35, 1.05);
    this.composer.addPass(this.bloom);
    this.grain = new ShaderPass(grainShader);
    this.composer.addPass(this.grain);
    this.resize();
  }

  private createFallbackFloor() {
    const geometry = new THREE.PlaneGeometry(40, 40);
    const floor = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({ color: 0x07090d, roughness: 0.72, metalness: 0.18 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.55;
    return floor;
  }

  private createReflectionFloor() {
    const reflector = new Reflector(new THREE.PlaneGeometry(40, 40), {
      color: 0x090b10,
      textureWidth: Math.floor(window.innerWidth * 0.5),
      textureHeight: Math.floor(window.innerHeight * 0.5),
      clipBias: 0.003,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -1.55;
    return reflector;
  }

  private createBrakeGlows() {
    return this.roles.wheels.map((wheel) => {
      const material = new THREE.SpriteMaterial({
        color: 0xff2a12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      });
      const glow = new THREE.Sprite(material);
      glow.scale.setScalar(0.52);
      wheel.add(glow);
      return glow;
    });
  }

  start(
    readInput: () => ShowroomRenderInput,
    onChapterChange: (frame: ShowroomFrame) => void,
  ) {
    const animate = (timeMs: number) => {
      if (this.disposed) return;
      this.frameId = requestAnimationFrame(animate);
      const delta = this.previousTime === 0 ? 0 : Math.min(0.1, (timeMs - this.previousTime) / 1000);
      this.previousTime = timeMs;
      if (document.hidden) return;
      const input = readInput();
      stepStorySignal(this.story, input.progress, delta);
      const frame = getShowroomFrame(this.story.progress, this.story.velocity);
      this.applyFrame(frame, input, timeMs / 1000, delta);
      if (frame.chapter.index !== this.activeChapter) {
        this.activeChapter = frame.chapter.index;
        onChapterChange(frame);
      }
      this.grain.uniforms.uTime.value = timeMs / 1000;
      this.composer.render(delta);
      const previousTier = this.frameBudget.tier;
      stepFrameBudget(this.frameBudget, delta * 1000);
      if (previousTier !== this.frameBudget.tier) this.applyTier(this.frameBudget.tier);
    };
    this.frameId = requestAnimationFrame(animate);
  }

  private applyFrame(
    frame: ShowroomFrame,
    input: ShowroomRenderInput,
    time: number,
    delta: number,
  ) {
    this.camera.position.set(
      frame.camera.x + input.pointerX * 0.28,
      frame.camera.y + input.pointerY * 0.18,
      frame.camera.z,
    );
    this.camera.lookAt(frame.camera.targetX, frame.camera.targetY, frame.camera.targetZ);
    this.car.position.set(frame.car.x, frame.car.y, frame.car.z);
    this.car.rotation.y = frame.car.rotationY;
    this.car.scale.setScalar(frame.car.scale);
    this.materials.setReveal(frame.effects.reveal);
    this.materials.updateTime(time);
    this.airflow.update(time, frame.effects.airflow);
    this.route.update(frame.effects.circuitMorph, frame.effects.weekendMorph);
    this.renderer.toneMappingExposure = frame.exposure;
    this.scene.environment = frame.chapter.index >= 3
      ? this.nightEnvironment ?? this.studioEnvironment
      : this.studioEnvironment;
    stepF1Motion(this.motion, frame.audio.energy, delta);
    for (const wheel of this.roles.wheels) wheel.rotation.x = this.motion.wheelAngle;
    for (const glow of this.brakeGlows) {
      (glow.material as THREE.SpriteMaterial).opacity = frame.effects.brakeHeat * 0.65;
    }
    this.audio.update(frame.audio.energy, frame.audio.pitch, delta);
  }

  private applyTier(tier: QualityTier) {
    const config = getRendererConfig(tier);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.dpr));
    this.composer.setPixelRatio(config.postScale);
    this.bloom.strength = config.bloomStrength;
    this.airflow.visible = config.airflowLines > 0;
    this.airflow.setLineCount(config.airflowLines);
    this.fallbackFloor.visible = !config.reflection;
    if (this.reflectionFloor) this.reflectionFloor.visible = config.reflection;
    this.resize();
  }

  async startAudio() { return this.audio.start(); }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.audio.dispose();
    this.materials.dispose();
    this.airflow.dispose();
    this.route.dispose();
    this.brakeGlows.forEach((glow) => (glow.material as THREE.SpriteMaterial).dispose());
    this.studioEnvironment?.dispose();
    this.nightEnvironment?.dispose();
    this.bloom.dispose();
    this.grain.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.reflectionFloor?.getRenderTarget().dispose();
    this.reflectionFloor?.geometry.dispose();
    this.fallbackFloor.geometry.dispose();
    (this.fallbackFloor.material as THREE.Material).dispose();
    this.renderer.domElement.remove();
  }
}
```

- [ ] **Step 5: Add the React canvas mount boundary**

Create `src/components/showroom/CinematicCanvas.tsx`:

```tsx
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import type { ShowroomFrame } from '../../lib/showroom-director';
import type { QualityTier } from '../../lib/showroom-quality';
import type { LoadedShowroomAssets } from './asset-manager';
import { ShowroomRenderer, type ShowroomRenderInput } from './showroom-renderer';

interface Props {
  assets: LoadedShowroomAssets;
  quality: QualityTier;
  inputRef: RefObject<ShowroomRenderInput>;
  onChapterChange: (frame: ShowroomFrame) => void;
  onFailure: (error: unknown) => void;
  rendererRef: MutableRefObject<ShowroomRenderer | null>;
}

export default function CinematicCanvas({
  assets, quality, inputRef, onChapterChange, onFailure, rendererRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current || !assets.car) return;
    let renderer: ShowroomRenderer;
    try {
      renderer = new ShowroomRenderer(containerRef.current, assets, quality);
    } catch (error) {
      onFailure(error);
      return;
    }
    rendererRef.current = renderer;
    renderer.start(
      () => inputRef.current ?? { progress: 0, pointerX: 0, pointerY: 0 },
      onChapterChange,
    );
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      rendererRef.current = null;
      renderer.dispose();
    };
  }, [assets, inputRef, onChapterChange, onFailure, quality, rendererRef]);
  return <div ref={containerRef} className="showroom-canvas" aria-hidden="true" />;
}
```

- [ ] **Step 6: Run focused checks and build**

Run:

```bash
npm run check:showroom-renderer-config
npm run check:showroom-effects
npm run check:showroom-materials
npm run check:showroom-director
npm run lint
npm run build
```

Expected: all exit `0`.

- [ ] **Step 7: Commit the renderer**

```bash
git add package.json scripts/check-showroom-renderer-config.ts src/components/showroom/renderer-config.ts src/components/showroom/showroom-renderer.ts src/components/showroom/CinematicCanvas.tsx
git commit -m "feat: add cinematic showroom renderer"
```

---

### Task 11: Accessible scroll showroom UI and App handoff

**Files:**
- Create: `src/components/showroom/useIgnition.ts`
- Create: `src/components/showroom/ShowroomOverlay.tsx`
- Create: `src/components/showroom/showroom.css`
- Replace: `src/components/WelcomePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n.tsx`
- Modify: `src/index.css`
- Delete after replacement: `src/components/ParticleBackground.tsx`

**Interfaces:**
- Consumes: `ShowroomAssetManager`, `CinematicCanvas`, story/quality types, `requestMotionPermission`, and `onEnter`.
- Produces: final `WelcomePage` behavior, DOM fallback, localized controls, and one-shot 700 ms handoff.

- [ ] **Step 1: Extend the i18n check before adding keys**

In `scripts/check-i18n.ts`, add:

```ts
for (const key of [
  'showroom.ignition',
  'showroom.skip',
  'showroom.enter',
  'showroom.chapter.material',
  'showroom.chapter.aero',
  'showroom.chapter.power',
  'showroom.chapter.circuit',
  'showroom.chapter.weekend',
] as const) {
  assert.ok(translate('zh', key).length > 0, `Missing zh key: ${key}`);
  assert.ok(translate('en', key).length > 0, `Missing en key: ${key}`);
}
```

Run: `npm run check:i18n`

Expected: TypeScript/runtime failure because the new showroom keys are absent.

- [ ] **Step 2: Add localized showroom copy**

Add these keys to both message objects in `src/i18n.tsx`:

```ts
// zh
'showroom.ignition': '长按点火',
'showroom.loading': '赛车系统准备中',
'showroom.skip': '跳过展厅',
'showroom.enter': '进入周末行程',
'showroom.muted': '声音已关闭',
'showroom.chapter.material': '碳纤维与光',
'showroom.chapter.aero': '让风显形',
'showroom.chapter.power': '热量、动力、控制',
'showroom.chapter.circuit': '竞速上海',
'showroom.chapter.weekend': '全速周末',

// en
'showroom.ignition': 'Hold to Ignite',
'showroom.loading': 'Preparing Race Systems',
'showroom.skip': 'Skip Showroom',
'showroom.enter': 'Enter Weekend',
'showroom.muted': 'Sound Off',
'showroom.chapter.material': 'Carbon & Light',
'showroom.chapter.aero': 'Wind Made Visible',
'showroom.chapter.power': 'Heat. Power. Control.',
'showroom.chapter.circuit': 'Race Shanghai',
'showroom.chapter.weekend': 'Full Throttle Weekend',
```

- [ ] **Step 3: Implement keyboard/pointer ignition**

Create `src/components/showroom/useIgnition.ts`:

```ts
import { useEffect, useReducer, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { reduceIgnition } from '../../lib/showroom-story';

export function useIgnition(
  ready: boolean,
  reducedMotion: boolean,
  onGesture: () => void,
) {
  const [state, dispatch] = useReducer(reduceIgnition, {
    phase: 'loading' as const,
    progress: 0,
  });
  const previous = useRef(0);

  useEffect(() => {
    if (ready) dispatch({ type: 'ready' });
  }, [ready]);

  useEffect(() => {
    if (state.phase !== 'holding' && state.phase !== 'completing') return;
    let frameId = 0;
    const tick = (time: number) => {
      const deltaSeconds = previous.current === 0 ? 0 : (time - previous.current) / 1000;
      previous.current = time;
      dispatch({ type: 'tick', deltaSeconds });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      previous.current = 0;
    };
  }, [state.phase]);

  const press = () => {
    if (state.phase !== 'ready') return;
    onGesture();
    dispatch({ type: 'press' });
    if (reducedMotion) dispatch({ type: 'tick', deltaSeconds: 2.5 });
  };
  const release = () => dispatch({ type: 'release' });

  return {
    state,
    buttonProps: {
      onPointerDown: press,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      onKeyDown: (event: ReactKeyboardEvent) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) press();
      },
      onKeyUp: (event: ReactKeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') release();
      },
    },
  };
}
```

- [ ] **Step 4: Implement the DOM overlay**

Create `src/components/showroom/ShowroomOverlay.tsx`:

```tsx
import type { ShowroomChapterId } from '../../lib/showroom-story';
import type { MessageKey } from '../../i18n';

const keys: Record<ShowroomChapterId, MessageKey> = {
  material: 'showroom.chapter.material',
  aero: 'showroom.chapter.aero',
  power: 'showroom.chapter.power',
  circuit: 'showroom.chapter.circuit',
  weekend: 'showroom.chapter.weekend',
};

interface Props {
  chapter: ShowroomChapterId;
  progress: number;
  ignited: boolean;
  entering: boolean;
  muted: boolean;
  t: (key: MessageKey) => string;
  onSkip: () => void;
  onEnter: () => void;
}

export default function ShowroomOverlay({
  chapter, progress, ignited, entering, muted, t, onSkip, onEnter,
}: Props) {
  return (
    <div className="showroom-overlay">
      <div className="showroom-telemetry" aria-live="polite">
        <span>{String(Math.round(progress * 100)).padStart(3, '0')}%</span>
        {muted && <span>{t('showroom.muted')}</span>}
      </div>
      {ignited && (
        <button className="showroom-skip" type="button" onClick={onSkip}>
          {t('showroom.skip')}
        </button>
      )}
      <div className="showroom-copy" key={chapter}>
        <p>0{(['material','aero','power','circuit','weekend'] as const).indexOf(chapter) + 1}</p>
        <h2>{t(keys[chapter])}</h2>
      </div>
      {progress >= 0.995 && (
        <button
          className="showroom-enter"
          type="button"
          disabled={entering}
          onClick={onEnter}
        >
          {t('showroom.enter')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Replace `WelcomePage` with the showroom composer**

Replace `src/components/WelcomePage.tsx` with:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import bgImage from '../img/IMG_9596.jpg';
import { useI18n } from '../i18n';
import type { ShowroomFrame } from '../lib/showroom-director';
import { selectInitialQuality } from '../lib/showroom-quality';
import type { ShowroomChapterId } from '../lib/showroom-story';
import CinematicCanvas from './showroom/CinematicCanvas';
import { ShowroomAssetManager, type LoadedShowroomAssets } from './showroom/asset-manager';
import type { ShowroomRenderer, ShowroomRenderInput } from './showroom/showroom-renderer';
import ShowroomOverlay from './showroom/ShowroomOverlay';
import { useIgnition } from './showroom/useIgnition';
import './showroom/showroom.css';

interface WelcomeProps {
  onEnter: () => void;
  onRequestMotionPermission: () => Promise<boolean>;
}

export default function WelcomePage({ onEnter, onRequestMotionPermission }: WelcomeProps) {
  const { t } = useI18n();
  const [assets, setAssets] = useState<LoadedShowroomAssets | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [chapter, setChapter] = useState<ShowroomChapterId>('material');
  const [uiProgress, setUiProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [motionGranted, setMotionGranted] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [entering, setEntering] = useState(false);
  const enteredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ShowroomRenderer | null>(null);
  const inputRef = useRef<ShowroomRenderInput>({ progress: 0, pointerX: 0, pointerY: 0 });
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const quality = useMemo(() => selectInitialQuality({
    reducedMotion,
    webgl2: Boolean(document.createElement('canvas').getContext('webgl2')),
    finePointer: window.matchMedia('(pointer: fine)').matches,
    viewportWidth: window.innerWidth,
    hardwareConcurrency: navigator.hardwareConcurrency || 2,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  }), [reducedMotion]);

  useEffect(() => {
    const manager = new ShowroomAssetManager(undefined, (progress) => {
      setLoadProgress(progress.critical);
    });
    manager.load().then(setAssets).catch((error) => {
      if ((error as DOMException).name !== 'AbortError') console.error(error);
    });
    return () => manager.dispose();
  }, []);

  const beginGesture = useCallback(() => {
    rendererRef.current?.startAudio().then((started) => setMuted(!started));
    onRequestMotionPermission().then(setMotionGranted).catch(() => setMotionGranted(false));
    navigator.vibrate?.(18);
  }, [onRequestMotionPermission]);
  const { state, buttonProps } = useIgnition(Boolean(assets), reducedMotion, beginGesture);
  const ignited = state.phase === 'ignited' || state.phase === 'fallback';

  useEffect(() => {
    if (!motionGranted) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      inputRef.current.pointerX = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 30));
      inputRef.current.pointerY = Math.max(-1, Math.min(1, (event.beta ?? 0) / 45));
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [motionGranted]);

  const handleChapterChange = useCallback((frame: ShowroomFrame) => {
    setChapter(frame.chapter.id);
  }, []);
  const handleCanvasFailure = useCallback((error: unknown) => {
    console.error('[Showroom] WebGL renderer unavailable:', error);
    setCanvasFailed(true);
  }, []);

  const updateScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const range = element.scrollHeight - element.clientHeight;
    const next = range <= 0 ? 0 : element.scrollTop / range;
    inputRef.current.progress = next;
    setUiProgress(Math.round(next * 20) / 20);
  };
  const skip = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const enter = () => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    setEntering(true);
    window.setTimeout(onEnter, 700);
  };

  return (
    <div
      className={`showroom ${entering ? 'showroom--entering' : ''}`}
      style={{ backgroundImage: `url(${bgImage})` }}
      onPointerMove={(event) => {
        inputRef.current.pointerX = event.clientX / window.innerWidth * 2 - 1;
        inputRef.current.pointerY = -(event.clientY / window.innerHeight * 2 - 1);
      }}
    >
      {assets?.status === 'ready' && assets.car && !canvasFailed && (
        <CinematicCanvas
          assets={assets}
          quality={quality}
          inputRef={inputRef}
          rendererRef={rendererRef}
          onChapterChange={handleChapterChange}
          onFailure={handleCanvasFailure}
        />
      )}
      <div
        ref={scrollRef}
        className={`showroom-scroll ${ignited ? 'showroom-scroll--enabled' : ''}`}
        onScroll={updateScroll}
      >
        <div className="showroom-scroll-track" />
      </div>
      <ShowroomOverlay
        chapter={chapter}
        progress={uiProgress}
        ignited={ignited}
        entering={entering}
        muted={muted}
        t={t}
        onSkip={skip}
        onEnter={enter}
      />
      {!ignited && (
        <button
          {...buttonProps}
          className="showroom-ignition"
          type="button"
          aria-label={`${t('showroom.ignition')} ${Math.round(state.progress * 100)}%`}
        >
          <span>{assets ? t('showroom.ignition') : `${t('showroom.loading')} ${loadProgress}%`}</span>
          <i style={{ transform: `scaleX(${state.progress})` }} />
        </button>
      )}
      {(assets?.status === 'fallback' || canvasFailed) && (
        <button className="showroom-enter showroom-enter--fallback" type="button" onClick={enter}>
          {t('showroom.enter')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add the fixed-canvas and reduced-motion styles**

Create `src/components/showroom/showroom.css`:

```css
.showroom { position:fixed; inset:0; z-index:50; overflow:hidden; background:#030406 center/cover no-repeat; color:#f4f5f7; }
.showroom::before { content:""; position:absolute; inset:0; z-index:0; background:rgba(3,4,6,.84); }
.showroom-canvas,.showroom-overlay,.showroom-scroll { position:absolute; inset:0; }
.showroom-canvas { z-index:1; pointer-events:none; }
.showroom-canvas canvas { display:block; width:100%; height:100%; }
.showroom-scroll { z-index:2; overflow:hidden; overscroll-behavior:none; scrollbar-width:none; }
.showroom-scroll--enabled { overflow-y:auto; }
.showroom-scroll::-webkit-scrollbar { display:none; }
.showroom-scroll-track { height:600svh; pointer-events:none; }
.showroom-overlay { z-index:3; pointer-events:none; padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left)); }
.showroom-overlay button,.showroom-ignition { pointer-events:auto; }
.showroom-telemetry { display:flex; justify-content:space-between; font:800 10px/1 ui-monospace,monospace; letter-spacing:.16em; color:rgba(255,255,255,.58); }
.showroom-skip { position:absolute; right:24px; top:58px; border:1px solid rgba(255,255,255,.24); border-radius:99px; padding:9px 13px; background:rgba(0,0,0,.3); color:white; font-size:10px; }
.showroom-copy { position:absolute; left:7vw; bottom:9vh; max-width:540px; animation:showroom-copy-in .55s ease both; }
.showroom-copy p { color:#e10600; font:900 11px/1 ui-monospace,monospace; letter-spacing:.16em; }
.showroom-copy h2 { margin:8px 0 0; max-width:11ch; font-size:clamp(48px,7.5vw,112px); line-height:.82; letter-spacing:-.065em; text-transform:uppercase; }
.showroom-ignition { position:absolute; z-index:5; left:50%; bottom:9vh; width:min(360px,82vw); transform:translateX(-50%) skewX(-12deg); overflow:hidden; border:0; padding:17px 24px; background:#ffb800; color:#071a2c; font-weight:900; text-transform:uppercase; }
.showroom-ignition span { position:relative; z-index:2; display:block; transform:skewX(12deg); }
.showroom-ignition i { position:absolute; inset:0; transform-origin:left; background:#e10600; }
.showroom-enter { position:absolute; right:7vw; bottom:9vh; padding:16px 24px; border:1px solid #ffb800; background:#ffb800; color:#071a2c; font-weight:900; text-transform:uppercase; }
.showroom-enter--fallback { z-index:7; }
.showroom--entering { animation:showroom-exit .7s cubic-bezier(.4,0,.2,1) forwards; pointer-events:none; }
@keyframes showroom-copy-in { from { opacity:0; transform:translateY(22px); } }
@keyframes showroom-exit { to { opacity:0; transform:scale(1.035); } }
@media (max-width:700px) { .showroom-copy { left:24px; right:24px; bottom:16vh; }.showroom-copy h2{font-size:clamp(42px,14vw,70px)}.showroom-enter{left:24px;right:24px;bottom:7vh}.showroom-skip{right:16px}.showroom-scroll-track{height:520svh} }
@media (prefers-reduced-motion:reduce) { .showroom * { animation-duration:.01ms!important; scroll-behavior:auto!important; }.showroom-scroll-track{height:500svh} }
```

Import it once from `src/index.css` only if the component import is removed; do not import it from both places.

- [ ] **Step 7: Separate motion permission from final handoff**

Remove the static `WelcomePage` import from `src/App.tsx`, then add the lazy boundary after the imports:

```tsx
const WelcomePage = React.lazy(() => import('./components/WelcomePage'));
```

Keep `AnimatePresence` ownership unchanged, wrap it in Suspense, and change the `WelcomePage` call to:

```tsx
<React.Suspense fallback={null}>
  <AnimatePresence>
    {showWelcome && (
      <WelcomePage
        key="welcome"
        onRequestMotionPermission={requestMotionPermission}
        onEnter={() => setShowWelcome(false)}
      />
    )}
  </AnimatePresence>
</React.Suspense>
```

Remove the previous `async` `onEnter` callback. Keep `requestMotionPermission()` unchanged.

- [ ] **Step 8: Remove the replaced renderer and run checks**

Delete `src/components/ParticleBackground.tsx` only after `rg "ParticleBackground" src` returns no remaining imports. Do not delete reusable effect files yet; the final verification task decides whether they are truly unused.

Run:

```bash
npm run check:i18n
npm run check:showroom-story
npm run check:showroom-asset-manager
npm run check:showroom-director
npm run lint
npm run build
```

Expected: all exit `0`, and Vite emits `WelcomePage` plus its Three.js showroom dependencies as a distinct lazy chunk rather than adding them to the itinerary's initial chunk.

- [ ] **Step 9: Commit the complete UI handoff**

```bash
git add src/App.tsx src/i18n.tsx src/index.css src/components/WelcomePage.tsx src/components/showroom scripts/check-i18n.ts
git add -u src/components/ParticleBackground.tsx
git commit -m "feat: add scroll-driven F1 showroom"
```

---

### Task 12: Browser, failure, performance, and regression verification

**Files:**
- Modify only files proven necessary by verification failures.
- Do not stage: `.superpowers/`

**Interfaces:**
- Consumes: the complete showroom.
- Produces: passing automated checks, visual evidence for all chapters, and a clean focused diff.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm run check:showroom-story
npm run check:showroom-quality
npm run check:showroom-route
npm run check:showroom-assets
npm run check:showroom-asset-manager
npm run check:showroom-materials
npm run check:showroom-director
npm run check:showroom-effects
npm run check:showroom-audio
npm run check:showroom-renderer-config
npm run check:f1-motion
npm run check:rose-animation
npm run check:rose-glb
npm run check:i18n
npm run lint
npm run build
```

Expected: every command exits `0`. Do not treat the existing Vite chunk warning as a pass if the new showroom chunk exceeds the previous bundle without code splitting.

- [ ] **Step 2: Start a production-like local preview**

Run:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

Expected: Vite prints a local preview URL and serves the production build without console exceptions.

- [ ] **Step 3: Verify desktop story and capture evidence**

At a 1440 × 900 viewport, verify and capture:

1. Loading progress reflects only the car as critical.
2. Releasing ignition below 30% resets.
3. Releasing at or above 30% completes automatically.
4. Scroll remains locked until ignition completes.
5. Material, Aero, Power, Circuit, and Weekend chapter screenshots match the confirmed dark cinematic direction.
6. Wheel rotation, airflow, brake heat, audio, and route morph respond smoothly.
7. `ENTER WEEKEND` appears only at completion and hands off once after 700 ms.
8. Header, itinerary list, map, rose modal trigger, and language switch remain functional after entry.

Expected: no layout overlap, canvas input interception, console error, or abrupt material replacement.

- [ ] **Step 4: Verify mobile and accessibility behavior**

At representative 390 × 844 portrait and 844 × 390 landscape viewports:

- Touch ignition and scroll work without horizontal page movement.
- Safe areas do not cover Skip or Enter.
- The Balanced tier keeps the scene responsive and disables planar reflection.
- Motion permission denial preserves touch parallax and entry.
- Audio denial exposes the muted state and preserves the sequence.
- Keyboard Space/Enter ignition, Skip, and Enter work.
- `prefers-reduced-motion: reduce` uses Essential quality and a single activation for ignition.

Expected: the full story and entry path remain available in every case.

- [ ] **Step 5: Verify explicit failures**

Temporarily change one asset URL at a time in local dev only, then restore it:

- Missing car: hero-image fallback and Enter remain available.
- Missing studio HDR: authored lights render the car.
- Missing night HDR: studio environment remains without throwing.
- WebGL disabled: DOM fallback renders and Enter works.

Expected: no loading overlay remains permanently and no retry loop floods the console.

- [ ] **Step 6: Audit frame allocations and cleanup**

Use browser performance tools for one full showroom pass and confirm:

- No React commit occurs every animation frame.
- Route and airflow `position` attributes retain object identity.
- Hidden-tab rendering pauses.
- Leaving the welcome overlay cancels RAF, pauses audio, removes the canvas, and disposes composer render targets.
- Sustained frame time above the thresholds steps quality down once and never back up.

Expected: capable desktop stays near 60 fps; representative mid-range mobile stays at or above 30 fps after quality selection.

- [ ] **Step 7: Check scope and commit verification fixes**

Run:

```bash
git status --short
git diff --check
git diff --name-only
git diff --cached --name-only | rg '^\.superpowers/' && exit 1 || true
```

Expected: no `.superpowers/` path is staged; unrelated rose changes remain untouched unless they were already part of the task owner's branch.

If verification required code fixes, commit only those files:

```bash
git add src/App.tsx src/i18n.tsx src/index.css src/lib/showroom-*.ts src/components/WelcomePage.tsx src/components/showroom scripts/check-showroom-*.ts scripts/check-showroom-assets.mjs
git commit -m "fix: verify cinematic showroom experience"
```

If no fixes were required, do not create an empty commit.

---

## Final Implementation Review Checklist

- [ ] Every acceptance criterion in the design spec maps to Tasks 1–12.
- [ ] The product never loads the rose model as a welcome-screen dependency.
- [ ] The optimized GLB preserves `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, and `Wheel_RR`.
- [ ] Body and wheel PBR clones preserve baked maps; no guessed glass transmission exists.
- [ ] Route buffers have identical sample counts and update without replacement.
- [ ] Final Enter fires once after 700 ms.
- [ ] High, Balanced, Essential, and fallback paths are all browser-verified.
- [ ] `.superpowers/` and unrelated user edits are absent from all showroom commits.

### Task 5: Cancellable model/HDR asset manager and rose lazy loading

**Files:**
- Modify: `src/lib/model-loader.ts`
- Create: `src/components/showroom/asset-manager.ts`
- Create: `scripts/check-showroom-asset-manager.ts`
- Modify: `src/components/WelcomePage.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `SHOWROOM_ASSETS`, `ShowroomLoadProgress` from Task 4.
- Produces: `ShowroomAssetManager`, `LoadedShowroomAssets`, Meshopt-capable `loadModelWithCache(url, onProgress?, signal?)`.
- Consumers: `ShowroomRenderer` and `CinematicCanvas` in Task 10, plus `WelcomePage` in Task 11.

- [ ] **Step 1: Add the failing asset-manager check**

Create `scripts/check-showroom-asset-manager.ts`:

```ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ShowroomAssetManager } from '../src/components/showroom/asset-manager';

const progress: number[] = [];
const manager = new ShowroomAssetManager({
  loadModel: async (_url, onProgress) => {
    onProgress?.(50);
    onProgress?.(100);
    return { scene: new THREE.Group() } as never;
  },
  loadHdr: async () => new THREE.DataTexture(),
}, (value) => progress.push(value.critical));

const loaded = await manager.load();
assert.equal(loaded.status, 'ready');
assert.ok(loaded.car instanceof THREE.Group);
assert.ok(loaded.studioHdr instanceof THREE.DataTexture);
assert.equal(progress.at(-1), 100);

const fallback = new ShowroomAssetManager({
  loadModel: async () => { throw new Error('model failed'); },
  loadHdr: async () => new THREE.DataTexture(),
}).load();
assert.equal((await fallback).status, 'fallback');

let disposedTextures = 0;
loaded.studioHdr?.addEventListener('dispose', () => { disposedTextures += 1; });
loaded.nightHdr?.addEventListener('dispose', () => { disposedTextures += 1; });
manager.dispose();
assert.equal(disposedTextures, 2);
console.log('PASS: showroom asset manager readiness and fallback');
```

Add:

```json
"check:showroom-asset-manager": "tsx scripts/check-showroom-asset-manager.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-asset-manager`

Expected: FAIL with missing `src/components/showroom/asset-manager`.

- [ ] **Step 3: Replace the model loader with the Meshopt/cancellation-safe version**

Replace `src/lib/model-loader.ts` with:

```ts
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import localforage from 'localforage';

localforage.config({ name: 'happy-travel', storeName: 'models' });

const createLoader = () => {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
};

const parseModel = (bytes: ArrayBuffer, url: string): Promise<GLTF> =>
  new Promise((resolve, reject) => {
    createLoader().parse(bytes, '', resolve, (error) => {
      console.error(`[ModelLoader] Error parsing ${url}:`, error);
      reject(error);
    });
  });

export const loadModelWithCache = async (
  url: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<GLTF> => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const cached = await localforage.getItem<ArrayBuffer>(url);
  if (cached) {
    onProgress?.(100);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return parseModel(cached, url);
  }

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  if (!response.body) throw new Error(`Missing response body: ${url}`);

  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
    loaded += result.value.length;
    if (total > 0) onProgress?.(Math.round((loaded / total) * 100));
  }

  const joined = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await localforage.setItem(url, joined.buffer);
  onProgress?.(100);
  return parseModel(joined.buffer, url);
};
```

- [ ] **Step 4: Implement the asset manager**

Create `src/components/showroom/asset-manager.ts`:

```ts
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModelWithCache } from '../../lib/model-loader';
import {
  SHOWROOM_ASSETS,
  type ShowroomLoadProgress,
} from './showroom-assets';

export interface LoadedShowroomAssets {
  status: 'ready' | 'fallback';
  car: THREE.Group | null;
  studioHdr: THREE.DataTexture | null;
  nightHdr: THREE.DataTexture | null;
}

export interface AssetDependencies {
  loadModel: (
    url: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ) => Promise<GLTF>;
  loadHdr: (url: string) => Promise<THREE.DataTexture>;
}

const runtimeDependencies: AssetDependencies = {
  loadModel: loadModelWithCache,
  loadHdr: async (url) => new RGBELoader().loadAsync(url),
};

export class ShowroomAssetManager {
  private readonly controller = new AbortController();
  private disposed = false;
  private assets: LoadedShowroomAssets | null = null;

  constructor(
    private readonly dependencies = runtimeDependencies,
    private readonly onProgress?: (progress: ShowroomLoadProgress) => void,
  ) {}

  async load(): Promise<LoadedShowroomAssets> {
    let critical = 0;
    let studioHdr: THREE.DataTexture | null = null;
    let nightHdr: THREE.DataTexture | null = null;
    this.onProgress?.({ critical, optional: 0, status: 'loading' });
    try {
      const [modelResult, studioResult, nightResult] = await Promise.allSettled([
        this.dependencies.loadModel(
          SHOWROOM_ASSETS.car,
          (value) => {
            critical = value;
            this.onProgress?.({ critical, optional: 0, status: 'loading' });
          },
          this.controller.signal,
        ),
        this.dependencies.loadHdr(SHOWROOM_ASSETS.studioHdr),
        this.dependencies.loadHdr(SHOWROOM_ASSETS.nightHdr),
      ]);
      studioHdr = studioResult.status === 'fulfilled' ? studioResult.value : null;
      nightHdr = nightResult.status === 'fulfilled' ? nightResult.value : null;
      if (this.disposed) {
        studioHdr?.dispose();
        nightHdr?.dispose();
        throw new DOMException('Aborted', 'AbortError');
      }
      if (modelResult.status === 'rejected') throw modelResult.reason;
      this.assets = { status: 'ready', car: modelResult.value.scene, studioHdr, nightHdr };
      this.onProgress?.({ critical: 100, optional: 100, status: 'ready' });
      return this.assets;
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') throw error;
      studioHdr?.dispose();
      nightHdr?.dispose();
      console.error('[Showroom] Critical asset load failed:', error);
      this.assets = {
        status: 'fallback',
        car: null,
        studioHdr: null,
        nightHdr: null,
      };
      this.onProgress?.({ critical, optional: 100, status: 'fallback' });
      return this.assets;
    }
  }

  dispose() {
    this.disposed = true;
    this.controller.abort();
    this.assets?.studioHdr?.dispose();
    this.assets?.nightHdr?.dispose();
    this.assets?.car?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => material.dispose());
    });
  }
}
```

- [ ] **Step 5: Remove rose from the critical welcome preload**

In `src/components/WelcomePage.tsx`, remove the `ROSE_MODEL_URL` import, `roseProg`, and the second `loadModelWithCache()` promise. Replace the current `Promise.all([...])` effect body with:

```ts
loadModelWithCache('/models/red_bull_f1_showroom.glb', setModelProgress)
  .then((carGltf) => {
    setLoadedModel(carGltf.scene);
    setTimeout(() => setModelLoading(false), 250);
  })
  .catch((error) => {
    console.error('[WelcomePage] Model preloading failed:', error);
    setModelLoading(false);
  });
```

This is transitional and will be replaced by `ShowroomAssetManager` in Task 11. Do not change `RoseModal` or `ThreeRose`; they already load when the modal mounts.

- [ ] **Step 6: Run checks**

Run:

```bash
npm run check:showroom-asset-manager
npm run check:showroom-assets
npm run check:rose-animation
npm run lint
npm run build
```

Expected: all exit `0`; the asset-manager check prints PASS.

- [ ] **Step 7: Commit loading changes**

```bash
git add package.json scripts/check-showroom-asset-manager.ts src/lib/model-loader.ts src/components/showroom/asset-manager.ts src/components/WelcomePage.tsx
git commit -m "feat: add showroom asset lifecycle"
```

---

### Task 6: Role-aware PBR material system and single-lifecycle hologram

**Files:**
- Create: `src/components/showroom/vehicle-profile.ts`
- Create: `src/components/showroom/material-system.ts`
- Create: `scripts/check-showroom-materials.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `SHOWROOM_VEHICLE_PROFILE`, `resolveVehicleRoles()`, `ShowroomMaterialSystem.setReveal()`, `dispose()`.
- Consumers: `ShowroomRenderer`.

- [ ] **Step 1: Add the failing role/material check**

Create `scripts/check-showroom-materials.ts`:

```ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  SHOWROOM_VEHICLE_PROFILE,
  resolveVehicleRoles,
} from '../src/components/showroom/vehicle-profile';
import { ShowroomMaterialSystem } from '../src/components/showroom/material-system';

const root = new THREE.Group();
const body = new THREE.Group();
body.name = 'Sketchfab_model';
const bodyMesh = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.45 }),
);
body.add(bodyMesh);
root.add(body);
for (const name of SHOWROOM_VEHICLE_PROFILE.wheelNodes) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
  );
  wheel.name = name;
  root.add(wheel);
}

const roles = resolveVehicleRoles(root);
assert.equal(roles.wheels.length, 4);
assert.equal(roles.body, body);
const firstWheel = roles.wheels[0] as THREE.Mesh;

const system = new ShowroomMaterialSystem(root);
system.setReveal(0.5);
assert.equal(system.uniforms.reveal.value, 0.5);
assert.ok(bodyMesh.material instanceof THREE.MeshPhysicalMaterial);
assert.equal((bodyMesh.material as THREE.MeshPhysicalMaterial).clearcoat, 0.55);
assert.ok(firstWheel.material instanceof THREE.MeshPhysicalMaterial);
assert.equal((firstWheel.material as THREE.MeshPhysicalMaterial).clearcoat, 0.08);
system.dispose();
assert.ok(bodyMesh.material instanceof THREE.MeshStandardMaterial);
assert.ok(firstWheel.material instanceof THREE.MeshStandardMaterial);

console.log('PASS: showroom vehicle roles and material lifecycle');
```

Add:

```json
"check:showroom-materials": "tsx scripts/check-showroom-materials.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-materials`

Expected: FAIL with missing vehicle-profile/material-system modules.

- [ ] **Step 3: Add the explicit vehicle role profile**

Create `src/components/showroom/vehicle-profile.ts`:

```ts
import * as THREE from 'three';

export const SHOWROOM_VEHICLE_PROFILE = {
  rootNode: 'F1_Car',
  bodyNode: 'Sketchfab_model',
  wheelNodes: ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'],
} as const;

export interface VehicleRoles {
  root: THREE.Object3D;
  body: THREE.Object3D;
  wheels: THREE.Object3D[];
}

export function resolveVehicleRoles(
  scene: THREE.Object3D,
  warn: (message: string) => void = console.warn,
): VehicleRoles {
  const root = scene.getObjectByName(SHOWROOM_VEHICLE_PROFILE.rootNode) ?? scene;
  const body = root.getObjectByName(SHOWROOM_VEHICLE_PROFILE.bodyNode)
    ?? scene.getObjectByName(SHOWROOM_VEHICLE_PROFILE.bodyNode)
    ?? root;
  const wheels = SHOWROOM_VEHICLE_PROFILE.wheelNodes
    .map((name) => root.getObjectByName(name))
    .filter((node): node is THREE.Object3D => Boolean(node));
  if (wheels.length !== SHOWROOM_VEHICLE_PROFILE.wheelNodes.length) {
    warn(`[Showroom] Resolved ${wheels.length}/4 wheel nodes`);
  }
  return { root, body, wheels };
}
```

- [ ] **Step 4: Implement physical clones and one hologram lifecycle**

Create `src/components/showroom/material-system.ts`:

```ts
import * as THREE from 'three';
import { resolveVehicleRoles } from './vehicle-profile';

interface MaterialEntry {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  generated: THREE.Material | THREE.Material[];
}

const clonePhysical = (
  source: THREE.MeshStandardMaterial,
  role: 'body' | 'wheel',
) => new THREE.MeshPhysicalMaterial({
  name: `${source.name || 'baked'}_${role}_showroom`,
  color: source.color.clone(),
  map: source.map,
  normalMap: source.normalMap,
  normalScale: source.normalScale.clone(),
  aoMap: source.aoMap,
  aoMapIntensity: source.aoMapIntensity,
  metalnessMap: source.metalnessMap,
  roughnessMap: source.roughnessMap,
  emissive: source.emissive.clone(),
  emissiveMap: source.emissiveMap,
  emissiveIntensity: source.emissiveIntensity,
  metalness: role === 'body' ? Math.min(0.5, source.metalness) : source.metalness,
  roughness: role === 'body' ? Math.min(0.52, source.roughness) : Math.max(0.62, source.roughness),
  clearcoat: role === 'body' ? 0.55 : 0.08,
  clearcoatRoughness: role === 'body' ? 0.16 : 0.45,
  transparent: source.transparent,
  opacity: source.opacity,
  alphaTest: source.alphaTest,
  side: source.side,
});

export class ShowroomMaterialSystem {
  readonly uniforms = {
    reveal: { value: 0 },
    time: { value: 0 },
  };
  private readonly entries: MaterialEntry[] = [];

  constructor(scene: THREE.Object3D) {
    const roles = resolveVehicleRoles(scene);
    this.replaceTree(roles.root, roles.wheels);
  }

  private replaceTree(root: THREE.Object3D, wheels: THREE.Object3D[]) {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const role = wheels.some((wheel) => {
        let cursor: THREE.Object3D | null = object;
        while (cursor) {
          if (cursor === wheel) return true;
          cursor = cursor.parent;
        }
        return false;
      }) ? 'wheel' : 'body';
      const original = mesh.material;
      const source = Array.isArray(original) ? original : [original];
      const generated = source.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material.clone();
        const physical = clonePhysical(material, role);
        physical.onBeforeCompile = (shader) => {
          shader.uniforms.uReveal = this.uniforms.reveal;
          shader.uniforms.uShowroomTime = this.uniforms.time;
          shader.fragmentShader = `
            uniform float uReveal;
            uniform float uShowroomTime;
            ${shader.fragmentShader}
          `.replace(
            '#include <dithering_fragment>',
            `
              #include <dithering_fragment>
              float scan = smoothstep(0.08, 0.0, abs(vViewPosition.y * 0.04 + 0.5 - uReveal));
              float grid = step(0.92, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.08));
              vec3 hologram = vec3(0.0, 0.72, 1.4) * (0.28 + grid + scan * 2.0);
              gl_FragColor.rgb = mix(hologram, gl_FragColor.rgb, smoothstep(0.0, 1.0, uReveal));
              gl_FragColor.a = mix(0.55, gl_FragColor.a, uReveal);
            `,
          );
        };
        physical.customProgramCacheKey = () => 'showroom-hologram-v1';
        return physical;
      });
      mesh.material = Array.isArray(original) ? generated : generated[0];
      this.entries.push({ mesh, original, generated: mesh.material });
    });
  }

  setReveal(progress: number) {
    this.uniforms.reveal.value = Math.min(1, Math.max(0, progress));
  }

  updateTime(seconds: number) {
    this.uniforms.time.value = seconds;
  }

  dispose() {
    for (const entry of this.entries) {
      const materials = Array.isArray(entry.generated)
        ? entry.generated
        : [entry.generated];
      for (const material of materials) material.dispose();
      entry.mesh.material = entry.original;
    }
    this.entries.length = 0;
  }
}
```

- [ ] **Step 5: Run checks and commit**

Run:

```bash
npm run check:showroom-materials
npm run lint
```

Expected: PASS and exit `0`.

Commit:

```bash
git add package.json scripts/check-showroom-materials.ts src/components/showroom/vehicle-profile.ts src/components/showroom/material-system.ts
git commit -m "feat: add showroom PBR material system"
```

---

### Task 7: Pure scene director

**Files:**
- Create: `src/lib/showroom-director.ts`
- Create: `scripts/check-showroom-director.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getShowroomChapter()` from Task 1.
- Produces: `ShowroomFrame`, `getShowroomFrame(progress, velocity)`.
- Consumers: renderer and audio engine.

- [ ] **Step 1: Add the failing director check**

Create `scripts/check-showroom-director.ts`:

```ts
import assert from 'node:assert/strict';
import { getShowroomFrame } from '../src/lib/showroom-director';

const material = getShowroomFrame(0.09, 0);
assert.equal(material.chapter.id, 'material');
assert.ok(material.effects.reveal > 0 && material.effects.reveal < 1);

const aero = getShowroomFrame(0.3, 1.5);
assert.equal(aero.chapter.id, 'aero');
assert.ok(aero.effects.airflow > 0.5);
assert.ok(aero.audio.energy > 0);

const power = getShowroomFrame(0.52, 1);
assert.equal(power.chapter.id, 'power');
assert.ok(power.effects.brakeHeat > 0.5);

const circuit = getShowroomFrame(0.72, 0.5);
assert.ok(circuit.effects.circuitMorph > 0 && circuit.effects.circuitMorph < 1);

const weekend = getShowroomFrame(1, 0);
assert.equal(weekend.effects.weekendMorph, 1);
assert.equal(weekend.exposure, 0.82);
assert.equal(weekend.audio.energy, 0);

console.log('PASS: showroom director chapter outputs');
```

Add:

```json
"check:showroom-director": "tsx scripts/check-showroom-director.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-director`

Expected: FAIL with missing `src/lib/showroom-director`.

- [ ] **Step 3: Implement the director**

Create `src/lib/showroom-director.ts`:

```ts
import { getShowroomChapter, type ShowroomChapterState } from './showroom-story';

export interface ShowroomFrame {
  chapter: ShowroomChapterState;
  camera: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number };
  car: { x: number; y: number; z: number; rotationY: number; scale: number };
  effects: {
    reveal: number;
    airflow: number;
    brakeHeat: number;
    circuitMorph: number;
    weekendMorph: number;
  };
  audio: { energy: number; pitch: number };
  exposure: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};
const lerp = (from: number, to: number, value: number) => from + (to - from) * value;

export function getShowroomFrame(progress: number, velocity: number): ShowroomFrame {
  const chapter = getShowroomChapter(progress);
  const local = smooth(chapter.localProgress);
  const speed = clamp01(Math.abs(velocity) / 2.5);
  const reveal = chapter.index === 0 ? local : 1;
  const airflow = chapter.id === 'aero' ? 0.35 + local * 0.65 + speed * 0.2 : 0;
  const brakeHeat = chapter.id === 'power' ? Math.sin(local * Math.PI) : 0;
  const circuitMorph = chapter.id === 'circuit' ? local : chapter.index > 3 ? 1 : 0;
  const weekendMorph = chapter.id === 'weekend' ? local : 0;
  const energy = chapter.id === 'weekend'
    ? Math.max(0, 1 - local)
    : clamp01(0.25 + speed * 0.75 + brakeHeat * 0.25);

  return {
    chapter,
    camera: {
      x: lerp(0, chapter.id === 'power' ? 3.4 : 1.2, local),
      y: lerp(1.4, chapter.id === 'circuit' ? 4.2 : 1.8, local),
      z: lerp(10.5, chapter.id === 'weekend' ? 13.5 : 8.2, local),
      targetX: 0,
      targetY: 0.3,
      targetZ: 0,
    },
    car: {
      x: chapter.id === 'weekend' ? lerp(0, -2.2, local) : 0,
      y: -0.9,
      z: 0,
      rotationY: lerp(-0.2, chapter.id === 'material' ? 0.55 : 0.2, local),
      scale: 2.2,
    },
    effects: { reveal, airflow, brakeHeat, circuitMorph, weekendMorph },
    audio: { energy, pitch: 0.85 + energy * 0.45 },
    exposure: chapter.id === 'aero' ? 0.68 : chapter.id === 'weekend' ? 0.82 : 0.76,
  };
}
```

- [ ] **Step 4: Run checks and commit**

Run:

```bash
npm run check:showroom-director
npm run check:showroom-story
npm run lint
```

Expected: PASS and exit `0`.

Commit:

```bash
git add package.json scripts/check-showroom-director.ts src/lib/showroom-director.ts
git commit -m "feat: add showroom scene director"
```

---

### Task 8: Preallocated airflow and route-line effects

**Files:**
- Create: `src/components/showroom/airflow.ts`
- Create: `src/components/showroom/route-line.ts`
- Create: `scripts/check-showroom-effects.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `resampleRoute()` and `interpolateRouteInto()`.
- Produces: `AirflowEffect`, `RouteLineEffect`, each with `update()` and `dispose()`.
- Consumers: `ShowroomRenderer`.

- [ ] **Step 1: Add the failing geometry check**

Create `scripts/check-showroom-effects.ts`:

```ts
import assert from 'node:assert/strict';
import { AirflowEffect } from '../src/components/showroom/airflow';
import { RouteLineEffect } from '../src/components/showroom/route-line';

const airflow = new AirflowEffect(8, 16);
const airflowPosition = airflow.geometry.getAttribute('position');
airflow.update(1, 0.8);
assert.equal(airflow.geometry.getAttribute('position'), airflowPosition);
assert.equal(airflowPosition.count, 8 * 16);
airflow.setLineCount(4);
assert.equal(airflow.geometry.drawRange.count, 4 * 16);

const route = new RouteLineEffect(32);
const routePosition = route.geometry.getAttribute('position');
route.update(0.5, 0.25);
assert.equal(route.geometry.getAttribute('position'), routePosition);
assert.equal(routePosition.count, 32);

airflow.dispose();
route.dispose();
console.log('PASS: showroom effects reuse preallocated geometry');
```

Add:

```json
"check:showroom-effects": "tsx scripts/check-showroom-effects.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-effects`

Expected: FAIL with missing airflow and route-line modules.

- [ ] **Step 3: Implement airflow geometry**

Create `src/components/showroom/airflow.ts`:

```ts
import * as THREE from 'three';

export class AirflowEffect extends THREE.LineSegments {
  readonly geometry: THREE.BufferGeometry;
  private readonly materialRef: THREE.ShaderMaterial;
  private readonly segments: number;
  private readonly maxLines: number;

  constructor(lineCount = 48, segments = 28) {
    const positions = new Float32Array(lineCount * segments * 3);
    const phases = new Float32Array(lineCount * segments);
    for (let line = 0; line < lineCount; line += 1) {
      const yBase = -1.5 + (line / Math.max(1, lineCount - 1)) * 3;
      const zBase = -1.8 + (line % 7) * 0.55;
      for (let segment = 0; segment < segments; segment += 1) {
        const index = line * segments + segment;
        const t = segment / Math.max(1, segments - 1);
        positions[index * 3] = -7 + t * 14;
        positions[index * 3 + 1] = yBase + Math.sin(t * Math.PI) * 0.65;
        positions[index * 3 + 2] = zBase + Math.sin(t * Math.PI * 2 + line) * 0.12;
        phases[index] = t + line / lineCount;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        varying float vPulse;
        void main() {
          vPulse = smoothstep(0.0, 0.18, fract(aPhase - uTime * 0.35));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uIntensity;
        varying float vPulse;
        void main() {
          gl_FragColor = vec4(vec3(2.2), uIntensity * vPulse * 0.55);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    super(geometry, material);
    this.geometry = geometry;
    this.materialRef = material;
    this.segments = segments;
    this.maxLines = lineCount;
    this.frustumCulled = false;
  }

  update(time: number, intensity: number) {
    this.materialRef.uniforms.uTime.value = time;
    this.materialRef.uniforms.uIntensity.value = Math.min(1, Math.max(0, intensity));
    this.visible = intensity > 0.001;
  }

  setLineCount(lineCount: number) {
    const visibleLines = Math.min(this.maxLines, Math.max(0, lineCount));
    this.geometry.setDrawRange(0, visibleLines * this.segments);
    this.visible = visibleLines > 0;
  }

  dispose() {
    this.geometry.dispose();
    this.materialRef.dispose();
  }
}
```

- [ ] **Step 4: Implement the continuous route line**

Create `src/components/showroom/route-line.ts`:

```ts
import * as THREE from 'three';
import { interpolateRouteInto, resampleRoute, type RoutePoint } from '../../lib/showroom-route';

const waveform: RoutePoint[] = [
  { x: -6, y: 0, z: 0 }, { x: -3, y: 1.4, z: 0 },
  { x: 0, y: -0.8, z: 0 }, { x: 3, y: 1.1, z: 0 },
  { x: 6, y: 0, z: 0 },
];
const circuit: RoutePoint[] = [
  { x: -5, y: -2, z: 0 }, { x: -5.5, y: 2.4, z: 0 },
  { x: -1, y: 3.2, z: 0 }, { x: 1.5, y: 0.8, z: 0 },
  { x: -1, y: -0.4, z: 0 }, { x: 2.8, y: -2.6, z: 0 },
  { x: 5.2, y: 0.2, z: 0 },
];
const weekend: RoutePoint[] = [
  { x: -6, y: -2.4, z: 0 }, { x: -3.4, y: 1.2, z: 0 },
  { x: -0.8, y: -0.3, z: 0 }, { x: 1.6, y: 2.2, z: 0 },
  { x: 3.6, y: 0.4, z: 0 }, { x: 6, y: 2.8, z: 0 },
];

const toBuffer = (points: RoutePoint[]) => {
  const buffer = new Float32Array(points.length * 3);
  points.forEach((point, index) => buffer.set([point.x, point.y, point.z], index * 3));
  return buffer;
};

export class RouteLineEffect extends THREE.Line {
  readonly geometry: THREE.BufferGeometry;
  private readonly materialRef: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly waveform: Float32Array;
  private readonly circuit: Float32Array;
  private readonly weekend: Float32Array;
  private readonly intermediate: Float32Array;

  constructor(samples = 128) {
    const geometry = new THREE.BufferGeometry();
    const waveformBuffer = toBuffer(resampleRoute(waveform, samples));
    geometry.setAttribute('position', new THREE.BufferAttribute(waveformBuffer.slice(), 3));
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(3.2, 0.08, 0.02) } },
      vertexShader: `void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 uColor;void main(){gl_FragColor=vec4(uColor,1.0);}`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    super(geometry, material);
    this.geometry = geometry;
    this.materialRef = material;
    this.positions = geometry.getAttribute('position').array as Float32Array;
    this.waveform = waveformBuffer;
    this.circuit = toBuffer(resampleRoute(circuit, samples));
    this.weekend = toBuffer(resampleRoute(weekend, samples));
    this.intermediate = new Float32Array(this.positions.length);
    this.frustumCulled = false;
  }

  update(circuitMorph: number, weekendMorph: number) {
    interpolateRouteInto(this.intermediate, this.waveform, this.circuit, circuitMorph);
    interpolateRouteInto(this.positions, this.intermediate, this.weekend, weekendMorph);
    this.geometry.getAttribute('position').needsUpdate = true;
    this.materialRef.uniforms.uColor.value.setRGB(
      3.2 - weekendMorph * 2.3,
      0.08 + weekendMorph * 1.5,
      0.02 + weekendMorph * 2.4,
    );
  }

  dispose() {
    this.geometry.dispose();
    this.materialRef.dispose();
  }
}
```

- [ ] **Step 5: Run checks and commit**

Run:

```bash
npm run check:showroom-effects
npm run check:showroom-route
npm run lint
```

Expected: PASS and exit `0`.

Commit:

```bash
git add package.json scripts/check-showroom-effects.ts src/components/showroom/airflow.ts src/components/showroom/route-line.ts
git commit -m "feat: add showroom airflow and route effects"
```

---

### Task 1: Ignition and chapter state

**Files:**
- Create: `src/lib/showroom-story.ts`
- Create: `scripts/check-showroom-story.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `IgnitionState`, `IgnitionEvent`, `reduceIgnition()`, `ShowroomChapterState`, `getShowroomChapter()`, `StorySignal`, `stepStorySignal()`.
- Consumers: `useIgnition`, `SceneDirector`, `WelcomePage`, and browser verification tasks.

- [ ] **Step 1: Add the failing story check**

Create `scripts/check-showroom-story.ts`:

```ts
import assert from 'node:assert/strict';
import {
  getShowroomChapter,
  reduceIgnition,
  stepStorySignal,
  type IgnitionState,
  type StorySignal,
} from '../src/lib/showroom-story';

const ready: IgnitionState = { phase: 'ready', progress: 0 };
const holding = reduceIgnition(ready, { type: 'press' });
assert.deepEqual(holding, { phase: 'holding', progress: 0 });

const shortHold = reduceIgnition(
  { phase: 'holding', progress: 0.2 },
  { type: 'release' },
);
assert.deepEqual(shortHold, ready);

const committed = reduceIgnition(
  { phase: 'holding', progress: 0.3 },
  { type: 'release' },
);
assert.equal(committed.phase, 'completing');

const ignited = reduceIgnition(
  { phase: 'holding', progress: 0.99 },
  { type: 'tick', deltaSeconds: 0.1 },
);
assert.deepEqual(ignited, { phase: 'ignited', progress: 1 });

assert.equal(getShowroomChapter(0).id, 'material');
assert.equal(getShowroomChapter(0.18).id, 'aero');
assert.equal(getShowroomChapter(0.42).id, 'power');
assert.equal(getShowroomChapter(0.62).id, 'circuit');
assert.equal(getShowroomChapter(0.82).id, 'weekend');
assert.equal(getShowroomChapter(1).localProgress, 1);

const oneFrame: StorySignal = { progress: 0, velocity: 0 };
const twoFrames: StorySignal = { progress: 0, velocity: 0 };
stepStorySignal(oneFrame, 0.8, 0.032);
stepStorySignal(twoFrames, 0.8, 0.016);
stepStorySignal(twoFrames, 0.8, 0.016);
assert.ok(Math.abs(oneFrame.progress - twoFrames.progress) < 1e-8);
assert.ok(Math.abs(oneFrame.velocity - twoFrames.velocity) < 1e-8);

console.log('PASS: showroom ignition and chapter state');
```

Add the package script:

```json
"check:showroom-story": "tsx scripts/check-showroom-story.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-story`

Expected: FAIL with `Cannot find module '../src/lib/showroom-story'`.

- [ ] **Step 3: Implement the pure story state**

Create `src/lib/showroom-story.ts`:

```ts
export type IgnitionPhase =
  | 'loading'
  | 'ready'
  | 'holding'
  | 'completing'
  | 'ignited'
  | 'fallback';

export interface IgnitionState {
  phase: IgnitionPhase;
  progress: number;
}

export type IgnitionEvent =
  | { type: 'ready' }
  | { type: 'press' }
  | { type: 'release' }
  | { type: 'tick'; deltaSeconds: number }
  | { type: 'fallback' }
  | { type: 'reset' };

export type ShowroomChapterId =
  | 'material'
  | 'aero'
  | 'power'
  | 'circuit'
  | 'weekend';

export interface ShowroomChapterState {
  id: ShowroomChapterId;
  index: number;
  progress: number;
  localProgress: number;
}

export interface StorySignal {
  progress: number;
  velocity: number;
}

const IGNITION_SECONDS = 2.5;
const AUTO_COMPLETE_THRESHOLD = 0.3;
const STORY_RESPONSE = 8;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const CHAPTERS = [
  { id: 'material', start: 0, end: 0.18 },
  { id: 'aero', start: 0.18, end: 0.42 },
  { id: 'power', start: 0.42, end: 0.62 },
  { id: 'circuit', start: 0.62, end: 0.82 },
  { id: 'weekend', start: 0.82, end: 1 },
] as const;

export function reduceIgnition(
  state: IgnitionState,
  event: IgnitionEvent,
): IgnitionState {
  if (event.type === 'fallback') return { phase: 'fallback', progress: 1 };
  if (event.type === 'reset') return { phase: 'ready', progress: 0 };
  if (event.type === 'ready' && state.phase === 'loading') {
    return { phase: 'ready', progress: 0 };
  }
  if (event.type === 'press' && state.phase === 'ready') {
    return { phase: 'holding', progress: 0 };
  }
  if (event.type === 'release' && state.phase === 'holding') {
    return state.progress < AUTO_COMPLETE_THRESHOLD
      ? { phase: 'ready', progress: 0 }
      : { phase: 'completing', progress: state.progress };
  }
  if (
    event.type === 'tick' &&
    (state.phase === 'holding' || state.phase === 'completing')
  ) {
    const progress = clamp01(
      state.progress + event.deltaSeconds / IGNITION_SECONDS,
    );
    return progress >= 1
      ? { phase: 'ignited', progress: 1 }
      : { ...state, progress };
  }
  return state;
}

export function getShowroomChapter(progress: number): ShowroomChapterState {
  const value = clamp01(progress);
  const index = CHAPTERS.findIndex(
    (chapter, chapterIndex) =>
      value < chapter.end || chapterIndex === CHAPTERS.length - 1,
  );
  const chapter = CHAPTERS[index];
  return {
    id: chapter.id,
    index,
    progress: value,
    localProgress: clamp01(
      (value - chapter.start) / (chapter.end - chapter.start),
    ),
  };
}

export function stepStorySignal(
  signal: StorySignal,
  targetProgress: number,
  deltaSeconds: number,
): StorySignal {
  const delta = Math.min(0.1, Math.max(0, deltaSeconds));
  const target = clamp01(targetProgress);
  const previous = signal.progress;
  const decay = Math.exp(-STORY_RESPONSE * delta);
  signal.progress = target + (previous - target) * decay;
  signal.velocity = STORY_RESPONSE * (target - signal.progress);
  return signal;
}
```

- [ ] **Step 4: Run the focused and existing checks**

Run:

```bash
npm run check:showroom-story
npm run check:f1-motion
npm run lint
```

Expected: all commands print PASS or exit `0`.

- [ ] **Step 5: Commit the story state**

```bash
git add package.json scripts/check-showroom-story.ts src/lib/showroom-story.ts
git commit -m "feat: add showroom story state"
```

---

### Task 2: Device quality and frame-budget step-down

**Files:**
- Create: `src/lib/showroom-quality.ts`
- Create: `scripts/check-showroom-quality.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `QualityTier`, `DeviceSignals`, `selectInitialQuality()`, `FrameBudgetState`, `stepFrameBudget()`.
- Consumers: `ShowroomRenderer` and responsive fallback UI.

- [ ] **Step 1: Add the failing quality check**

Create `scripts/check-showroom-quality.ts`:

```ts
import assert from 'node:assert/strict';
import {
  selectInitialQuality,
  stepFrameBudget,
  type FrameBudgetState,
} from '../src/lib/showroom-quality';

assert.equal(selectInitialQuality({
  reducedMotion: true,
  webgl2: true,
  finePointer: true,
  viewportWidth: 1440,
  hardwareConcurrency: 12,
  deviceMemory: 16,
}), 'essential');

assert.equal(selectInitialQuality({
  reducedMotion: false,
  webgl2: true,
  finePointer: true,
  viewportWidth: 1440,
  hardwareConcurrency: 12,
  deviceMemory: 16,
}), 'high');

assert.equal(selectInitialQuality({
  reducedMotion: false,
  webgl2: true,
  finePointer: false,
  viewportWidth: 430,
  hardwareConcurrency: 8,
  deviceMemory: 8,
}), 'balanced');

const high: FrameBudgetState = {
  tier: 'high',
  overBudgetFrames: 0,
  averageMs: 0,
};
for (let index = 0; index < 120; index += 1) stepFrameBudget(high, 24);
assert.equal(high.tier, 'balanced');

const balanced: FrameBudgetState = {
  tier: 'balanced',
  overBudgetFrames: 0,
  averageMs: 0,
};
for (let index = 0; index < 120; index += 1) stepFrameBudget(balanced, 40);
assert.equal(balanced.tier, 'essential');

console.log('PASS: showroom quality selection and step-down');
```

Add:

```json
"check:showroom-quality": "tsx scripts/check-showroom-quality.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-quality`

Expected: FAIL with missing `src/lib/showroom-quality`.

- [ ] **Step 3: Implement deterministic tier selection**

Create `src/lib/showroom-quality.ts`:

```ts
export type QualityTier = 'high' | 'balanced' | 'essential';

export interface DeviceSignals {
  reducedMotion: boolean;
  webgl2: boolean;
  finePointer: boolean;
  viewportWidth: number;
  hardwareConcurrency: number;
  deviceMemory?: number;
}

export interface FrameBudgetState {
  tier: QualityTier;
  overBudgetFrames: number;
  averageMs: number;
}

export const QUALITY_DPR: Record<QualityTier, number> = {
  high: 1.75,
  balanced: 1.25,
  essential: 1,
};

export function selectInitialQuality(signals: DeviceSignals): QualityTier {
  if (signals.reducedMotion || !signals.webgl2) return 'essential';
  const enoughMemory =
    signals.deviceMemory === undefined || signals.deviceMemory >= 8;
  if (
    signals.finePointer &&
    signals.viewportWidth >= 1024 &&
    signals.hardwareConcurrency >= 8 &&
    enoughMemory
  ) return 'high';
  return 'balanced';
}

export function stepFrameBudget(
  state: FrameBudgetState,
  frameMs: number,
): FrameBudgetState {
  state.averageMs = state.averageMs === 0
    ? frameMs
    : state.averageMs * 0.9 + frameMs * 0.1;
  const limit = state.tier === 'high' ? 22 : state.tier === 'balanced' ? 38 : Infinity;
  state.overBudgetFrames = state.averageMs > limit
    ? state.overBudgetFrames + 1
    : 0;
  if (state.overBudgetFrames >= 120) {
    state.tier = state.tier === 'high' ? 'balanced' : 'essential';
    state.overBudgetFrames = 0;
    state.averageMs = 0;
  }
  return state;
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run check:showroom-quality
npm run lint
```

Expected: PASS and exit `0`.

- [ ] **Step 5: Commit the quality manager**

```bash
git add package.json scripts/check-showroom-quality.ts src/lib/showroom-quality.ts
git commit -m "feat: add showroom quality tiers"
```

---

### Task 3: Route resampling and morph interpolation

**Files:**
- Create: `src/lib/showroom-route.ts`
- Create: `scripts/check-showroom-route.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `RoutePoint`, `resampleRoute()`, `interpolateRouteInto()`.
- Consumers: `RouteLine` and `SceneDirector`.

- [ ] **Step 1: Add the failing route check**

Create `scripts/check-showroom-route.ts`:

```ts
import assert from 'node:assert/strict';
import {
  interpolateRouteInto,
  resampleRoute,
} from '../src/lib/showroom-route';

const line = resampleRoute([
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
], 5);
assert.deepEqual(line.map((point) => point.x), [0, 2.5, 5, 7.5, 10]);

const from = new Float32Array([0, 0, 0, 10, 0, 0]);
const to = new Float32Array([0, 10, 0, 10, 10, 0]);
const output = new Float32Array(6);
assert.equal(interpolateRouteInto(output, from, to, 0.5), output);
assert.deepEqual(Array.from(output), [0, 5, 0, 10, 5, 0]);
assert.throws(
  () => interpolateRouteInto(new Float32Array(3), from, to, 0.5),
  /equal length/,
);

console.log('PASS: showroom route resampling and morphing');
```

Add:

```json
"check:showroom-route": "tsx scripts/check-showroom-route.ts"
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `npm run check:showroom-route`

Expected: FAIL with missing `src/lib/showroom-route`.

- [ ] **Step 3: Implement allocation-free interpolation**

Create `src/lib/showroom-route.ts`:

```ts
export interface RoutePoint { x: number; y: number; z: number }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function resampleRoute(
  points: readonly RoutePoint[],
  count: number,
): RoutePoint[] {
  if (points.length < 2 || count < 2) {
    throw new Error('Route needs at least two points and two samples');
  }
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    lengths.push(lengths[index - 1] + Math.hypot(
      b.x - a.x,
      b.y - a.y,
      b.z - a.z,
    ));
  }
  const total = lengths[lengths.length - 1];
  return Array.from({ length: count }, (_, sampleIndex) => {
    const distance = total * (sampleIndex / (count - 1));
    let segment = 1;
    while (segment < lengths.length - 1 && lengths[segment] < distance) {
      segment += 1;
    }
    const startDistance = lengths[segment - 1];
    const span = lengths[segment] - startDistance || 1;
    const mix = (distance - startDistance) / span;
    const a = points[segment - 1];
    const b = points[segment];
    return {
      x: a.x + (b.x - a.x) * mix,
      y: a.y + (b.y - a.y) * mix,
      z: a.z + (b.z - a.z) * mix,
    };
  });
}

export function interpolateRouteInto(
  output: Float32Array,
  from: Float32Array,
  to: Float32Array,
  progress: number,
): Float32Array {
  if (output.length !== from.length || from.length !== to.length) {
    throw new Error('Route buffers must have equal length');
  }
  const mix = clamp01(progress);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = from[index] + (to[index] - from[index]) * mix;
  }
  return output;
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run check:showroom-route
npm run lint
```

Expected: PASS and exit `0`.

- [ ] **Step 5: Commit route math**

```bash
git add package.json scripts/check-showroom-route.ts src/lib/showroom-route.ts
git commit -m "feat: add showroom route morph math"
```

---

### Task 4: Reproducible showroom assets

**Files:**
- Create: `public/environments/ferndale_studio_09_1k.hdr`
- Create: `public/environments/rooftop_night_1k.hdr`
- Create: `public/models/red_bull_f1_showroom.glb`
- Create: `scripts/check-showroom-assets.mjs`
- Create: `src/components/showroom/showroom-assets.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `SHOWROOM_ASSETS`, verified HDR SHA-1 values, and the compressed model node contract.
- Consumers: `AssetManager` and deployment verification.

- [ ] **Step 1: Install the pinned optimization tool**

Run: `npm install --save-dev @gltf-transform/cli`

Expected: `package.json` and `package-lock.json` add `@gltf-transform/cli` under dev dependencies.

- [ ] **Step 2: Download the confirmed CC0 1K HDR files**

Run:

```bash
mkdir -p public/environments
curl -L https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/ferndale_studio_09_1k.hdr -o public/environments/ferndale_studio_09_1k.hdr
curl -L https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rooftop_night_1k.hdr -o public/environments/rooftop_night_1k.hdr
shasum public/environments/ferndale_studio_09_1k.hdr public/environments/rooftop_night_1k.hdr
```

Expected:

```text
300723e57b930413fa3e493033033713f911dd18  public/environments/ferndale_studio_09_1k.hdr
4dc306b1cc07c5e9e830758dede1eb7ed8ecbebd  public/environments/rooftop_night_1k.hdr
```

Record the sources in the eventual PR description:

- `https://polyhaven.com/a/ferndale_studio_09`
- `https://polyhaven.com/a/rooftop_night`
- License: CC0 as stated on each asset page.

- [ ] **Step 3: Optimize a new, non-destructive showroom model**

Run:

```bash
npx gltf-transform optimize public/models/red_bull_f1_rigged.glb /tmp/red_bull_f1_showroom-webp.glb --texture-compress webp
npx gltf-transform meshopt /tmp/red_bull_f1_showroom-webp.glb public/models/red_bull_f1_showroom.glb --level medium
```

Expected: a new `public/models/red_bull_f1_showroom.glb`; the original rigged model remains unchanged.

- [ ] **Step 4: Add the failing asset contract check**

Create `scripts/check-showroom-assets.mjs`:

```js
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const assets = {
  model: 'public/models/red_bull_f1_showroom.glb',
  studio: 'public/environments/ferndale_studio_09_1k.hdr',
  night: 'public/environments/rooftop_night_1k.hdr',
};

const parseGlbJson = async (path) => {
  const bytes = await readFile(path);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + length));
};

const sha1 = async (path) => createHash('sha1')
  .update(await readFile(path))
  .digest('hex');

const modelStat = await stat(assets.model);
assert.ok(modelStat.size <= 15 * 1024 * 1024, `Showroom GLB is ${modelStat.size} bytes`);

const gltf = await parseGlbJson(assets.model);
const names = new Set(gltf.nodes.map((node) => node.name));
for (const name of ['F1_Car', 'Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
  assert.ok(names.has(name), `Missing required node: ${name}`);
}

assert.equal(await sha1(assets.studio), '300723e57b930413fa3e493033033713f911dd18');
assert.equal(await sha1(assets.night), '4dc306b1cc07c5e9e830758dede1eb7ed8ecbebd');
console.log(`PASS: showroom assets (${(modelStat.size / 1024 / 1024).toFixed(2)} MB model)`);
```

Add:

```json
"check:showroom-assets": "node scripts/check-showroom-assets.mjs"
```

- [ ] **Step 5: Run the asset check**

Run: `npm run check:showroom-assets`

Expected: PASS with model size at or below `15.00 MB`. If the size assertion fails, rerun optimization with `gltf-transform resize` at 2048 pixels before the WebP and Meshopt commands, then visually compare the result before accepting it:

```bash
npx gltf-transform resize public/models/red_bull_f1_rigged.glb /tmp/red_bull_f1_showroom-2k.glb --width 2048 --height 2048
npx gltf-transform optimize /tmp/red_bull_f1_showroom-2k.glb /tmp/red_bull_f1_showroom-webp.glb --texture-compress webp
npx gltf-transform meshopt /tmp/red_bull_f1_showroom-webp.glb public/models/red_bull_f1_showroom.glb --level medium
```

- [ ] **Step 6: Add the typed manifest**

Create `src/components/showroom/showroom-assets.ts`:

```ts
export const SHOWROOM_ASSETS = {
  car: '/models/red_bull_f1_showroom.glb',
  studioHdr: '/environments/ferndale_studio_09_1k.hdr',
  nightHdr: '/environments/rooftop_night_1k.hdr',
} as const;

export type ShowroomAssetKey = keyof typeof SHOWROOM_ASSETS;

export interface ShowroomLoadProgress {
  critical: number;
  optional: number;
  status: 'loading' | 'ready' | 'fallback';
}
```

- [ ] **Step 7: Run project checks and commit assets**

Run:

```bash
npm run check:showroom-assets
npm run lint
npm run build
```

Expected: all exit `0`. At this intermediate commit only, record the existing large-chunk warning; Task 10 must move the showroom behind the lazy boundary and Task 12 verifies the resulting split.

Commit:

```bash
git add package.json package-lock.json scripts/check-showroom-assets.mjs src/components/showroom/showroom-assets.ts public/environments public/models/red_bull_f1_showroom.glb
git commit -m "feat: add optimized showroom assets"
```

---
