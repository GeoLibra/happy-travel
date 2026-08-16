import { describe, expect, it, vi } from 'vitest';

import { resolveNextShanghaiRace } from '@/src/features/race-countdown/event-resolver';

describe('resolveNextShanghaiRace', () => {
  it('chooses the earliest future official Shanghai race', async () => {
    const fetchImpl = vi.fn(async (url: string) => new Response(JSON.stringify({
      MRData: { RaceTable: { Races: url.includes('/2027/') ? [{
        season: '2027', date: '2027-03-21', time: '07:00:00Z',
        Circuit: { circuitId: 'shanghai' },
      }] : [] } },
    })));

    const result = await resolveNextShanghaiRace({
      now: new Date('2026-08-15T00:00:00+08:00'), fetchImpl,
    });

    expect(result).toMatchObject({ source: 'official', season: 2027 });
    expect(result.startsAt.toISOString()).toBe('2027-03-21T07:00:00.000Z');
  });

  it('falls back to next March 15 when offline after current season event', async () => {
    const result = await resolveNextShanghaiRace({
      now: new Date('2026-08-15T00:00:00+08:00'),
      fetchImpl: vi.fn(async () => { throw new Error('offline'); }),
    });

    expect(result.source).toBe('estimated');
    expect(result.startsAt.toISOString()).toBe('2027-03-15T07:00:00.000Z');
  });

  it('discards malformed and past race entries before choosing an official event', async () => {
    const fetchImpl = vi.fn(async (url: string) => new Response(JSON.stringify({
      MRData: { RaceTable: { Races: url.includes('/2026/') ? [
        { season: '2026', date: '2026-03-15', time: '07:00:00Z', Circuit: { circuitId: 'shanghai' } },
        { season: '2026', date: 'not-a-date', time: '07:00:00Z', Circuit: { circuitId: 'shanghai' } },
      ] : [{
        season: '2027', date: '2027-03-21', time: '07:00:00Z', Circuit: { circuitId: 'shanghai' },
      }] } },
    })));

    const result = await resolveNextShanghaiRace({
      now: new Date('2026-08-15T00:00:00+08:00'), fetchImpl,
    });

    expect(result).toMatchObject({ source: 'official', season: 2027 });
    expect(result.startsAt.toISOString()).toBe('2027-03-21T07:00:00.000Z');
  });

  it('uses an estimate when an official response has an invalid shape', async () => {
    const result = await resolveNextShanghaiRace({
      now: new Date('2026-01-01T00:00:00+08:00'),
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ MRData: {} }))),
    });

    expect(result).toMatchObject({ source: 'estimated', season: 2026 });
    expect(result.startsAt.toISOString()).toBe('2026-03-15T07:00:00.000Z');
  });

  it('aborts stalled Jolpica requests and resolves the estimated fallback within the timeout', async () => {
    vi.useFakeTimers();
    const observedSignals: AbortSignal[] = [];
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal) observedSignals.push(init.signal);
      return new Promise<Response>(() => {});
    });

    try {
      const pending = resolveNextShanghaiRace({
        now: new Date('2026-08-15T00:00:00+08:00'),
        fetchImpl,
        timeoutMs: 250,
      });

      await vi.advanceTimersByTimeAsync(250);
      const result = await pending;

      expect(result).toMatchObject({ source: 'estimated', season: 2027 });
      expect(result.startsAt.toISOString()).toBe('2027-03-15T07:00:00.000Z');
      expect(observedSignals).toHaveLength(2);
      expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
