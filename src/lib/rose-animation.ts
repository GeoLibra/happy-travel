import * as THREE from "three";

export const ROSE_MODEL_URL = "/models/rose.glb?v=1ba2e7a";
export const ROSE_PARTICLE_PHASE_MS = 2_500;

export function getRoseBloomDelta(
  elapsedMs: number,
  frameDeltaSeconds: number,
): number {
  return elapsedMs < ROSE_PARTICLE_PHASE_MS ? 0 : frameDeltaSeconds;
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
  return { mixer, action };
}
