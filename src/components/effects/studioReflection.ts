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
}

export interface StudioReflectionEffect {
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  render: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

const createFloorGeometry = (): THREE.PlaneGeometry => {
  const geometry = new THREE.PlaneGeometry(90, 80);
  return geometry;
};

const createFallbackMaterial = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  color: 0x080b0f,
  metalness: 0.55,
  roughness: 0.42,
});

const createReflectionMaterial = (
  reflectionTexture: THREE.Texture,
  textureMatrix: THREE.Matrix4,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  uniforms: {
    uReflection: { value: reflectionTexture },
    uTextureMatrix: { value: textureMatrix },
    uFloorColor: { value: new THREE.Color(0x080b0f) },
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
      gl_FragColor = vec4(mix(roughFloor, reflection, 0.42 * inside), 1.0);
    }
  `,
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
}: StudioReflectionOptions): StudioReflectionEffect => {
  const floorGeometry = createFloorGeometry();

  if (tier === 'fallback') {
    const fallbackMaterial = createFallbackMaterial();
    const floor = new THREE.Mesh(floorGeometry, fallbackMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    let disposed = false;
    return {
      floor,
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
  }

  if (!renderer) {
    floorGeometry.dispose();
    throw new Error('Reflective studio floor requires a WebGL renderer.');
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
  const targetA = new THREE.WebGLRenderTarget(halfWidth, halfHeight, targetOptions);
  const targetB = new THREE.WebGLRenderTarget(halfWidth, halfHeight, targetOptions);
  targetA.texture.name = 'StudioReflection.SceneAndBlur';
  targetB.texture.name = 'StudioReflection.BlurIntermediate';

  const textureMatrix = new THREE.Matrix4();
  const floorMaterial = createReflectionMaterial(targetA.texture, textureMatrix);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const mirroredCamera = new THREE.PerspectiveCamera();
  const sourcePosition = new THREE.Vector3();
  const sourceDirection = new THREE.Vector3();
  const sourceLookAt = new THREE.Vector3();
  const mirroredPosition = new THREE.Vector3();
  const mirroredTarget = new THREE.Vector3();
  const mirroredUp = new THREE.Vector3();
  const textureBias = new THREE.Matrix4().set(
    0.5, 0, 0, 0.5,
    0, 0.5, 0, 0.5,
    0, 0, 0.5, 0.5,
    0, 0, 0, 1,
  );

  const horizontalDirection = new THREE.Vector2(1 / halfWidth, 0);
  const verticalDirection = new THREE.Vector2(0, 1 / halfHeight);
  const horizontalBlurMaterial = createBlurMaterial(targetA.texture, horizontalDirection);
  const verticalBlurMaterial = createBlurMaterial(targetB.texture, verticalDirection);
  const fullscreenGeometry = new THREE.PlaneGeometry(2, 2);
  const fullscreenQuad = new THREE.Mesh(fullscreenGeometry, horizontalBlurMaterial);
  const blurScene = new THREE.Scene();
  const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  blurScene.add(fullscreenQuad);

  let disposed = false;
  return {
    floor,
    render: () => {
      if (disposed) return;

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

      const previousTarget = renderer.getRenderTarget();
      const floorWasVisible = floor.visible;
      const cameraWasVisible = camera.visible;
      floor.visible = false;
      camera.visible = false;

      try {
        renderer.setRenderTarget(targetA);
        renderer.render(scene, mirroredCamera);

        fullscreenQuad.material = horizontalBlurMaterial;
        renderer.setRenderTarget(targetB);
        renderer.render(blurScene, blurCamera);

        fullscreenQuad.material = verticalBlurMaterial;
        renderer.setRenderTarget(targetA);
        renderer.render(blurScene, blurCamera);
      } finally {
        floor.visible = floorWasVisible;
        camera.visible = cameraWasVisible;
        renderer.setRenderTarget(previousTarget);
      }
    },
    resize: (width, height) => {
      if (disposed) return;
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
      floorMaterial.dispose();
      horizontalBlurMaterial.dispose();
      verticalBlurMaterial.dispose();
      fullscreenGeometry.dispose();
      targetA.dispose();
      targetB.dispose();
    },
  };
};
