async page => {
  const outputRoot = '/Users/hgis/myproject/happy-travel/.worktrees/f1-post-hologram-glitch/output/playwright/task-4-verified';
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const loading = page.getByText('RACE PREP IN PROGRESS');
  await loading.waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
  const startButton = page.locator('[data-f1-welcome-action="enter"]');
  await startButton.waitFor({ state: 'visible', timeout: 45000 });

  await page.screencast.start({
    path: `${outputRoot}/desktop-arrival.webm`,
    size: { width: 1440, height: 900 },
  });
  const videoStart = await page.evaluate(() => performance.now());
  const startBox = await startButton.boundingBox();
  if (!startBox) throw new Error('Desktop start button has no bounding box');
  const startPoint = {
    x: startBox.x + startBox.width / 2,
    y: startBox.y + startBox.height / 2,
  };
  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent || '';
    return text.includes('ENTER') && !text.includes('STARTING');
  }, null, { timeout: 10000 });
  const progressComplete = await page.evaluate(() => performance.now());
  await page.mouse.move(8, 8);
  await page.mouse.up();

  const carControl = page.getByRole('button', { name: 'Interactive Formula One showroom car' });
  await page.waitForTimeout(7900);
  const beforeRayClick = await carControl.getAttribute('aria-pressed');
  await page.mouse.click(600, 470);
  await page.waitForFunction(() => document.querySelector('[aria-label="Interactive Formula One showroom car"]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 3000 });
  const reassemblyStarted = await page.evaluate(() => performance.now());
  await page.waitForTimeout(2400);
  const afterRayClick = await carControl.getAttribute('aria-pressed');

  const forwardingProbe = await page.evaluate(() => {
    const button = document.querySelector('[data-f1-welcome-action="enter"]');
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    if (!(button instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) return null;
    window.__task4Forwarding = { canvasPointerUps: [], buttonClicks: [] };
    canvas.addEventListener('pointerup', (event) => window.__task4Forwarding.canvasPointerUps.push({
      isTrusted: event.isTrusted,
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    }), { capture: true });
    button.addEventListener('click', (event) => window.__task4Forwarding.buttonClicks.push({
      isTrusted: event.isTrusted,
    }), { capture: true });
    const rect = button.getBoundingClientRect();
    return {
      buttonRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      canvasZIndex: getComputedStyle(canvas.parentElement).zIndex,
      buttonZIndex: getComputedStyle(button).zIndex,
    };
  });
  if (!forwardingProbe) throw new Error('Could not install forwarding probe');
  const probePoint = {
    x: forwardingProbe.buttonRect.x + 8,
    y: forwardingProbe.buttonRect.y + forwardingProbe.buttonRect.height / 2,
  };
  await page.mouse.click(probePoint.x, probePoint.y);
  await page.waitForTimeout(250);
  const forwardingEvents = await page.evaluate(() => window.__task4Forwarding);
  const transitioning = (await startButton.textContent())?.includes('REASSEMBLING') || false;
  await page.waitForTimeout(500);
  await page.screencast.stop();

  return {
    viewport: page.viewportSize(),
    captureStartedUtc: new Date().toISOString(),
    videoStartPerformanceMs: videoStart,
    progressCompletePerformanceMs: progressComplete,
    progressCompleteVideoOffsetMs: progressComplete - videoStart,
    reassemblyStartedVideoOffsetMs: reassemblyStarted - videoStart,
    startInput: { type: 'trusted mouse', startPoint },
    rayOwnership: { beforeRayClick, afterRayClick, point: { x: 600, y: 470 } },
    forwarding: { probePoint, forwardingProbe, forwardingEvents, transitioning },
    reducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
}
