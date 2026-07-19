export const SHOWROOM_ASSETS = {
  car: '/models/red_bull_f1_showroom_v4.glb',
  studioHdr: '/environments/ferndale_studio_09_1k.hdr',
  nightHdr: '/environments/rooftop_night_1k.hdr',
} as const;

export type ShowroomAssetKey = keyof typeof SHOWROOM_ASSETS;

export interface ShowroomLoadProgress {
  critical: number;
  optional: number;
  status: 'loading' | 'ready' | 'fallback';
}
