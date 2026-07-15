import * as THREE from "three";

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
