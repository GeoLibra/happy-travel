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

export const loadModelWithCache = async (
  url: string,
  onProgress?: (progress: number) => void
): Promise<GLTF> => {
  const cachedModel = await localforage.getItem<ArrayBuffer>(url);

  if (cachedModel) {
    console.log(`[ModelLoader] Loading ${url} from cache`);
    onProgress?.(100);
    return new Promise((resolve, reject) => {
      const loader = createGLTFLoader();
      loader.parse(cachedModel, '', (gltf) => {
        resolve(gltf);
      }, (error) => {
        console.error(`[ModelLoader] Error parsing cached model ${url}:`, error);
        reject(error);
      });
    });
  }

  console.log(`[ModelLoader] Fetching ${url} from server`);
  const response = await fetch(url);

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  while(true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) {
      onProgress?.(Math.round((loaded / total) * 100));
    }
  }

  const allChunks = new Uint8Array(loaded);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  const arrayBuffer = allChunks.buffer;

  // Cache for next time
  await localforage.setItem(url, arrayBuffer);

  return new Promise((resolve, reject) => {
    const loader = createGLTFLoader();
    loader.parse(arrayBuffer, '', (gltf) => {
      resolve(gltf);
    }, (error) => {
      console.error(`[ModelLoader] Error parsing fetched model ${url}:`, error);
      reject(error);
    });
  });
};
