import * as THREE from 'three';

export type StudioReflectionTier = 'reflective' | 'fallback';

export interface StudioReflectionViewport {
  width: number;
  height: number;
}

export interface StudioReflectionOptions {
  renderer?: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  viewport: StudioReflectionViewport;
  tier: StudioReflectionTier;
  createRenderTarget?: (
    width: number,
    height: number,
    options: THREE.RenderTargetOptions,
  ) => THREE.WebGLRenderTarget;
}

export interface StudioReflectionEffect {
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  setReveal: (reveal: number) => void;
  render: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

const STUDIO_FLOOR_COLOR = 0xaeb8c4;
const FALLBACK_FLOOR_ALPHA = 0.12;

const createFloorGeometry = (): THREE.PlaneGeometry => {
  const geometry = new THREE.PlaneGeometry(90, 80);
  return geometry;
};

const createFallbackMaterial = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  color: STUDIO_FLOOR_COLOR,
  metalness: 0.18,
  roughness: 0.68,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
});

const disposeSafely = (resource: { dispose: () => void } | undefined): void => {
  if (!resource) return;
  try {
    resource.dispose();
  } catch {
    // Continue releasing the rest of the transaction's resources.
  }
};

const createFallbackEffect = (scene: THREE.Scene): StudioReflectionEffect => {
  const floorGeometry = createFloorGeometry();
  const fallbackMaterial = createFallbackMaterial();
  const floor = new THREE.Mesh(floorGeometry, fallbackMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.visible = false;
  scene.add(floor);

  let disposed = false;
  return {
    floor,
    setReveal: (reveal) => {
      const clampedReveal = THREE.MathUtils.clamp(reveal, 0, 1);
      floor.visible = clampedReveal > 0.001;
      fallbackMaterial.opacity = clampedReveal * FALLBACK_FLOOR_ALPHA;
    },
    render: () => undefined,
    resize: () => undefined,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      scene.remove(floor);
      floorGeometry.dispose();
      fallbackMaterial.dispose();
    },
  };
};

const createReflectionMaterial = (
  reflectionTexture: THREE.Texture,
  textureMatrix: THREE.Matrix4,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  uniforms: {
    uReflection: { value: reflectionTexture },
    uTextureMatrix: { value: textureMatrix },
    uFloorColor: { value: new THREE.Color(STUDIO_FLOOR_COLOR) },
    uReveal: { value: 0 },
  },
  vertexShader: `
    uniform mat4 uTextureMatrix;
    varying vec2 vFloorUv;
    varying vec4 vReflectionUv;

    void main() {
      vFloorUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vReflectionUv = uTextureMatrix * worldPosition;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D uReflection;
    uniform vec3 uFloorColor;
    uniform float uReveal;
    varying vec2 vFloorUv;
    varying vec4 vReflectionUv;

    float hash(vec2 point) {
      return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float lowFrequencyNoise(vec2 point) {
      vec2 cell = floor(point);
      vec2 blend = smoothstep(0.0, 1.0, fract(point));
      return mix(
        mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
        mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), blend.x),
        blend.y
      );
    }

    void main() {
      vec2 projectedUv = vReflectionUv.xy / vReflectionUv.w;
      float inside = step(0.0, projectedUv.x) * step(projectedUv.x, 1.0)
        * step(0.0, projectedUv.y) * step(projectedUv.y, 1.0);
      vec3 reflection = texture2D(uReflection, projectedUv).rgb;
      float roughness = lowFrequencyNoise(vFloorUv * 14.0);
      vec3 roughFloor = uFloorColor * mix(0.86, 1.08, roughness);
      float reflectionMix = 0.72 * inside * uReveal;
      float reflectionEnergy = max(reflection.r, max(reflection.g, reflection.b));
      float reflectionMask = inside * smoothstep(0.015, 0.22, reflectionEnergy);
      float alpha = uReveal * mix(0.08, 0.64, reflectionMask);
      gl_FragColor = vec4(mix(roughFloor, reflection, reflectionMix), alpha);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

const createBlurMaterial = (
  inputTexture: THREE.Texture,
  direction: THREE.Vector2,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  uniforms: {
    uInput: { value: inputTexture },
    uDirection: { value: direction },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uInput;
    uniform vec2 uDirection;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(uInput, vUv) * 0.2270270270;
      color += texture2D(uInput, vUv + uDirection * 1.3846153846) * 0.3162162162;
      color += texture2D(uInput, vUv - uDirection * 1.3846153846) * 0.3162162162;
      color += texture2D(uInput, vUv + uDirection * 3.2307692308) * 0.0702702703;
      color += texture2D(uInput, vUv - uDirection * 3.2307692308) * 0.0702702703;
      gl_FragColor = color;
    }
  `,
  depthTest: false,
  depthWrite: false,
});

export const createStudioReflection = ({
  renderer,
  scene,
  camera,
  viewport,
  tier,
  createRenderTarget,
}: StudioReflectionOptions): StudioReflectionEffect => {
  if (tier === 'fallback') {
    return createFallbackEffect(scene);
  }

  if (!renderer) {
    return createFallbackEffect(scene);
  }

  const width = viewport.width;
  const height = viewport.height;
  const halfWidth = Math.ceil(width * 0.5);
  const halfHeight = Math.ceil(height * 0.5);
  const targetOptions: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  };
  const renderTargetFactory = createRenderTarget
    ?? ((targetWidth, targetHeight, options) => (
      new THREE.WebGLRenderTarget(targetWidth, targetHeight, options)
    ));

  let floorGeometry: THREE.PlaneGeometry | undefined;
  let targetA: THREE.WebGLRenderTarget | undefined;
  let targetB: THREE.WebGLRenderTarget | undefined;
  let runtimeFallbackMaterial: THREE.MeshStandardMaterial | undefined;
  let floorMaterial: THREE.ShaderMaterial | undefined;
  let floor: THREE.Mesh<THREE.PlaneGeometry, THREE.Material> | undefined;
  let horizontalBlurMaterial: THREE.ShaderMaterial | undefined;
  let verticalBlurMaterial: THREE.ShaderMaterial | undefined;
  let fullscreenGeometry: THREE.PlaneGeometry | undefined;
  let fullscreenQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | undefined;
  let textureMatrix: THREE.Matrix4;
  let mirroredCamera: THREE.PerspectiveCamera;
  let sourcePosition: THREE.Vector3;
  let sourceDirection: THREE.Vector3;
  let sourceLookAt: THREE.Vector3;
  let mirroredPosition: THREE.Vector3;
  let mirroredTarget: THREE.Vector3;
  let mirroredUp: THREE.Vector3;
  let textureBias: THREE.Matrix4;
  let horizontalDirection: THREE.Vector2;
  let verticalDirection: THREE.Vector2;
  let blurScene: THREE.Scene;
  let blurCamera: THREE.OrthographicCamera;

  try {
    floorGeometry = createFloorGeometry();
    targetA = renderTargetFactory(halfWidth, halfHeight, targetOptions);
    targetB = renderTargetFactory(halfWidth, halfHeight, targetOptions);
    targetA.texture.name = 'StudioReflection.SceneAndBlur';
    targetB.texture.name = 'StudioReflection.BlurIntermediate';

    runtimeFallbackMaterial = createFallbackMaterial();
    textureMatrix = new THREE.Matrix4();
    floorMaterial = createReflectionMaterial(targetA.texture, textureMatrix);
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.visible = false;

    mirroredCamera = new THREE.PerspectiveCamera();
    sourcePosition = new THREE.Vector3();
    sourceDirection = new THREE.Vector3();
    sourceLookAt = new THREE.Vector3();
    mirroredPosition = new THREE.Vector3();
    mirroredTarget = new THREE.Vector3();
    mirroredUp = new THREE.Vector3();
    textureBias = new THREE.Matrix4().set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    );

    horizontalDirection = new THREE.Vector2(1 / halfWidth, 0);
    verticalDirection = new THREE.Vector2(0, 1 / halfHeight);
    horizontalBlurMaterial = createBlurMaterial(targetA.texture, horizontalDirection);
    verticalBlurMaterial = createBlurMaterial(targetB.texture, verticalDirection);
    fullscreenGeometry = new THREE.PlaneGeometry(2, 2);
    fullscreenQuad = new THREE.Mesh(fullscreenGeometry, horizontalBlurMaterial);
    blurScene = new THREE.Scene();
    blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blurScene.add(fullscreenQuad);
    scene.add(floor);
  } catch {
    if (floor) scene.remove(floor);
    disposeSafely(fullscreenGeometry);
    disposeSafely(verticalBlurMaterial);
    disposeSafely(horizontalBlurMaterial);
    disposeSafely(floorMaterial);
    disposeSafely(runtimeFallbackMaterial);
    disposeSafely(targetB);
    disposeSafely(targetA);
    disposeSafely(floorGeometry);
    return createFallbackEffect(scene);
  }

  let disposed = false;
  let fallbackActive = false;
  let reflectiveResourcesDisposed = false;
  let currentReveal = 0;

  const disposeReflectiveResources = (): void => {
    if (reflectiveResourcesDisposed) return;
    reflectiveResourcesDisposed = true;
    disposeSafely(fullscreenGeometry);
    disposeSafely(verticalBlurMaterial);
    disposeSafely(horizontalBlurMaterial);
    disposeSafely(floorMaterial);
    disposeSafely(targetB);
    disposeSafely(targetA);
  };

  const activateFallback = (): void => {
    if (fallbackActive || disposed) return;
    floor.material = runtimeFallbackMaterial;
    runtimeFallbackMaterial.opacity = currentReveal * FALLBACK_FLOOR_ALPHA;
    floor.visible = currentReveal > 0.001;
    fallbackActive = true;
    disposeReflectiveResources();
  };

  return {
    floor,
    setReveal: (reveal) => {
      currentReveal = THREE.MathUtils.clamp(reveal, 0, 1);
      floor.visible = currentReveal > 0.001;
      if (floor.material instanceof THREE.ShaderMaterial) {
        floor.material.uniforms.uReveal.value = currentReveal;
      } else {
        floor.material.opacity = currentReveal * FALLBACK_FLOOR_ALPHA;
      }
    },
    render: () => {
      if (disposed || fallbackActive || !floor.visible) return;

      const floorWasVisible = floor.visible;
      const cameraWasVisible = camera.visible;
      let previousTarget: THREE.WebGLRenderTarget | null = null;
      let previousTargetKnown = false;
      let renderFailed = false;

      try {
        camera.updateWorldMatrix(true, false);
        camera.getWorldPosition(sourcePosition);
        camera.getWorldDirection(sourceDirection);
        sourceLookAt.copy(sourcePosition).add(sourceDirection);

        const floorY = floor.position.y;
        mirroredPosition.copy(sourcePosition);
        mirroredPosition.y = floorY * 2 - sourcePosition.y;
        mirroredTarget.copy(sourceLookAt);
        mirroredTarget.y = floorY * 2 - sourceLookAt.y;
        mirroredUp.copy(camera.up);
        mirroredUp.y *= -1;

        mirroredCamera.position.copy(mirroredPosition);
        mirroredCamera.up.copy(mirroredUp);
        mirroredCamera.fov = camera.fov;
        mirroredCamera.aspect = camera.aspect;
        mirroredCamera.near = camera.near;
        mirroredCamera.far = camera.far;
        mirroredCamera.zoom = camera.zoom;
        mirroredCamera.focus = camera.focus;
        mirroredCamera.filmGauge = camera.filmGauge;
        mirroredCamera.filmOffset = camera.filmOffset;
        mirroredCamera.updateProjectionMatrix();
        mirroredCamera.lookAt(mirroredTarget);
        mirroredCamera.updateMatrixWorld(true);

        textureMatrix.copy(textureBias)
          .multiply(mirroredCamera.projectionMatrix)
          .multiply(mirroredCamera.matrixWorldInverse);

        previousTarget = renderer.getRenderTarget();
        previousTargetKnown = true;
        floor.visible = false;
        camera.visible = false;

        renderer.setRenderTarget(targetA);
        renderer.render(scene, mirroredCamera);

        fullscreenQuad.material = horizontalBlurMaterial;
        renderer.setRenderTarget(targetB);
        renderer.render(blurScene, blurCamera);

        fullscreenQuad.material = verticalBlurMaterial;
        renderer.setRenderTarget(targetA);
        renderer.render(blurScene, blurCamera);
      } catch {
        renderFailed = true;
      } finally {
        floor.visible = floorWasVisible;
        camera.visible = cameraWasVisible;
        if (previousTargetKnown) {
          try {
            renderer.setRenderTarget(previousTarget);
          } catch {
            renderFailed = true;
          }
        }
      }

      if (renderFailed) activateFallback();
    },
    resize: (width, height) => {
      if (disposed || fallbackActive) return;
      const halfWidth = Math.ceil(width * 0.5);
      const halfHeight = Math.ceil(height * 0.5);
      targetA.setSize(halfWidth, halfHeight);
      targetB.setSize(halfWidth, halfHeight);
      horizontalDirection.set(1 / halfWidth, 0);
      verticalDirection.set(0, 1 / halfHeight);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      scene.remove(floor);
      floorGeometry.dispose();
      disposeReflectiveResources();
      runtimeFallbackMaterial.dispose();
    },
  };
};
