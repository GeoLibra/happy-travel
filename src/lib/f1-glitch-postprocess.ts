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
        color.rgb*=1.0-(0.22*uPulse+0.08*scan*spatial)*uAmplitude;
        gl_FragColor=color;
      }
    `,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);
  let disposed = false;

  const resize = (nextWidth: number, nextHeight: number, nextPixelRatio: number) => {
    if (disposed) return;
    const ratio = profile.mobile ? Math.min(nextPixelRatio, 1) : Math.min(nextPixelRatio, 2);
    const renderWidth = Math.max(1, Math.floor(nextWidth * ratio));
    const renderHeight = Math.max(1, Math.floor(nextHeight * ratio));
    target.setSize(renderWidth, renderHeight);
    uniforms.uResolution.value.set(renderWidth, renderHeight);
  };
  resize(width, height, pixelRatio);

  return {
    render({ progress, renderSource }: F1GlitchRenderInput) {
      if (disposed) return;
      renderSource(target);
      uniforms.uProgress.value = progress;
      uniforms.uPulse.value = getF1GlitchPulse(progress);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}
