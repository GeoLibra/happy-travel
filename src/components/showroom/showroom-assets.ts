export const SHOWROOM_ASSETS = {
  car: '/models/2024_redbull_rb20_showroom_v5.glb',
  studioHdr: '/environments/ferndale_studio_09_1k.hdr',
  nightHdr: '/environments/rooftop_night_1k.hdr',
} as const;

export type ShowroomAssetKey = keyof typeof SHOWROOM_ASSETS;

export interface ShowroomLoadProgress {
  critical: number;
  optional: number;
  status: 'loading' | 'ready' | 'fallback';
}
