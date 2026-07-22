/**
 * Showroom Pure Scene Director Module
 * Consumes getShowroomChapter() and outputs deterministic camera, car, visual effects, and audio target frames.
 */

import { getAudioTarget } from '../components/showroom/audio-engine';
import {
  getShowroomChapter,
  ShowroomChapterId,
  ShowroomChapterState,
} from './showroom-story';
import { lerp, lerpVector3D, Vector3D } from './showroom-route';

export interface DirectorCameraFrame {
  position: Vector3D;
  lookAt: Vector3D;
  fov: number;
}

export interface DirectorCarFrame {
  explodeAmount: number;
  rotationY: number;
}

export interface DirectorEffectsFrame {
  particleOpacity: number;
  airflowIntensity: number;
  gridIntensity: number;
}

export interface DirectorAudioFrame {
  volume: number;
  playbackRate: number;
}

export interface ShowroomDirectorFrame {
  chapterId: ShowroomChapterId;
  chapterTitle: string;
  globalProgress: number;
  localProgress: number;
  chapter: ShowroomChapterState;
  camera: DirectorCameraFrame;
  car: DirectorCarFrame;
  effects: DirectorEffectsFrame;
  audio: DirectorAudioFrame;
}

/**
 * Generates a deterministic scene director frame for a given global progress value [0, 1.0].
 */
export function createShowroomDirectorFrame(progress: number): ShowroomDirectorFrame {
  const chapter = getShowroomChapter(progress);
  const { id, localProgress, globalProgress } = chapter;

  let camera: DirectorCameraFrame;
  let car: DirectorCarFrame;
  let effects: DirectorEffectsFrame;

  switch (id) {
    case 'material': {
      camera = {
        position: lerpVector3D({ x: 0, y: 0.8, z: 3.5 }, { x: 0.5, y: 0.9, z: 3.6 }, localProgress),
        lookAt: { x: 0, y: 0.5, z: 0 },
        fov: lerp(45, 48, localProgress),
      };
      car = {
        explodeAmount: 0,
        rotationY: lerp(0, 0.15, localProgress),
      };
      effects = {
        particleOpacity: lerp(0.4, 0.5, localProgress),
        airflowIntensity: 0.1,
        gridIntensity: 0.2,
      };
      break;
    }

    case 'aero': {
      camera = {
        position: lerpVector3D({ x: 0.5, y: 0.9, z: 3.6 }, { x: 2.5, y: 1.2, z: 4.0 }, localProgress),
        lookAt: { x: 0, y: 0.6, z: 0 },
        fov: lerp(48, 52, localProgress),
      };
      car = {
        explodeAmount: lerp(0, 0.3, localProgress),
        rotationY: lerp(0.15, 0.35, localProgress),
      };
      effects = {
        particleOpacity: lerp(0.5, 0.7, localProgress),
        airflowIntensity: lerp(0.3, 0.9, localProgress),
        gridIntensity: 0.4,
      };
      break;
    }

    case 'power': {
      camera = {
        position: lerpVector3D({ x: 2.5, y: 1.2, z: 4.0 }, { x: 0, y: 1.5, z: 3.0 }, localProgress),
        lookAt: { x: 0, y: 0.8, z: 0 },
        fov: 50,
      };
      car = {
        explodeAmount: lerp(0.3, 0.7, localProgress),
        rotationY: lerp(0.35, 0.5, localProgress),
      };
      effects = {
        particleOpacity: 0.8,
        airflowIntensity: lerp(0.9, 0.5, localProgress),
        gridIntensity: lerp(0.4, 0.6, localProgress),
      };
      break;
    }

    case 'circuit': {
      camera = {
        position: lerpVector3D({ x: 0, y: 1.5, z: 3.0 }, { x: -3.0, y: 2.0, z: 5.0 }, localProgress),
        lookAt: { x: 0, y: 0.5, z: 0 },
        fov: lerp(50, 60, localProgress),
      };
      car = {
        explodeAmount: lerp(0.7, 0.1, localProgress),
        rotationY: lerp(0.5, 0.8, localProgress),
      };
      effects = {
        particleOpacity: lerp(0.8, 0.7, localProgress),
        airflowIntensity: 0.3,
        gridIntensity: lerp(0.6, 0.9, localProgress),
      };
      break;
    }

    case 'weekend':
    default: {
      camera = {
        position: lerpVector3D({ x: -3.0, y: 2.0, z: 5.0 }, { x: 0, y: 1.0, z: 4.5 }, localProgress),
        lookAt: { x: 0, y: 0.5, z: 0 },
        fov: lerp(60, 55, localProgress),
      };
      car = {
        explodeAmount: 0,
        rotationY: lerp(0.8, 1.0, localProgress),
      };
      effects = {
        particleOpacity: 1.0,
        airflowIntensity: 0.2,
        gridIntensity: lerp(0.9, 0.3, localProgress),
      };
      break;
    }
  }

  const audioTarget = getAudioTarget(globalProgress);

  return {
    chapterId: id,
    chapterTitle: chapter.title,
    globalProgress,
    localProgress,
    chapter,
    camera,
    car,
    effects,
    audio: {
      volume: audioTarget.volume,
      playbackRate: audioTarget.playbackRate,
    },
  };
}
