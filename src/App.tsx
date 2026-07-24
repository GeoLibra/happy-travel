import React, { useState, useMemo, useRef, useEffect } from 'react';
interface RoseEasterEggProps {
  show: boolean;
  onClose: () => void;
}
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  MapPin,
  Clock,
  Coffee,
  Hotel,
  Trophy,
  Palette,
  Ticket,
  ChevronRight,
  Map as MapIcon,
  List as ListIcon,
  Flag,
  Utensils,
  Music,
  Sparkles,
  Languages
} from 'lucide-react';
import { ITINERARY_DATA, Location, TYPE_COLORS } from './constants';
import MapComponent from './components/MapComponent';
import { cn } from './lib/utils';
import WelcomePage from './components/WelcomePage';
import tripImage from './img/IMG_9599.jpg';
import MiniFirework from './components/MiniFirework';
import MV1Badge from './components/MV1Badge';
import MV1InfoCard from './components/MV1InfoCard';
import ImagineDragonsBadge from './components/ImagineDragonsBadge';
import RaceCountdown from './components/RaceCountdown';
import RoseModal from './components/RoseModal';
import f1EngineShiftSound from './audio/f1-engine-2.mp3';
import successSound from './audio/success.mp3';
import { localizeItinerary, useI18n } from './i18n';
import { EMPTY_SHAKE_STATE, stepShakeDetection } from './lib/shake-detection';

const TypeIcon = ({ type, className }: { type: Location['type'], className?: string }) => {
  switch (type) {
    case 'sports': return <Trophy className={className} />;
    case 'hotel': return <Hotel className={className} />;
    case 'museum': return <Palette className={className} />;
    case 'theatre': return <Ticket className={className} />;
    case 'cafe': return <Coffee className={className} />;
    case 'park': return <MapPin className={className} />;
    case 'restaurant': return <Utensils className={className} />;
    case 'citywalk': return <MapIcon className={className} />;
    case 'spa': return <Sparkles className={className} />;
    default: return <MapPin className={className} />;
  }
};

export default function App() {
  const { locale, t, toggleLocale } = useI18n();
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); // For mobile toggle
  const [hoveredType, setHoveredType] = useState<Location['type'] | null>(null);
  const [showMV1Card, setShowMV1Card] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  // Rose easter egg state - Three.js Rose Modal
  const [showRoseModal, setShowRoseModal] = useState(false);
  const [motionPermissionGranted, setMotionPermissionGranted] = useState(false);
  const shakeState = useRef(EMPTY_SHAKE_STATE);
  const isModalOpenRef = useRef(showRoseModal);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const secretClickRef = useRef(0);
  const secretClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isModalOpenRef.current = showRoseModal;
  }, [showRoseModal]);

  const localizedItinerary = useMemo(() => localizeItinerary(ITINERARY_DATA, locale), [locale]);
  const allLocations = useMemo(() => localizedItinerary.flatMap(d => d.locations), [localizedItinerary]);
  const currentDay = localizedItinerary[selectedDayIdx];
  const shiftAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(f1EngineShiftSound);
    audio.volume = 0.4;
    audio.preload = 'auto';
    shiftAudioRef.current = audio;
    const successAudio = new Audio(successSound);
    successAudio.preload = 'auto';
    successAudioRef.current = successAudio;
    return () => {
      audio.pause();
      audio.src = '';
      shiftAudioRef.current = null;
      successAudio.pause();
      successAudio.src = '';
      successAudioRef.current = null;
    };
  }, []);

  const playShiftSound = () => {
    if (shiftAudioRef.current) {
        // Play a random short segment of the engine sound to simulate different shifts
        const randomStart = Math.random() * 2;
        shiftAudioRef.current.currentTime = randomStart;
        shiftAudioRef.current.play().catch(() => {});
        // Stop after 0.3s
        setTimeout(() => {
            if(shiftAudioRef.current) {
                shiftAudioRef.current.pause();
            }
        }, 300);
    }
  };

  const handleSecretClick = () => {
    console.log('[App] Secret click registered', secretClickRef.current + 1);
    secretClickRef.current += 1;

    if (secretClickTimeoutRef.current) clearTimeout(secretClickTimeoutRef.current);

    if (secretClickRef.current >= 5) {
      console.log('[App] Secret click trigger: Opening Rose Modal');
      setShowRoseModal(true);
      secretClickRef.current = 0;
      if (successAudioRef.current) {
        successAudioRef.current.currentTime = 0;
        successAudioRef.current.play().catch(() => {});
      }
    } else {
      secretClickTimeoutRef.current = setTimeout(() => {
        secretClickRef.current = 0;
      }, 2000);
    }
  };

  const requestMotionPermission = async () => {
    console.log('[App] Requesting motion permission...');
    if (typeof (window.DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (window.DeviceMotionEvent as any).requestPermission();
        console.log('[App] Permission response:', response);
        if (response === 'granted') {
          setMotionPermissionGranted(true);
          return true;
        }
      } catch (e) {
        console.error('[App] Permission request failed', e);
      }
    } else {
      console.log('[App] Browser does not require permission');
      setMotionPermissionGranted(true);
      return true;
    }
    return false;
  };

  // Shake detection and rose easter egg
  useEffect(() => {
    if (!motionPermissionGranted) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.acceleration ?? event.accelerationIncludingGravity;
      const result = stepShakeDetection(
        shakeState.current,
        {
          x: acceleration?.x ?? null,
          y: acceleration?.y ?? null,
          z: acceleration?.z ?? null,
        },
        Date.now(),
        isModalOpenRef.current,
      );
      shakeState.current = result.state;

      if (result.detected) {
        console.log('[App] Shake detected!');
        if (successAudioRef.current) {
          successAudioRef.current.currentTime = 0;
          successAudioRef.current.play().catch(() => {});
        }
        setShowRoseModal(true);
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [motionPermissionGranted]);

  // Scroll into view when selectedLocationId changes
  useEffect(() => {
    if (selectedLocationId && itemRefs.current[selectedLocationId]) {
      // Find which day this location belongs to
      const dayIdx = ITINERARY_DATA.findIndex(day =>
        day.locations.some(loc => loc.id === selectedLocationId)
      );

      if (dayIdx !== -1 && dayIdx !== selectedDayIdx) {
        setSelectedDayIdx(dayIdx);
      }

      // Small delay to ensure the day tab has switched and DOM is ready
      setTimeout(() => {
        itemRefs.current[selectedLocationId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }, 100);
    }
  }, [selectedLocationId]);

  const handleLocationClick = (loc: Location) => {
    console.log('[App] Location clicked', {
      locationId: loc.id,
      locationName: loc.name,
      currentSelectedId: selectedLocationId,
    });
    playShiftSound();
    setSelectedLocationId(loc.id);
    if (window.innerWidth < 768) {
      setViewMode('map');
    }
  };

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <WelcomePage
            key="welcome"
            onPrepareEnter={() => { void requestMotionPermission(); }}
            onEnter={() => {
              console.log('[App] Entering application...');
              setShowWelcome(false);
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        data-app-shell="main"
        className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans selection:bg-[#E10600]/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: showWelcome ? 0 : 1 }}
        transition={{ duration: 0.8 }}
        style={{ pointerEvents: showWelcome ? 'none' : 'auto' }}
      >
        {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 pt-5">
        {/* Checkered Flag Top Border */}
        <div
          className="absolute top-0 left-0 w-full h-2 z-40 opacity-90 shadow-sm"
          style={{
            backgroundImage: 'repeating-conic-gradient(#1a1a1a 0% 25%, #f8fafc 0% 50%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0'
          }}
        />

        <div className="max-w-7xl mx-auto flex justify-between items-center mt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-app-action="return-welcome"
              onClick={() => setShowWelcome(true)}
              aria-label="Return to Welcome"
              className="w-10 h-10 bg-[#001A30] rounded-xl flex items-center justify-center text-[#FFB800] shadow-lg shadow-[#001A30]/20 border border-white/10 relative overflow-hidden group cursor-pointer"
            >
              <MapPin size={24} className="relative z-10" />
              {/* MV1 Number Badge */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#E10600] rounded-tl-lg flex items-center justify-center text-white text-[8px] font-black italic opacity-0 group-hover:opacity-100 transition-opacity">
                #1
              </div>
            </button>
            <div data-rose-trigger="true" onClick={handleSecretClick} className="cursor-pointer active:scale-95 transition-transform select-none">
              <h1 className="text-xl font-bold tracking-tight">{t('app.title')}</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider flex items-center gap-2">
                2026.03.13 - 03.15
                <span className="inline-flex items-center text-[9px] font-black bg-[#E10600] text-white px-1.5 py-0.5 rounded-sm italic transform -skew-x-12 tracking-widest">
                  RACE WEEKEND
                </span>
                <span className="inline-flex items-center text-[9px] font-black bg-[#001A30] text-[#FFB800] px-1.5 py-0.5 rounded-sm italic transform -skew-x-12 tracking-widest">
                  MV1
                </span>
              </p>
            </div>
          </div>

          {/* Mobile Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t('language.label')}
              title={t('language.label')}
              className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white/80 inline-flex items-center justify-center text-slate-700 shadow-sm transition-colors hover:border-[#E10600]/40 hover:text-[#E10600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/40"
            >
              <Languages size={18} aria-hidden="true" />
            </button>
          <div className="md:hidden flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'list' ? "bg-white shadow-sm text-[#E10600]" : "text-slate-500"
              )}
            >
              <ListIcon size={20} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'map' ? "bg-white shadow-sm text-[#E10600]" : "text-slate-500"
              )}
            >
              <MapIcon size={20} />
            </button>
          </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-88px)]">
        {/* Left Column: Itinerary */}
        <div className={cn(
          "md:col-span-5 lg:col-span-4 flex flex-col gap-6 overflow-y-scroll overflow-x-hidden custom-scrollbar pr-4 pb-24 md:pb-12 relative z-10 overscroll-none touch-pan-y",
          viewMode === 'map' && "hidden md:flex"
        )}>
          {/* Prominent Image Highlight */}
          <div className="relative w-full shrink-0 z-20 mt-4">
            <div className="w-full h-48 md:h-56 rounded-2xl overflow-hidden relative shadow-xl shadow-slate-200/50 group border border-white/60 select-none">
              <img
                 src={tripImage}
                 alt="Trip Highlight"
                 className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            </div>
            {/* Firework anchor placed exactly at the top right bounding corner */}
            <div className="absolute top-0 right-0 w-0 h-0 z-50 pointer-events-none">
              {!showWelcome && <MiniFirework />}
            </div>
      </div>

          {!showWelcome && <RaceCountdown />}

          {/* Day Selector with Swipe Support */}
          {/* Day Selector with Swipe Support */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              const threshold = 40;
              if (info.offset.x < -threshold && selectedDayIdx < ITINERARY_DATA.length - 1) {
                setSelectedDayIdx(selectedDayIdx + 1);
                setSelectedLocationId(undefined);
              } else if (info.offset.x > threshold && selectedDayIdx > 0) {
                setSelectedDayIdx(selectedDayIdx - 1);
                setSelectedLocationId(undefined);
              }
            }}
            className="flex gap-2 p-1 bg-white/80 backdrop-blur-md rounded-xl shrink-0 sticky top-0 z-20 shadow-sm border border-slate-200/50 overflow-hidden touch-pan-y"
          >
            {localizedItinerary.map((day, idx) => (
              <button
                key={day.date}
                onClick={(e) => {
                  e.preventDefault();
                  if (selectedDayIdx !== idx) playShiftSound();
                  setSelectedDayIdx(idx);
                  setSelectedLocationId(undefined);
                }}
                className={cn(
                  "flex-1 py-3 px-2 sm:px-4 rounded-lg font-semibold transition-all flex flex-col items-center gap-1 min-w-0 relative",
                  selectedDayIdx === idx
                    ? "text-[#001A30]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                <span className="text-xs opacity-60 whitespace-nowrap relative z-10">DAY {idx + 1}</span>
                <span className="text-sm whitespace-nowrap relative z-10">{day.date.split('-').slice(1).join('.')}</span>

                {selectedDayIdx === idx && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white shadow-sm border-b-[3px] border-[#E10600] rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </motion.div>

          {/* List Component with Swipe Support */}
          <div className="flex-1 min-h-0 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDayIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  const threshold = 50;
                  if (info.offset.x < -threshold && selectedDayIdx < ITINERARY_DATA.length - 1) {
                    setSelectedDayIdx(selectedDayIdx + 1);
                    setSelectedLocationId(undefined);
                  } else if (info.offset.x > threshold && selectedDayIdx > 0) {
                    setSelectedDayIdx(selectedDayIdx - 1);
                    setSelectedLocationId(undefined);
                  }
                }}
                className="space-y-4 touch-pan-y"
              >
                {currentDay.locations.map((loc, idx) => {
                  const isF1Circuit = loc.id === '2-1' || loc.name.includes('F1');
                  const isImagineDragons = loc.description?.includes('Imagine Dragons');
                  return (
                  <motion.div
                    key={loc.id}
                    ref={el => { itemRefs.current[loc.id] = el; }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleLocationClick(loc)}
                    className={cn(
                      "group relative p-5 rounded-2xl border transition-all cursor-pointer overflow-hidden",
                      selectedLocationId === loc.id
                        ? "bg-white border-[#001A30]/20 shadow-xl shadow-[#001A30]/5 ring-1 ring-[#001A30]/10"
                        : "bg-white/50 border-slate-200 hover:border-slate-300 hover:bg-white",
                      hoveredType === loc.type && "ring-2 ring-[#FFB800]/50 bg-[#FFB800]/5",
                      isF1Circuit && "border-[#E10600]/30 bg-gradient-to-br from-[#001A30]/5 to-[#E10600]/5",
                      isImagineDragons && "border-purple-400/40 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50"
                    )}
                  >
                    {/* MV1 Racing Stripe for F1 Circuit */}
                    {isF1Circuit && (
                      <>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E10600] via-[#FFB800] to-[#001A30] opacity-80" />
                        <div className="absolute top-0 right-0 w-20 h-20 opacity-5 pointer-events-none">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="60" fontWeight="900" fill="#001A30" fontStyle="italic">
                              #1
                            </text>
                          </svg>
                        </div>
                      </>
                    )}

                    {/* Imagine Dragons Concert Styling */}
                    {isImagineDragons && (
                      <>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 opacity-80" />
                        <div className="absolute inset-0 opacity-5 pointer-events-none">
                          <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                            <path d="M0,50 Q25,20 50,50 T100,50 T150,50 T200,50" stroke="url(#gradient)" strokeWidth="2" fill="none" />
                            <path d="M0,50 Q25,80 50,50 T100,50 T150,50 T200,50" stroke="url(#gradient)" strokeWidth="2" fill="none" />
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#9333ea" />
                                <stop offset="50%" stopColor="#ec4899" />
                                <stop offset="100%" stopColor="#f97316" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                        {/* Music note watermark */}
                        <div className="absolute bottom-2 right-2 opacity-10 pointer-events-none">
                          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                      </>
                    )}
                    <div className="flex gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${TYPE_COLORS[loc.type]}15`, color: TYPE_COLORS[loc.type] }}
                      >
                        <TypeIcon type={loc.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-slate-900 truncate pr-4">{loc.name}</h3>
                          {loc.time && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-[#E10600] bg-[#E10600]/10 px-2 py-0.5 rounded-full uppercase">
                              <Clock size={10} />
                              {loc.time}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mb-2">
                          <Flag size={14} className="shrink-0 text-slate-400" />
                          <span className="truncate">{loc.address}</span>
                        </p>
                        {loc.description && (
                          <p className="text-xs text-slate-400 italic">
                            {loc.description}
                          </p>
                        )}
                        {isF1Circuit && (
                          <div className="mt-3">
                            <MV1Badge variant="compact" animated={false} />
                          </div>
                        )}
                        {isImagineDragons && (
                          <div className="mt-3">
                            <ImagineDragonsBadge variant="compact" animated={false} />
                          </div>
                        )}
                      </div>
                      {loc.url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(loc.url, '_blank', 'noopener,noreferrer');
                          }}
                          className="flex items-center text-slate-300 hover:text-[#E10600] transition-colors"
                          aria-label={t('app.openLink')}
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}
                    </div>
                    {/* MV1 Badge for F1 Circuit */}
                    {isF1Circuit && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-black bg-[#001A30] text-[#FFB800] px-2 py-1 rounded-md italic transform -skew-x-12 opacity-70 group-hover:opacity-100 transition-opacity">
                        <Flag size={10} className="skew-x-12" />
                        <span className="skew-x-12">MV33</span>
                      </div>
                    )}

                    {/* Imagine Dragons Badge */}
                    {isImagineDragons && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-black bg-gradient-to-r from-purple-600 to-pink-500 text-white px-2 py-1 rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
                        <Music size={10} />
                        <span>LIVE</span>
                      </div>
                    )}
                  </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Map */}
        <div className={cn(
          "md:col-span-7 lg:col-span-8 h-full",
          viewMode === 'list' && "hidden md:block"
        )}>
          <MapComponent
            locations={allLocations}
            selectedLocationId={selectedLocationId}
            onMarkerClick={(loc) => setSelectedLocationId(loc.id)}
            onHoverType={setHoveredType}
            hoveredType={hoveredType}
          />
        </div>
      </main>
{/* MV1 Floating Button - temporarily disabled */}
{/*
<motion.button disabled />
*/}
      {/* </motion.button> */}

      {/* MV1 Info Card Overlay */}
      <AnimatePresence>
        {showMV1Card && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowMV1Card(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <MV1InfoCard onClose={() => setShowMV1Card(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RoseModal isOpen={showRoseModal} onClose={() => setShowRoseModal(false)} />
    </motion.div>
    </>
  );
}
