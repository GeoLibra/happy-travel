// Focused Playwright CLI probe. Run against a local Vite server with:
// playwright-cli run-code "$(cat scripts/run-f1-glitch-webgl-probe.mjs)"
async page => {
  const canvasSelector = '[aria-label="Interactive Formula One showroom car"] canvas';
  const restoreBeforeSequenceScreenshotPath =
    'output/playwright/f1-glitch-probe-restore-before-sequence.png';
  const lossDuringActivePulseScreenshotPath =
    'output/playwright/f1-glitch-probe-active-loss-restored.png';

  const openMountedShowroom = async () => {
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
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector(selector);
      return canvas?.__f1RendererAudit?.snapshot().modelSourcePrewarms >= 1;
    }, canvasSelector, { timeout: 45_000 });
    return { showroom, startButton };
  };

  const readAudit = () => page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    const snapshot = canvas?.__f1RendererAudit?.snapshot();
    if (!snapshot) throw new Error('real showroom renderer audit unavailable');
    return snapshot;
  }, canvasSelector);

  const startSequence = async ({ showroom, startButton }) => {
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
  };

  const loseContext = async () => {
    const triggered = await page.evaluate((selector) => {
      const canvas = document.querySelector(selector);
      return canvas?.__f1RendererAudit?.loseContext() ?? false;
    }, canvasSelector);
    if (!triggered) throw new Error('WEBGL_lose_context unavailable on the showroom canvas');
  };

  const loseContextOnNextActivePulse = async (previousActivePulseFrames) => {
    await page.waitForFunction(({ selector, previousFrames }) => {
      const canvas = document.querySelector(selector);
      return (canvas?.__f1RendererAudit?.snapshot().activePulseFrames ?? 0) > previousFrames;
    }, { selector: canvasSelector, previousFrames: previousActivePulseFrames }, {
      timeout: 15_000,
    });
    const triggered = await page.evaluate((selector) => {
      const canvas = document.querySelector(selector);
      return canvas?.__f1RendererAudit?.loseContext() ?? false;
    }, canvasSelector);
    if (!triggered) throw new Error('WEBGL_lose_context unavailable during active pulse');
  };

  const restoreContext = async (modelSourcePrewarmsBeforeLoss) => {
    // Let the synthetic loss event unwind before asking the extension to restore.
    await page.waitForTimeout(50);
    const triggered = await page.evaluate((selector) => {
      const canvas = document.querySelector(selector);
      return canvas?.__f1RendererAudit?.restoreContext() ?? false;
    }, canvasSelector);
    if (!triggered) throw new Error('showroom context restoration was not triggered');
    await page.waitForFunction(({ selector, previousPrewarms }) => {
      const canvas = document.querySelector(selector);
      const snapshot = canvas?.__f1RendererAudit?.snapshot();
      return snapshot
        && snapshot.contextRestores === 1
        && snapshot.modelSourcePrewarms > previousPrewarms
        && snapshot.status !== 'context-lost'
        && snapshot.status !== 'fallback';
    }, { selector: canvasSelector, previousPrewarms: modelSourcePrewarmsBeforeLoss }, {
      timeout: 15_000,
    });
  };

  const runRestoreBeforeSequenceScenario = async () => {
    const controls = await openMountedShowroom();
    const beforeLoss = await readAudit();
    await loseContext();
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector(selector);
      return canvas?.__f1RendererAudit?.snapshot().contextLosses === 1;
    }, canvasSelector, { timeout: 5_000 });
    await restoreContext(beforeLoss.modelSourcePrewarms);
    const afterRestore = await readAudit();

    await startSequence(controls);
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector(selector);
      const snapshot = canvas?.__f1RendererAudit?.snapshot();
      return snapshot
        && snapshot.activePulseFrames > 0
        && snapshot.firstPulseProgramDeltas.length > 0;
    }, canvasSelector, { timeout: 12_000 });
    const afterFirstPulse = await readAudit();
    await page.screenshot({
      path: restoreBeforeSequenceScreenshotPath,
      fullPage: true,
    });

    if (afterFirstPulse.modelSourceMisses !== 0) {
      throw new Error('a restored model prewarm missed its real mesh draw');
    }
    if (afterFirstPulse.firstPulseProgramDeltas[0] !== 0) {
      throw new Error(`shader programs compiled on restored first pulse: ${afterFirstPulse.firstPulseProgramDeltas}`);
    }
    if (afterFirstPulse.unavailableCount !== 0) {
      throw new Error('restored-before-sequence post-process became unavailable');
    }

    return { beforeLoss, afterRestore, afterFirstPulse, restoreBeforeSequenceScreenshotPath };
  };

  const runLossDuringActivePulseScenario = async () => {
    const controls = await openMountedShowroom();
    await startSequence(controls);
    const beforeLoss = await readAudit();
    await loseContextOnNextActivePulse(beforeLoss.activePulseFrames);
    await page.waitForFunction(({ selector, previousFallbackFrames }) => {
      const canvas = document.querySelector(selector);
      const snapshot = canvas?.__f1RendererAudit?.snapshot();
      return snapshot
        && snapshot.contextLosses === 1
        && snapshot.directFallbackFrames > previousFallbackFrames;
    }, {
      selector: canvasSelector,
      previousFallbackFrames: beforeLoss.directFallbackFrames,
    }, { timeout: 5_000 });
    const duringLoss = await readAudit();

    await restoreContext(duringLoss.modelSourcePrewarms);
    await page.waitForTimeout(250);
    const afterRestore = await readAudit();
    await page.screenshot({
      path: lossDuringActivePulseScreenshotPath,
      fullPage: true,
    });

    if (duringLoss.directFallbackFrames <= beforeLoss.directFallbackFrames) {
      throw new Error('active-pulse context loss did not enter direct-render fallback');
    }
    if (afterRestore.modelSourceMisses !== 0) {
      throw new Error('active-pulse restoration missed its real model source draw');
    }

    await page.waitForFunction(() => (
      document.querySelector('[aria-label="Interactive Formula One showroom car"]')
        ?.getAttribute('aria-pressed') === 'true'
    ), null, { timeout: 12_000 });
    await controls.showroom.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (
      document.querySelector('[aria-label="Interactive Formula One showroom car"]')
        ?.getAttribute('aria-pressed') === 'false'
    ), null, { timeout: 3_000 });

    return {
      beforeLoss,
      duringLoss,
      afterRestore,
      lossDuringActivePulseScreenshotPath,
      interactionContinuity: 'keyboard reassembly succeeded after active-pulse restoration',
    };
  };

  const restoreBeforeSequence = await runRestoreBeforeSequenceScenario();
  const lossDuringActivePulse = await runLossDuringActivePulseScenario();

  return {
    status: 'PASS',
    commitSha: 'record `git rev-parse HEAD` with this returned result',
    component: {
      restoreBeforeSequence,
      lossDuringActivePulse,
    },
  };
}
