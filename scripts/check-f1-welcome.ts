import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  AUTO_EXPLODE_DELAY_MS,
  GLITCH_CLEAN_FRAME_MS,
  GLITCH_CLEAN_HOLD_MS,
  GLITCH_DURATION_MS,
  HOLOGRAM_REVEAL_MS,
} from '../src/lib/f1-glitch-sequence';
import { createF1WelcomeSequence } from '../src/lib/f1-welcome-sequence';
import * as glitchPostProcessModule from '../src/lib/f1-glitch-postprocess';

const { createF1GlitchPostProcess, renderF1GlitchFrame } = glitchPostProcessModule;

const source = readFileSync(
  new URL('../src/components/WelcomePage.tsx', import.meta.url),
  'utf8',
);
const particleSource = readFileSync(
  new URL('../src/components/ParticleBackground.tsx', import.meta.url),
  'utf8',
);
const glitchPostSource = readFileSync(
  new URL('../src/lib/f1-glitch-postprocess.ts', import.meta.url),
  'utf8',
);
const agentGuidance = readFileSync(
  new URL('../AGENTS.md', import.meta.url),
  'utf8',
);

assert.match(
  particleSource,
  /zIndex:\s*95/,
  'the transparent car canvas must render above ordinary welcome UI',
);
assert.match(
  particleSource,
  /forwardPointerToUnderlyingWelcomeUi/,
  'the foreground canvas must forward exposed-control clicks when the car ray misses',
);
assert.match(
  particleSource,
  /document\s*\.elementsFromPoint/,
  'underlying welcome controls must be resolved from the real layered DOM',
);
assert.match(source, /data-f1-welcome-action="enter"/);
assert.match(
  source,
  /className="[^"]*select-none[^"]*touch-none[^"]*"/,
  'the entire welcome scene must opt out of native text selection during a car hold',
);
assert.match(
  source,
  /WebkitTouchCallout:\s*'none'/,
  'iOS must not show its native long-press callout over the showroom',
);
assert.match(source, /z-\[70\][^\n]*StartLights|StartLights[\s\S]*?z-\[70\]/);
assert.match(source, /z-\[100\]/, 'intentional modal overlays may remain above the car');
assert.match(source, /z-\[110\]/, 'the blocking loader must remain above the car');

for (const phrase of [
  'car canvas stays above ordinary welcome UI',
  'WheelSpin_FL',
  'versioned GLB',
  'desktop and mobile',
  'arrival timeline',
]) {
  assert.match(agentGuidance, new RegExp(phrase), `AGENTS.md must contain: ${phrase}`);
}

assert.match(
  source,
  /const hasManualInteractionRef = React\.useRef\(false\);/,
  'WelcomePage must remember any accepted manual car interaction',
);
assert.match(
  source,
  /const autoExplodeTimerRef = React\.useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
  'WelcomePage must retain the manual-interaction timer compatibility ref',
);
assert.match(source, /const \[glitchProgress, setGlitchProgress\] = useState<number \| null>\(null\)/);
assert.match(source, /const glitchFrameRef = React\.useRef<number \| null>\(null\)/);
assert.match(source, /cancelAutomaticShowroomSequence/);
assert.match(source, /cancelAnimationFrame\(glitchFrameRef\.current\)/);
assert.match(source, /glitchProgress=\{glitchProgress\}/);
assert.match(source, /setIsCarExploded\(true\)/);
assert.match(source, /createF1WelcomeSequence/);
assert.match(source, /automaticSequenceRef/);
assert.doesNotMatch(
  source,
  /autoExplodeTimerRef\.current\s*=\s*setTimeout/,
  'automatic explosion must be animation-frame owned, never timeout owned',
);
assert.doesNotMatch(
  source,
  /sequenceStartedAtRef/,
  'WelcomePage must pass the sequence start timestamp directly without redundant ref state',
);
assert.match(
  source,
  /const hasStartedEntryRef = React\.useRef\(false\);/,
  'WelcomePage must synchronously reject repeated ENTER activation',
);
assert.match(
  source,
  /const handleCarManualInteraction = useCallback\(\(\) => \{[\s\S]*?markF1ManualInteraction\([\s\S]*?hasManualInteractionRef,[\s\S]*?autoExplodeTimerRef,[\s\S]*?clearTimeout,[\s\S]*?\);[\s\S]*?cancelAutomaticShowroomSequence\(\);[\s\S]*?\}\, \[cancelAutomaticShowroomSequence\]\);/,
  'WelcomePage must expose one focused manual-interaction cancellation callback',
);
assert.match(
  source,
  /const toggleExplodedView = useCallback\(\(\) => \{[\s\S]*?handleCarManualInteraction\(\);[\s\S]*?setIsCarExploded\(\(value\) => !value\);/,
  'manual toggles must cancel pending auto-explode before changing state',
);
assert.match(
  source,
  /progress < 100[\s\S]*?\|\| isTransitioning[\s\S]*?\|\| hasManualInteractionRef\.current[\s\S]*?\|\| automaticSequenceRef\.current/,
  'auto-explode must remain cancelled after any accepted manual interaction',
);
assert.match(
  source,
  /onCarClick=\{toggleExplodedView\}/,
  'canvas car clicks must preserve the same exploded-view toggle behavior',
);
assert.match(
  source,
  /onCarManualInteraction=\{handleCarManualInteraction\}/,
  'accepted car holds must notify WelcomePage without toggling exploded state',
);
assert.doesNotMatch(source, /\{\/\* Exploded view toggle \*\/\}/);
assert.doesNotMatch(source, /CLICK CAR TO REASSEMBLE/);
assert.match(
  particleSource,
  /tier:\s*prefersReducedMotion\s*\?\s*'fallback'\s*:\s*'reflective'/,
  'mobile viewports must retain the reflective tier unless reduced motion is requested',
);
assert.match(particleSource, /glitchProgress\?: number \| null/);
assert.match(particleSource, /createF1GlitchPostProcess/);
assert.match(particleSource, /renderF1GlitchFrame/);
assert.match(glitchPostSource, /glitchPostProcess\.render/);
assert.match(particleSource, /glitchPostProcess\.resize/);
assert.match(particleSource, /glitchPostProcess\.dispose\(\)/);
assert.match(glitchPostSource, /webglcontextlost/);
assert.match(glitchPostSource, /webglcontextrestored/);
assert.match(particleSource, /bindF1GlitchContextRecovery/);
assert.match(particleSource, /prewarm\(renderShowroomForGlitchPrewarm\)/);
assert.match(
  particleSource,
  /renderF1GlitchPrewarmSource\([\s\S]*?source:\s*f1CarGroup/,
  'the actual late GLB must be made renderable only inside the target-bound prewarm pass',
);
assert.match(
  particleSource,
  /revalidateGlitchAfterModelInjection/,
  'late GLB injection must prewarm the car source shaders before glitch activation',
);
assert.match(
  particleSource,
  /revertHologramMaterial\(f1CarGroup\)[\s\S]*?revalidateGlitchAfterModelInjection\?\.\(\)/,
  'restoring the original GLB materials must prewarm their offscreen shader variants before the first pulse',
);
assert.match(
  particleSource,
  /__f1RendererAudit/,
  'the mounted showroom canvas must expose a focused context-loss integration probe',
);
assert.match(glitchPostSource, /new THREE\.WebGLRenderTarget/);
assert.match(glitchPostSource, /getF1GlitchPulse/);
assert.match(glitchPostSource, /prefersReducedMotion/);
assert.match(glitchPostSource, /mobile/);
assert.match(glitchPostSource, /renderer\.setRenderTarget\(null\)/);
assert.match(glitchPostSource, /scan\*spatial/, 'reduced motion must suppress spatial scan bands');
assert.match(glitchPostSource, /vec2 blockCell=floor\(vUv\*vec2\(/, 'block noise must use both UV axes');
assert.match(glitchPostSource, /vec2 blockOffset=/);
assert.match(glitchPostSource, /float scanDistortion=/);
assert.match(glitchPostSource, /float pixelNoise=/);
assert.match(particleSource, /\[F1 glitch\] Post-process unavailable/);

class FakeGlitchContext {
  readonly NO_ERROR = 0;
  readonly INVALID_OPERATION = 0x0502;
  readonly FRAMEBUFFER = 0x8D40;
  readonly FRAMEBUFFER_COMPLETE = 0x8CD5;
  readonly FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 0x8CD6;
  framebufferStatus = this.FRAMEBUFFER_COMPLETE;
  contextLost = false;
  private readonly errors: number[] = [];

  getError(): number {
    return this.errors.shift() ?? this.NO_ERROR;
  }

  pushError(error: number): void {
    this.errors.push(error);
  }

  checkFramebufferStatus(): number {
    return this.framebufferStatus;
  }

  isContextLost(): boolean {
    return this.contextLost;
  }
}

class FakeGlitchRenderer {
  readonly events: string[] = [];
  readonly context = new FakeGlitchContext();
  readonly domElement = new EventTarget();
  renderedScene: THREE.Scene | null = null;
  compileCalls = 0;
  failShaderLink = false;
  failNextRenderedDrawWithGlError = false;
  supportsHalfFloat = true;
  supportsFloat = true;
  halfFloatFramebufferComplete = true;
  floatFramebufferComplete = true;
  autoClear = false;
  outputColorSpace = THREE.SRGBColorSpace;
  readonly extensions = {
    has: (name: string) => (
      name === 'EXT_color_buffer_half_float'
        ? this.supportsHalfFloat
        : name === 'EXT_color_buffer_float'
          ? this.supportsFloat
          : false
    ),
  };
  readonly debug: THREE.WebGLDebug = {
    checkShaderErrors: true,
    onShaderError: null,
  };
  private target: THREE.WebGLRenderTarget | null = null;

  setRenderTarget(target: THREE.WebGLRenderTarget | null): void {
    this.target = target;
    this.events.push(target === null ? 'screen' : 'target');
    if (target?.texture.type === THREE.HalfFloatType) {
      this.context.framebufferStatus = this.halfFloatFramebufferComplete
        ? this.context.FRAMEBUFFER_COMPLETE
        : this.context.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
    } else if (target?.texture.type === THREE.FloatType) {
      this.context.framebufferStatus = this.floatFramebufferComplete
        ? this.context.FRAMEBUFFER_COMPLETE
        : this.context.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
    } else {
      this.context.framebufferStatus = this.context.FRAMEBUFFER_COMPLETE;
    }
  }

  getRenderTarget(): THREE.WebGLRenderTarget | null {
    return this.target;
  }

  compile(): Set<THREE.Material> {
    this.compileCalls += 1;
    this.events.push('compile');
    return new Set();
  }

  initRenderTarget(target: THREE.WebGLRenderTarget): void {
    this.events.push(`init:${target.texture.type}`);
  }

  getContext(): FakeGlitchContext {
    return this.context;
  }

  clear(): void {
    this.events.push('clear');
  }

  render(scene: THREE.Scene): void {
    this.events.push('render');
    this.renderedScene = scene;
    if (this.failNextRenderedDrawWithGlError) {
      this.failNextRenderedDrawWithGlError = false;
      this.context.pushError(this.context.INVALID_OPERATION);
    }
    if (this.failShaderLink) {
      this.failShaderLink = false;
      this.debug.onShaderError?.(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
    }
  }
}

assert.equal(
  typeof (glitchPostProcessModule as Record<string, unknown>).renderF1GlitchPrewarmSource,
  'function',
  'target-bound source prewarming must be behaviorally testable',
);
const prewarmRenderer = new FakeGlitchRenderer();
const prewarmPreviousTarget = new THREE.WebGLRenderTarget(2, 2);
const prewarmTarget = new THREE.WebGLRenderTarget(4, 4);
prewarmRenderer.setRenderTarget(prewarmPreviousTarget);
const prewarmSource = new THREE.Group();
prewarmSource.visible = false;
const prewarmMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial(),
);
const originalBeforeRender = prewarmMesh.onBeforeRender;
prewarmMesh.frustumCulled = true;
prewarmSource.add(prewarmMesh);
let prewarmObservedBoundTarget = false;
const prewarmResult = (
  glitchPostProcessModule as unknown as {
    renderF1GlitchPrewarmSource(input: {
      renderer: THREE.WebGLRenderer;
      target: THREE.WebGLRenderTarget;
      source: THREE.Object3D | null;
      renderSource(target: THREE.WebGLRenderTarget): void;
    }): { sourcePassParticipated: boolean };
  }
).renderF1GlitchPrewarmSource({
  renderer: prewarmRenderer as unknown as THREE.WebGLRenderer,
  target: prewarmTarget,
  source: prewarmSource,
  renderSource: (target) => {
    assert.equal(target, prewarmTarget);
    assert.equal(prewarmRenderer.getRenderTarget(), prewarmTarget);
    assert.equal(prewarmSource.visible, true);
    assert.equal(prewarmMesh.frustumCulled, false);
    prewarmObservedBoundTarget = true;
    prewarmMesh.onBeforeRender(
      prewarmRenderer as unknown as THREE.WebGLRenderer,
      new THREE.Scene(),
      new THREE.Camera(),
      prewarmMesh.geometry,
      prewarmMesh.material,
      null,
    );
  },
});
assert.equal(prewarmObservedBoundTarget, true);
assert.equal(prewarmResult.sourcePassParticipated, true, 'a real model mesh draw must participate');
assert.equal(prewarmSource.visible, false, 'hidden late models must remain hidden after prewarm');
assert.equal(prewarmMesh.frustumCulled, true, 'mesh culling state must be restored after prewarm');
assert.equal(prewarmMesh.onBeforeRender, originalBeforeRender, 'mesh callbacks must be restored after prewarm');
assert.equal(
  prewarmRenderer.getRenderTarget(),
  prewarmPreviousTarget,
  'prewarm must restore the renderer target even though its source pass is target-bound',
);
assert.throws(
  () => (
    glitchPostProcessModule as unknown as {
      renderF1GlitchPrewarmSource(input: {
        renderer: THREE.WebGLRenderer;
        target: THREE.WebGLRenderTarget;
        source: THREE.Object3D | null;
        renderSource(target: THREE.WebGLRenderTarget): void;
      }): { sourcePassParticipated: boolean };
    }
  ).renderF1GlitchPrewarmSource({
    renderer: prewarmRenderer as unknown as THREE.WebGLRenderer,
    target: prewarmTarget,
    source: prewarmSource,
    renderSource: () => { throw new Error('injected source failure'); },
  }),
  /injected source failure/,
);
assert.equal(prewarmSource.visible, false, 'failed prewarm must restore model visibility');
assert.equal(prewarmMesh.frustumCulled, true, 'failed prewarm must restore mesh culling');
assert.equal(prewarmRenderer.getRenderTarget(), prewarmPreviousTarget, 'failed prewarm must restore target');
prewarmPreviousTarget.dispose();
prewarmTarget.dispose();
prewarmMesh.geometry.dispose();
prewarmMesh.material.dispose();

const constructionFailureRenderer = new FakeGlitchRenderer();
const ownedTarget = new THREE.WebGLRenderTarget(4, 4);
const ownedMaterial = new THREE.ShaderMaterial();
const ownedGeometry = new THREE.PlaneGeometry(2, 2);
let ownedTargetDisposals = 0;
let ownedMaterialDisposals = 0;
let ownedGeometryDisposals = 0;
ownedTarget.dispose = () => { ownedTargetDisposals += 1; };
ownedMaterial.dispose = () => { ownedMaterialDisposals += 1; };
ownedGeometry.dispose = () => { ownedGeometryDisposals += 1; };
const injectedConstructionFailure = new Error('injected mesh construction failure');
assert.throws(
  () => createF1GlitchPostProcess(
    constructionFailureRenderer as unknown as THREE.WebGLRenderer,
    4,
    4,
    1,
    { mobile: false, prefersReducedMotion: false },
    {
      createRenderTarget: () => ownedTarget,
      createShaderMaterial: () => ownedMaterial,
      createGeometry: () => ownedGeometry,
      createMesh: () => { throw injectedConstructionFailure; },
    },
  ),
  (error) => error === injectedConstructionFailure,
  'construction failure must rethrow the original error',
);
assert.deepEqual(
  [ownedTargetDisposals, ownedMaterialDisposals, ownedGeometryDisposals],
  [1, 1, 1],
  'render target, material, and geometry must be transactionally released before create returns',
);

const shaderFailureRenderer = new FakeGlitchRenderer();
shaderFailureRenderer.autoClear = true;
shaderFailureRenderer.failShaderLink = true;
const shaderFailurePreviousTarget = new THREE.WebGLRenderTarget(2, 2);
shaderFailureRenderer.setRenderTarget(shaderFailurePreviousTarget);
shaderFailureRenderer.events.length = 0;
let priorShaderErrorCalls = 0;
const priorShaderError = () => { priorShaderErrorCalls += 1; };
shaderFailureRenderer.debug.checkShaderErrors = false;
shaderFailureRenderer.debug.onShaderError = priorShaderError;
assert.throws(
  () => createF1GlitchPostProcess(
    shaderFailureRenderer as unknown as THREE.WebGLRenderer,
    100,
    50,
    1,
    { mobile: false, prefersReducedMotion: false },
  ),
  /failed to compile or link/,
  'lazy shader link errors must disable the post-process before active output',
);
assert.equal(priorShaderErrorCalls, 1, 'an existing renderer shader diagnostic callback must still run');
assert.equal(shaderFailureRenderer.autoClear, true, 'shader validation must restore autoClear');
assert.equal(shaderFailureRenderer.debug.checkShaderErrors, false);
assert.equal(shaderFailureRenderer.debug.onShaderError, priorShaderError);
assert.equal(
  shaderFailureRenderer.getRenderTarget(),
  shaderFailurePreviousTarget,
  'shader validation must restore the render target',
);
shaderFailurePreviousTarget.dispose();

const simulatedOffscreenTarget = new THREE.WebGLRenderTarget(1, 1);
const fallbackTargets: Array<THREE.WebGLRenderTarget | null> = [];
let fallbackWarnings = 0;
let failedPostDisposals = 0;
let failingPostProcess: glitchPostProcessModule.F1GlitchPostProcess | null = {
  prewarm() {
    // This stub represents a resource that already passed initialization.
  },
  render({ renderSource }) {
    renderSource(simulatedOffscreenTarget);
    throw new Error('simulated draw failure after the source composite');
  },
  resize() {
    throw new Error('a failed resource must never be resized again');
  },
  dispose() {
    failedPostDisposals += 1;
  },
};
failingPostProcess = renderF1GlitchFrame({
  glitchPostProcess: failingPostProcess,
  progress: 0.5,
  renderShowroom: (target) => fallbackTargets.push(target),
  onUnavailable: () => { fallbackWarnings += 1; },
});
assert.equal(failingPostProcess, null, 'a failed active resource must stay disabled');
assert.deepEqual(
  fallbackTargets,
  [simulatedOffscreenTarget, null],
  'a failure after offscreen source rendering must redraw directly in the same frame',
);
assert.equal(failedPostDisposals, 1);
assert.equal(fallbackWarnings, 1);
failingPostProcess = renderF1GlitchFrame({
  glitchPostProcess: failingPostProcess,
  progress: 0.6,
  renderShowroom: (target) => fallbackTargets.push(target),
  onUnavailable: () => { fallbackWarnings += 1; },
});
assert.equal(failingPostProcess, null);
assert.equal(fallbackTargets.at(-1), null, 'later active timing frames must remain on direct rendering');
assert.equal(fallbackWarnings, 1, 'persistent direct fallback must not warn again');
simulatedOffscreenTarget.dispose();

let zeroPulsePostRenders = 0;
const zeroPulseTargets: Array<THREE.WebGLRenderTarget | null> = [];
const zeroPulsePostProcess: glitchPostProcessModule.F1GlitchPostProcess = {
  prewarm() {},
  render() { zeroPulsePostRenders += 1; },
  resize() {},
  dispose() {},
};
const retainedZeroPulsePostProcess = renderF1GlitchFrame({
  glitchPostProcess: zeroPulsePostProcess,
  progress: 0,
  renderShowroom: (target) => zeroPulseTargets.push(target),
  onUnavailable: () => undefined,
});
assert.equal(retainedZeroPulsePostProcess, zeroPulsePostProcess);
assert.equal(zeroPulsePostRenders, 0, 'pulse-zero must bypass the composite output transform');
assert.deepEqual(zeroPulseTargets, [null], 'pulse-zero must be framebuffer-equivalent to direct rendering');

const desktopRenderer = new FakeGlitchRenderer();
const desktopPostProcess = createF1GlitchPostProcess(
  desktopRenderer as unknown as THREE.WebGLRenderer,
  100,
  50,
  3,
  { mobile: false, prefersReducedMotion: false },
);
assert.equal(desktopRenderer.compileCalls, 1, 'the fullscreen shader must be compiled before active rendering');
desktopRenderer.events.length = 0;
let prewarmedDesktopTarget: THREE.WebGLRenderTarget | null = null;
(desktopPostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => {
  prewarmedDesktopTarget = target;
  desktopRenderer.events.push('source-prewarm');
  desktopRenderer.setRenderTarget(target);
});
assert(prewarmedDesktopTarget, 'prewarm must allocate and exercise the full-size showroom target');
assert.equal(prewarmedDesktopTarget.width, 200);
assert.equal(prewarmedDesktopTarget.height, 100);
assert.deepEqual(
  desktopRenderer.events,
  ['source-prewarm', 'target', 'target', 'screen', 'render', 'screen'],
  'prewarm must exercise the offscreen source and identity composite before restoring the screen target',
);
desktopRenderer.events.length = 0;
let desktopTarget: THREE.WebGLRenderTarget | null = null;
desktopPostProcess.render({
  progress: 0.5,
  renderSource: (target) => {
    desktopRenderer.events.push('source');
    desktopTarget = target;
  },
});
assert(desktopTarget, 'post-process must provide its offscreen target to the showroom renderer');
assert.equal(desktopTarget.width, 200, 'desktop target DPR must be capped at 2');
assert.equal(desktopTarget.height, 100, 'desktop target height must follow the capped DPR');
assert.equal(
  desktopTarget.texture.type,
  THREE.HalfFloatType,
  'the offscreen composite must retain HDR precision until each source material applies its output transform',
);
assert.equal(
  desktopTarget.texture.colorSpace,
  THREE.LinearSRGBColorSpace,
  'the HDR source composite must remain linear until the single fullscreen output transform',
);
assert.deepEqual(
  desktopRenderer.events,
  ['source', 'target', 'screen', 'clear', 'render'],
  'source composition must finish before the post-process renders to the transparent canvas',
);
assert(desktopRenderer.renderedScene);
const desktopQuad = desktopRenderer.renderedScene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
assert.equal(desktopQuad.material.transparent, false, 'the already-composited alpha must not be blended twice');
assert.equal(desktopQuad.material.blending, THREE.NoBlending);
assert.equal(desktopQuad.material.toneMapped, true);
assert.equal(desktopQuad.material.fragmentShader.match(/#include <tonemapping_fragment>/g)?.length, 1);
assert.equal(desktopQuad.material.fragmentShader.match(/#include <colorspace_fragment>/g)?.length, 1);
assert.doesNotMatch(desktopQuad.material.fragmentShader, /#include <opaque_fragment>/);
assert.equal(desktopQuad.material.uniforms.uPulse.value, 1, 'the post-process must consume the glitch pulse envelope');
assert.equal(desktopQuad.material.uniforms.uAmplitude.value, 1);
assert.equal(desktopQuad.material.uniforms.uReducedMotion.value, 0);
assert(desktopQuad.material.uniforms.uBlockSeed, 'block noise requires an independent frame seed');
assert(desktopQuad.material.uniforms.uScanSeed, 'scan distortion requires an independent frame seed');
assert(desktopQuad.material.uniforms.uNoiseSeed, 'grain noise requires an independent frame seed');
assert(desktopQuad.material.uniforms.uSpatialAmount, 'spatial artifacts require a pulse-gated amplitude');
assert(desktopQuad.material.uniforms.uReducedBrightness, 'reduced motion requires a separate brightness flicker');
assert(desktopQuad.material.uniforms.uReducedNoise, 'reduced motion requires a separate noise flicker');

const readDesktopGlitchState = (progress: number) => {
  desktopPostProcess.render({ progress, renderSource: () => undefined });
  return {
    pulse: desktopQuad.material.uniforms.uPulse.value as number,
    spatialAmount: desktopQuad.material.uniforms.uSpatialAmount.value as number,
    blockSeed: desktopQuad.material.uniforms.uBlockSeed.value as number,
    scanSeed: desktopQuad.material.uniforms.uScanSeed.value as number,
    noiseSeed: desktopQuad.material.uniforms.uNoiseSeed.value as number,
  };
};

const firstPulseState = readDesktopGlitchState(0.16);
const secondPulseState = readDesktopGlitchState(0.5);
const thirdPulseState = readDesktopGlitchState(0.82);
for (const state of [firstPulseState, secondPulseState, thirdPulseState]) {
  assert.equal(state.pulse, 1, 'each of the three pulse centers must fully activate');
  assert(state.spatialAmount > 0, 'each pulse must activate spatial artifacts');
  assert.equal(new Set([state.blockSeed, state.scanSeed, state.noiseSeed]).size, 3);
}
assert.notDeepEqual(
  [firstPulseState.blockSeed, firstPulseState.scanSeed, firstPulseState.noiseSeed],
  [secondPulseState.blockSeed, secondPulseState.scanSeed, secondPulseState.noiseSeed],
  'independent glitch seeds must evolve between pulses',
);
const betweenPulseState = readDesktopGlitchState(0.32);
assert.equal(betweenPulseState.pulse, 0);
assert.equal(betweenPulseState.spatialAmount, 0, 'block, scan, and grain artifacts must stop between pulses');

let targetDisposals = 0;
let geometryDisposals = 0;
let materialDisposals = 0;
desktopTarget.dispose = () => {
  targetDisposals += 1;
  throw new Error('simulated target disposal failure');
};
desktopQuad.geometry.dispose = () => { geometryDisposals += 1; };
desktopQuad.material.dispose = () => { materialDisposals += 1; };
desktopPostProcess.dispose();
desktopPostProcess.dispose();
assert.deepEqual(
  [targetDisposals, geometryDisposals, materialDisposals],
  [1, 1, 1],
  'all owned GPU resources must be disposed exactly once',
);

const floatFallbackRenderer = new FakeGlitchRenderer();
floatFallbackRenderer.halfFloatFramebufferComplete = false;
const floatFallbackPostProcess = createF1GlitchPostProcess(
  floatFallbackRenderer as unknown as THREE.WebGLRenderer,
  64,
  32,
  1,
  { mobile: false, prefersReducedMotion: false },
);
let floatFallbackTarget: THREE.WebGLRenderTarget | null = null;
(floatFallbackPostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => {
  floatFallbackTarget = target;
  floatFallbackRenderer.setRenderTarget(target);
});
assert(floatFallbackTarget);
assert.equal(
  floatFallbackTarget.texture.type,
  THREE.FloatType,
  'a validated Float target is the only allowed HDR fallback when HalfFloat is incomplete',
);
floatFallbackPostProcess.dispose();

const unavailableHdrRenderer = new FakeGlitchRenderer();
unavailableHdrRenderer.supportsHalfFloat = false;
unavailableHdrRenderer.supportsFloat = false;
assert.throws(
  () => createF1GlitchPostProcess(
    unavailableHdrRenderer as unknown as THREE.WebGLRenderer,
    64,
    32,
    1,
    { mobile: false, prefersReducedMotion: false },
  ),
  /HDR render target unavailable/,
  'the effect must fall back to direct rendering instead of silently using a clipping RGBA8 target',
);

const incompleteHdrRenderer = new FakeGlitchRenderer();
incompleteHdrRenderer.halfFloatFramebufferComplete = false;
incompleteHdrRenderer.floatFramebufferComplete = false;
assert.throws(
  () => createF1GlitchPostProcess(
    incompleteHdrRenderer as unknown as THREE.WebGLRenderer,
    64,
    32,
    1,
    { mobile: false, prefersReducedMotion: false },
  ),
  /framebuffer incomplete/,
  'non-throwing framebuffer allocation failures must disable the visual effect before activation',
);

const sourceGlErrorRenderer = new FakeGlitchRenderer();
let sourceGlErrorPostProcess: glitchPostProcessModule.F1GlitchPostProcess | null = createF1GlitchPostProcess(
  sourceGlErrorRenderer as unknown as THREE.WebGLRenderer,
  64,
  32,
  1,
  { mobile: false, prefersReducedMotion: false },
);
(sourceGlErrorPostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => sourceGlErrorRenderer.setRenderTarget(target));
const sourceGlErrorTargets: Array<THREE.WebGLRenderTarget | null> = [];
let sourceGlErrorWarnings = 0;
sourceGlErrorPostProcess = renderF1GlitchFrame({
  glitchPostProcess: sourceGlErrorPostProcess,
  progress: 0.5,
  renderShowroom: (target) => {
    sourceGlErrorTargets.push(target);
    sourceGlErrorRenderer.setRenderTarget(target);
    if (target) sourceGlErrorRenderer.context.pushError(sourceGlErrorRenderer.context.INVALID_OPERATION);
  },
  onUnavailable: () => { sourceGlErrorWarnings += 1; },
});
assert.equal(sourceGlErrorPostProcess, null);
assert.equal(sourceGlErrorTargets.at(-1), null, 'a source GL error must trigger same-frame direct redraw');
assert.equal(sourceGlErrorWarnings, 1);

const compositeGlErrorRenderer = new FakeGlitchRenderer();
let compositeGlErrorPostProcess: glitchPostProcessModule.F1GlitchPostProcess | null = createF1GlitchPostProcess(
  compositeGlErrorRenderer as unknown as THREE.WebGLRenderer,
  64,
  32,
  1,
  { mobile: false, prefersReducedMotion: false },
);
(compositeGlErrorPostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => compositeGlErrorRenderer.setRenderTarget(target));
const compositeGlErrorTargets: Array<THREE.WebGLRenderTarget | null> = [];
compositeGlErrorPostProcess = renderF1GlitchFrame({
  glitchPostProcess: compositeGlErrorPostProcess,
  progress: 0.5,
  renderShowroom: (target) => {
    compositeGlErrorTargets.push(target);
    compositeGlErrorRenderer.setRenderTarget(target);
    if (target) compositeGlErrorRenderer.failNextRenderedDrawWithGlError = true;
  },
  onUnavailable: () => undefined,
});
assert.equal(compositeGlErrorPostProcess, null);
assert.equal(compositeGlErrorTargets.at(-1), null, 'a composite GL error must trigger same-frame direct redraw');

const lostContextRenderer = new FakeGlitchRenderer();
let lostContextPostProcess: glitchPostProcessModule.F1GlitchPostProcess | null = createF1GlitchPostProcess(
  lostContextRenderer as unknown as THREE.WebGLRenderer,
  64,
  32,
  1,
  { mobile: false, prefersReducedMotion: false },
);
(lostContextPostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => lostContextRenderer.setRenderTarget(target));
lostContextRenderer.context.contextLost = true;
const lostContextTargets: Array<THREE.WebGLRenderTarget | null> = [];
lostContextPostProcess = renderF1GlitchFrame({
  glitchPostProcess: lostContextPostProcess,
  progress: 0.5,
  renderShowroom: (target) => lostContextTargets.push(target),
  onUnavailable: () => undefined,
});
assert.equal(lostContextPostProcess, null, 'context loss must persistently disable the stale resource');
assert.equal(lostContextTargets.at(-1), null, 'context loss must retain the direct render route');

assert.equal(
  typeof (glitchPostProcessModule as Record<string, unknown>).bindF1GlitchContextRecovery,
  'function',
  'the component needs a tested context restoration binding',
);
let contextLostCallbacks = 0;
let contextRestoredCallbacks = 0;
const removeContextRecovery = (
  glitchPostProcessModule as unknown as {
    bindF1GlitchContextRecovery(
      canvas: EventTarget,
      callbacks: { onContextLost(): void; onContextRestored(): void },
    ): () => void;
  }
).bindF1GlitchContextRecovery(lostContextRenderer.domElement, {
  onContextLost: () => { contextLostCallbacks += 1; },
  onContextRestored: () => { contextRestoredCallbacks += 1; },
});
lostContextRenderer.domElement.dispatchEvent(new Event('webglcontextlost'));
lostContextRenderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
assert.deepEqual([contextLostCallbacks, contextRestoredCallbacks], [1, 1]);
removeContextRecovery();
lostContextRenderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
assert.equal(contextRestoredCallbacks, 1, 'cleanup must remove the restoration callback');

assert.equal(
  typeof (glitchPostProcessModule as Record<string, unknown>).restoreF1GlitchPostProcess,
  'function',
  'context restoration needs a behaviorally tested recreate-and-prewarm operation',
);
let staleRestorationDisposals = 0;
let restoredPrewarms = 0;
const restoredTarget = new THREE.WebGLRenderTarget(2, 2);
const staleRestorationPostProcess: glitchPostProcessModule.F1GlitchPostProcess = {
  prewarm() {},
  render() {},
  resize() {},
  dispose() { staleRestorationDisposals += 1; },
};
const recreatedRestorationPostProcess: glitchPostProcessModule.F1GlitchPostProcess = {
  prewarm(renderSource) {
    restoredPrewarms += 1;
    renderSource(restoredTarget);
  },
  render() {},
  resize() {},
  dispose() {},
};
let restoredSourceTarget: THREE.WebGLRenderTarget | null = null;
const restoredPostProcess = (
  glitchPostProcessModule as unknown as {
    restoreF1GlitchPostProcess(input: {
      glitchPostProcess: glitchPostProcessModule.F1GlitchPostProcess | null;
      create(): glitchPostProcessModule.F1GlitchPostProcess;
      renderSource(target: THREE.WebGLRenderTarget): void;
      onUnavailable(): void;
    }): glitchPostProcessModule.F1GlitchPostProcess | null;
  }
).restoreF1GlitchPostProcess({
  glitchPostProcess: staleRestorationPostProcess,
  create: () => recreatedRestorationPostProcess,
  renderSource: (target) => { restoredSourceTarget = target; },
  onUnavailable: () => assert.fail('successful restoration must not warn'),
});
assert.equal(restoredPostProcess, recreatedRestorationPostProcess);
assert.equal(staleRestorationDisposals, 1, 'restoration must dispose stale driver resources once');
assert.equal(restoredPrewarms, 1, 'restoration must prewarm the complete replacement pipeline');
assert.equal(restoredSourceTarget, restoredTarget);
restoredTarget.dispose();

const mobileRenderer = new FakeGlitchRenderer();
const mobilePostProcess = createF1GlitchPostProcess(
  mobileRenderer as unknown as THREE.WebGLRenderer,
  100,
  50,
  3,
  { mobile: true, prefersReducedMotion: true },
);
let mobileTarget: THREE.WebGLRenderTarget | null = null;
(mobilePostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => {
  mobileTarget = target;
  mobileRenderer.setRenderTarget(target);
});
mobilePostProcess.render({ progress: 0.5, renderSource: (target) => { mobileTarget = target; } });
assert(mobileTarget);
assert.equal(mobileTarget.width, 100, 'mobile target DPR must be capped at 1');
assert.equal(mobileTarget.height, 50);
assert(mobileRenderer.renderedScene);
const mobileQuad = mobileRenderer.renderedScene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
assert.equal(mobileQuad.material.uniforms.uAmplitude.value, 0.65);
assert.equal(mobileQuad.material.uniforms.uReducedMotion.value, 1);
assert.equal(mobileQuad.material.uniforms.uSpatialAmount.value, 0);
assert(
  mobileQuad.material.uniforms.uReducedBrightness.value > 0
    && mobileQuad.material.uniforms.uReducedBrightness.value <= 0.03,
  'reduced motion must use a low-amplitude brightness flicker instead of full dropout',
);
assert(
  Math.abs(mobileQuad.material.uniforms.uReducedNoise.value) > 0
    && Math.abs(mobileQuad.material.uniforms.uReducedNoise.value) <= 0.01,
  'reduced motion must retain only low-amplitude non-spatial noise flicker',
);
mobilePostProcess.render({ progress: 0.32, renderSource: () => undefined });
assert.equal(mobileQuad.material.uniforms.uReducedBrightness.value, 0);
assert.equal(mobileQuad.material.uniforms.uReducedNoise.value, 0);
mobilePostProcess.resize(1000, 500, 3);
(mobilePostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => mobileRenderer.setRenderTarget(target));
assert.equal(mobileTarget.width, 2000, 'crossing to desktop must raise the live target DPR cap to 2');
assert.equal(mobileTarget.height, 1000);
assert.equal(mobileQuad.material.uniforms.uAmplitude.value, 1, 'desktop resize must restore full amplitude');
mobilePostProcess.render({ progress: 0.5, renderSource: () => undefined });
assert.equal(mobileQuad.material.uniforms.uAmplitude.value, 1);
mobilePostProcess.resize(390, 844, 3);
(mobilePostProcess as unknown as {
  prewarm(renderSource: (target: THREE.WebGLRenderTarget) => void): void;
}).prewarm((target) => mobileRenderer.setRenderTarget(target));
assert.equal(mobileTarget.width, 390, 'crossing back to mobile must restore the 1x DPR cap');
assert.equal(mobileTarget.height, 844);
assert.equal(mobileQuad.material.uniforms.uAmplitude.value, 0.65);
mobilePostProcess.render({ progress: 0.5, renderSource: () => undefined });
assert.equal(mobileQuad.material.uniforms.uSpatialAmount.value, 0);
mobilePostProcess.dispose();

type FakeFrame = number;

class FakeAnimationFrames {
  now = 0;
  private nextId = 1;
  private readonly callbacks = new Map<FakeFrame, (now: number) => void>();
  private readonly allCallbacks = new Map<FakeFrame, (now: number) => void>();

  requestAnimationFrame(callback: (now: number) => void): FakeFrame {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    this.allCallbacks.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id: FakeFrame): void {
    this.callbacks.delete(id);
  }

  runNext(now: number): FakeFrame {
    const next = this.callbacks.entries().next().value as [FakeFrame, (time: number) => void] | undefined;
    assert(next, 'expected an animation frame to be scheduled');
    const [id, callback] = next;
    this.callbacks.delete(id);
    this.now = now;
    callback(now);
    return id;
  }

  runStale(id: FakeFrame, now: number): void {
    const callback = this.allCallbacks.get(id);
    assert(callback, `expected frame ${id} to exist`);
    this.now = now;
    callback(now);
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }
}

const createSequenceHarness = () => {
  const frames = new FakeAnimationFrames();
  const events: Array<string | number | null> = [];
  const sequence = createF1WelcomeSequence({
    requestAnimationFrame: (callback) => frames.requestAnimationFrame(callback),
    cancelAnimationFrame: (frame) => frames.cancelAnimationFrame(frame),
    onGlitchProgress: (value) => events.push(value),
    onExplode: () => events.push('explode'),
  });
  return { events, frames, sequence };
};

const hasExplosion = (events: ReadonlyArray<number | string | null>): boolean =>
  events.some((event) => event === 'explode');

const cleanFrameSequence = createSequenceHarness();
assert.equal(cleanFrameSequence.sequence.start(0), true, 'the automatic sequence must start once');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS - 1);
assert.deepEqual(cleanFrameSequence.events, [], 'glitch state must remain clean before the active window');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS);
assert.deepEqual(cleanFrameSequence.events, [0], 'glitch progress must start at zero on the exact boundary');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS / 2);
assert.equal(cleanFrameSequence.events.at(-1), 0.5, 'glitch progress must reach the deterministic midpoint');
cleanFrameSequence.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS);
assert.deepEqual(
  cleanFrameSequence.events.slice(-2),
  [0.5, null],
  'glitch completion must commit a clean assembled frame before explosion',
);
assert.equal(hasExplosion(cleanFrameSequence.events), false, 'completion frame must not explode the car');
cleanFrameSequence.frames.runNext(AUTO_EXPLODE_DELAY_MS - 1);
assert.equal(
  hasExplosion(cleanFrameSequence.events),
  false,
  'the second post-glitch frame must not explode before the complete clean-frame delay',
);
cleanFrameSequence.frames.runNext(AUTO_EXPLODE_DELAY_MS);
assert.equal(cleanFrameSequence.events.at(-1), 'explode', 'only the later animation frame may explode the car');
assert.equal(cleanFrameSequence.frames.pendingCount, 0, 'explosion must stop the frame loop');
assert.equal(cleanFrameSequence.sequence.start(AUTO_EXPLODE_DELAY_MS + 1), false, 'a completed sequence instance must never restart');

const preGlitchCancellation = createSequenceHarness();
assert.equal(preGlitchCancellation.sequence.start(0), true);
const preGlitchFrame = preGlitchCancellation.frames.runNext(100);
preGlitchCancellation.sequence.cancel();
assert.equal(preGlitchCancellation.frames.pendingCount, 0, 'pre-glitch cancellation must remove the pending frame');
preGlitchCancellation.frames.runStale(preGlitchFrame, AUTO_EXPLODE_DELAY_MS + 100);
assert.deepEqual(preGlitchCancellation.events, [null], 'a stale pre-glitch callback must not restart or explode');
assert.equal(preGlitchCancellation.sequence.start(200), false, 'a cancelled sequence instance must never restart');

const activeGlitchCancellation = createSequenceHarness();
assert.equal(activeGlitchCancellation.sequence.start(0), true);
activeGlitchCancellation.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + 200);
const activeGlitchFrame = activeGlitchCancellation.frames.runNext(HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + 400);
activeGlitchCancellation.sequence.cancel();
assert.equal(activeGlitchCancellation.frames.pendingCount, 0, 'active-glitch cancellation must remove the pending frame');
activeGlitchCancellation.frames.runStale(activeGlitchFrame, AUTO_EXPLODE_DELAY_MS + 100);
assert.equal(activeGlitchCancellation.events.at(-1), null, 'active-glitch cancellation must clear the visual state');
assert.equal(hasExplosion(activeGlitchCancellation.events), false, 'stale active-glitch callbacks must not explode the car');

assert.equal(
  AUTO_EXPLODE_DELAY_MS,
  HOLOGRAM_REVEAL_MS + GLITCH_CLEAN_HOLD_MS + GLITCH_DURATION_MS + GLITCH_CLEAN_FRAME_MS,
  'the controller must use the complete timing contract',
);
