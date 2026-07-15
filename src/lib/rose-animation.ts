import * as THREE from "three";

export const ROSE_MODEL_URL = "/models/rose.glb?v=1ba2e7a";
export const ROSE_ASSEMBLY_MS = 3_000;
export const ROSE_HANDOFF_MS = 600;
export const ROSE_BLOOM_DURATION_MS = 4_500;
export const ROSE_BLOOM_START_MS = ROSE_ASSEMBLY_MS + ROSE_HANDOFF_MS;
export const ROSE_BLOOM_END_MS = ROSE_BLOOM_START_MS + ROSE_BLOOM_DURATION_MS;
export const ROSE_INITIAL_YAW = THREE.MathUtils.degToRad(35);
export const ROSE_SLOW_SPIN_RADIANS_PER_MS = 0.00005;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getRoseAssemblyProgress(
  elapsedMs: number,
  heightRatio: number,
  delayJitter: number,
): number {
  const delay = 100 + clamp01(heightRatio) * 450 + clamp01(delayJitter) * 250;
  const linear = clamp01((elapsedMs - delay) / (ROSE_ASSEMBLY_MS - delay));
  return easeInOutCubic(linear);
}

export function getRoseArcStrength(progress: number): number {
  const t = clamp01(progress);
  return Math.sin(Math.PI * t) * (1 - t * 0.25);
}

export function getRoseHandoffProgress(elapsedMs: number): number {
  return easeInOutCubic((elapsedMs - ROSE_ASSEMBLY_MS) / ROSE_HANDOFF_MS);
}

export function getRosePresentationYaw(elapsedMs: number): number {
  if (elapsedMs <= ROSE_BLOOM_START_MS) return ROSE_INITIAL_YAW;
  if (elapsedMs < ROSE_BLOOM_END_MS) {
    const progress = easeInOutCubic(
      (elapsedMs - ROSE_BLOOM_START_MS) / ROSE_BLOOM_DURATION_MS,
    );
    return ROSE_INITIAL_YAW * (1 - progress);
  }
  return (elapsedMs - ROSE_BLOOM_END_MS) * ROSE_SLOW_SPIN_RADIANS_PER_MS;
}

export function getRoseBloomDelta(
  elapsedMs: number,
  frameDeltaSeconds: number,
): number {
  const current = Math.max(elapsedMs, 0);
  const previous = Math.max(current - Math.max(frameDeltaSeconds, 0) * 1_000, 0);
  const activeStart = Math.max(previous, ROSE_BLOOM_START_MS);
  const activeEnd = Math.min(current, ROSE_BLOOM_END_MS);
  return Math.max(activeEnd - activeStart, 0) / 1_000;
}

export function createRoseBloomAction(
  root: THREE.Object3D,
  animations: readonly THREE.AnimationClip[],
): { mixer: THREE.AnimationMixer; action: THREE.AnimationAction } | null {
  const clip = THREE.AnimationClip.findByName([...animations], "RoseBloom") ?? animations[0];
  if (!clip) return null;
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.reset().play();
  mixer.setTime(0);
  return { mixer, action };
}
