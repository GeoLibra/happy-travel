import { expect, test } from 'playwright/test';

import { RaceCountdownPageObject } from '../pages/RaceCountdownPage';
import { ItineraryPage } from '../pages/ItineraryPage';
import { WelcomePage } from '../pages/WelcomePage';

const officialShanghaiFixture = {
  MRData: {
    RaceTable: {
      Races: [{
        season: '2027',
        date: '2027-03-21',
        time: '07:00:00Z',
        Circuit: { circuitId: 'shanghai' },
      }],
    },
  },
};

interface AMapVendorLifecycle {
  events: string[];
  mapCreated: number;
  mapDestroyed: number;
  layerCreated: number;
  layerCleared: number;
  markerCreated: number;
  markerRemoved: number;
  labelMarkerCreated: number;
  labelMarkerRemoved: number;
}

async function installAmapVendorFixture(page: import('playwright/test').Page, preload: boolean) {
  await page.addInitScript(({ shouldPreload }) => {
    const fixtureWindow = window as typeof window & {
      AMap?: unknown;
      __AMAP_VENDOR_LIFECYCLE__?: AMapVendorLifecycle;
      __installAmapVendorSdk?: () => void;
    };
    const lifecycle: AMapVendorLifecycle = {
      events: [],
      mapCreated: 0,
      mapDestroyed: 0,
      layerCreated: 0,
      layerCleared: 0,
      markerCreated: 0,
      markerRemoved: 0,
      labelMarkerCreated: 0,
      labelMarkerRemoved: 0,
    };
    fixtureWindow.__AMAP_VENDOR_LIFECYCLE__ = lifecycle;
    fixtureWindow.__installAmapVendorSdk = () => {
      fixtureWindow.AMap = {
        Map: class {
          private readonly fixtureId: number;

          constructor() {
            this.fixtureId = ++lifecycle.mapCreated;
            lifecycle.events.push(`map:create:${this.fixtureId}`);
          }

          on(_event: string, callback: () => void) { callback(); }
          add() {}
          addControl() {}
          destroy() {
            lifecycle.mapDestroyed += 1;
            lifecycle.events.push(`map:destroy:${this.fixtureId}`);
          }
          setCenter() {}
          setFeatures() {}
          setFitView() {}
        },
        Scale: class {},
        ToolBar: class {},
        LabelsLayer: class {
          private readonly fixtureId: number;

          constructor() {
            this.fixtureId = ++lifecycle.layerCreated;
            lifecycle.events.push(`layer:create:${this.fixtureId}`);
          }

          add() {}
          clear() {
            lifecycle.layerCleared += 1;
            lifecycle.events.push(`layer:clear:${this.fixtureId}`);
          }
        },
        Marker: class {
          private readonly fixtureId: number;

          constructor() {
            this.fixtureId = ++lifecycle.markerCreated;
            lifecycle.events.push(`marker:create:${this.fixtureId}`);
          }

          on() {}
          remove() {
            lifecycle.markerRemoved += 1;
            lifecycle.events.push(`marker:remove:${this.fixtureId}`);
          }
          setContent() {}
          setMap() {}
          setzIndex() {}
        },
        LabelMarker: class {
          private readonly fixtureId: number;

          constructor() {
            this.fixtureId = ++lifecycle.labelMarkerCreated;
            lifecycle.events.push(`label-marker:create:${this.fixtureId}`);
          }

          on() {}
          remove() {
            lifecycle.labelMarkerRemoved += 1;
            lifecycle.events.push(`label-marker:remove:${this.fixtureId}`);
          }
          setText() {}
          setzIndex() {}
        },
        LngLat: class { constructor(_lng: number, _lat: number) {} },
      };
    };

    if (shouldPreload) fixtureWindow.__installAmapVendorSdk();
  }, { shouldPreload: preload });
}

async function readAmapVendorLifecycle(page: import('playwright/test').Page) {
  return page.evaluate<AMapVendorLifecycle>(() => {
    const lifecycle = (window as typeof window & {
      __AMAP_VENDOR_LIFECYCLE__?: AMapVendorLifecycle;
    }).__AMAP_VENDOR_LIFECYCLE__;
    if (!lifecycle) throw new Error('AMap vendor lifecycle fixture was not installed');
    return structuredClone(lifecycle);
  });
}

function raceFixture(date: string, time: string, season = date.slice(0, 4)) {
  return {
    MRData: {
      RaceTable: {
        Races: [{
          season,
          date,
          time,
          Circuit: { circuitId: 'shanghai' },
        }],
      },
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('happy-travel-locale', 'zh'));
});

test('compact itinerary countdown resolves the same future event instead of freezing on 2026 zeroes', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'race-countdown-mobile-chromium',
    'The viewport-independent compact resolver contract is covered after the desktop ignition flow.',
  );
  test.setTimeout(240_000);
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: officialShanghaiFixture })
  ));
  const itinerary = new ItineraryPage(page);

  await itinerary.completeWelcomeIgnition();

  await expect(itinerary.fullCountdownButton).toHaveAttribute('data-compact-countdown-state', 'ready');
  await expect(itinerary.fullCountdownButton).toHaveAttribute('data-compact-countdown-source', 'official');
  await expect(itinerary.fullCountdownButton).toHaveAttribute(
    'data-compact-countdown-target',
    '2027-03-21T07:00:00.000Z',
  );
  await expect(itinerary.fullCountdownButton).not.toHaveAttribute('data-compact-countdown-display', '000000000');
});

test('returns from the itinerary countdown with keyboard and restores state through history', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'race-countdown-mobile-chromium',
    'AMap vendor lifecycle is exercised in the desktop map view; mobile starts in list view.',
  );
  test.setTimeout(480_000);
  const itinerary = new ItineraryPage(page);
  const countdown = new RaceCountdownPageObject(page);
  const mapRenderer = page.locator('[data-amap-renderer-state]');
  const fireworkPortal = page.locator('[data-mini-firework-portal]');

  await installAmapVendorFixture(page, true);
  await itinerary.completeWelcomeIgnition();
  await itinerary.selectDayTab(1);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '1', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '1', { timeout: 60_000 });
  const markerCount = await mapRenderer.getAttribute('data-amap-marker-count');
  expect(Number(markerCount)).toBeGreaterThan(0);
  const expectedMarkerCount = Number(markerCount);
  expect(await readAmapVendorLifecycle(page)).toMatchObject({
    mapCreated: 1,
    mapDestroyed: 0,
    layerCreated: 1,
    layerCleared: 0,
    markerCreated: expectedMarkerCount,
    markerRemoved: 0,
    labelMarkerCreated: expectedMarkerCount,
    labelMarkerRemoved: 0,
  });
  await expect(fireworkPortal).toHaveCount(1);
  await itinerary.fullCountdownButton.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/countdown$/, { timeout: 60_000 });
  await expect(countdown.backButton).toBeFocused({ timeout: 60_000 });
  await expect(itinerary.surface).toHaveAttribute('aria-hidden', 'true', { timeout: 60_000 });
  await expect(itinerary.surface).toHaveCSS('display', 'none', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '0', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '0', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', '0', { timeout: 60_000 });
  await expect(fireworkPortal).toHaveCount(0);
  expect(await readAmapVendorLifecycle(page)).toMatchObject({
    mapCreated: 1,
    mapDestroyed: 1,
    layerCreated: 1,
    layerCleared: 1,
    markerCreated: expectedMarkerCount,
    markerRemoved: expectedMarkerCount,
    labelMarkerCreated: expectedMarkerCount,
    labelMarkerRemoved: expectedMarkerCount,
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended');
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', '0');
  await expect(page.getByRole('main')).toHaveCount(1);

  await countdown.backButton.press('Enter');
  await expect(page).toHaveURL(/\/$/, { timeout: 60_000 });
  await expect(itinerary.daySelector).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('button:has-text("DAY 2") > div')).toBeVisible({ timeout: 60_000 });
  await expect(itinerary.fullCountdownButton).toBeFocused({ timeout: 60_000 });
  await expect(page.locator('[data-f1-welcome-action="enter"]')).toHaveCount(0, { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '1', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '1', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', markerCount ?? '', { timeout: 60_000 });
  await expect(fireworkPortal).toHaveCount(1);
  const recreatedLifecycle = await readAmapVendorLifecycle(page);
  expect(recreatedLifecycle).toMatchObject({
    mapCreated: 2,
    mapDestroyed: 1,
    layerCreated: 2,
    layerCleared: 1,
    markerCreated: expectedMarkerCount * 2,
    markerRemoved: expectedMarkerCount,
    labelMarkerCreated: expectedMarkerCount * 2,
    labelMarkerRemoved: expectedMarkerCount,
  });
  expect(recreatedLifecycle.events.indexOf('map:destroy:1'))
    .toBeLessThan(recreatedLifecycle.events.indexOf('map:create:2'));
  expect(recreatedLifecycle.events.indexOf('layer:clear:1'))
    .toBeLessThan(recreatedLifecycle.events.indexOf('layer:create:2'));
  expect(recreatedLifecycle.events.indexOf(`marker:remove:${expectedMarkerCount}`))
    .toBeLessThan(recreatedLifecycle.events.indexOf(`marker:create:${expectedMarkerCount + 1}`));
  expect(recreatedLifecycle.events.indexOf(`label-marker:remove:${expectedMarkerCount}`))
    .toBeLessThan(recreatedLifecycle.events.indexOf(`label-marker:create:${expectedMarkerCount + 1}`));

  await page.goForward();
  await expect(page).toHaveURL(/\/countdown$/, { timeout: 60_000 });
  await expect(countdown.backButton).toBeFocused({ timeout: 60_000 });
  await expect(itinerary.surface).toHaveAttribute('aria-hidden', 'true', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '0', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '0', { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', '0', { timeout: 60_000 });
  await expect(fireworkPortal).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole('main')).toHaveCount(1, { timeout: 60_000 });
  expect(await readAmapVendorLifecycle(page)).toMatchObject({
    mapCreated: 2,
    mapDestroyed: 2,
    layerCreated: 2,
    layerCleared: 2,
    markerCreated: expectedMarkerCount * 2,
    markerRemoved: expectedMarkerCount * 2,
    labelMarkerCreated: expectedMarkerCount * 2,
    labelMarkerRemoved: expectedMarkerCount * 2,
  });
});

test('does not attach a stale AMap loader result after countdown suspension', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'race-countdown-mobile-chromium',
    'The mobile list view does not request AMap until the user explicitly switches to the map.',
  );
  test.setTimeout(300_000);
  const itinerary = new ItineraryPage(page);
  const countdown = new RaceCountdownPageObject(page);
  const mapRenderer = page.locator('[data-amap-renderer-state]');
  const fixtureAmapKey = 'playwright-deferred-loader-key';
  const amapLoaderErrors: string[] = [];
  let appKeyInjected = false;
  let loaderRequested = false;
  let loaderRequestCount = 0;
  let requestedAmapKey: string | null = null;
  let releaseLoader = () => {};
  const loaderGate = new Promise<void>((resolve) => { releaseLoader = resolve; });

  await installAmapVendorFixture(page, false);
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('AMap Loader Error:')) {
      amapLoaderErrors.push(message.text());
    }
  });
  await page.route('**/src/components/MapComponent.tsx*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const appKeyExpression = 'import.meta.env.VITE_AMAP_KEY';
    if (!source.includes(appKeyExpression)) {
      throw new Error('Unable to inject the AMap fixture key into MapComponent');
    }
    appKeyInjected = true;
    await route.fulfill({
      response,
      body: source.replace(appKeyExpression, JSON.stringify(fixtureAmapKey)),
    });
  });
  await page.route(/https:\/\/webapi\.amap\.com\/maps\?.*/, async (route) => {
    loaderRequested = true;
    loaderRequestCount += 1;
    requestedAmapKey = new URL(route.request().url()).searchParams.get('key');
    await loaderGate;
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.__installAmapVendorSdk(); window.___onAPILoaded?.();',
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const welcome = new WelcomePage(page);
  await welcome.waitUntilReady();
  expect(appKeyInjected).toBe(true);
  await welcome.holdToIgnite();
  await itinerary.waitUntilReady();
  await expect.poll(() => loaderRequested).toBe(true);
  expect(loaderRequestCount).toBe(1);
  expect(requestedAmapKey).toBe(fixtureAmapKey);
  expect(amapLoaderErrors).toEqual([]);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'initializing', { timeout: 60_000 });
  expect(await readAmapVendorLifecycle(page)).toMatchObject({ mapCreated: 0, layerCreated: 0 });

  await itinerary.openFullCountdown();
  await expect(page).toHaveURL(/\/countdown$/, { timeout: 60_000 });
  await expect(countdown.backButton).toBeFocused({ timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended', { timeout: 60_000 });
  releaseLoader();
  await expect.poll(async () => page.evaluate(() => (
    typeof (window as typeof window & { ___onAPILoaded?: unknown }).___onAPILoaded
  ))).toBe('undefined');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(amapLoaderErrors).toEqual([]);
  expect(await readAmapVendorLifecycle(page)).toMatchObject({
    mapCreated: 0,
    mapDestroyed: 0,
    layerCreated: 0,
    layerCleared: 0,
    markerCreated: 0,
    markerRemoved: 0,
    labelMarkerCreated: 0,
    labelMarkerRemoved: 0,
  });
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended', { timeout: 60_000 });

  await countdown.backButton.press('Enter');
  await expect(page).toHaveURL(/\/$/, { timeout: 60_000 });
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready', { timeout: 60_000 });
  expect(await readAmapVendorLifecycle(page)).toMatchObject({
    mapCreated: 1,
    mapDestroyed: 0,
    layerCreated: 1,
    layerCleared: 0,
  });
});

test('shows the Shanghai start time for a future API race', async ({ page }) => {
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: officialShanghaiFixture })
  ));
  const countdown = new RaceCountdownPageObject(page);

  await countdown.goto();

  await expect(page.locator('time[data-time-zone="Asia/Shanghai"]')).toContainText('15:00');
});

test('falls back from a stalled resolution without showing zero countdown digits', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => (
      originalSetTimeout(handler, timeout === 8_000 ? 50 : timeout, ...args)
    )) as typeof window.setTimeout;
  });
  let releaseRoute = () => {};
  const routeGate = new Promise<void>((resolve) => { releaseRoute = resolve; });
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', async (route) => {
    await routeGate;
    await route.fulfill({ json: officialShanghaiFixture });
  });
  const countdown = new RaceCountdownPageObject(page);

  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready');
  await expect(countdown.product).not.toHaveAttribute('data-countdown-display', '000000000');
  releaseRoute();
});

test('keeps the resolved countdown and back control usable when WebGL is unavailable', async ({ page }) => {
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: officialShanghaiFixture })
  ));
  const countdown = new RaceCountdownPageObject(page);
  await countdown.disableWebGL();

  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'webgl-fallback');
  await expect(countdown.domFallback).toBeVisible();
  await expect(countdown.domFallback.locator('[data-countdown-unit]')).toHaveCount(4);
  await expect(countdown.backButton).toBeVisible();
  await countdown.backButton.click();
  await expect(page).toHaveURL(/\/$/);
});

test('updates the polite announcement at minute boundaries instead of every second', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-08-15T00:00:00Z') });
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: raceFixture('2026-08-15', '00:02:30Z') })
  ));
  const countdown = new RaceCountdownPageObject(page);

  await countdown.goto();
  await expect(countdown.liveStatus).not.toBeEmpty();
  const initialAnnouncement = await countdown.liveStatus.textContent();

  await page.clock.fastForward(1_000);
  await expect(countdown.liveStatus).toHaveText(initialAnnouncement ?? '');

  await page.clock.fastForward(60_000);
  await expect(countdown.liveStatus).not.toHaveText(initialAnnouncement ?? '');
});

test('shows LIGHTS OUT and resolves the next event instead of freezing at zero', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-08-15T00:00:00Z') });
  let currentYearRequests = 0;
  let releaseNextResolution = () => {};
  const nextResolutionGate = new Promise<void>((resolve) => { releaseNextResolution = resolve; });
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', async (route) => {
    if (!route.request().url().includes('/2026/')) {
      await route.fulfill({ json: { MRData: { RaceTable: { Races: [] } } } });
      return;
    }

    currentYearRequests += 1;
    if (currentYearRequests === 1) {
      await route.fulfill({ json: raceFixture('2026-08-15', '00:00:30Z') });
      return;
    }

    await nextResolutionGate;
    await route.fulfill({ json: raceFixture('2026-08-15', '01:00:00Z') });
  });
  const countdown = new RaceCountdownPageObject(page);
  await countdown.disableWebGL();

  await countdown.goto();
  await expect(page.locator('time[data-time-zone="Asia/Shanghai"]')).toContainText('08:00');
  await page.clock.fastForward(31_000);

  await expect(countdown.lightsOut).toBeVisible();
  await expect.poll(() => currentYearRequests).toBe(2);
  releaseNextResolution();
  await expect(countdown.lightsOut).toBeHidden();
  await expect(countdown.product).not.toHaveAttribute('data-countdown-display', '000000000');
});
