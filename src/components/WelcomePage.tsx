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
    <div className="absolute top-8 sm:top-12 md:top-16 landscape:top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 sm:gap-4 md:gap-6 landscape:gap-2 p-2 sm:p-5 landscape:p-2 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in duration-300">
      {[...Array(5)].map((_, i) => {
        const isOn = i < lightsOn;
        const colorClass = isGreen
          ? 'bg-[#22c55e] shadow-[0_0_30px_#22c55e,0_0_60px_#22c55e]'
          : 'bg-[#E10600] shadow-[0_0_25px_#E10600,0_0_50px_#E10600]';

        return (
          <div key={i} className="flex flex-col gap-1.5 sm:gap-3 landscape:gap-1 p-1 sm:p-2.5 landscape:p-1 bg-[#1a1a1a] rounded-lg border border-white/5 shadow-inner">
             <div className={`w-6 h-6 sm:w-10 sm:h-10 md:w-14 md:h-14 landscape:w-5 landscape:h-5 rounded-full transition-all duration-75 ${isOn ? colorClass : 'bg-white/5'}`} />
             <div className={`w-6 h-6 sm:w-10 sm:h-10 md:w-14 md:h-14 landscape:w-5 landscape:h-5 rounded-full transition-all duration-75 ${isOn ? colorClass : 'bg-white/5'}`} />
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
      initial={{ x: '-150vw', opacity: 0 }}
      animate={{ x: '250vw', opacity: 1 }}
      transition={{ duration: 1.2, ease: "linear" }}
      className="absolute top-[45%] -translate-y-1/2 z-[60] pointer-events-none"
    >
      <div className="relative scale-[2] sm:scale-[4] md:scale-[5]">
        <svg width="240" height="60" viewBox="0 0 240 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_15px_rgba(225,6,0,0.4)]">
          {/* Exhaust Flame */}
          <motion.path
            animate={{ scaleX: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 0.1 }}
            d="M5 30 L-30 25 L-20 30 L-30 35 Z" fill="url(#flameGradient)"
          />
          <defs>
            <linearGradient id="flameGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFB800" />
              <stop offset="100%" stopColor="#E10600" />
            </linearGradient>
          </defs>

          {/* Rear Wing Structure */}
          <path d="M15 10 L35 10 L35 15 L15 15 Z" fill="#001A30" />
          <path d="M22 15 L22 35 L28 35 L28 15 Z" fill="#001A30" />
          <path d="M12 10 L15 35 L35 35 L38 10 Z" fill="#E10600" opacity="0.9" />

          {/* Chassis (Red Bull Navy) */}
          <path d="M25 35
                   C 40 35, 60 22, 100 22
                   L 150 12 L 180 28 L 220 35
                   L 235 42 L 235 48 L 20 48
                   Z" fill="#001A30" />

          {/* Air Intake & Engine Cover */}
          <path d="M100 22 C 115 12, 135 12, 150 22" fill="#001A30" stroke="#FFB800" strokeWidth="1" />

          {/* Yellow Engine Cover Accent (The Bull area) */}
          <path d="M110 23 L 145 23 L 140 32 L 115 32 Z" fill="#FFB800" />

          {/* Red Bull Text Placeholder (Red lines) */}
          <rect x="70" y="38" width="40" height="2" fill="#E10600" />

          {/* Front Wing */}
          <path d="M210 38 L 240 38 L 240 48 L 210 48 Z" fill="#001A30" />
          <path d="M215 40 L 240 40 L 240 43 L 215 43 Z" fill="#E10600" />
          <path d="M220 36 L 235 36 L 230 39 L 225 39 Z" fill="#FFB800" />

          {/* Halo */}
          <path d="M135 21 L 160 21 L 165 28" stroke="#000" strokeWidth="2" fill="none" />

          {/* Wheels (Larger, more dramatic) */}
          <circle cx="50" cy="45" r="15" fill="#111" />
          <circle cx="50" cy="45" r="8" fill="#181818" stroke="#333" strokeWidth="1" />
          <circle cx="50" cy="45" r="3" fill="#FFC107" />

          <circle cx="195" cy="45" r="14" fill="#111" />
          <circle cx="195" cy="45" r="7" fill="#181818" stroke="#333" strokeWidth="1" />
          <circle cx="195" cy="45" r="3" fill="#FFC107" />

          {/* Verstappen #1 */}
          <text x="118" y="30" fill="#001A30" fontSize="8" fontWeight="950" fontStyle="italic" fontFamily="Arial">1</text>

          {/* High speed motion lines */}
          <g opacity="0.6">
            <line x1="-10" y1="20" x2="-80" y2="20" stroke="#fff" strokeWidth="1" />
            <line x1="-30" y1="40" x2="-120" y2="40" stroke="#FFB800" strokeWidth="1.5" />
            <line x1="-20" y1="50" x2="-100" y2="50" stroke="#E10600" strokeWidth="1" />
          </g>
        </svg>
      </div>
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
      }, 1500);
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

      {/* Main Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-8 pointer-events-none overflow-hidden">
        <div className="flex flex-col items-center justify-center text-center max-w-4xl w-full transition-all duration-300 pointer-events-auto"
        >
          {/* Tag */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            onClick={handleTagClick}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-sm bg-[#E10600] text-white text-xs sm:text-sm font-bold tracking-[0.15em] sm:tracking-[0.2em] mb-4 sm:mb-8 shadow-[0_0_15px_rgba(225,6,0,0.5)] transform -skew-x-12 cursor-pointer active:scale-95 transition-transform"
          >
            <Flag size={14} className="skew-x-12" />
            <span className="skew-x-12">RACE WEEKEND</span>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="relative"
          >
            <h1 className="absolute -left-1 -top-1 text-4xl sm:text-6xl md:text-8xl landscape:text-5xl font-black text-[#E10600] tracking-tighter uppercase opacity-50 blur-[2px]">
              Ready to Race
            </h1>
            <h1 className="absolute -right-1 -bottom-1 text-4xl sm:text-6xl md:text-8xl landscape:text-5xl font-black text-[#FFB800] tracking-tighter uppercase opacity-50 blur-[2px]">
              Ready to Race
            </h1>
            <h1 className="relative text-4xl sm:text-6xl md:text-8xl landscape:text-5xl font-black text-white tracking-tighter uppercase drop-shadow-2xl italic">
              Ready To <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E10600] to-[#FFB800]">Race</span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.div
             initial={{ y: 30, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
             className="mt-4 mb-8 sm:mt-6 sm:mb-12 landscape:mt-2 landscape:mb-6 flex flex-col items-center gap-1 sm:gap-2"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl landscape:text-2xl font-bold text-white tracking-wide uppercase">
              欢迎开启上海狂欢周末
            </h2>
            <p className="text-[#A0AAB4] text-sm sm:text-base md:text-lg landscape:text-sm font-medium tracking-wide mt-1 sm:mt-2 landscape:mt-0 px-4">
              引擎轰鸣碰撞摇滚风暴，一场魔都竞速与梦龙狂欢的探索之旅。
            </p>
          </motion.div>

          {/* Button */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2, ease: "backOut" }}
            className="mb-6 sm:mb-0 landscape:mb-4"
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
              className="group relative inline-flex items-center justify-center gap-2 sm:gap-3 px-8 sm:px-12 py-3 sm:py-5 bg-[#FFB800] text-[#001A30] font-black text-lg sm:text-2xl landscape:text-xl uppercase tracking-wider transform -skew-x-12 transition-all hover:bg-white hover:scale-105 active:scale-95 overflow-hidden select-none touch-none shadow-[0_0_20px_rgba(255,184,0,0.4)]"
            >
              <div className="absolute left-0 top-0 bottom-0 bg-[#E10600] z-0 transition-[width] duration-75 ease-linear pointer-events-none" style={{ width: `${progress}%` }} />
              <span className={`relative z-10 flex items-center gap-2 skew-x-12 ${isPressing || progress > 0 ? 'text-white' : ''}`}>
                <Zap size={20} className={isPressing || progress > 0 ? "fill-white" : "fill-[#001A30]"} />
                <span className="block">{isPressing ? `ENGINE STARTING ${progress}%` : "HOLD TO START"}</span>
                <motion.span animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1 }}><ArrowRight size={24} strokeWidth={3} /></motion.span>
              </span>
            </button>
            <audio ref={audioRef} src={f1EngineSound} preload="auto" />
          </motion.div>

          {/* Glitch Overlay & Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="mt-4 sm:mt-12 flex flex-col items-center justify-center pointer-events-none gap-3"
          >
            <div className="relative flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold tracking-[0.15em] sm:tracking-[0.2em] transform -skew-x-12">
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
              className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4"
            >
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#FFB800] animate-pulse" /><span>4x World Champion</span></div>
              <div className="w-px h-3 bg-slate-600 hidden sm:block" />
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#E10600] animate-pulse" style={{ animationDelay: '0.5s' }} /><span>71 Wins</span></div>
              <div className="w-px h-3 bg-slate-600 hidden sm:block" />
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#001A30] animate-pulse" style={{ animationDelay: '1s' }} /><span>48 Pole Positions</span></div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
