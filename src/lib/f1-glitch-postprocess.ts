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

export interface F1GlitchPostProcess {
  render(input: F1GlitchRenderInput): void;
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

const getFrameSeed = (frame: number, salt: number): number => {
  const value = Math.sin((frame + salt) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const disposeBestEffort = (resources: ReadonlyArray<{ dispose(): void }>): void => {
  for (const resource of resources) {
    try {
      resource.dispose();
    } catch {
      // Continue releasing independent GPU resources after a driver disposal failure.
    }
  }
};

export interface F1GlitchFrameInput {
  glitchPostProcess: F1GlitchPostProcess | null;
  progress: number | null | undefined;
  renderShowroom(target: THREE.WebGLRenderTarget | null): void;
  onUnavailable(): void;
}

export function renderF1GlitchFrame({
  glitchPostProcess,
  progress,
  renderShowroom,
  onUnavailable,
}: F1GlitchFrameInput): F1GlitchPostProcess | null {
  if (glitchPostProcess === null || progress === null || progress === undefined) {
    renderShowroom(null);
    return glitchPostProcess;
  }

  try {
    glitchPostProcess.render({
      progress,
      renderSource: (target) => renderShowroom(target),
    });
    return glitchPostProcess;
  } catch {
    disposeBestEffort([glitchPostProcess]);
    try {
      onUnavailable();
    } catch {
      // Diagnostics must not prevent the same-frame direct redraw.
    }
    renderShowroom(null);
    return null;
  }
}

const validateShaderProgram = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  material: THREE.ShaderMaterial,
): void => {
  const previousTarget = renderer.getRenderTarget();
  const previousAutoClear = renderer.autoClear;
  const previousColorWrite = material.colorWrite;
  const previousCheckShaderErrors = renderer.debug.checkShaderErrors;
  const previousShaderError = renderer.debug.onShaderError;
  let shaderFailed = false;

  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    shaderFailed = true;
    previousShaderError?.(gl, program, vertexShader, fragmentShader);
  };
  material.colorWrite = false;
  renderer.autoClear = false;

  try {
    renderer.setRenderTarget(null);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    if (shaderFailed) throw new Error('F1 glitch shader failed to compile or link');
  } finally {
    material.colorWrite = previousColorWrite;
    renderer.autoClear = previousAutoClear;
    renderer.debug.checkShaderErrors = previousCheckShaderErrors;
    renderer.debug.onShaderError = previousShaderError;
    renderer.setRenderTarget(previousTarget);
  }
};

export function createF1GlitchPostProcess(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  pixelRatio: number,
  profile: F1GlitchProfile,
): F1GlitchPostProcess {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  const uniforms = {
    uTexture: { value: target.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uProgress: { value: 0 },
    uPulse: { value: 0 },
    uAmplitude: { value: profile.mobile ? 0.65 : 1 },
    uReducedMotion: { value: profile.prefersReducedMotion ? 1 : 0 },
    uSpatialAmount: { value: 0 },
    uBlockSeed: { value: 0 },
    uScanSeed: { value: 0 },
    uNoiseSeed: { value: 0 },
    uReducedBrightness: { value: 0 },
    uReducedNoise: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    blending: THREE.NoBlending,
    toneMapped: true,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform float uProgress;
      uniform float uPulse;
      uniform float uAmplitude;
      uniform float uReducedMotion;
      uniform float uSpatialAmount;
      uniform float uBlockSeed;
      uniform float uScanSeed;
      uniform float uNoiseSeed;
      uniform float uReducedBrightness;
      uniform float uReducedNoise;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        float band=floor(vUv.y*42.0);
        float noise=hash(vec2(band,floor(uProgress*90.0)));
        float pulseGate=step(0.0001,uPulse);
        float spatial=uSpatialAmount*pulseGate;
        float shift=(noise-0.5)*0.055*spatial;

        vec2 blockCell=floor(vUv*vec2(13.0,9.0));
        float blockNoise=hash(blockCell+vec2(uBlockSeed*31.0,uBlockSeed*71.0));
        float block=step(0.78,blockNoise);
        vec2 blockVector=vec2(
          hash(blockCell+vec2(uBlockSeed*17.0,3.0)),
          hash(blockCell+vec2(5.0,uBlockSeed*29.0))
        )-0.5;
        vec2 blockOffset=blockVector*vec2(0.022,0.009)*block*spatial;

        float scanBand=floor(vUv.y*uResolution.y/3.0);
        float scanNoise=hash(vec2(scanBand,uScanSeed*97.0));
        float scan=step(0.92,scanNoise);
        float scanDistortion=(hash(vec2(uScanSeed*53.0,scanBand))-0.5)*0.014*scan*spatial;

        vec2 uv=vUv+vec2(shift,scanDistortion)+blockOffset;
        float split=0.012*spatial;
        vec4 base=texture2D(uTexture,uv);
        vec4 color=vec4(texture2D(uTexture,uv+vec2(split,0.0)).r,base.g,texture2D(uTexture,uv-vec2(split,0.0)).b,base.a);
        vec2 noiseCell=floor(vUv*uResolution/2.0);
        float pixelNoise=hash(noiseCell+vec2(uNoiseSeed*113.0,uNoiseSeed*47.0))-0.5;
        color.rgb+=pixelNoise*0.05*spatial;
        color.rgb*=1.0-(0.18*spatial+0.08*scan*spatial)*(1.0-uReducedMotion);
        color.rgb*=1.0-uReducedBrightness;
        color.rgb+=vec3(uReducedNoise);
        gl_FragColor=color;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);
  let disposed = false;
  let mobile = profile.mobile;

  try {
    validateShaderProgram(renderer, scene, camera, material);
  } catch (error) {
    disposed = true;
    disposeBestEffort([target, quad.geometry, material]);
    throw error;
  }

  const applySize = (
    nextWidth: number,
    nextHeight: number,
    nextPixelRatio: number,
    nextMobile: boolean,
  ) => {
    if (disposed) return;
    mobile = nextMobile;
    uniforms.uAmplitude.value = mobile ? 0.65 : 1;
    const ratio = mobile ? Math.min(nextPixelRatio, 1) : Math.min(nextPixelRatio, 2);
    const renderWidth = Math.max(1, Math.floor(nextWidth * ratio));
    const renderHeight = Math.max(1, Math.floor(nextHeight * ratio));
    target.setSize(renderWidth, renderHeight);
    uniforms.uResolution.value.set(renderWidth, renderHeight);
  };
  applySize(width, height, pixelRatio, mobile);

  const resize = (nextWidth: number, nextHeight: number, nextPixelRatio: number) => {
    applySize(nextWidth, nextHeight, nextPixelRatio, nextWidth < 768);
  };

  return {
    render({ progress, renderSource }: F1GlitchRenderInput) {
      if (disposed) return;
      renderSource(target);
      uniforms.uProgress.value = progress;
      const pulse = getF1GlitchPulse(progress);
      const amplitude = mobile ? 0.65 : 1;
      const frame = Math.floor(Math.min(1, Math.max(0, progress)) * 180);
      const blockSeed = getFrameSeed(frame, 11);
      const scanSeed = getFrameSeed(frame, 37);
      const noiseSeed = getFrameSeed(frame, 73);
      uniforms.uPulse.value = pulse;
      uniforms.uSpatialAmount.value = profile.prefersReducedMotion ? 0 : pulse * amplitude;
      uniforms.uBlockSeed.value = blockSeed;
      uniforms.uScanSeed.value = scanSeed;
      uniforms.uNoiseSeed.value = noiseSeed;
      uniforms.uReducedBrightness.value = profile.prefersReducedMotion && pulse > 0
        ? pulse * (0.018 + blockSeed * 0.012)
        : 0;
      uniforms.uReducedNoise.value = profile.prefersReducedMotion && pulse > 0
        ? pulse * (noiseSeed - 0.5) * 0.02
        : 0;
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeBestEffort([target, quad.geometry, material]);
    },
  };
}
