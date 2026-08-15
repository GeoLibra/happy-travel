import { useEffect, useMemo, useState } from 'react';

import { CountdownCanvas } from './CountdownCanvas';
import './countdown-page.css';

const REFERENCE_SEED = 26;
const MOBILE_BREAKPOINT = 768;

function clockDigits(date: Date): string[] {
  return [
    ...date.getHours().toString().padStart(2, '0'),
    ...date.getMinutes().toString().padStart(2, '0'),
    ...date.getSeconds().toString().padStart(2, '0'),
  ];
}

function developmentDigitsOverride(): string[] | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const digits = new URLSearchParams(window.location.search).get('digits');
  return digits && /^\d{6}$/.test(digits) ? [...digits] : null;
}

function useClockDigits(): string[] {
  const override = useMemo(developmentDigitsOverride, []);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (override) return;
    const update = () => setNow(new Date());
    const intervalId = window.setInterval(update, 1_000);
    return () => window.clearInterval(intervalId);
  }, [override]);

  return override ?? clockDigits(now);
}

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return width;
}

function DevelopmentTools({ digits }: { digits: string[] }) {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let frames = 0;
    let sampledAt = performance.now();
    const sample = (time: number) => {
      frames += 1;
      if (time - sampledAt >= 500) {
        setFps(Math.round((frames * 1_000) / (time - sampledAt)));
        sampledAt = time;
        frames = 0;
      }
      frameId = requestAnimationFrame(sample);
    };
    frameId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="time-viz-dev-tools" data-time-viz-dev-tools>
      <output className="time-viz-fps" aria-label="Frames per second">
        <strong>{fps || '--'} FPS</strong>
        <span>scene ready</span>
      </output>
      <details className="time-viz-debug">
        <summary>Debug-UI</summary>
        <dl>
          <div><dt>Digits</dt><dd>{digits.join('')}</dd></div>
          <div><dt>Seed</dt><dd>{REFERENCE_SEED}</dd></div>
          <div><dt>Mode</dt><dd>Reference</dd></div>
        </dl>
      </details>
    </div>
  );
}

export function ReferenceTimeVizPage() {
  const digits = useClockDigits();
  const viewportWidth = useViewportWidth();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const layout = viewportWidth < MOBILE_BREAKPOINT ? 'mobile-three-row' : 'desktop-row';

  return (
    <main
      className="time-viz-page"
      data-time-viz-digits={digits.join('')}
      data-time-viz-layout={layout}
      data-time-viz-seed={REFERENCE_SEED}
      data-time-viz-state={state}
    >
      <CountdownCanvas
        digits={digits}
        mode="reference"
        seed={REFERENCE_SEED}
        onReady={() => setState('ready')}
        onWebGLFailure={() => setState('error')}
      />
      {import.meta.env.DEV ? <DevelopmentTools digits={digits} /> : null}
      {state === 'error' ? (
        <p className="time-viz-error" role="alert">WebGL scene unavailable</p>
      ) : null}
    </main>
  );
}
