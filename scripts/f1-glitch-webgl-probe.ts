import * as THREE from 'three';
import {
  bindF1GlitchContextRecovery,
  createF1GlitchPostProcess,
  renderF1GlitchFrame,
  restoreF1GlitchPostProcess,
  type F1GlitchPostProcess,
} from '../src/lib/f1-glitch-postprocess';

interface F1GlitchWebglProbeResult {
  status: 'PASS' | 'FAIL';
  renderer: string;
  targetType: string;
  directRgba: number[];
  pulseZeroRgba: number[];
  pulseZeroMaxChannelDelta: number;
  activePulseRgba: number[];
  contextLossEvents: number;
  contextRestoreEvents: number;
  restorePrewarms: number;
  restoredPulseRgba: number[];
  error?: string;
}

type ProbeWindow = Window & { __f1GlitchWebglProbe?: F1GlitchWebglProbeResult };

const resultElement = document.querySelector<HTMLPreElement>('#result');
if (!resultElement) throw new Error('missing probe result element');

const readCenterPixel = (renderer: THREE.WebGLRenderer): number[] => {
  const gl = renderer.getContext();
  const pixel = new Uint8Array(4);
  gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return Array.from(pixel);
};

const maxChannelDelta = (left: number[], right: number[]): number =>
  Math.max(...left.map((value, index) => Math.abs(value - right[index])));

const waitForCanvasEvent = (canvas: HTMLCanvasElement, type: string): Promise<void> =>
  new Promise((resolve) => canvas.addEventListener(type, () => resolve(), { once: true }));

const run = async (): Promise<F1GlitchWebglProbeResult> => {
  const canvas = document.createElement('canvas');
  document.body.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(64, 64, false);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const sourceScene = new THREE.Scene();
  const sourceCamera = new THREE.Camera();
  const sourceMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: false,
    blending: THREE.NoBlending,
    toneMapped: true,
    vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
    fragmentShader: `
      void main(){
        gl_FragColor=vec4(2.4,0.25,0.08,0.37);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sourceQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sourceMaterial);
  sourceScene.add(sourceQuad);

  let targetType = 'unseen';
  const renderSource = (target: THREE.WebGLRenderTarget | null) => {
    if (target) targetType = target.texture.type === THREE.HalfFloatType
      ? 'HalfFloatType'
      : target.texture.type === THREE.FloatType
        ? 'FloatType'
        : String(target.texture.type);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(sourceScene, sourceCamera);
  };

  renderSource(null);
  const directRgba = readCenterPixel(renderer);

  let postProcess: F1GlitchPostProcess | null = restoreF1GlitchPostProcess({
    glitchPostProcess: null,
    create: () => createF1GlitchPostProcess(
      renderer,
      64,
      64,
      1,
      { mobile: false, prefersReducedMotion: false },
    ),
    renderSource: (target) => renderSource(target),
    onUnavailable: () => { throw new Error('initial post-process unavailable'); },
  });
  if (!postProcess) throw new Error('initial post-process failed validation');

  postProcess = renderF1GlitchFrame({
    glitchPostProcess: postProcess,
    progress: 0,
    renderShowroom: renderSource,
    onUnavailable: () => { throw new Error('pulse-zero resource unexpectedly failed'); },
  });
  const pulseZeroRgba = readCenterPixel(renderer);
  const pulseZeroMaxChannelDelta = maxChannelDelta(directRgba, pulseZeroRgba);
  if (pulseZeroMaxChannelDelta !== 0) {
    throw new Error(`pulse-zero framebuffer mismatch: max channel delta ${pulseZeroMaxChannelDelta}`);
  }

  postProcess = renderF1GlitchFrame({
    glitchPostProcess: postProcess,
    progress: 0.5,
    renderShowroom: renderSource,
    onUnavailable: () => { throw new Error('active pulse resource unexpectedly failed'); },
  });
  if (!postProcess) throw new Error('active pulse disabled the post-process');
  const activePulseRgba = readCenterPixel(renderer);
  if (activePulseRgba[3] === 0 || activePulseRgba.slice(0, 3).every((value) => value === 0)) {
    throw new Error(`active pulse produced a black/transparent frame: ${activePulseRgba.join(',')}`);
  }

  let contextLossEvents = 0;
  let contextRestoreEvents = 0;
  let restorePrewarms = 0;
  const removeContextRecovery = bindF1GlitchContextRecovery(canvas, {
    onContextLost: () => {
      contextLossEvents += 1;
      postProcess = null;
    },
    onContextRestored: () => {
      contextRestoreEvents += 1;
      postProcess = restoreF1GlitchPostProcess({
        glitchPostProcess: postProcess,
        create: () => createF1GlitchPostProcess(
          renderer,
          64,
          64,
          1,
          { mobile: false, prefersReducedMotion: false },
        ),
        renderSource: (target) => {
          restorePrewarms += 1;
          renderSource(target);
        },
        onUnavailable: () => { throw new Error('restored post-process unavailable'); },
      });
    },
  });

  const loseContext = renderer.getContext().getExtension('WEBGL_lose_context');
  if (!loseContext) throw new Error('WEBGL_lose_context unavailable');
  const lost = waitForCanvasEvent(canvas, 'webglcontextlost');
  loseContext.loseContext();
  await lost;
  // Restoration is rejected while the synthetic loss event is still
  // unwinding. A later task mirrors the browser's real loss/restore lifecycle.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  const restored = waitForCanvasEvent(canvas, 'webglcontextrestored');
  loseContext.restoreContext();
  await restored;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!postProcess || contextLossEvents !== 1 || contextRestoreEvents !== 1 || restorePrewarms !== 1) {
    throw new Error(
      `context recovery mismatch: post=${Boolean(postProcess)} lost=${contextLossEvents} restored=${contextRestoreEvents} prewarm=${restorePrewarms}`,
    );
  }

  postProcess = renderF1GlitchFrame({
    glitchPostProcess: postProcess,
    progress: 0.5,
    renderShowroom: renderSource,
    onUnavailable: () => { throw new Error('restored active pulse failed'); },
  });
  const restoredPulseRgba = readCenterPixel(renderer);
  if (!postProcess || restoredPulseRgba[3] === 0 || restoredPulseRgba.slice(0, 3).every((value) => value === 0)) {
    throw new Error(`restored pulse produced a black/transparent frame: ${restoredPulseRgba.join(',')}`);
  }

  removeContextRecovery();
  // The browser session owns teardown for this single-use probe. Explicitly
  // deleting pre-loss Three.js objects after WEBGL_lose_context restoration
  // triggers Chromium warnings from Three's stale context listeners and adds
  // no coverage beyond the fake-GL disposal assertions.

  const gl = canvas.getContext('webgl2');
  return {
    status: 'PASS',
    renderer: gl?.getParameter(gl.RENDERER) ?? 'unknown',
    targetType,
    directRgba,
    pulseZeroRgba,
    pulseZeroMaxChannelDelta,
    activePulseRgba,
    contextLossEvents,
    contextRestoreEvents,
    restorePrewarms,
    restoredPulseRgba,
  };
};

try {
  const result = await run();
  (window as ProbeWindow).__f1GlitchWebglProbe = result;
  resultElement.textContent = JSON.stringify(result, null, 2);
} catch (error) {
  const failed: F1GlitchWebglProbeResult = {
    status: 'FAIL',
    renderer: 'unknown',
    targetType: 'unknown',
    directRgba: [],
    pulseZeroRgba: [],
    pulseZeroMaxChannelDelta: Number.POSITIVE_INFINITY,
    activePulseRgba: [],
    contextLossEvents: 0,
    contextRestoreEvents: 0,
    restorePrewarms: 0,
    restoredPulseRgba: [],
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  };
  (window as ProbeWindow).__f1GlitchWebglProbe = failed;
  resultElement.textContent = JSON.stringify(failed, null, 2);
  throw error;
}
