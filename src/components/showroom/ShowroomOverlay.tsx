/**
 * Showroom Overlay Component
 * Accessible scroll showroom overlay displaying chapter definition, progress, ignition CTA, and skip controls.
 */

import React from 'react';
import { useI18n } from '../../i18n.tsx';
import { getShowroomChapter, IgnitionStatus } from '../../lib/showroom-story.ts';

export interface ShowroomOverlayProps {
  progress: number;
  ignitionStatus: IgnitionStatus;
  onPressStart: () => void;
  onPressEnd: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onKeyUp?: (e: React.KeyboardEvent) => void;
  onSkip?: () => void;
  onEnter?: () => void;
  showSkipButton?: boolean;
  className?: string;
}

export const ShowroomOverlay: React.FC<ShowroomOverlayProps> = ({
  progress,
  ignitionStatus,
  onPressStart,
  onPressEnd,
  onKeyDown,
  onKeyUp,
  onSkip,
  onEnter,
  showSkipButton = true,
  className = '',
}) => {
  let t = (key: string) => key;
  try {
    const i18n = useI18n();
    t = i18n.t;
  } catch {
    // Fallback if rendered outside I18nProvider
  }

  const chapter = getShowroomChapter(progress);
  const isIgnited = ignitionStatus === 'ignited';
  const pct = Math.round(progress * 100);

  const getLabelText = (): string => {
    if (isIgnited) {
      return t('showroom.ignition.ready');
    }
    if (ignitionStatus === 'holding' || ignitionStatus === 'completing') {
      return `${t('showroom.ignition.starting')} ${pct}%`;
    }
    return t('showroom.ignition.hold');
  };

  return (
    <div
      className={`fixed inset-0 z-[80] pointer-events-none flex flex-col justify-between p-4 sm:p-8 ${className}`}
      data-showroom-overlay="true"
    >
      {/* Top Chapter Card Overlay */}
      <div className="w-full flex justify-between items-start pointer-events-auto">
        <div
          className="bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-4 text-white max-w-sm shadow-2xl"
          role="region"
          aria-label={t('showroom.chapter')}
        >
          <div className="text-[10px] font-bold text-[#FFB800] uppercase tracking-widest mb-1">
            {t('showroom.chapter')} - {chapter.title}
          </div>
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#E10600] to-[#FFB800] transition-all duration-75"
              style={{ width: `${Math.round(chapter.localProgress * 100)}%` }}
            />
          </div>
        </div>

        {showSkipButton && (
          <button
            type="button"
            data-showroom-action="skip"
            aria-label={t('showroom.skip')}
            tabIndex={0}
            onClick={() => {
              if (onSkip) onSkip();
              else if (onEnter) onEnter();
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md text-xs font-bold uppercase tracking-wider transition-colors border border-white/10 pointer-events-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          >
            {t('showroom.skip')}
          </button>
        )}
      </div>

      {/* ARIA Live Status Announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {getLabelText()}
      </div>

      {/* Bottom Ignition Button CTA */}
      <div className="w-full flex flex-col items-center pointer-events-auto pb-6">
        <button
          type="button"
          data-showroom-action="ignition"
          role="button"
          tabIndex={0}
          aria-label={getLabelText()}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerLeave={onPressEnd}
          onPointerCancel={onPressEnd}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onClick={() => {
            if (isIgnited && onEnter) {
              onEnter();
            }
          }}
          className="relative inline-flex items-center justify-center px-8 py-4 w-[280px] sm:w-[360px] bg-[#FFB800] text-[#001A30] font-black text-lg sm:text-xl uppercase tracking-wider transform -skew-x-12 cursor-pointer select-none overflow-hidden focus:outline-none focus:ring-4 focus:ring-[#E10600]"
        >
          {/* Fill Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#E10600] transition-all duration-75"
            style={{ width: `${pct}%` }}
          />

          <span className="relative z-10 flex items-center justify-center gap-2 skew-x-12 text-center w-full">
            {getLabelText()}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ShowroomOverlay;
