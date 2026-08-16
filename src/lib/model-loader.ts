import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'happy-travel',
  storeName: 'models'
});

const createGLTFLoader = () => {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
};

const parseGLTFBuffer = (buffer: ArrayBuffer): Promise<GLTF> => {
  return new Promise<GLTF>((resolve, reject) => {
    const loader = createGLTFLoader();
    loader.parse(
      buffer,
      '',
      (result) => {
        resolve(result);
      },
      (error) => {
        console.error('[ModelLoader] Error parsing GLTF buffer:', error);
        reject(error);
      }
    );
  });
};

export const loadModelWithCache = async (
  url: string,
  onProgress?: (progress: number) => void
): Promise<GLTF> => {
  const cachedModel = await localforage.getItem<ArrayBuffer>(url);

  if (cachedModel) {
    console.log(`[ModelLoader] Loading ${url} from cache`);
    onProgress?.(100);
    return parseGLTFBuffer(cachedModel);
  }

  console.log(`[ModelLoader] Fetching ${url} from server`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  onProgress?.(100);

  // Cache asynchronously for next time without blocking
  void localforage.setItem(url, arrayBuffer).catch(() => {});

  return parseGLTFBuffer(arrayBuffer);
};
