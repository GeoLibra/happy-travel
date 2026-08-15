import { expect, test } from 'playwright/test';

import { RaceCountdownPageObject } from '../pages/RaceCountdownPage';
import { ItineraryPage } from '../pages/ItineraryPage';

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

const amapBrowserFixture = `
  window.AMap = {
    Map: class {
      on(_event, callback) { callback(); }
      add() {}
      addControl() {}
      destroy() {}
      setCenter() {}
      setFeatures() {}
      setFitView() {}
    },
    Scale: class {},
    ToolBar: class {},
    LabelsLayer: class { add() {} clear() {} },
    Marker: class {
      on() {}
      remove() {}
      setContent() {}
      setMap() {}
      setzIndex() {}
    },
    LabelMarker: class {
      on() {}
      remove() {}
      setText() {}
      setzIndex() {}
    },
    LngLat: class { constructor(_lng, _lat) {} },
  };
  window.___onAPILoaded?.();
`;

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

  await page.addInitScript(amapBrowserFixture);
  await itinerary.completeWelcomeIgnition();
  await itinerary.selectDayTab(1);
  await expect(mapRenderer).toHaveAttribute('data-amap-renderer-state', 'ready');
  await expect(mapRenderer).toHaveAttribute('data-amap-instance-count', '1');
  await expect(mapRenderer).toHaveAttribute('data-amap-layer-count', '1');
  const markerCount = await mapRenderer.getAttribute('data-amap-marker-count');
  expect(Number(markerCount)).toBeGreaterThan(0);
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
