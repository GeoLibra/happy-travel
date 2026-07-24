import * as THREE from 'three';
// @ts-ignore - Sometimes addons lack types depending on the setup
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { CURL_NOISE_GLSL } from './forceField';

export interface GPUEffectUniforms {
  uTime: { value: number };
  uDelta: { value: number };
  uIsPressing: { value: boolean };
  uProgress: { value: number };
  uExplosionForce: { value: number };
  uFieldScale: { value: number };
  uFieldStrength: { value: number };
  uFieldSpeed: { value: number };
  uBassLevel: { value: number };
  uPixelRatio: { value: number };
}

const computePositionShader = `
  uniform float uDelta;
  uniform bool uIsPressing;
  uniform float uExplosionForce;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D(texturePosition, uv);
    vec4 tmpVel = texture2D(textureVelocity, uv);

    vec3 pos = tmpPos.xyz;
    vec3 vel = tmpVel.xyz;
    float phase = tmpPos.w;

    // Apply velocity
    pos += vel * uDelta * 60.0; // 60fps base multiplier

    // Boundary Wrap (Only when idle, to prevent popping during interactions)
    if (!uIsPressing && uExplosionForce == 0.0) {
      if (pos.x < -120.0) pos.x = 120.0;
      if (pos.x > 120.0) pos.x = -120.0;
      if (pos.y < -90.0) pos.y = 90.0;
      if (pos.y > 90.0) pos.y = -90.0;

      // Z Wrap - emerge from the back
      if (pos.z > 80.0) {
        pos.z = -100.0;
        // Pseudo-random respawn using phase and uv
        pos.x = (fract(sin(dot(uv.xy + phase, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 200.0;
        pos.y = (fract(sin(dot(uv.yx + phase, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 150.0;
      }
    }

    gl_FragColor = vec4(pos, phase);
  }
`;

const computeVelocityShader = `
  ${CURL_NOISE_GLSL}

  uniform float uTime;
  uniform float uDelta;
  uniform bool uIsPressing;
  uniform float uProgress;
  uniform float uExplosionForce;

  uniform float uFieldScale;
  uniform float uFieldStrength;
  uniform float uFieldSpeed;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D(texturePosition, uv);
    vec4 tmpVel = texture2D(textureVelocity, uv);

    vec3 pos = tmpPos.xyz;
    vec3 vel = tmpVel.xyz;
    float mass = tmpVel.w;
    float phase = tmpPos.w;

    // 1. Organic Force Field (Curl Noise)
    vec3 noiseVec = curlNoise(pos, uTime, uFieldScale, uFieldSpeed);
    vec3 force = noiseVec * uFieldStrength;

    // Default flow: toward viewer with slight sway
    force.x += sin(uTime * 0.3 + phase) * 0.02 * 60.0;
    force.y += cos(uTime * 0.2 + phase * 1.3) * 0.015 * 60.0;
    force.z += 0.5 * 60.0;

    // 2. Interaction Overrides
    if (uIsPressing && uProgress < 100.0) {
      // Gather Phase: Pull toward button center, deep into screen
      vec3 target = vec3(0.0, -25.0, -40.0);
      vec3 dir = target - pos;
      float dist = length(dir);
      float reverseForce = 2.0 + pow(uProgress / 100.0, 2.0) * 12.0;
      vel += normalize(dir) * reverseForce * clamp(dist / 50.0, 0.1, 1.0);

      // Reduce turbulence while gathering
      force += noiseVec * (uFieldStrength * 0.3 * mass);
    }
    else if (uExplosionForce > 0.0) {
      // Explosion Phase: Blast outward from button center
      vec3 center = vec3(0.0, -25.0, -40.0);
      vec3 dir = pos - center;
      float dist = length(dir) + 0.1;
      vec3 norm = dir / dist;

      float pwr = uExplosionForce * 4.0;
      force.x = norm.x * pwr * 60.0;
      force.y = norm.y * pwr * 60.0 + (uExplosionForce * 1.0 * 60.0); // Upward bias
      force.z = norm.z * pwr * 60.0;

      // Amplify chaos
      force += noiseVec * (uExplosionForce * 5.0 * mass);
    }

    // Apply force to velocity with damping
    vel = vel * 0.92 + force * uDelta; // Momentum

    gl_FragColor = vec4(vel, mass);
  }
`;

const particleVertexShader = `
  uniform sampler2D texturePosition;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBassLevel;

  attribute float size;
  attribute vec3 color;
  attribute vec2 computeUV;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vec4 posRef = texture2D(texturePosition, computeUV);
    vec3 wPos = posRef.xyz;

    vec4 mvPosition = modelViewMatrix * vec4(wPos, 1.0);
    float dist = length(mvPosition.xyz);

    vAlpha = smoothstep(120.0, 20.0, dist) * 0.8;

    // Bass pulse effect
    float bassPulse = 1.0 + uBassLevel * 1.5;

    gl_PointSize = size * bassPulse * uPixelRatio * (60.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    glow = pow(glow, 1.5);
    gl_FragColor = vec4(vColor, glow * vAlpha);
  }
`;

export class GPUParticleSystem {
  public renderer: THREE.WebGLRenderer;
  public compute: any = null;
  public posVar: any = null;
  public velVar: any = null;

  public particles: THREE.Points | null = null;
  public isSupported = false;

  public WIDTH = 128; // 128x128 = 16,384 particles
  public PARTICLE_COUNT = this.WIDTH * this.WIDTH;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  public init(scene: THREE.Scene, baseUniforms: GPUEffectUniforms): boolean {
    if (!this.renderer.capabilities.isWebGL2 && !this.renderer.extensions.get('OES_texture_float')) {
      console.warn("GPU particles not supported (requires WebGL2 or OES_texture_float)");
      return false;
    }

    try {
      this.compute = new GPUComputationRenderer(this.WIDTH, this.WIDTH, this.renderer);

      const dtPosition = this.compute.createTexture();
      const dtVelocity = this.compute.createTexture();

      this.fillTextures(dtPosition, dtVelocity);

      this.posVar = this.compute.addVariable('texturePosition', computePositionShader, dtPosition);
      this.velVar = this.compute.addVariable('textureVelocity', computeVelocityShader, dtVelocity);

      this.compute.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);
      this.compute.setVariableDependencies(this.velVar, [this.posVar, this.velVar]);

      // Inject uniforms
      this.posVar.material.uniforms = {
        uDelta: baseUniforms.uDelta,
        uIsPressing: baseUniforms.uIsPressing,
        uExplosionForce: baseUniforms.uExplosionForce,
      };

      this.velVar.material.uniforms = {
        uTime: baseUniforms.uTime,
        uDelta: baseUniforms.uDelta,
        uIsPressing: baseUniforms.uIsPressing,
        uProgress: baseUniforms.uProgress,
        uExplosionForce: baseUniforms.uExplosionForce,
        uFieldScale: baseUniforms.uFieldScale,
        uFieldStrength: baseUniforms.uFieldStrength,
        uFieldSpeed: baseUniforms.uFieldSpeed,
      };

      const error = this.compute.init();
      if (error !== null) {
        console.warn("GPUComputationRenderer failed:", error);
        return false;
      }

      this.isSupported = true;
      this.createParticles(scene, baseUniforms);
      return true;
    } catch (e) {
      console.warn("GPUParticles setup failed, falling back to CPU", e);
      return false;
    }
  }

  private fillTextures(texturePosition: THREE.DataTexture, textureVelocity: THREE.DataTexture) {
    const posArray = texturePosition.image.data;
    const velArray = textureVelocity.image.data;

    for (let k = 0, kl = posArray.length; k < kl; k += 4) {
      // Position xyz, phase w
      posArray[k + 0] = (Math.random() - 0.5) * 200;
      posArray[k + 1] = (Math.random() - 0.5) * 150;
      posArray[k + 2] = (Math.random() - 0.5) * 150;
      posArray[k + 3] = Math.random() * Math.PI * 2;

      // Velocity xyz, mass w
      velArray[k + 0] = 0;
      velArray[k + 1] = 0;
      velArray[k + 2] = 0;
      velArray[k + 3] = Math.random() * 0.8 + 0.2;
    }
  }

  private createParticles(scene: THREE.Scene, uniforms: GPUEffectUniforms) {
    const geometry = new THREE.BufferGeometry();
    const computeUVs = new Float32Array(this.PARTICLE_COUNT * 2);
    const colors = new Float32Array(this.PARTICLE_COUNT * 3);
    const sizes = new Float32Array(this.PARTICLE_COUNT);
    const emptyPos = new Float32Array(this.PARTICLE_COUNT * 3);

    const COLORS = [
      new THREE.Color('#E10600'),
      new THREE.Color('#FFB800'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#ffffff'), // double chance for white
    ];

    let p = 0;
    for (let j = 0; j < this.WIDTH; j++) {
      for (let i = 0; i < this.WIDTH; i++) {
        // compute texture UV
        computeUVs[p++] = (i + 0.5) / this.WIDTH;
        computeUVs[p++] = (j + 0.5) / this.WIDTH;

        const i3 = (i + j * this.WIDTH) * 3;
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;

        sizes[i + j * this.WIDTH] = Math.random() * 2.5 + 0.5;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(emptyPos, 3));
    geometry.setAttribute('computeUV', new THREE.BufferAttribute(computeUVs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        uTime: uniforms.uTime,
        uPixelRatio: uniforms.uPixelRatio,
        uBassLevel: uniforms.uBassLevel,
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  public update() {
    if (!this.isSupported || !this.particles) return;

    this.compute.compute();

    const positionTexture = this.compute.getCurrentRenderTarget(this.posVar).texture;
    (this.particles.material as THREE.ShaderMaterial).uniforms.texturePosition.value = positionTexture;
  }

  public dispose(scene: THREE.Scene) {
    if (this.particles) {
      scene.remove(this.particles);
      this.particles.geometry.dispose();
      if (this.particles.material) {
        const mat = this.particles.material as THREE.ShaderMaterial;
        if (mat.uniforms?.texturePosition) {
          mat.uniforms.texturePosition.value = null;
        }
        mat.dispose();
      }
      this.particles = null;
    }
    if (this.compute) {
      if (this.posVar) {
        this.posVar.initialValueTexture?.dispose?.();
        if (Array.isArray(this.posVar.renderTargets)) {
          this.posVar.renderTargets.forEach((rt: any) => rt?.dispose?.());
        }
        if (this.posVar.material) this.posVar.material.dispose?.();
      }
      if (this.velVar) {
        this.velVar.initialValueTexture?.dispose?.();
        if (Array.isArray(this.velVar.renderTargets)) {
          this.velVar.renderTargets.forEach((rt: any) => rt?.dispose?.());
        }
        if (this.velVar.material) this.velVar.material.dispose?.();
      }
      this.compute = null;
    }
    this.posVar = null;
    this.velVar = null;
  }
}
