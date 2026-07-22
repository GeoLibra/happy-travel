/**
 * Showroom Accessible Ignition Hook & Controller Primitive
 * Pure/testable ignition controller and React hook with keyboard, pointer, and scroll-lock management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  reduceIgnition,
  IgnitionState,
  IgnitionStatus,
  IgnitionEvent,
  INITIAL_IGNITION_STATE,
} from '../../lib/showroom-story.ts';

export interface UseIgnitionOptions {
  onIgnitionComplete?: () => void;
  initialProgress?: number;
  autoLockScroll?: boolean;
}

export function isIgnitionKey(keyOrEvent: string | KeyboardEvent | { key?: string; code?: string }): boolean {
  if (typeof keyOrEvent === 'string') {
    return keyOrEvent === ' ' || keyOrEvent === 'Space' || keyOrEvent === 'Enter';
  }
  const key = keyOrEvent.key;
  const code = keyOrEvent.code;
  return key === ' ' || key === 'Space' || key === 'Enter' || code === 'Space' || code === 'Enter';
}

export function shouldLockScroll(status: IgnitionStatus): boolean {
  return status !== 'ignited';
}

export class PureIgnitionController {
  private state: IgnitionState;
  private onComplete?: () => void;
  private hasCalledComplete = false;

  constructor(initialProgress = 0, onComplete?: () => void) {
    this.state = initialProgress > 0 ? { status: 'ready', progress: initialProgress } : { ...INITIAL_IGNITION_STATE };
    this.onComplete = onComplete;
  }

  public getState(): IgnitionState {
    return { ...this.state };
  }

  public dispatch(event: IgnitionEvent): IgnitionState {
    const nextState = reduceIgnition(this.state, event);
    this.state = nextState;

    if (nextState.status === 'ignited' && !this.hasCalledComplete) {
      this.hasCalledComplete = true;
      this.onComplete?.();
    }

    return this.getState();
  }

  public press(): IgnitionState {
    return this.dispatch({ type: 'press' });
  }

  public release(): IgnitionState {
    return this.dispatch({ type: 'release' });
  }

  public tick(deltaMs: number): IgnitionState {
    return this.dispatch({ type: 'tick', deltaMs });
  }

  public reset(): IgnitionState {
    this.hasCalledComplete = false;
    return this.dispatch({ type: 'reset' });
  }

  public handleKeyDown(event: { key?: string; code?: string; repeat?: boolean }): IgnitionState {
    if (event.repeat) return this.getState();
    if (isIgnitionKey(event)) {
      return this.press();
    }
    return this.getState();
  }

  public handleKeyUp(event: { key?: string; code?: string }): IgnitionState {
    if (isIgnitionKey(event)) {
      return this.release();
    }
    return this.getState();
  }
}

export function useIgnition(options: UseIgnitionOptions = {}) {
  const { onIgnitionComplete, autoLockScroll = true } = options;
  const [ignitionState, setIgnitionState] = useState<IgnitionState>(INITIAL_IGNITION_STATE);
  const controllerRef = useRef<PureIgnitionController | null>(null);
  const onIgnitionCompleteRef = useRef(onIgnitionComplete);

  useEffect(() => {
    onIgnitionCompleteRef.current = onIgnitionComplete;
  }, [onIgnitionComplete]);

  if (!controllerRef.current) {
    controllerRef.current = new PureIgnitionController(0, () => {
      onIgnitionCompleteRef.current?.();
    });
  }

  const handlePressStart = useCallback(() => {
    if (controllerRef.current) {
      setIgnitionState(controllerRef.current.press());
    }
  }, []);

  const handlePressEnd = useCallback(() => {
    if (controllerRef.current) {
      setIgnitionState(controllerRef.current.release());
    }
  }, []);

  const handleReset = useCallback(() => {
    if (controllerRef.current) {
      setIgnitionState(controllerRef.current.reset());
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent | React.KeyboardEvent) => {
    if (e.repeat) return;
    if (isIgnitionKey(e)) {
      if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      handlePressStart();
    }
  }, [handlePressStart]);

  const handleKeyUp = useCallback((e: KeyboardEvent | React.KeyboardEvent) => {
    if (isIgnitionKey(e)) {
      if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      handlePressEnd();
    }
  }, [handlePressEnd]);

  // Tick loop when holding or completing
  useEffect(() => {
    let animFrame: number;
    let lastTime: number | null = null;

    const loop = (now: number) => {
      if (lastTime !== null && controllerRef.current) {
        const deltaMs = now - lastTime;
        const current = controllerRef.current.getState();
        if (current.status === 'holding' || current.status === 'completing') {
          const next = controllerRef.current.tick(deltaMs);
          setIgnitionState(next);
        }
      }
      lastTime = now;

      const curr = controllerRef.current?.getState();
      if (curr && (curr.status === 'holding' || curr.status === 'completing')) {
        animFrame = requestAnimationFrame(loop);
      }
    };

    const status = ignitionState.status;
    if (status === 'holding' || status === 'completing') {
      lastTime = null;
      animFrame = requestAnimationFrame(loop);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [ignitionState.status]);

  // Scroll locking effect
  useEffect(() => {
    if (!autoLockScroll || typeof document === 'undefined') return;

    const locked = shouldLockScroll(ignitionState.status);
    const prevOverflow = document.body.style.overflow;
    if (locked) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [autoLockScroll, ignitionState.status]);

  return {
    status: ignitionState.status,
    progress: ignitionState.progress,
    isIgnited: ignitionState.status === 'ignited',
    isHolding: ignitionState.status === 'holding',
    isCompleting: ignitionState.status === 'completing',
    onPressStart: handlePressStart,
    onPressEnd: handlePressEnd,
    onReset: handleReset,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
    isIgnitionKey,
    controller: controllerRef.current,
  };
}
