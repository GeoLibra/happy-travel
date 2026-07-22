/**
 * Showroom Renderer Configuration Module
 * Pure logic for WebGLRenderer parameters, Tone Mapping, DPR capping, and Post-Processing toggles.
 * Consumes ShowroomQualityProfile from showroom-quality.
 */

import * as THREE from 'three';
import {
  selectShowroomQuality,
  ShowroomQualityLevel,
  ShowroomQualityOptions,
  ShowroomQualityProfile,
} from './showroom-quality.ts';

export interface ShowroomPostProcessingConfig {
  enabled: boolean;
  bloomEnabled: boolean;
  vignetteEnabled: boolean;
  chromaticAberrationEnabled: boolean;
}

export interface ShowroomRendererConfig {
  qualityLevel: ShowroomQualityLevel;
  pixelRatio: number;
  maxPixelRatio: number;
  antialias: boolean;
  alpha: boolean;
  powerPreference: 'high-performance' | 'default' | 'low-power';
  stencil: boolean;
  depth: boolean;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: string;
  shadowsEnabled: boolean;
  shadowMapType: THREE.ShadowMapType;
  postprocessing: ShowroomPostProcessingConfig;
  reducedMotion: boolean;
}

/**
 * Calculates effective pixel ratio by capping device/window DPR with profile maxPixelRatio.
 * Safe for SSR / Node environment where window is undefined.
 */
export function getEffectivePixelRatio(maxPixelRatio: number, windowPixelRatio?: number): number {
  const dpr =
    windowPixelRatio ??
    (typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1.0);
  return Math.min(Math.max(1.0, dpr), maxPixelRatio);
}

/**
 * Derives ShowroomRendererConfig from ShowroomQualityOptions or profile.
 */
export function selectShowroomRendererConfig(
  options: ShowroomQualityOptions = {},
  windowPixelRatio?: number,
): ShowroomRendererConfig {
  const profile: ShowroomQualityProfile = selectShowroomQuality(options);
  const pixelRatio = getEffectivePixelRatio(profile.maxPixelRatio, windowPixelRatio);

  const isLow = profile.level === 'low';
  const isHigh = profile.level === 'high';
  const reduced = profile.reducedMotion;

  return {
    qualityLevel: profile.level,
    pixelRatio,
    maxPixelRatio: profile.maxPixelRatio,
    antialias: !isLow,
    alpha: true,
    powerPreference: isLow ? 'low-power' : 'high-performance',
    stencil: false,
    depth: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: THREE.SRGBColorSpace,
    shadowsEnabled: profile.shadowsEnabled,
    shadowMapType: isHigh ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap,
    postprocessing: {
      enabled: (profile.bloomEnabled || !isLow) && !reduced,
      bloomEnabled: profile.bloomEnabled && !reduced,
      vignetteEnabled: !isLow && !reduced,
      chromaticAberrationEnabled: isHigh && !reduced,
    },
    reducedMotion: reduced,
  };
}
