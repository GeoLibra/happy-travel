import * as THREE from 'three';

export const COLORS = {
  red: new THREE.Color('#E10600'),
  yellow: new THREE.Color('#FFB800'),
  white: new THREE.Color('#ffffff'),
  navy: new THREE.Color('#001A30'),
};

export const SPEED_LINE_COUNT = 100;
export const CPU_PARTICLE_COUNT = 1000;
export const TRAIL_COUNT = 15;
export const TRAIL_SEGMENTS = 20;
export const HAIRLINE_COUNT = 3000;
export const SIDE_LINE_COUNT = 400;
export const TOTAL_LINES = HAIRLINE_COUNT + SIDE_LINE_COUNT;
