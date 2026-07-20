// Focused Playwright CLI probe. Run against a local Vite server with:
// playwright-cli run-code "$(cat scripts/run-f1-glitch-webgl-probe.mjs)"
async page => {
  await page.goto('http://127.0.0.1:3000/?f1RendererAudit=1', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.getByText('RACE PREP IN PROGRESS').waitFor({ state: 'hidden', timeout: 45_000 })
    .catch(() => undefined);
  const showroom = page.getByRole('button', {
    name: 'Interactive Formula One showroom car',
  });
  const startButton = page.locator('[data-f1-welcome-action="enter"]');
  await startButton.waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    return canvas?.__f1RendererAudit?.snapshot().modelSourcePrewarms >= 1;
  }, null, { timeout: 45_000 });

  const startBox = await startButton.boundingBox();
  if (!startBox) throw new Error('start control has no layout box');
  const welcomeUrl = page.url();
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent ?? '';
    const match = text.match(/ENGINE STARTING (\d+)%/);
    const progress = Number(match?.[1] ?? 0);
    return progress >= 30 && progress < 100;
  }, null, { timeout: 12_000 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent ?? '';
    return text.includes('ENTER') && !text.includes('STARTING');
  }, null, { timeout: 12_000 });
  if (page.url() !== welcomeUrl || !(await showroom.isVisible())) {
    throw new Error('pre-100% release left the welcome scene');
  }

  await page.waitForFunction(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    return (canvas?.__f1RendererAudit?.snapshot().activePulseFrames ?? 0) > 0;
  }, null, { timeout: 12_000 });

  const sampleCanvas = () => page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('real showroom canvas unavailable');
    const sample = document.createElement('canvas');
    sample.width = 160;
    sample.height = 100;
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('2D canvas sampling unavailable');
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let nonTransparent = 0;
    let nonBlack = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 3) nonTransparent += 1;
      if (pixels[index + 3] > 3 && pixels[index] + pixels[index + 1] + pixels[index + 2] > 12) {
        nonBlack += 1;
      }
    }
    return { nonTransparent, nonBlack, samples: pixels.length / 4 };
  });

  const beforeLossPixels = await sampleCanvas();
  const lossTriggered = await page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    return canvas?.__f1RendererAudit?.loseContext() ?? false;
  });
  if (!lossTriggered) throw new Error('WEBGL_lose_context unavailable on the showroom canvas');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    const snapshot = canvas?.__f1RendererAudit?.snapshot();
    return snapshot && snapshot.contextLosses === 1 && snapshot.directFallbackFrames > 0;
  }, null, { timeout: 5_000 });
  const duringLoss = await page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    return canvas?.__f1RendererAudit?.snapshot();
  });

  const restoreTriggered = await page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    return canvas?.__f1RendererAudit?.restoreContext() ?? false;
  });
  if (!restoreTriggered) throw new Error('showroom context restoration was not triggered');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    const snapshot = canvas?.__f1RendererAudit?.snapshot();
    return snapshot
      && snapshot.contextRestores === 1
      && snapshot.modelSourcePrewarms >= 3
      && snapshot.status !== 'context-lost'
      && snapshot.status !== 'fallback';
  }, null, { timeout: 15_000 });
  await page.waitForTimeout(250);
  const afterRestorePixels = await sampleCanvas();
  const afterRestore = await page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    return canvas?.__f1RendererAudit?.snapshot();
  });

  if (afterRestore.modelSourceMisses !== 0) throw new Error('a model prewarm missed its real mesh draw');
  if (afterRestore.firstPulseProgramDeltas.length < 2) {
    throw new Error('initial and restored first pulses were not both measured');
  }
  if (afterRestore.firstPulseProgramDeltas.some(delta => delta !== 0)) {
    throw new Error(`shader programs compiled on first pulse: ${afterRestore.firstPulseProgramDeltas}`);
  }
  if (afterRestore.unavailableCount !== 0) throw new Error('post-process became unavailable');
  if (beforeLossPixels.nonBlack <= 100 || afterRestorePixels.nonBlack <= 100) {
    throw new Error('pre-loss or restored showroom frame was black/transparent');
  }

  await page.waitForFunction(() => (
    document.querySelector('[aria-label="Interactive Formula One showroom car"]')
      ?.getAttribute('aria-pressed') === 'true'
  ), null, { timeout: 10_000 });
  await showroom.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (
    document.querySelector('[aria-label="Interactive Formula One showroom car"]')
      ?.getAttribute('aria-pressed') === 'false'
  ), null, { timeout: 3_000 });

  return {
    status: 'PASS',
    commitSha: 'record `git rev-parse HEAD` with this returned result',
    component: {
      duringLoss,
      afterRestore,
      beforeLossPixels,
      afterRestorePixels,
      interactionContinuity: 'keyboard reassembly succeeded after real canvas restoration',
    },
  };
}
