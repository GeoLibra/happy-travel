import type * as THREE from 'three';

import type {
  ShowroomQualityOptions,
  ShowroomQualityProfile,
} from '@/src/lib/showroom-quality';

import type { TimeVizMode } from './digit-layout';

export interface TimeVizSceneSnapshot {
  ready: boolean;
  frameCount: number;
  resourceCount: number;
  mode: 'reference' | 'countdown';
  viewport: 'desktop' | 'mobile';
}

export interface TimeVizScene {
  setDigits(digits: string[]): void;
  setVehicle(vehicle: THREE.Object3D | null): void;
  resize(width: number, height: number, pixelRatio: number): void;
  getSnapshot(): TimeVizSceneSnapshot;
  dispose(): void;
}

export interface TimeVizSceneOptions {
  canvas: HTMLCanvasElement;
  mode: 'reference' | 'countdown';
  seed?: number;
  reducedMotion?: boolean;
  onReady?: (snapshot: TimeVizSceneSnapshot) => void;
  dependencies?: TimeVizDependencies;
}

export interface TimeVizRenderer {
  dispose(): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

export interface TimeVizComposer {
  dispose(): void;
  render(deltaTime?: number): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number): void;
}

export interface TimeVizFloor {
  object: THREE.Object3D;
  resize(width: number, height: number, pixelRatio: number): void;
  update(elapsedSeconds: number): void;
  dispose(): void;
}

export interface TimeVizEnvironment {
  texture: THREE.Texture;
  dispose(): void;
}

export interface TimeVizDependencies {
  createRenderer(canvas: HTMLCanvasElement, quality: ShowroomQualityProfile): TimeVizRenderer;
  createComposer(
    renderer: TimeVizRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    bloomEnabled: boolean,
  ): TimeVizComposer;
  createFloor(
    renderer: TimeVizRenderer,
    width: number,
    height: number,
    animated: boolean,
  ): TimeVizFloor;
  createGeometry(): THREE.BufferGeometry;
  createMaterial(): THREE.Material;
  loadEnvironment(renderer: TimeVizRenderer, url: string): Promise<TimeVizEnvironment | null>;
  selectQuality(options: ShowroomQualityOptions): ShowroomQualityProfile;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(frameId: number): void;
  now(): number;
}

export interface CountdownCanvasProps {
  digits: string[];
  mode: TimeVizMode;
  seed?: number;
  vehicle?: THREE.Object3D | null;
  onReady?: (snapshot: TimeVizSceneSnapshot) => void;
  onSnapshot?: (snapshot: TimeVizSceneSnapshot) => void;
  onWebGLFailure?: (error: Error) => void;
}
