/**
 * Showroom Cinematic Renderer Scaffold
 * Encapsulates Three.js scene, camera, lighting, floor, and post-processing scaffold primitives.
 * Pure/testable lifecycle class with zero per-frame object allocations.
 */

import * as THREE from 'three';
import {
  selectShowroomRendererConfig,
  ShowroomRendererConfig,
} from '../../lib/showroom-renderer-config.ts';
import { ShowroomQualityOptions } from '../../lib/showroom-quality.ts';
import { createIdempotentDisposer } from './showroom-resource-lifecycle.ts';

export interface CinematicRendererOptions {
  qualityOptions?: ShowroomQualityOptions;
  renderer?: THREE.WebGLRenderer;
  viewport?: { width: number; height: number };
}

export interface CinematicRendererUpdateInput {
  timeMs?: number;
  deltaMs?: number;
  lightIntensity?: number;
  floorReveal?: number;
  cameraPosition?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
}

export class CinematicRenderer {
  private config: ShowroomRendererConfig;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;

  // Lighting scaffold
  private lightingGroup: THREE.Group;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  // Floor scaffold
  private floorGeometry: THREE.PlaneGeometry;
  private floorMaterial: THREE.MeshStandardMaterial;
  private floorMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;

  // Post-processing scaffold render targets & state
  private postProcessingEnabled: boolean;
  private passRenderTarget?: THREE.WebGLRenderTarget;

  private isDisposed = false;
  private disposerFn: () => void;

  constructor(options: CinematicRendererOptions = {}) {
    this.config = selectShowroomRendererConfig(options.qualityOptions);

    this.scene = new THREE.Scene();
    const aspect = options.viewport ? options.viewport.width / options.viewport.height : 16 / 9;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 2, 8);

    this.renderer = options.renderer;
    if (this.renderer) {
      this.renderer.setPixelRatio(this.config.pixelRatio);
      this.renderer.outputColorSpace = this.config.outputColorSpace;
      this.renderer.toneMapping = this.config.toneMapping;
      this.renderer.toneMappingExposure = this.config.toneMappingExposure;
      this.renderer.shadowMap.enabled = this.config.shadowsEnabled;
      if (this.config.shadowsEnabled) {
        this.renderer.shadowMap.type = this.config.shadowMapType;
      }
    }

    // 1. Pre-allocate Lighting Scaffold
    this.lightingGroup = new THREE.Group();
    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this.keyLight.position.set(5, 10, 7);
    this.keyLight.castShadow = this.config.shadowsEnabled;

    this.fillLight = new THREE.DirectionalLight(0x88bbff, 1.2);
    this.fillLight.position.set(-5, 5, -5);

    this.ambientLight = new THREE.AmbientLight(0x222233, 0.8);

    this.lightingGroup.add(this.keyLight, this.fillLight, this.ambientLight);
    this.scene.add(this.lightingGroup);

    // 2. Pre-allocate Floor Scaffold
    this.floorGeometry = new THREE.PlaneGeometry(90, 80);
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x111622,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    this.floorMesh = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = this.config.shadowsEnabled;
    this.scene.add(this.floorMesh);

    // 3. Pre-allocate Post-processing Scaffold
    this.postProcessingEnabled = this.config.postprocessing.enabled;
    if (this.postProcessingEnabled && this.renderer) {
      const width = options.viewport?.width ?? 1024;
      const height = options.viewport?.height ?? 576;
      this.passRenderTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      });
    }

    // Single-dispose resource cleanup setup using createIdempotentDisposer
    this.disposerFn = createIdempotentDisposer([
      { dispose: () => this.floorGeometry.dispose() },
      { dispose: () => this.floorMaterial.dispose() },
      {
        dispose: () => {
          if (this.passRenderTarget) {
            this.passRenderTarget.dispose();
          }
        },
      },
      {
        dispose: () => {
          this.scene.remove(this.lightingGroup);
          this.scene.remove(this.floorMesh);
          this.lightingGroup.clear();
        },
      },
    ]);
  }

  public get configuration(): ShowroomRendererConfig {
    return this.config;
  }

  public get sceneObject(): THREE.Scene {
    return this.scene;
  }

  public get cameraObject(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public get floorObject(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
    return this.floorMesh;
  }

  public get floorGeom(): THREE.PlaneGeometry {
    return this.floorGeometry;
  }

  public get floorMat(): THREE.MeshStandardMaterial {
    return this.floorMaterial;
  }

  public get lightingGroupObject(): THREE.Group {
    return this.lightingGroup;
  }

  public get renderTargetObject(): THREE.WebGLRenderTarget | undefined {
    return this.passRenderTarget;
  }

  public get keyLightObject(): THREE.DirectionalLight {
    return this.keyLight;
  }

  public get fillLightObject(): THREE.DirectionalLight {
    return this.fillLight;
  }

  public get isRendererDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Deterministic per-frame update loop.
   * Modifies existing light, floor, camera, and post-processing properties in place without object allocation.
   */
  public update(input: CinematicRendererUpdateInput = {}): void {
    if (this.isDisposed) return;

    const lightIntensity = input.lightIntensity ?? 1.0;
    this.keyLight.intensity = 3.0 * lightIntensity;
    this.fillLight.intensity = 1.2 * lightIntensity;

    if (input.floorReveal !== undefined) {
      const reveal = Math.min(1.0, Math.max(0.0, input.floorReveal));
      this.floorMaterial.opacity = 0.9 * reveal;
      this.floorMesh.visible = reveal > 0.001;
    }

    if (input.cameraPosition) {
      this.camera.position.set(input.cameraPosition.x, input.cameraPosition.y, input.cameraPosition.z);
    }

    if (input.cameraTarget) {
      this.camera.lookAt(input.cameraTarget.x, input.cameraTarget.y, input.cameraTarget.z);
    }
  }

  /**
   * Resizes viewport and updates camera / post-processing render target in-place.
   */
  public resize(width: number, height: number): void {
    if (this.isDisposed || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (this.passRenderTarget) {
      this.passRenderTarget.setSize(width, height);
    }
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Disposes all geometry, material, render target, and lighting resources exactly once.
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.disposerFn();
  }
}
