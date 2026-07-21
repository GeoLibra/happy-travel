async page => {
  const outputRoot = '/Users/hgis/myproject/happy-travel/.worktrees/f1-post-hologram-glitch/output/playwright/task-4-verified';
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const loading = page.getByText('RACE PREP IN PROGRESS');
  await loading.waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
  const startButton = page.locator('[data-f1-welcome-action="enter"]');
  await startButton.waitFor({ state: 'visible', timeout: 45000 });
  const cdp = await page.context().newCDPSession(page);

  await page.screencast.start({
    path: `${outputRoot}/mobile-arrival-touch.webm`,
    size: { width: 390, height: 844 },
  });
  const videoStart = await page.evaluate(() => performance.now());
  const startBox = await startButton.boundingBox();
  if (!startBox) throw new Error('Mobile start button has no bounding box');
  const startPoint = {
    x: startBox.x + startBox.width / 2,
    y: startBox.y + startBox.height / 2,
  };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startPoint.x, y: startPoint.y, radiusX: 2, radiusY: 2, force: 1, id: 7 }],
  });
  await page.waitForFunction(() => {
    const progressFill = document.querySelector('[data-f1-welcome-action="enter"] > div');
    return progressFill instanceof HTMLElement && Number.parseFloat(progressFill.style.width) >= 35;
  }, null, { timeout: 5000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent || '';
    return text.includes('ENTER') && !text.includes('STARTING');
  }, null, { timeout: 10000 });
  const progressComplete = await page.evaluate(() => performance.now());

  const carControl = page.getByRole('button', { name: 'Interactive Formula One showroom car' });
  await page.waitForFunction(() => document.querySelector('[aria-label="Interactive Formula One showroom car"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 12000 });
  await page.waitForTimeout(1400);
  const beforeRayTouch = await carControl.getAttribute('aria-pressed');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 300, y: 525, radiusX: 2, radiusY: 2, force: 1, id: 8 }],
  });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => document.querySelector('[aria-label="Interactive Formula One showroom car"]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 3000 });
  const reassemblyStarted = await page.evaluate(() => performance.now());
  await page.waitForTimeout(2400);
  const afterRayTouch = await carControl.getAttribute('aria-pressed');
  await page.screencast.stop();

  return {
    viewport: page.viewportSize(),
    captureStartedUtc: new Date().toISOString(),
    videoStartPerformanceMs: videoStart,
    progressCompletePerformanceMs: progressComplete,
    progressCompleteVideoOffsetMs: progressComplete - videoStart,
    reassemblyStartedVideoOffsetMs: reassemblyStarted - videoStart,
    startInput: { type: 'trusted CDP touchStart released at 35%; app auto-completed to 100%', startPoint },
    touchEnvironment: await page.evaluate(() => ({
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
    })),
    rayOwnership: { beforeRayTouch, afterRayTouch, point: { x: 300, y: 525 } },
    reducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
}
