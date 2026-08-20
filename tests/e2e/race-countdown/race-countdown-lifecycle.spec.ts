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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('happy-travel-locale', 'zh'));
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', (route) => (
    route.fulfill({ json: officialShanghaiFixture })
  ));
  // Mock Google Fonts to use local font and avoid network flakiness
  await page.route('https://fonts.googleapis.com/css2**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: `@font-face {
  font-family: 'Russo One';
  font-style: normal;
  font-weight: 400;
  src: url('/fonts/RussoOne-Regular.ttf') format('truetype');
}`,
  }));
});

test('countdown renderer resources return to baseline after five open and close cycles', async ({
  page,
}) => {
  test.setTimeout(900_000);

  const itinerary = new ItineraryPage(page);
  const countdown = new RaceCountdownPageObject(page);
  await itinerary.completeWelcomeIgnition();

  const baseline = await countdown.readObservability();
  expect(baseline).toMatchObject({
    activeAnimationFrames: 0,
    activeListeners: 0,
    activeScenes: 0,
    composers: 0,
    environments: 0,
    frameCount: 0,
    floors: 0,
    geometries: 0,
    materials: 0,
    mode: null,
    ready: false,
    renderers: 0,
    resourceCount: 0,
    vehicles: 0,
    viewport: null,
  });

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await itinerary.openFullCountdown();
    await expect(countdown.product).toHaveAttribute('data-countdown-state', 'ready', { timeout: 60_000 });
    await expect(countdown.product).toHaveAttribute('data-countdown-vehicle', 'ready', { timeout: 60_000 });
    const active = await countdown.waitForObservabilityReady(60_000);
    expect(active.activeScenes, `cycle ${cycle} must own one countdown scene`).toBe(1);
    expect(active.activeAnimationFrames, `cycle ${cycle} must own one animation frame`).toBe(1);
    expect(active.activeListeners, `cycle ${cycle} must own its context listener`).toBe(1);
    expect(active.renderers, `cycle ${cycle} must own one renderer`).toBe(1);
    expect(active.composers, `cycle ${cycle} must own one composer`).toBe(1);
    expect(active.vehicles, `cycle ${cycle} must own one vehicle clone`).toBe(1);
    expect(active.resourceCount, `cycle ${cycle} must report owned resources`).toBeGreaterThan(0);

    await countdown.backButton.click();
    await expect(page).toHaveURL(/\/itinerary$/, { timeout: 60_000 });
    await expect.poll(async () => await countdown.readObservability(), { timeout: 120_000 }).toEqual(baseline);
  }
});
