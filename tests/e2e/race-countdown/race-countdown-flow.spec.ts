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

test('returns from the itinerary countdown with keyboard and restores state through history', async ({ page }) => {
  test.setTimeout(180_000);
  const itinerary = new ItineraryPage(page);
  const countdown = new RaceCountdownPageObject(page);
  const mapRenderer = page.locator('[data-amap-renderer-state]');
  const fireworkPortal = page.locator('[data-mini-firework-portal]');

  await installAmapVendorFixture(page, true);
  await itinerary.completeWelcomeIgnition();
  await itinerary.selectDayTab(1);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready');
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '1');
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '1');
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
  await expect(page).toHaveURL(/\/countdown$/);
  await expect(countdown.backButton).toBeFocused();
  await expect(itinerary.surface).toHaveAttribute('aria-hidden', 'true');
  await expect(itinerary.surface).toHaveCSS('display', 'none');
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended');
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '0');
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '0');
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', '0');
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
  await expect(page).toHaveURL(/\/$/);
  await expect(itinerary.daySelector).toBeVisible();
  await expect(page.locator('button:has-text("DAY 2") > div')).toBeVisible();
  await expect(itinerary.fullCountdownButton).toBeFocused();
  await expect(page.locator('[data-f1-welcome-action="enter"]')).toHaveCount(0);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready');
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '1');
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '1');
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', markerCount ?? '');
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
  await expect(page).toHaveURL(/\/countdown$/);
  await expect(countdown.backButton).toBeFocused();
  await expect(itinerary.surface).toHaveAttribute('aria-hidden', 'true');
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended');
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '0');
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '0');
  await expect(mapRenderer).toHaveAttribute('data-amap-marker-count', '0');
  await expect(fireworkPortal).toHaveCount(0);
  await expect(page.getByRole('main')).toHaveCount(1);
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

test('does not attach a stale AMap loader result after countdown suspension', async ({ page }) => {
  test.setTimeout(180_000);
  const itinerary = new ItineraryPage(page);
  const countdown = new RaceCountdownPageObject(page);
  const mapRenderer = page.locator('[data-amap-renderer-state]');
  let loaderRequested = false;
  let releaseLoader = () => {};
  const loaderGate = new Promise<void>((resolve) => { releaseLoader = resolve; });

  await installAmapVendorFixture(page, false);
  await page.route(/https:\/\/webapi\.amap\.com\/maps\?.*/, async (route) => {
    loaderRequested = true;
    await loaderGate;
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'window.__installAmapVendorSdk(); window.___onAPILoaded?.();',
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const welcome = new WelcomePage(page);
  await welcome.waitUntilReady();
  await page.evaluate(() => {
    void fetch('/src/components/MapComponent.tsx')
      .then((response) => response.text())
      .then((source) => {
        const loaderUrl = source.match(/from\s+"(\/node_modules\/\.vite\/deps\/@amap_amap-jsapi-loader\.js[^\"]*)"/)?.[1];
        if (!loaderUrl) throw new Error('Unable to resolve the Vite AMap loader module URL');
        return new Function('url', 'return import(url)')(loaderUrl);
      })
      .then((module) => module.default.load({
        key: 'playwright-deferred-loader-key',
        version: '2.0',
        plugins: ['AMap.Scale', 'AMap.ToolBar'],
      }))
      .catch((error) => {
        (window as typeof window & { __AMAP_LOADER_FIXTURE_ERROR__?: string })
          .__AMAP_LOADER_FIXTURE_ERROR__ = String(error);
      });
  });
  await expect.poll(() => loaderRequested).toBe(true);
  await welcome.holdToIgnite();
  await itinerary.waitUntilReady();
  await expect.poll(() => loaderRequested).toBe(true);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'initializing');
  expect(await readAmapVendorLifecycle(page)).toMatchObject({ mapCreated: 0, layerCreated: 0 });

  await itinerary.openFullCountdown();
  await expect(page).toHaveURL(/\/countdown$/);
  await expect(countdown.backButton).toBeFocused();
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended');
  releaseLoader();
  await expect.poll(async () => page.evaluate(() => (
    typeof (window as typeof window & { ___onAPILoaded?: unknown }).___onAPILoaded
  ))).toBe('undefined');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
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
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'suspended');

  await countdown.backButton.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready');
  expect(await readAmapVendorLifecycle(page)).toMatchObject({
    mapCreated: 1,
    mapDestroyed: 0,
    layerCreated: 1,
    layerCleared: 0,
  });
});

test('shows official status for a future API race', async ({ page }) => {
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: officialShanghaiFixture })
  ));
  const countdown = new RaceCountdownPageObject(page);

  await countdown.goto();

  await expect(page.getByText('官方正赛时间')).toBeVisible();
  await expect(countdown.sourceStatus).toHaveAttribute('data-countdown-source', 'official');
  await expect(page.locator('time[data-time-zone="Asia/Shanghai"]')).toContainText('15:00');
});

test('shows estimated status when the API is unavailable', async ({ page }) => {
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => route.abort());
  const countdown = new RaceCountdownPageObject(page);

  await countdown.goto();

  await expect(page.getByText('暂定日期 · 等待官方赛程确认')).toBeVisible();
  await expect(countdown.sourceStatus).toHaveAttribute('data-countdown-source', 'estimated');
});

test('shows a loading state without zero countdown digits while resolution is pending', async ({ page }) => {
  let releaseRoute = () => {};
  const routeGate = new Promise<void>((resolve) => { releaseRoute = resolve; });
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', async (route) => {
    await routeGate;
    await route.fulfill({ json: officialShanghaiFixture });
  });
  const countdown = new RaceCountdownPageObject(page);

  await countdown.goto();

  await expect(countdown.product).toHaveAttribute('data-countdown-state', 'loading');
  await expect(countdown.product).not.toHaveAttribute('data-countdown-display', '000000000');
  releaseRoute();
  await expect(countdown.sourceStatus).toBeVisible();
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
  await expect(countdown.sourceStatus).toBeVisible();
  await page.clock.fastForward(31_000);

  await expect(countdown.lightsOut).toBeVisible();
  await expect.poll(() => currentYearRequests).toBe(2);
  releaseNextResolution();
  await expect(countdown.lightsOut).toBeHidden();
  await expect(countdown.product).not.toHaveAttribute('data-countdown-display', '000000000');
});
