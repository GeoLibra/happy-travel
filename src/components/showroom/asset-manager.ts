/**
 * Showroom Cancellable & Cached Asset Manager
 * Handles loading, caching, cancellation, fallback, and cleanup for 3D models and HDR environment maps.
 */

import { loadModelWithCache } from '../../lib/model-loader';

export interface AssetLoadResult<T> {
  success: boolean;
  data: T | null;
  isFallback: boolean;
  error?: Error;
}

export interface AssetManagerOptions {
  modelLoader?: (url: string, onProgress?: (p: number) => void) => Promise<unknown>;
  hdrLoader?: (url: string, onProgress?: (p: number) => void) => Promise<unknown>;
}

const defaultHdrLoader = async (url: string, onProgress?: (p: number) => void): Promise<unknown> => {
  if (typeof window === 'undefined') {
    onProgress?.(100);
    return { url, isMockHdr: true };
  }
  // Dynamic import RGBELoader if running in browser
  const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js');
  const loader = new RGBELoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => resolve(texture),
      (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      },
      (err) => reject(err),
    );
  });
};

interface CachedTask<T> {
  taskId: number;
  promise: Promise<AssetLoadResult<T>>;
}

export class ShowroomAssetManager {
  private modelCache = new Map<string, CachedTask<unknown>>();
  private hdrCache = new Map<string, CachedTask<unknown>>();
  private cancelledTaskIds = new Set<number>();
  private nextTaskId = 0;
  private isDisposed = false;

  private modelLoader: (url: string, onProgress?: (p: number) => void) => Promise<unknown>;
  private hdrLoader: (url: string, onProgress?: (p: number) => void) => Promise<unknown>;

  constructor(options: AssetManagerOptions = {}) {
    this.modelLoader = options.modelLoader || loadModelWithCache;
    this.hdrLoader = options.hdrLoader || defaultHdrLoader;
  }

  public get isManagerDisposed(): boolean {
    return this.isDisposed;
  }

  public loadModel<T = unknown>(
    url: string,
    onProgress?: (p: number) => void,
  ): Promise<AssetLoadResult<T>> {
    if (this.isDisposed) {
      return Promise.resolve({
        success: false,
        data: null,
        isFallback: true,
        error: new Error('AssetManager is disposed'),
      });
    }

    if (this.modelCache.has(url)) {
      return this.modelCache.get(url)!.promise as Promise<AssetLoadResult<T>>;
    }

    const taskId = ++this.nextTaskId;

    const promise = (async (): Promise<AssetLoadResult<T>> => {
      try {
        const data = await this.modelLoader(url, (p) => {
          if (!this.cancelledTaskIds.has(taskId) && !this.isDisposed) {
            onProgress?.(p);
          }
        });

        if (this.cancelledTaskIds.has(taskId) || this.isDisposed) {
          return {
            success: false,
            data: null,
            isFallback: true,
            error: new Error(`Loading cancelled for ${url}`),
          };
        }

        return {
          success: true,
          data: data as T,
          isFallback: false,
        };
      } catch (err) {
        return {
          success: false,
          data: null,
          isFallback: true,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    })();

    this.modelCache.set(url, { taskId, promise: promise as Promise<AssetLoadResult<unknown>> });
    return promise;
  }

  public loadHDR<T = unknown>(
    url: string,
    onProgress?: (p: number) => void,
  ): Promise<AssetLoadResult<T>> {
    if (this.isDisposed) {
      return Promise.resolve({
        success: false,
        data: null,
        isFallback: true,
        error: new Error('AssetManager is disposed'),
      });
    }

    if (this.hdrCache.has(url)) {
      return this.hdrCache.get(url)!.promise as Promise<AssetLoadResult<T>>;
    }

    const taskId = ++this.nextTaskId;

    const promise = (async (): Promise<AssetLoadResult<T>> => {
      try {
        const data = await this.hdrLoader(url, (p) => {
          if (!this.cancelledTaskIds.has(taskId) && !this.isDisposed) {
            onProgress?.(p);
          }
        });

        if (this.cancelledTaskIds.has(taskId) || this.isDisposed) {
          return {
            success: false,
            data: null,
            isFallback: true,
            error: new Error(`Loading cancelled for ${url}`),
          };
        }

        return {
          success: true,
          data: data as T,
          isFallback: false,
        };
      } catch (err) {
        return {
          success: false,
          data: null,
          isFallback: true,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    })();

    this.hdrCache.set(url, { taskId, promise: promise as Promise<AssetLoadResult<unknown>> });
    return promise;
  }

  public cancel(url: string): void {
    const modelTask = this.modelCache.get(url);
    if (modelTask) {
      this.cancelledTaskIds.add(modelTask.taskId);
      this.modelCache.delete(url);
    }
    const hdrTask = this.hdrCache.get(url);
    if (hdrTask) {
      this.cancelledTaskIds.add(hdrTask.taskId);
      this.hdrCache.delete(url);
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    for (const task of this.modelCache.values()) {
      this.cancelledTaskIds.add(task.taskId);
    }
    for (const task of this.hdrCache.values()) {
      this.cancelledTaskIds.add(task.taskId);
    }
    this.modelCache.clear();
    this.hdrCache.clear();
  }
}
