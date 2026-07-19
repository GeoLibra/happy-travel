import * as THREE from 'three';
import { COLORS, HAIRLINE_COUNT, TOTAL_LINES } from './showroom-constants';

export interface TrackDatum {
  x: number;
  y: number;
  z: number;
  speedMultiplier: number;
  length: number;
  width: number;
  isVertical: boolean;
}

export interface ShowroomTrack {
  mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  data: TrackDatum[];
  scratch: THREE.Object3D;
  material: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export const createShowroomTrack = (): ShowroomTrack => {
  // Base geometry: simple thin plane. We will scale it in instanceMatrix.
  const hairGeo = new THREE.PlaneGeometry(1, 1);
  // Move pivot to front edge so they scale from camera outwards nicely
  hairGeo.translate(0, 0, -0.5);

  const hairMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
  });

  const hairMesh = new THREE.InstancedMesh(hairGeo, hairMat, TOTAL_LINES);

  // The road needs to stay locked to the car's bottom, no matter the progress
  hairMesh.position.y = -10.05;

  const hairData: TrackDatum[] = [];
  const dummyHair = new THREE.Object3D();

  for (let i = 0; i < TOTAL_LINES; i++) {
      const isVertical = i >= HAIRLINE_COUNT;

      let x, y, z;
      let c: THREE.Color;
      const rng = Math.random();

      if (!isVertical) {
          // -- GROUND LINES --
          // Spread X: concentrated in the center, tapering out. Range ~[-35, 35]
          const xDist = (Math.pow(Math.random(), 3.0) * 45);
          x = Math.random() < 0.5 ? xDist : -xDist;
          y = 0; // Flat on the road

          // Strict color matching based on the reference image
          if (Math.abs(x) < 4) {
               // Center track: Bright exhaust lines. Mostly fine white, some bright blue/purple hues
               c = rng > 0.95 ? new THREE.Color('#d4e4ff') : COLORS.white;
          } else if (x < -2) {
              // Left side: Icy cyan blue to deep blue
              c = new THREE.Color().lerpColors(new THREE.Color('#00ccff'), new THREE.Color('#0033cc'), Math.abs(x)/45);
          } else if (x > 2) {
              // Right side: Bright magenta to deep purple
              c = new THREE.Color().lerpColors(new THREE.Color('#e040fb'), new THREE.Color('#651fff'), Math.abs(x)/45);
          } else {
               c = COLORS.white;
          }
      } else {
          // -- SIDE WALL LINES --
          // Like a U-shaped half-pipe. They run parallel to the road (pointing down Z),
          // but their positions curve up the side walls.
          const wallCurveX = 30 + Math.random() * 25; // How far out they are (X)
          x = Math.random() < 0.5 ? wallCurveX : -wallCurveX;
          // Curve up into the sky. The further out (X), the higher (Y)
          const curveFactor = Math.abs(x) - 30; // 0 to 25
          y = Math.pow(Math.random(), 2.0) * (curveFactor * 8);

          if (x < 0) {
               // Left wall: deep blue
               c = new THREE.Color().lerpColors(new THREE.Color('#0055ff'), new THREE.Color('#001155'), y/200);
          } else {
               // Right wall: deep purple
               c = new THREE.Color().lerpColors(new THREE.Color('#9900ff'), new THREE.Color('#220044'), y/200);
          }
      }

      z = (Math.random() - 0.5) * 800; // Deep back to right behind camera

      // Variance
      // Very long lines to create continuous feel without gaps
      const length = 100 + Math.random() * 300;

      // Fine hairlines: mostly very thin, rarely thick
      let width;
      if (!isVertical && Math.abs(x) < 3 && rng > 0.98) {
           width = 1.0 + Math.random() * 1.5; // Rare thick center glowing lines
      } else {
           width = 0.05 + Math.random() * 0.4;
      }

      const speedMultiplier = 0.5 + Math.random() * 0.8;

      // Apply
      dummyHair.position.set(x, y, z);

      // ALL lines point straight forward along the Z axis (parallel to the ground)!
      dummyHair.rotation.set(-Math.PI / 2, 0, 0);

      // If it's a wall line, we tilt its face towards the camera (rotating around its roll axis, which is now World Z)
      if (isVertical) {
           const faceAngle = Math.atan2(y + 10, Math.abs(x));
           dummyHair.rotateY(x < 0 ? -faceAngle : faceAngle);
      }

      dummyHair.scale.set(width, length, 1);
      dummyHair.updateMatrix();
      hairMesh.setMatrixAt(i, dummyHair.matrix);
      hairMesh.setColorAt(i, c);

      hairData.push({ x, y, z, speedMultiplier, length, width, isVertical });
  }
  hairMesh.instanceMatrix.needsUpdate = true;
  if (hairMesh.instanceColor) hairMesh.instanceColor.needsUpdate = true;

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    hairGeo.dispose();
    hairMat.dispose();
  };

  return {
    mesh: hairMesh,
    data: hairData,
    scratch: dummyHair,
    material: hairMat,
    dispose,
  };
};
