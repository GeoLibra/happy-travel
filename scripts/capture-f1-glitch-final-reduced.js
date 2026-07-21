async page => {
  const outputRoot = '/Users/hgis/myproject/happy-travel/.worktrees/f1-post-hologram-glitch/output/playwright/final-fixes';
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('RACE PREP IN PROGRESS').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
  const startButton = page.locator('[data-f1-welcome-action="enter"]');
  await startButton.waitFor({ state: 'visible', timeout: 45000 });
  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!reducedMotion) throw new Error('reduced-motion emulation was not active before initialization');
  await page.screencast.start({
    path: `${outputRoot}/reduced-arrival-final.webm`,
    size: { width: 1440, height: 900 },
  });
  const videoStart = await page.evaluate(() => performance.now());
  const startBox = await startButton.boundingBox();
  if (!startBox) throw new Error('reduced-motion start button has no bounding box');
  const startPoint = { x: startBox.x + startBox.width / 2, y: startBox.y + startBox.height / 2 };
  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent || '';
    const progress = Number(text.match(/ENGINE STARTING (\d+)%/)?.[1] || 0);
    return progress >= 35 && progress < 100;
  }, null, { timeout: 12000 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-f1-welcome-action="enter"]')?.textContent || '';
    return text.includes('ENTER') && !text.includes('STARTING');
  }, null, { timeout: 10000 });
  const progressComplete = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => (
    document.querySelector('[aria-label="Interactive Formula One showroom car"]')?.getAttribute('aria-pressed') === 'true'
  ), null, { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.screencast.stop();
  return {
    status: 'PASS',
    artifact: 'reduced-arrival-final.webm',
    viewport: page.viewportSize(),
    capturedAt: new Date().toISOString(),
    videoStartPerformanceMs: videoStart,
    progressCompleteVideoOffsetMs: progressComplete - videoStart,
    phaseOffsetsMs: {
      hologramComplete: progressComplete - videoStart + 4500,
      glitchStart: progressComplete - videoStart + 4600,
      glitchEnd: progressComplete - videoStart + 6400,
      explodeEligible: progressComplete - videoStart + 6434,
    },
    startInput: { type: 'trusted mouse hold released at 35%', point: startPoint },
    reducedMotion,
  };
}
