export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  elapsed: boolean;
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function splitRemainingTime(targetMs: number, nowMs: number): CountdownParts {
  const remainingMs = targetMs - nowMs;
  if (remainingMs < 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, elapsed: true };
  }

  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((remainingMs % MINUTE_MS) / SECOND_MS);

  return { days, hours, minutes, seconds, elapsed: false };
}

export function formatCountdownDigits(parts: CountdownParts): string[] {
  return [
    ...Math.max(0, Math.min(999, parts.days)).toString().padStart(3, '0'),
    ...Math.max(0, Math.min(99, parts.hours)).toString().padStart(2, '0'),
    ...Math.max(0, Math.min(99, parts.minutes)).toString().padStart(2, '0'),
    ...Math.max(0, Math.min(99, parts.seconds)).toString().padStart(2, '0'),
  ];
}
