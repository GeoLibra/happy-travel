import * as THREE from 'three';

const godRaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLightPos: { value: new THREE.Vector2(0.5, 0.5) },
    uDensity: { value: 0.96 },
    uWeight: { value: 0.4 },
    uDecay: { value: 0.93 },
    uExposure: { value: 2.5 }, // Increased for more dramatic effect
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uLightPos;
    uniform float uDensity;
    uniform float uWeight;
    uniform float uDecay;
    uniform float uExposure;

    const int SAMPLES = 40;

    void main() {
      vec2 deltaTextCoord = vUv - uLightPos;
      deltaTextCoord *= 1.0 / float(SAMPLES) * uDensity;
      vec2 tc = vUv;
      float illuminationDecay = 1.0;
      vec4 fragColor = vec4(0.0);

      // Radial blur
      for(int i = 0; i < SAMPLES; i++) {
        tc -= deltaTextCoord;
        vec4 samp = texture2D(tDiffuse, tc);

        // Thresholding: Only bloom bright areas (avoids dark colors blooming)
        float maxColor = max(samp.r, max(samp.g, samp.b));
        if (maxColor > 0.3) {
          samp *= illuminationDecay * uWeight;
          fragColor += samp;
        }

        illuminationDecay *= uDecay;
      }

      // Add subtle chromatic aberration
      fragColor.r *= 1.05;
      fragColor.b *= 0.95;

      gl_FragColor = fragColor * uExposure;
    }
  `
};

export class GodRays {
  private target: THREE.WebGLRenderTarget;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  public active = false;

  constructor() {
    // Half resolution render target for performance
    this.target = new THREE.WebGLRenderTarget(window.innerWidth / 2, window.innerHeight / 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(godRaysShader.uniforms),
      vertexShader: godRaysShader.vertexShader,
      fragmentShader: godRaysShader.fragmentShader,
      blending: THREE.AdditiveBlending, // Mix with the scene
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.quad);
  }

  public resize(width: number, height: number) {
    this.target.setSize(width / 2, height / 2);
  }

  /**
   * Renders the scene to a target, applies radial blur centered on the light,
   * then adds the result to the main canvas.
   */
  public render(
    renderer: THREE.WebGLRenderer,
    mainScene: THREE.Scene,
    mainCamera: THREE.PerspectiveCamera,
    intensity: number,
    light3DPos: THREE.Vector3
  ) {
    if (intensity <= 0) return;

    // 1. Project light 3D position to Screen Coordinates (0-1)
    const lightScreenPos = light3DPos.clone().project(mainCamera);
    const x = (lightScreenPos.x + 1) / 2;
    const y = (lightScreenPos.y + 1) / 2;

    // Only render if light source is somewhat on screen or just off screen
    if (x < -0.5 || x > 1.5 || y < -0.5 || y > 1.5) return;

    // 2. Render normal scene to our half-res target first
    renderer.setRenderTarget(this.target);
    renderer.render(mainScene, mainCamera);

    // 3. Setup uniforms
    this.material.uniforms.tDiffuse.value = this.target.texture;
    this.material.uniforms.uLightPos.value.set(x, y);
    this.material.uniforms.uExposure.value = intensity * 2.5;

    // 4. Render god rays to Canvas
    renderer.setRenderTarget(null);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false; // Important: Don't clear what was just rendered!

    renderer.render(this.scene, this.camera);

    renderer.autoClear = autoClear;
  }

  public dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
    this.material.dispose();
  }
}
