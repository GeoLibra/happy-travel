import { useCallback, useEffect, useState } from 'react';

const COUNTDOWN_PATH = '/countdown';
const COUNTDOWN_HISTORY_STATE_KEY = 'happyTravelCountdown';

function isCountdownOpen() {
  return window.location.pathname === COUNTDOWN_PATH;
}

function isAppCountdownEntry(state: unknown) {
  return typeof state === 'object'
    && state !== null
    && COUNTDOWN_HISTORY_STATE_KEY in state
    && (state as Record<string, unknown>)[COUNTDOWN_HISTORY_STATE_KEY] === true;
}

export function useCountdownNavigation() {
  const [countdownOpen, setCountdownOpen] = useState(isCountdownOpen);

  useEffect(() => {
    const syncCountdownLocation = () => setCountdownOpen(isCountdownOpen());
    window.addEventListener('popstate', syncCountdownLocation);
    return () => window.removeEventListener('popstate', syncCountdownLocation);
  }, []);

  const openCountdown = useCallback(() => {
    if (isCountdownOpen()) return;

    const currentState = window.history.state;
    window.history.pushState(
      {
        ...(typeof currentState === 'object' && currentState !== null ? currentState : {}),
        [COUNTDOWN_HISTORY_STATE_KEY]: true,
      },
      '',
      COUNTDOWN_PATH,
    );
    setCountdownOpen(true);
  }, []);

  const closeCountdown = useCallback(() => {
    if (isAppCountdownEntry(window.history.state)) {
      window.history.back();
      return;
    }

    window.history.replaceState(window.history.state, '', '/');
    setCountdownOpen(false);
  }, []);

  return { countdownOpen, openCountdown, closeCountdown };
}
