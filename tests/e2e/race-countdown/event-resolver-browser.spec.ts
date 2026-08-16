import { expect, test } from 'playwright/test';

test('browser resolver aborts never-settling requests and returns the estimate', async ({ page }) => {
  await page.goto('/time-viz-reference', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves source modules from /src in the browser test server.
    const { resolveNextShanghaiRace } = await import('/src/features/race-countdown/event-resolver.ts');
    const signals: AbortSignal[] = [];
    const event = await resolveNextShanghaiRace({
      fetchImpl: ((_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>(() => {});
      }) as typeof fetch,
      now: new Date('2026-08-15T00:00:00+08:00'),
      timeoutMs: 50,
    });
    return {
      aborted: signals.every((signal) => signal.aborted),
      signalCount: signals.length,
      source: event.source,
      startsAt: event.startsAt.toISOString(),
    };
  });

  expect(result).toEqual({
    aborted: true,
    signalCount: 2,
    source: 'estimated',
    startsAt: '2026-03-15T07:00:00.000Z',
  });
});

test('browser resolver timeout wins over intercepted native fetch requests', async ({ page }) => {
  await page.goto('/time-viz-reference', { waitUntil: 'domcontentloaded' });
  let releaseRoute = () => {};
  const routeGate = new Promise<void>((resolve) => { releaseRoute = resolve; });
  await page.route('**/ergast/f1/*/circuits/shanghai/races.json', async (route) => {
    await routeGate;
    await route.abort();
  });

  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves source modules from /src in the browser test server.
    const { resolveNextShanghaiRace } = await import('/src/features/race-countdown/event-resolver.ts');
    const event = await resolveNextShanghaiRace({
      now: new Date('2026-08-15T00:00:00+08:00'),
      timeoutMs: 50,
    });
    return { source: event.source, startsAt: event.startsAt.toISOString() };
  });
  releaseRoute();

  expect(result).toEqual({
    source: 'estimated',
    startsAt: '2026-03-15T07:00:00.000Z',
  });
});
