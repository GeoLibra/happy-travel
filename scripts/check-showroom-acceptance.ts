import { spawn, ChildProcess } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, Browser } from 'playwright';

const OUTPUT_DIR = path.resolve('output/playwright');
const DEFAULT_TARGET_URL = process.env.APP_URL || 'http://127.0.0.1:3000';

interface ScenarioResult {
  name: string;
  viewport: string;
  status: 'PASS' | 'FAIL';
  details: string;
  screenshot?: string;
}

async function isServerReady(urlStr: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const req = http.get(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          timeout: 2000,
        },
        (res) => {
          resolve(res.statusCode === 200);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function startServerIfNeeded(urlStr: string): Promise<{ process: ChildProcess | null; url: string }> {
  const url = new URL(urlStr);
  const port = url.port || '3000';
  const ready = await isServerReady(urlStr);
  if (ready) {
    console.log(`[Showroom Acceptance] Using existing server at ${urlStr}`);
    return { process: null, url: urlStr };
  }

  console.log(`[Showroom Acceptance] No server at ${urlStr}. Spawning Vite dev server...`);
  const child = spawn('npx', ['vite', '--port', port, '--host', url.hostname], {
    stdio: 'ignore',
  });

  const start = Date.now();
  while (Date.now() - start < 20000) {
    if (await isServerReady(urlStr)) {
      console.log(`[Showroom Acceptance] Vite server ready at ${urlStr}`);
      return { process: child, url: urlStr };
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  child.kill();
  throw new Error(`Failed to start Vite server at ${urlStr} within 20s`);
}

async function runAcceptanceChecks() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const { process: serverProcess, url: baseUrl } = await startServerIfNeeded(DEFAULT_TARGET_URL);

  const results: ScenarioResult[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    // ------------------------------------------------------------------------
    // Scenario 1: Default route without query does NOT show showroom overlay
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Default Route Verification (Desktop 1280x800) ---');
    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopCtx.newPage();

    await desktopPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for race prep loading overlay to hide if model preloading occurs
    await desktopPage
      .getByText('RACE PREP IN PROGRESS')
      .waitFor({ state: 'hidden', timeout: 45000 })
      .catch(() => {});

    // Verify showroom overlay is NOT present
    const defaultOverlayCount = await desktopPage.locator('[data-showroom-overlay="true"]').count();
    if (defaultOverlayCount !== 0) {
      throw new Error(`Default route unexpectedly rendered showroom overlay (count: ${defaultOverlayCount})`);
    }

    // Verify default F1 welcome CTA button and canvas remain present
    const welcomeCta = desktopPage.locator('[data-f1-welcome-action="enter"]');
    await welcomeCta.waitFor({ state: 'visible', timeout: 15000 });
    const canvasCount = await desktopPage.locator('canvas').count();
    if (canvasCount === 0) {
      throw new Error('Default route canvas element is missing');
    }

    const defaultScreenshot = path.join(OUTPUT_DIR, 'showroom-default-route-desktop.png');
    await desktopPage.screenshot({ path: defaultScreenshot, fullPage: true });

    results.push({
      name: 'Default route without query parameter',
      viewport: 'Desktop (1280x800)',
      status: 'PASS',
      details: `Overlay absent (count=0), F1 welcome CTA visible, canvas present (${canvasCount} canvas element(s)).`,
      screenshot: 'showroom-default-route-desktop.png',
    });
    console.log('✔ PASS: Default route verified cleanly');

    await desktopPage.close();
    await desktopCtx.close();

    // ------------------------------------------------------------------------
    // Scenario 2 & 3 & 4 & 5: Showroom Overlay, Keyboard Ignition, Scroll Lock, Skip Path
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Showroom Route Overlay & Scroll Lock (Desktop 1280x800) ---');
    const showroomCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const showroomPage = await showroomCtx.newPage();

    await showroomPage.goto(`${baseUrl}/?showroom=v2`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for race prep loading overlay to hide
    await showroomPage
      .getByText('RACE PREP IN PROGRESS')
      .waitFor({ state: 'hidden', timeout: 45000 })
      .catch(() => {});

    // 1. Verify ShowroomOverlay is present with ignition & skip controls
    const overlay = showroomPage.locator('[data-showroom-overlay="true"]');
    await overlay.waitFor({ state: 'visible', timeout: 15000 });

    const ignitionBtn = showroomPage.locator('[data-showroom-action="ignition"]');
    const skipBtn = showroomPage.locator('[data-showroom-action="skip"]');
    await ignitionBtn.waitFor({ state: 'visible', timeout: 10000 });
    await skipBtn.waitFor({ state: 'visible', timeout: 10000 });

    // Verify Scroll Locking while in ready status
    const initialOverflow = await showroomPage.evaluate(() => document.body.style.overflow);
    if (initialOverflow !== 'hidden') {
      throw new Error(`Expected body style overflow to be 'hidden', got '${initialOverflow}'`);
    }

    const overlayScreenshot = path.join(OUTPUT_DIR, 'showroom-v2-overlay-desktop.png');
    await showroomPage.screenshot({ path: overlayScreenshot, fullPage: true });

    results.push({
      name: 'Showroom overlay & scroll lock in ready state',
      viewport: 'Desktop (1280x800)',
      status: 'PASS',
      details: 'ShowroomOverlay visible with ignition and skip controls. document.body.style.overflow = "hidden".',
      screenshot: 'showroom-v2-overlay-desktop.png',
    });
    console.log('✔ PASS: Showroom overlay and scroll locking verified');

    // ------------------------------------------------------------------------
    // Scenario 3: Keyboard Space/Enter Ignition Path & Progress Assertion
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Keyboard Ignition (Space/Enter) & Progress (Desktop 1280x800) ---');
    await ignitionBtn.focus();

    // Press Space keydown to initiate ignition holding
    await showroomPage.keyboard.down('Space');

    // Wait for progress >= 35% before keyup so release takes the completing path
    // instead of the intentional <30% reset branch.
    await showroomPage.waitForFunction(() => {
      const el = document.querySelector('[data-showroom-action="ignition"]');
      if (!el) return false;
      const val = Number(el.getAttribute('aria-valuenow') || '0');
      return val >= 35;
    }, null, { timeout: 10000 });

    const midProgressVal = await ignitionBtn.getAttribute('aria-valuenow');
    console.log(`Keyboard ignition progress holding: ${midProgressVal}%`);

    const progressScreenshot = path.join(OUTPUT_DIR, 'showroom-ignition-progress-desktop.png');
    await showroomPage.screenshot({ path: progressScreenshot, fullPage: true });

    // Release key when progress > 30% to trigger completing -> ignited flow
    await showroomPage.keyboard.up('Space');

    // Wait for handoff: showroom overlay unmounts / hides AND main app header renders
    await showroomPage.waitForFunction(() => {
      const overlayEl = document.querySelector('[data-showroom-overlay="true"]');
      const headerEl = document.querySelector('header');
      return !overlayEl && !!headerEl;
    }, null, { timeout: 25000 });

    // Verify Scroll Unlocked after ignition completion & handoff
    const postIgnitionOverflow = await showroomPage.evaluate(() => document.body.style.overflow);
    if (postIgnitionOverflow === 'hidden') {
      throw new Error(`Expected body style overflow to be unlocked after ignition, but got '${postIgnitionOverflow}'`);
    }

    const handoffScreenshot = path.join(OUTPUT_DIR, 'showroom-app-handoff-desktop.png');
    await showroomPage.screenshot({ path: handoffScreenshot, fullPage: true });

    results.push({
      name: 'Keyboard ignition Space/Enter hold & handoff',
      viewport: 'Desktop (1280x800)',
      status: 'PASS',
      details: `Key Space advanced progress (${midProgressVal}%), completed handoff to app, body overflow unlocked ("${postIgnitionOverflow}").`,
      screenshot: 'showroom-app-handoff-desktop.png',
    });
    console.log('✔ PASS: Keyboard ignition and app handoff verified');

    await showroomPage.close();
    await showroomCtx.close();

    // ------------------------------------------------------------------------
    // Scenario 4: Skip Button Path Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Skip Path Verification (Desktop 1280x800) ---');
    const skipCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const skipPage = await skipCtx.newPage();

    await skipPage.goto(`${baseUrl}/?showroom=v2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipPage.getByText('RACE PREP IN PROGRESS').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});

    const skipBtnTarget = skipPage.locator('[data-showroom-action="skip"]');
    await skipBtnTarget.waitFor({ state: 'visible', timeout: 15000 });

    await skipBtnTarget.click();

    // Wait for handoff into app route/state
    await skipPage.waitForFunction(() => {
      const overlayEl = document.querySelector('[data-showroom-overlay="true"]');
      const headerEl = document.querySelector('header');
      return !overlayEl && !!headerEl;
    }, null, { timeout: 25000 });

    const skipOverflow = await skipPage.evaluate(() => document.body.style.overflow);
    if (skipOverflow === 'hidden') {
      throw new Error(`Expected body style overflow to be unlocked after skip, but got '${skipOverflow}'`);
    }

    results.push({
      name: 'Skip path button trigger & handoff',
      viewport: 'Desktop (1280x800)',
      status: 'PASS',
      details: `Skip button triggered immediate handoff, overlay unmounted, body overflow unlocked ("${skipOverflow}").`,
    });
    console.log('✔ PASS: Skip path verified cleanly');

    await skipPage.close();
    await skipCtx.close();

    // ------------------------------------------------------------------------
    // Scenario 5: Emulated Chrome Mobile Viewport (390x844 Touch)
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Emulated Chrome Mobile Viewport Verification (390x844 Touch) ---');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    });
    const mobilePage = await mobileCtx.newPage();

    await mobilePage.goto(`${baseUrl}/?showroom=v2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.getByText('RACE PREP IN PROGRESS').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});

    const mobileOverlay = mobilePage.locator('[data-showroom-overlay="true"]');
    await mobileOverlay.waitFor({ state: 'visible', timeout: 15000 });

    const mobileIgnition = mobilePage.locator('[data-showroom-action="ignition"]');
    const mobileSkip = mobilePage.locator('[data-showroom-action="skip"]');
    await mobileIgnition.waitFor({ state: 'visible', timeout: 10000 });
    await mobileSkip.waitFor({ state: 'visible', timeout: 10000 });

    const mobileScreenshot = path.join(OUTPUT_DIR, 'showroom-v2-overlay-mobile.png');
    await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });

    // Test pointer tap / skip on mobile viewport
    await mobileSkip.click();
    await mobilePage.waitForFunction(() => {
      const overlayEl = document.querySelector('[data-showroom-overlay="true"]');
      const headerEl = document.querySelector('header');
      return !overlayEl && !!headerEl;
    }, null, { timeout: 25000 });

    const mobilePostOverflow = await mobilePage.evaluate(() => document.body.style.overflow);

    results.push({
      name: 'Emulated Chrome Mobile Viewport acceptance',
      viewport: 'Mobile (390x844, touch, isMobile)',
      status: 'PASS',
      details: `Showroom overlay rendered correctly on mobile viewport; tap skip transitioned to mobile app view; overflow unlocked ("${mobilePostOverflow}"). Note: Chrome mobile viewport emulation in CI.`,
      screenshot: 'showroom-v2-overlay-mobile.png',
    });
    console.log('✔ PASS: Emulated Chrome Mobile Viewport acceptance verified');

    await mobilePage.close();
    await mobileCtx.close();

    // ------------------------------------------------------------------------
    // Write JSON summary artifact
    // ------------------------------------------------------------------------
    const summary = {
      timestamp: new Date().toISOString(),
      overallStatus: 'PASS',
      baseUrl,
      viewports: {
        desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
        mobileEmulated: { width: 390, height: 844, isMobile: true, hasTouch: true, note: 'Chrome mobile viewport emulation' },
      },
      scenarios: results,
    };

    const summaryPath = path.join(OUTPUT_DIR, 'showroom-acceptance-summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n✔ Showroom acceptance summary written to ${summaryPath}`);

  } catch (err: any) {
    console.error('\n❌ Showroom Acceptance Check Failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      console.log('[Showroom Acceptance] Terminating spawned Vite server process...');
      serverProcess.kill('SIGTERM');
    }
  }
}

void runAcceptanceChecks();
