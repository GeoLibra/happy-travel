/**
 * Test Observability API for Happy Travel WebGL & Component Lifecycles
 * Exposes window.__HAPPY_TRAVEL_TEST__ in non-production / test mode for structured
 * telemetry, scene auditing, and GPU resource accounting.
 */

export interface GPUMetrics {
  geometries: number;
  textures: number;
  programs: number;
  activeAnimationFrames: number;
  activeListeners: number;
  activeRenderTargets: number;
  materials: number;
}

export interface SceneAudit {
  sceneId: string;
  phase?: string;
  geometries: number;
  textures: number;
  programs: number;
  activeAnimationFrames: number;
  activeListeners: number;
  activeRenderTargets: number;
  materials: number;
  details?: Record<string, any>;
}

export interface HappyTravelTestSnapshot {
  gpu: GPUMetrics;
  scenes: Record<string, SceneAudit>;
  geometries: number;
  textures: number;
  programs: number;
  activeAnimationFrames: number;
  activeListeners: number;
  activeRenderTargets: number;
  materials: number;
}

export interface CountdownTestSnapshot {
  activeAnimationFrames: number;
  activeListeners: number;
  activeScenes: number;
  composers: number;
  environments: number;
  frameCount: number;
  floors: number;
  geometries: number;
  materials: number;
  mode: 'countdown' | null;
  ready: boolean;
  renderers: number;
  resourceCount: number;
  vehicles: number;
  viewport: 'desktop' | 'mobile' | null;
}

export type CountdownResourceKind =
  | 'animationFrame'
  | 'composer'
  | 'environment'
  | 'floor'
  | 'geometry'
  | 'listener'
  | 'material'
  | 'renderer'
  | 'vehicle';

export interface HappyTravelTestAPI {
  countdown: () => CountdownTestSnapshot;
  snapshot: () => HappyTravelTestSnapshot;
  sceneAudit: (sceneId: string) => SceneAudit | null;
  registerScene: (sceneId: string, auditGetter: () => SceneAudit) => () => void;
  unregisterScene: (sceneId: string) => void;
  trackAnimationFrame: (id: number) => () => void;
  untrackAnimationFrame: (id: number) => void;
  trackListener: (target: EventTarget, type: string, listener: EventListenerOrEventListenerObject) => () => void;
}

declare global {
  interface Window {
    __HAPPY_TRAVEL_TEST__?: HappyTravelTestAPI;
    __HAPPY_TRAVEL_TEST_MODE__?: boolean;
  }
}

const registeredScenes = new Map<string, () => SceneAudit>();
const activeAnimationFrames = new Set<number>();
const activeListeners = new Set<{ target: EventTarget; type: string; listener: any }>();
const countdownResourceCounts: Record<CountdownResourceKind, number> = {
  animationFrame: 0,
  composer: 0,
  environment: 0,
  floor: 0,
  geometry: 0,
  listener: 0,
  material: 0,
  renderer: 0,
  vehicle: 0,
};

export function trackCountdownResource(kind: CountdownResourceKind): () => void {
  countdownResourceCounts[kind] += 1;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    countdownResourceCounts[kind] -= 1;
  };
}

export function registerScene(sceneId: string, auditGetter: () => SceneAudit): () => void {
  registeredScenes.set(sceneId, auditGetter);
  return () => {
    registeredScenes.delete(sceneId);
  };
}

export function unregisterScene(sceneId: string): void {
  registeredScenes.delete(sceneId);
}

export function trackAnimationFrame(id: number): () => void {
  activeAnimationFrames.add(id);
  return () => {
    activeAnimationFrames.delete(id);
  };
}

export function untrackAnimationFrame(id: number): void {
  activeAnimationFrames.delete(id);
}

export function trackListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject
): () => void {
  const entry = { target, type, listener };
  activeListeners.add(entry);
  return () => {
    activeListeners.delete(entry);
  };
}

export function sceneAudit(sceneId: string): SceneAudit | null {
  const getter = registeredScenes.get(sceneId);
  if (!getter) return null;
  try {
    return getter();
  } catch {
    return null;
  }
}

export function snapshot(): HappyTravelTestSnapshot {
  const scenesRecord: Record<string, SceneAudit> = {};
  let totalGeometries = 0;
  let totalTextures = 0;
  let totalPrograms = 0;
  let totalAnimFrames = activeAnimationFrames.size;
  let totalListeners = activeListeners.size;
  let totalRenderTargets = 0;
  let totalMaterials = 0;

  for (const [sceneId, getter] of registeredScenes.entries()) {
    try {
      const audit = getter();
      scenesRecord[sceneId] = audit;
      totalGeometries += audit.geometries || 0;
      totalTextures += audit.textures || 0;
      totalPrograms += audit.programs || 0;
      totalAnimFrames += audit.activeAnimationFrames || 0;
      totalListeners += audit.activeListeners || 0;
      totalRenderTargets += audit.activeRenderTargets || 0;
      totalMaterials += audit.materials || 0;
    } catch (e) {
      // Ignore scene getter error
    }
  }

  const gpu: GPUMetrics = {
    geometries: totalGeometries,
    textures: totalTextures,
    programs: totalPrograms,
    activeAnimationFrames: totalAnimFrames,
    activeListeners: totalListeners,
    activeRenderTargets: totalRenderTargets,
    materials: totalMaterials,
  };

  return {
    gpu,
    scenes: scenesRecord,
    geometries: totalGeometries,
    textures: totalTextures,
    programs: totalPrograms,
    activeAnimationFrames: totalAnimFrames,
    activeListeners: totalListeners,
    activeRenderTargets: totalRenderTargets,
    materials: totalMaterials,
  };
}

export function countdownResourceSnapshot() {
  const resourceCount = Object.values(countdownResourceCounts)
    .reduce((total, count) => total + count, 0);

  return {
    activeAnimationFrames: countdownResourceCounts.animationFrame,
    activeListeners: countdownResourceCounts.listener,
    composers: countdownResourceCounts.composer,
    environments: countdownResourceCounts.environment,
    floors: countdownResourceCounts.floor,
    geometries: countdownResourceCounts.geometry,
    materials: countdownResourceCounts.material,
    renderers: countdownResourceCounts.renderer,
    resourceCount,
    vehicles: countdownResourceCounts.vehicle,
  };
}

export function countdownSnapshot(): CountdownTestSnapshot {
  const audit = sceneAudit('race-countdown');
  const details = audit?.details ?? {};
  const mode = details.mode === 'countdown' ? details.mode : null;
  const viewport = details.viewport === 'desktop' || details.viewport === 'mobile'
    ? details.viewport
    : null;

  return {
    ...countdownResourceSnapshot(),
    activeScenes: audit ? 1 : 0,
    frameCount: typeof details.frameCount === 'number' ? details.frameCount : 0,
    mode,
    ready: details.ready === true,
    viewport,
  };
}

// Expose API on window only in dev/test mode. Never in production builds.
// import.meta.env.PROD is statically replaced by Vite, enabling dead-code elimination.
// For CI/Playwright running against a production build, set VITE_TEST_OBSERVABILITY=true
// at build time to opt in.
if (
  typeof window !== 'undefined' &&
  (!import.meta.env.PROD || import.meta.env.VITE_TEST_OBSERVABILITY === 'true')
) {
  const testAPI: HappyTravelTestAPI = {
    countdown: countdownSnapshot,
    snapshot,
    sceneAudit,
    registerScene,
    unregisterScene,
    trackAnimationFrame,
    untrackAnimationFrame,
    trackListener,
  };
  window.__HAPPY_TRAVEL_TEST__ = testAPI;
}
