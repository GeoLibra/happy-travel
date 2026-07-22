import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ShowroomAssetManager } from '../src/components/showroom/asset-manager.ts';

// Helper mock loader factories
function createMockLoader<T>(resolveValue: T, delayMs = 50) {
  let callCount = 0;
  const loader = (url: string, onProgress?: (p: number) => void): Promise<T> => {
    callCount += 1;
    onProgress?.(50);
    return new Promise((resolve) => {
      setTimeout(() => {
        onProgress?.(100);
        resolve(resolveValue);
      }, delayMs);
    });
  };

  return { loader, getCallCount: () => callCount };
}

function createFailingLoader(errorMsg: string) {
  return (url: string): Promise<never> => {
    return Promise.reject(new Error(errorMsg));
  };
}

async function runTests() {
  // 1. Cache Hit test
  const mockModel = { scene: 'mock-scene-object' };
  const mockModelLoader = createMockLoader(mockModel, 20);
  const manager = new ShowroomAssetManager({
    modelLoader: mockModelLoader.loader,
  });

  const url = '/models/test-car.glb';
  let progressCount = 0;

  const promise1 = manager.loadModel(url, () => {
    progressCount += 1;
  });
  const promise2 = manager.loadModel(url); // Cache hit

  assert.equal(mockModelLoader.getCallCount(), 1, 'loader must only be called once for cached URL');

  const [res1, res2] = await Promise.all([promise1, promise2]);
  assert.equal(res1.success, true);
  assert.equal(res1.isFallback, false);
  assert.equal(res1.data, mockModel);
  assert.equal(res2.data, mockModel);
  assert(progressCount > 0, 'progress callback should be called');

  // 2. Cancellation test
  const cancelModelLoader = createMockLoader(mockModel, 100);
  const cancelManager = new ShowroomAssetManager({
    modelLoader: cancelModelLoader.loader,
  });

  const cancelUrl = '/models/cancel-target.glb';
  const cancelPromise = cancelManager.loadModel(cancelUrl);
  cancelManager.cancel(cancelUrl);

  const cancelRes = await cancelPromise;
  assert.equal(cancelRes.success, false, 'cancelled task must fail');
  assert.equal(cancelRes.isFallback, true, 'cancelled task must return isFallback = true');
  assert.match(cancelRes.error?.message || '', /cancelled/, 'error message must mention cancellation');

  // 2b. Cancellation retry race condition test
  const raceModelLoader = createMockLoader(mockModel, 60);
  const raceManager = new ShowroomAssetManager({
    modelLoader: raceModelLoader.loader,
  });

  const sameUrl = '/models/race-condition.glb';
  const oldPromise = raceManager.loadModel(sameUrl);
  raceManager.cancel(sameUrl);
  const newPromise = raceManager.loadModel(sameUrl);

  const [oldRes, newRes] = await Promise.all([oldPromise, newPromise]);
  assert.equal(oldRes.success, false, 'cancelled old promise must return fallback even if same URL is retried');
  assert.equal(oldRes.isFallback, true, 'cancelled old promise must return isFallback = true');
  assert.equal(newRes.success, true, 'new promise for retried URL must succeed');
  assert.equal(newRes.isFallback, false);

  // 3. Failure Fallback test
  const failManager = new ShowroomAssetManager({
    modelLoader: createFailingLoader('Network 404 Error'),
    hdrLoader: createFailingLoader('HDR Texture Not Found'),
  });

  const failModelRes = await failManager.loadModel('/models/non-existent.glb');
  assert.equal(failModelRes.success, false);
  assert.equal(failModelRes.isFallback, true);
  assert.equal(failModelRes.error?.message, 'Network 404 Error');

  const failHdrRes = await failManager.loadHDR('/hdr/non-existent.hdr');
  assert.equal(failHdrRes.success, false);
  assert.equal(failHdrRes.isFallback, true);
  assert.equal(failHdrRes.error?.message, 'HDR Texture Not Found');

  // 4. Dispose test
  const disposeModelLoader = createMockLoader(mockModel, 100);
  const disposeManager = new ShowroomAssetManager({
    modelLoader: disposeModelLoader.loader,
  });

  const activeTask = disposeManager.loadModel('/models/dispose-test.glb');
  disposeManager.dispose();

  assert.equal(disposeManager.isManagerDisposed, true);
  const disposeRes = await activeTask;
  assert.equal(disposeRes.success, false);
  assert.equal(disposeRes.isFallback, true);

  const postDisposeTask = await disposeManager.loadModel('/models/post-dispose.glb');
  assert.equal(postDisposeTask.success, false);
  assert.equal(postDisposeTask.isFallback, true);

  // 5. Rose Lazy Loading check on WelcomePage.tsx
  const welcomePagePath = join(process.cwd(), 'src', 'components', 'WelcomePage.tsx');
  const welcomeSource = readFileSync(welcomePagePath, 'utf8');

  assert.match(
    welcomeSource,
    /import\s+.*ShowroomAssetManager.*from\s+['"].\/showroom\/asset-manager['"]/,
    'WelcomePage.tsx must import ShowroomAssetManager',
  );

  assert.match(
    welcomeSource,
    /new ShowroomAssetManager\(\)/,
    'WelcomePage.tsx must instantiate ShowroomAssetManager',
  );

  assert.doesNotMatch(
    welcomeSource,
    /ROSE_MODEL_URL/,
    'WelcomePage.tsx must not eagerly import or load ROSE_MODEL_URL during initial welcome page mount',
  );

  console.log('check:showroom-asset-manager passed cleanly.');
}

runTests().catch((err) => {
  console.error('check:showroom-asset-manager failed:', err);
  process.exit(1);
});
