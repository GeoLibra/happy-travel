async page => {
  const outputRoot = '/Users/hgis/myproject/happy-travel/.worktrees/f1-post-hologram-glitch/output/playwright/final-fixes';
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('RACE PREP IN PROGRESS').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
  const startButton = page.locator('[data-f1-welcome-action="enter"]');
  await startButton.waitFor({ state: 'visible', timeout: 45000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await page.screencast.start({
    path: `${outputRoot}/mobile-arrival-final.webm`,
    size: { width: 390, height: 844 },
  });
  const videoStart = await page.evaluate(() => performance.now());
  const startBox = await startButton.boundingBox();
  if (!startBox) throw new Error('mobile start button has no bounding box');
  const startPoint = { x: startBox.x + startBox.width / 2, y: startBox.y + startBox.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...startPoint, radiusX: 2, radiusY: 2, force: 1, id: 7 }],
  });
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent || '';
    const progress = Number(text.match(/ENGINE STARTING (\d+)%/)?.[1] || 0);
    return progress >= 35 && progress < 100;
  }, null, { timeout: 5000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent || '';
    return text.includes('ENTER') && !text.includes('STARTING');
  }, null, { timeout: 10000 });
  const progressComplete = await page.evaluate(() => performance.now());
  const car = page.getByRole('button', { name: 'Interactive Formula One showroom car' });
  await page.waitForFunction(() => (
    document.querySelector('[aria-label="Interactive Formula One showroom car"]')?.getAttribute('aria-pressed') === 'true'
  ), null, { timeout: 25000 });
  await page.waitForTimeout(1400);
  const beforeReassembly = await car.getAttribute('aria-pressed');
  const rayPoint = { x: 120, y: 450 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...rayPoint, radiusX: 2, radiusY: 2, force: 1, id: 8 }],
  });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => (
    document.querySelector('[aria-label="Interactive Formula One showroom car"]')?.getAttribute('aria-pressed') === 'false'
  ), null, { timeout: 3000 });
  const reassemblyStarted = await page.evaluate(() => performance.now());
  await page.waitForTimeout(2400);
  const afterReassembly = await car.getAttribute('aria-pressed');
  await page.screencast.stop();
  return {
    status: beforeReassembly === 'true' && afterReassembly === 'false' ? 'PASS' : 'FAIL',
    artifact: 'mobile-arrival-final.webm',
    viewport: page.viewportSize(),
    capturedAt: new Date().toISOString(),
    videoStartPerformanceMs: videoStart,
    progressCompleteVideoOffsetMs: progressComplete - videoStart,
    phaseOffsetsMs: {
      hologramComplete: progressComplete - videoStart + 4500,
      glitchStart: progressComplete - videoStart + 4600,
      glitchEnd: progressComplete - videoStart + 6400,
      explodeEligible: progressComplete - videoStart + 6434,
      reassemblyStarted: reassemblyStarted - videoStart,
    },
    startInput: { type: 'trusted CDP touch released at 35%', point: startPoint },
    rayReassembly: { type: 'trusted CDP touch', point: rayPoint, beforeReassembly, afterReassembly },
    environment: await page.evaluate(() => ({
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    })),
  };
}
