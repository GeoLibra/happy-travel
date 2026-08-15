import { useEffect, useRef, useState } from 'react';

import { useI18n, type MessageKey } from '@/src/i18n';

import { CountdownCanvas } from './CountdownCanvas';
import {
  formatCountdownDigits,
  splitRemainingTime,
  type CountdownParts,
} from './countdown-time';
import {
  resolveNextShanghaiRace,
  type ResolvedRaceEvent,
} from './event-resolver';
import './countdown-page.css';

const COUNTDOWN_SEED = 26;
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const EMPTY_DIGITS: string[] = [];

type CountdownPageState =
  | { status: 'loading' }
  | { status: 'ready'; event: ResolvedRaceEvent; parts: CountdownParts }
  | { status: 'webgl-fallback'; event: ResolvedRaceEvent; parts: CountdownParts };

interface RaceCountdownPageProps {
  onBack(): void;
}

interface CountdownUnit {
  key: 'days' | 'hours' | 'minutes' | 'seconds';
  messageKey: MessageKey;
  value: string;
}

function remainingParts(event: ResolvedRaceEvent, nowMs = Date.now()): CountdownParts {
  const parts = splitRemainingTime(event.startsAt.getTime(), nowMs);
  return event.startsAt.getTime() <= nowMs ? { ...parts, elapsed: true } : parts;
}

function formatShanghaiTime(event: ResolvedRaceEvent, locale: 'zh' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'long',
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
  }).format(event.startsAt);
}

function countdownUnits(parts: CountdownParts): CountdownUnit[] {
  const digits = formatCountdownDigits(parts);
  return [
    { key: 'days', messageKey: 'countdown.units.days', value: digits.slice(0, 3).join('') },
    { key: 'hours', messageKey: 'countdown.units.hours', value: digits.slice(3, 5).join('') },
    { key: 'minutes', messageKey: 'countdown.units.minutes', value: digits.slice(5, 7).join('') },
    { key: 'seconds', messageKey: 'countdown.units.seconds', value: digits.slice(7, 9).join('') },
  ];
}

export function RaceCountdownPage({ onBack }: RaceCountdownPageProps) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<CountdownPageState>({ status: 'loading' });
  const mountedRef = useRef(false);
  const initialResolutionStartedRef = useRef(false);
  const webglUnavailableRef = useRef(false);
  const resolvingElapsedEventRef = useRef(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  const applyResolvedEvent = (event: ResolvedRaceEvent) => {
    if (!mountedRef.current) return;
    setState((current) => ({
      event,
      parts: remainingParts(event),
      status: webglUnavailableRef.current || current.status === 'webgl-fallback'
        ? 'webgl-fallback'
        : 'ready',
    }));
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!initialResolutionStartedRef.current) {
      initialResolutionStartedRef.current = true;
      void resolveNextShanghaiRace().then(applyResolvedEvent);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const targetMs = state.status === 'loading' ? null : state.event.startsAt.getTime();

  useEffect(() => {
    if (targetMs === null) return;

    const intervalId = window.setInterval(() => {
      setState((current) => {
        if (current.status === 'loading' || current.event.startsAt.getTime() !== targetMs) {
          return current;
        }
        return { ...current, parts: remainingParts(current.event) };
      });
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [targetMs]);

  const elapsed = state.status !== 'loading' && state.parts.elapsed;
  useEffect(() => {
    if (!elapsed || resolvingElapsedEventRef.current) return;

    resolvingElapsedEventRef.current = true;
    void resolveNextShanghaiRace()
      .then(applyResolvedEvent)
      .finally(() => {
        resolvingElapsedEventRef.current = false;
      });
  }, [elapsed]);

  const handleWebGLFailure = () => {
    webglUnavailableRef.current = true;
    setState((current) => current.status === 'loading'
      ? current
      : { ...current, status: 'webgl-fallback' });
  };

  const parts = state.status === 'loading' ? null : state.parts;
  const event = state.status === 'loading' ? null : state.event;
  const digits = parts ? formatCountdownDigits(parts) : EMPTY_DIGITS;
  const units = parts ? countdownUnits(parts) : [];
  const liveText = !parts
    ? t('countdown.loading')
    : parts.elapsed
      ? `LIGHTS OUT · ${t('countdown.lightsOut')}`
      : `${t('countdown.remaining')}: ${parts.days} ${t('countdown.units.days')}, ${parts.hours} ${t('countdown.units.hours')}, ${parts.minutes} ${t('countdown.units.minutes')}`;

  return (
    <main
      className={`race-countdown-page race-countdown-page--${state.status}`}
      data-countdown-display={parts?.elapsed ? 'lights-out' : digits.join('') || 'loading'}
      data-countdown-state={state.status}
    >
      {state.status !== 'webgl-fallback' ? (
        <div className="race-countdown-canvas" aria-hidden="true">
          <CountdownCanvas
            digits={digits}
            mode="countdown"
            seed={COUNTDOWN_SEED}
            onWebGLFailure={handleWebGLFailure}
          />
        </div>
      ) : null}

      <div className="race-countdown-overlay">
        <button ref={backButtonRef} className="race-countdown-back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          <span>{t('countdown.back')}</span>
        </button>

        <header className="race-countdown-header">
          <p className="race-countdown-kicker">{t('countdown.eventTitle')}</p>
          {event ? (
            <>
              <time
                className="race-countdown-target"
                data-time-zone={SHANGHAI_TIME_ZONE}
                dateTime={event.startsAt.toISOString()}
              >
                {formatShanghaiTime(event, locale)} · {t('countdown.shanghaiTime')}
              </time>
              <p
                className={`race-countdown-source race-countdown-source--${event.source}`}
                data-countdown-source={event.source}
              >
                {event.source === 'official'
                  ? t('countdown.official')
                  : t('countdown.estimated')}
              </p>
            </>
          ) : null}
        </header>

        {state.status === 'loading' ? (
          <section className="race-countdown-loading" aria-label={t('countdown.loading')}>
            <span className="race-countdown-loading-line" />
            <span className="race-countdown-loading-units" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
          </section>
        ) : parts?.elapsed ? (
          <p className="race-countdown-lights-out">LIGHTS OUT</p>
        ) : state.status === 'webgl-fallback' ? (
          <section className="race-countdown-dom-fallback" data-countdown-fallback>
            {units.map((unit) => (
              <div data-countdown-unit={unit.key} key={unit.key}>
                <strong>{unit.value}</strong>
                <span>{t(unit.messageKey)}</span>
              </div>
            ))}
          </section>
        ) : (
          <div className="race-countdown-unit-labels" aria-hidden="true">
            {units.map((unit) => <span key={unit.key}>{t(unit.messageKey)}</span>)}
          </div>
        )}

        <p
          aria-atomic="true"
          aria-live="polite"
          className="race-countdown-sr-only"
          data-countdown-live
        >
          {liveText}
        </p>
      </div>
    </main>
  );
}
