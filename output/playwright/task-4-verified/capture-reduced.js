async page => {
  const outputRoot = '/Users/hgis/myproject/happy-travel/.worktrees/f1-post-hologram-glitch/output/playwright/task-4-verified';
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const loading = page.getByText('RACE PREP IN PROGRESS');
  await loading.waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
  const startButton = page.locator('[data-f1-welcome-action="enter"]');
  await startButton.waitFor({ state: 'visible', timeout: 45000 });
  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!reducedMotion) throw new Error('Reduced-motion media emulation was not active before app initialization');

  await page.screencast.start({
    path: `${outputRoot}/desktop-reduced-motion-glitch.webm`,
    size: { width: 1440, height: 900 },
  });
  const videoStart = await page.evaluate(() => performance.now());
  const startBox = await startButton.boundingBox();
  if (!startBox) throw new Error('Reduced-motion start button has no bounding box');
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
  await page.waitForTimeout(6700);
  await page.screencast.stop();

  return {
    viewport: page.viewportSize(),
    captureStartedUtc: new Date().toISOString(),
    videoStartPerformanceMs: videoStart,
    progressCompletePerformanceMs: progressComplete,
    progressCompleteVideoOffsetMs: progressComplete - videoStart,
    glitchIntervalVideoOffsetsMs: {
      start: progressComplete - videoStart + 4600,
      end: progressComplete - videoStart + 6400,
    },
    startInput: { type: 'trusted mouse', startPoint },
    reducedMotion,
  };
}
