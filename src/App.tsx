import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  List as ListIcon
} from 'lucide-react';
import { ITINERARY_DATA, Location, TYPE_COLORS } from './constants';
import MapComponent from './components/MapComponent';
import { cn } from './lib/utils';

const TypeIcon = ({ type, className }: { type: Location['type'], className?: string }) => {
  switch (type) {
    case 'sports': return <Trophy className={className} />;
    case 'hotel': return <Hotel className={className} />;
    case 'museum': return <Palette className={className} />;
    case 'theatre': return <Ticket className={className} />;
    case 'cafe': return <Coffee className={className} />;
    default: return <MapPin className={className} />;
  }
};

export default function App() {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); // For mobile toggle
  const [hoveredType, setHoveredType] = useState<Location['type'] | null>(null);

  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const allLocations = useMemo(() => ITINERARY_DATA.flatMap(d => d.locations), []);
  const currentDay = ITINERARY_DATA[selectedDayIdx];

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
    setSelectedLocationId(loc.id);
    if (window.innerWidth < 768) {
      setViewMode('map');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-bottom border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <MapPin size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">上海周末行程</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">2026.03.13 - 03.14</p>
            </div>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'list' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"
              )}
            >
              <ListIcon size={20} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'map' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"
              )}
            >
              <MapIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-88px)]">
        {/* Left Column: Itinerary */}
        <div className={cn(
          "md:col-span-5 lg:col-span-4 flex flex-col gap-6 overflow-hidden",
          viewMode === 'map' && "hidden md:flex"
        )}>
          {/* Day Selector */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            {ITINERARY_DATA.map((day, idx) => (
              <button
                key={day.date}
                onClick={() => {
                  setSelectedDayIdx(idx);
                  setSelectedLocationId(undefined);
                }}
                className={cn(
                  "flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex flex-col items-center gap-1",
                  selectedDayIdx === idx
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <span className="text-xs opacity-60">DAY {idx + 1}</span>
                <span className="text-sm">{day.date.split('-').slice(1).join('.')}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar scroll-smooth">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDayIdx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {currentDay.locations.map((loc, idx) => (
                  <motion.div
                    key={loc.id}
                    ref={el => { itemRefs.current[loc.id] = el; }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleLocationClick(loc)}
                    className={cn(
                      "group relative p-5 rounded-2xl border transition-all cursor-pointer",
                      selectedLocationId === loc.id
                        ? "bg-white border-indigo-200 shadow-xl shadow-indigo-50 ring-1 ring-indigo-100"
                        : "bg-white/50 border-slate-200 hover:border-slate-300 hover:bg-white",
                      hoveredType === loc.type && "ring-2 ring-indigo-400/30 bg-indigo-50/30"
                    )}
                  >
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
                            <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                              <Clock size={10} />
                              {loc.time}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mb-2">
                          <MapPin size={14} className="shrink-0" />
                          <span className="truncate">{loc.address}</span>
                        </p>
                        {loc.description && (
                          <p className="text-xs text-slate-400 italic">
                            {loc.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center text-slate-300 group-hover:text-indigo-400 transition-colors">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </motion.div>
                ))}
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

    </div>
  );
}
