import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, ArrowRight, Zap, Trophy } from 'lucide-react';

import bgImage from '../img/IMG_9596.jpg';
import f1EngineSound from '../audio/f1-engine.mp3';
import ParticleBackground from './ParticleBackground';

const StartLights = ({ progress, isPressing }: { progress: number, isPressing: boolean }) => {
  if (!isPressing && progress === 0) return null;

  const isGreen = progress >= 100;
  const lightsOn = isGreen ? 5 : Math.ceil(progress / 20);

  return (
    <div className="absolute top-12 sm:top-4 md:top-6 landscape:top-2 left-1/2 -translate-x-1/2 z-50 flex gap-1 sm:gap-1.5 md:gap-2.5 p-1.5 sm:p-2.5 md:p-3 landscape:p-1.5 bg-[#001A30]/80 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in fade-in duration-300">
      {[...Array(5)].map((_, i) => {
        const isOn = i < lightsOn;
        const colorClass = isGreen
          ? 'bg-[#22c55e] shadow-[0_0_20px_#22c55e,0_0_40px_#22c55e]'
          : 'bg-[#E10600] shadow-[0_0_20px_#E10600,0_0_40px_#E10600]';

        return (
          <div key={i} className="flex flex-col gap-1 sm:gap-1.5 md:gap-2 landscape:gap-1 p-1 sm:p-1.5 md:p-2 landscape:p-1 bg-black/90 rounded-lg sm:rounded-xl border border-white/5 shadow-inner">
             <div className={`w-3 h-3 sm:w-4 sm:h-4 md:w-8 md:h-8 landscape:w-3 landscape:h-3 rounded-full transition-all duration-75 ${isOn ? colorClass : 'bg-white/5'}`} />
             <div className={`w-3 h-3 sm:w-4 sm:h-4 md:w-8 md:h-8 landscape:w-3 landscape:h-3 rounded-full transition-all duration-75 ${isOn ? colorClass : 'bg-white/5'}`} />
          </div>
        )
      })}
    </div>
  );
};

const F1Car = ({ progress }: { progress: number }) => {
  if (progress < 100) return null;

  return (
    <motion.div
      initial={{ x: '-50vw', opacity: 0 }}
      animate={{ x: '150vw', opacity: 1 }}
      transition={{ duration: 0.6, ease: "linear" }}
      className="absolute top-[40%] -translate-y-1/2 z-[60] pointer-events-none scale-[1.5] sm:scale-[2.5]"
    >
      <svg width="240" height="60" viewBox="0 0 240 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Rear Wing */}
        <rect x="10" y="15" width="20" height="5" fill="#001A30" />
        <rect x="15" y="20" width="5" height="15" fill="#001A30" />
        <path d="M10 20 L25 20 L25 35 L10 35 Z" fill="#E10600" /> {/* Red rear wing accent */}

        {/* Main Body (Red Bull Navy) */}
        <path d="M20 35 L60 25 L120 25 L150 15 L180 30 L210 35 L230 40 L230 45 L10 45 Z" fill="#001A30"/>

        {/* Yellow/Red Bull Livery Stripes */}
        <path d="M60 25 L120 25 L150 15 L200 30" stroke="#FFB800" strokeWidth="3" fill="none"/>
        <path d="M30 35 L120 30 L160 20 L210 35" stroke="#E10600" strokeWidth="2" fill="none"/>
        <path d="M120 25 C130 15 140 15 150 25" stroke="#001A30" strokeWidth="3" fill="none"/>

        {/* Front Wing */}
        <path d="M210 38 L235 38 L235 45 L210 45 Z" fill="#001A30"/>
        <path d="M210 40 L235 40 L235 43 L210 43 Z" fill="#E10600"/> {/* Red lip */}
        <path d="M210 35 L225 35 L225 38 L210 38 Z" fill="#FFB800"/> {/* Yellow upper element */}

        {/* Halo & Cockpit */}
        <path d="M100 25 Q130 15 150 25" stroke="#000" strokeWidth="2" fill="none" />
        <circle cx="130" cy="22" r="4" fill="#E10600" /> {/* Driver helmet dot */}

        {/* Wheels */}
        <circle cx="45" cy="45" r="14" fill="#111"/>
        <circle cx="45" cy="45" r="7" fill="#222"/>
        <circle cx="45" cy="45" r="3" fill="#FFB800"/> {/* Yellow wheel nut */}
        <circle cx="185" cy="45" r="14" fill="#111"/>
        <circle cx="185" cy="45" r="7" fill="#222"/>
        <circle cx="185" cy="45" r="3" fill="#FFB800"/> {/* Yellow wheel nut */}

        {/* Number 1 Decal */}
        <text x="85" y="32" fill="#E10600" fontSize="11" fontWeight="900" fontFamily="sans-serif" fontStyle="italic">#1</text>

        {/* Speed Lines (Red/Yellow/White) */}
        <line x1="0" y1="20" x2="-60" y2="20" stroke="#fff" strokeWidth="2" strokeOpacity="0.6"/>
        <line x1="10" y1="35" x2="-80" y2="35" stroke="#fff" strokeWidth="2" strokeOpacity="0.4"/>
        <line x1="5" y1="50" x2="-40" y2="50" stroke="#fff" strokeWidth="2" strokeOpacity="0.8"/>
        <line x1="-20" y1="25" x2="-100" y2="25" stroke="#FFB800" strokeWidth="2" strokeOpacity="0.8"/>
        <line x1="-10" y1="40" x2="-70" y2="40" stroke="#E10600" strokeWidth="2" strokeOpacity="0.8"/>
      </svg>
    </motion.div>
  );
};

interface WelcomeProps {
  onEnter: () => void;
}

const WelcomePage: React.FC<WelcomeProps> = ({ onEnter }) => {
  const [mounted, setMounted] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [simplyLovely, setSimplyLovely] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleTagClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 3) {
      setSimplyLovely(true);
      setTimeout(() => {
        setSimplyLovely(false);
        setClickCount(0);
      }, 3000);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPressing) {

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 100;
          return prev + 1;
        });
      }, 50); // 5s total duration
    } else {
      setProgress(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    return () => clearInterval(interval);
  }, [isPressing]);

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        onEnter();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [progress, onEnter]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden font-sans"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-[#001A30]/80 mix-blend-multiply" />

      {/* Background Animated Elements */}
      <div className="absolute inset-0 w-full h-full opacity-60 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_#E10600_0%,_transparent_50%)]" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_#FFB800_0%,_transparent_50%)]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 w-full h-full pointer-events-none"
           style={{
             backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(3)',
             transformOrigin: 'top center',
             opacity: 0.5
           }}
      />

      <ParticleBackground isPressing={isPressing} progress={progress} audioRef={audioRef} />

      <StartLights progress={progress} isPressing={isPressing} />
      <F1Car progress={progress} />

      {/* Simply Lovely Easter Egg */}
      <AnimatePresence>
        {simplyLovely && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: -100 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="bg-[#FFB800] p-8 rounded-3xl shadow-[0_0_50px_rgba(255,184,0,0.5)] border-4 border-white transform -skew-x-12">
              <div className="text-[#001A30] text-5xl font-black italic mb-2 tracking-tighter skew-x-12">SIMPLY LOVELY!</div>
              <div className="flex justify-center skew-x-12">
                <Trophy size={60} className="text-[#001A30] fill-[#001A30]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content with dynamic scaling for short screens */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-safe pointer-events-none overflow-y-auto">
        <div className="flex flex-col items-center justify-center text-center max-w-4xl w-full transition-all duration-300 pointer-events-auto py-20 sm:py-8 landscape:py-4 landscape:gap-1"
        >
          {/* Tag */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            onClick={handleTagClick}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-sm bg-[#E10600] text-white text-xs sm:text-sm font-bold tracking-[0.15em] sm:tracking-[0.2em] mb-4 sm:mb-6 md:mb-8 landscape:mb-2 shadow-[0_0_15px_rgba(225,6,0,0.5)] transform -skew-x-12 cursor-pointer active:scale-95 transition-transform mt-16 sm:mt-0 landscape:mt-8"
          >
            <Flag size={12} className="skew-x-12 sm:hidden" />
            <Flag size={14} className="skew-x-12 hidden sm:block" />
            <span className="skew-x-12">RACE WEEKEND</span>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="relative"
          >
            <h1 className="absolute -left-1 -top-1 text-4xl sm:text-5xl md:text-8xl landscape:text-3xl font-black text-[#E10600] tracking-tighter uppercase opacity-50 blur-[2px]">
              Ready to Race
            </h1>
            <h1 className="absolute -right-1 -bottom-1 text-4xl sm:text-5xl md:text-8xl landscape:text-3xl font-black text-[#FFB800] tracking-tighter uppercase opacity-50 blur-[2px]">
              Ready to Race
            </h1>
            <h1 className="relative text-4xl sm:text-5xl md:text-8xl landscape:text-3xl font-black text-white tracking-tighter uppercase drop-shadow-2xl italic">
              Ready To <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E10600] to-[#FFB800]">Race</span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.div
             initial={{ y: 30, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
             className="mt-3 mb-6 sm:mt-4 sm:mb-8 md:mt-6 md:mb-12 landscape:mt-2 landscape:mb-3 flex flex-col items-center gap-1 sm:gap-2"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl landscape:text-lg font-bold text-white tracking-wide uppercase">
              欢迎开启上海狂欢周末
            </h2>
            <p className="text-[#A0AAB4] text-sm sm:text-base md:text-lg landscape:text-xs font-medium tracking-wide mt-1 sm:mt-2 landscape:mt-0 px-4 whitespace-nowrap">
              引擎轰鸣碰撞摇滚风暴，一场魔都竞速与梦龙狂欢的探索之旅。
            </p>
          </motion.div>

          {/* Button */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2, ease: "backOut" }}
            className="mb-4 sm:mb-0 landscape:mb-2"
          >
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                setIsPressing(true);
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.volume = 0.8;
                  audioRef.current.play().catch(() => {});
                }
              }}
              onPointerUp={() => setIsPressing(false)}
              onPointerLeave={() => setIsPressing(false)}
              onContextMenu={(e) => e.preventDefault()}
              className="group relative inline-flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-10 landscape:px-6 py-3 sm:py-4 landscape:py-2 bg-[#FFB800] text-[#001A30] font-black text-base sm:text-xl landscape:text-sm uppercase tracking-wider transform -skew-x-12 transition-all hover:bg-white hover:scale-105 active:scale-95 overflow-hidden select-none touch-none"
            >
              <div className="absolute left-0 top-0 bottom-0 bg-[#E10600] z-0 transition-[width] duration-75 ease-linear pointer-events-none" style={{ width: `${progress}%` }} />
              <span className={`relative z-10 flex items-center gap-2 skew-x-12 ${isPressing || progress > 0 ? 'text-white' : ''}`}>
                <Zap size={16} className={`sm:w-5 sm:h-5 landscape:w-4 landscape:h-4 ${isPressing || progress > 0 ? "fill-white" : "fill-[#001A30]"}`} />
                <span className="block text-sm sm:text-xl landscape:text-sm">{isPressing ? `ENGINE STARTING ${progress}%` : "HOLD TO START"}</span>
                <motion.span animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1 }}><ArrowRight size={20} strokeWidth={3} className="sm:w-6 sm:h-6 landscape:w-5 landscape:h-5" /></motion.span>
              </span>
            </button>
            <audio ref={audioRef} src={f1EngineSound} preload="auto" />
          </motion.div>

          {/* Glitch Overlay & Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="mt-4 sm:mt-6 md:mt-12 landscape:mt-2 flex flex-col items-center justify-center pointer-events-none gap-2 sm:gap-3 landscape:gap-1"
          >
            <div className="relative flex items-center justify-center text-[9px] sm:text-xs landscape:text-[8px] font-mono font-bold tracking-[0.15em] sm:tracking-[0.2em] landscape:tracking-[0.1em] transform -skew-x-12 px-2">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-[#FFB800]">
                // MAX VERSTAPPEN #1 // ORACLE RED BULL RACING
              </span>
              <span className="absolute left-[1px] top-0 z-0 text-[#E10600] opacity-70 animate-[glitch_3s_infinite_linear_alternate-reverse] mix-blend-screen whitespace-nowrap">
                // MAX VERSTAPPEN #1 // ORACLE RED BULL RACING
              </span>
              <span className="absolute -left-[1px] top-0 z-0 text-[#001A30] opacity-80 animate-[glitch_2s_infinite_linear_alternate] mix-blend-screen whitespace-nowrap">
                // MAX VERSTAPPEN #1 // ORACLE RED BULL RACING
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 landscape:gap-2 text-[9px] sm:text-[10px] landscape:text-[8px] font-bold text-slate-400 uppercase tracking-widest px-4"
            >
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 landscape:w-1.5 landscape:h-1.5 rounded-full bg-[#FFB800] animate-pulse" /><span>4x World Champion</span></div>
              <div className="w-px h-2 sm:h-3 landscape:h-2 bg-slate-600 hidden sm:block" />
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 landscape:w-1.5 landscape:h-1.5 rounded-full bg-[#E10600] animate-pulse" style={{ animationDelay: '0.5s' }} /><span>71 Wins</span></div>
              <div className="w-px h-2 sm:h-3 landscape:h-2 bg-slate-600 hidden sm:block" />
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 landscape:w-1.5 landscape:h-1.5 rounded-full bg-[#001A30] animate-pulse" style={{ animationDelay: '1s' }} /><span>48 Pole Positions</span></div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
