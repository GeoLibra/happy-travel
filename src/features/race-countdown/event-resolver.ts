const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

export interface ResolvedRaceEvent {
  startsAt: Date;
  season: number;
  source: 'official' | 'estimated';
}

export interface ResolveRaceOptions {
  now?: Date;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface RaceResponse {
  MRData: {
    RaceTable: {
      Races: unknown[];
    };
  };
}

function shanghaiYear(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
  }).format(now));
}

function fallbackEvent(now: Date): ResolvedRaceEvent {
  const currentYear = shanghaiYear(now);
  const currentFallbackMs = Date.UTC(currentYear, 2, 15, 7);
  const season = currentFallbackMs > now.getTime() ? currentYear : currentYear + 1;

  return {
    startsAt: new Date(Date.UTC(season, 2, 15, 7)),
    season,
    source: 'estimated',
  };
}

function asRaceResponse(value: unknown): RaceResponse {
  if (
    typeof value !== 'object' || value === null ||
    !('MRData' in value) ||
    typeof value.MRData !== 'object' || value.MRData === null ||
    !('RaceTable' in value.MRData) ||
    typeof value.MRData.RaceTable !== 'object' || value.MRData.RaceTable === null ||
    !('Races' in value.MRData.RaceTable) ||
    !Array.isArray(value.MRData.RaceTable.Races)
  ) {
    throw new Error('Invalid Jolpica race response');
  }

  return value as RaceResponse;
}

function parseRace(race: unknown, nowMs: number): ResolvedRaceEvent | undefined {
  if (typeof race !== 'object' || race === null) return undefined;

  const { date, time, season } = race as Record<string, unknown>;
  if (
    typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/.test(time) ||
    (typeof season !== 'string' && typeof season !== 'number')
  ) {
    return undefined;
  }

  const startsAt = new Date(`${date}T${time}`);
  const seasonNumber = Number(season);
  if (
    Number.isNaN(startsAt.getTime()) ||
    startsAt.toISOString().slice(0, 10) !== date ||
    !Number.isInteger(seasonNumber) ||
    startsAt.getTime() <= nowMs
  ) {
    return undefined;
  }

  return { startsAt, season: seasonNumber, source: 'official' };
}

export async function resolveNextShanghaiRace(
  {
    now = new Date(),
    fetchImpl = fetch,
    signal,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  }: ResolveRaceOptions = {},
): Promise<ResolvedRaceEvent> {
  const requestController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectTermination: ((error: Error) => void) | undefined;
  const termination = new Promise<never>((_resolve, reject) => {
    rejectTermination = reject;
    timeoutId = setTimeout(() => {
      requestController.abort(new DOMException('Jolpica request timed out', 'TimeoutError'));
      reject(new Error('Jolpica request timed out'));
    }, Math.max(0, timeoutMs));
  });
  const handleExternalAbort = () => {
    requestController.abort(signal?.reason);
    rejectTermination?.(new Error('Jolpica request aborted'));
  };
  if (signal?.aborted) handleExternalAbort();
  else signal?.addEventListener('abort', handleExternalAbort, { once: true });

  try {
    const currentYear = shanghaiYear(now);
    const responses = await Promise.race([
      Promise.all([currentYear, currentYear + 1].map(async (year) => {
        const response = await fetchImpl(
          `${JOLPICA_BASE_URL}/${year}/circuits/shanghai/races.json`,
          { signal: requestController.signal },
        );
        if (!response.ok) throw new Error(`Jolpica request failed: ${response.status}`);
        return asRaceResponse(await response.json());
      })),
      termination,
    ]);

    const candidates = responses
      .flatMap((response) => response.MRData.RaceTable.Races)
      .map((race) => parseRace(race, now.getTime()))
      .filter((race): race is ResolvedRaceEvent => race !== undefined)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

    return candidates[0] ?? fallbackEvent(now);
  } catch {
    return fallbackEvent(now);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleExternalAbort);
  }
}
