import * as THREE from 'three';

export interface F1StudioLighting {
  group: THREE.Group;
  key: THREE.RectAreaLight;
  update: (holdIntensity: number) => void;
  dispose: () => void;
}

const HOLD_LIGHT_BOOST = 0.12;

export const createF1StudioLighting = (scene: THREE.Scene): F1StudioLighting => {
  const group = new THREE.Group();
  const key = new THREE.RectAreaLight(0xfff4dd, 8.2, 22, 7);
  key.position.set(0, 13, 9);
  key.lookAt(0, 0, 0);

  const leftRim = new THREE.DirectionalLight(0xd9eeff, 2.1);
  leftRim.position.set(-14, 7, -8);

  const rightRim = new THREE.DirectionalLight(0xd9eeff, 2.1);
  rightRim.position.set(14, 6, -6);

  const frontFill = new THREE.DirectionalLight(0xe8f5ff, 0.65);
  frontFill.position.set(0, 3, 18);

  group.add(key, leftRim, rightRim, frontFill);
  scene.add(group);

  let disposed = false;
  return {
    group,
    key,
    update: (holdIntensity) => {
      const boost = 1 + THREE.MathUtils.clamp(holdIntensity, 0, 1) * HOLD_LIGHT_BOOST;
      key.intensity = 8.2 * boost;
      leftRim.intensity = 2.1 * boost;
      rightRim.intensity = 2.1 * boost;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      key.dispose();
      leftRim.dispose();
      rightRim.dispose();
      frontFill.dispose();
    },
  };
};
