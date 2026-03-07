import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Flag, ArrowRight, Zap } from 'lucide-react';

import bgImage from '../img/IMG_9596.jpg';
import f1EngineSound from '../audio/f1-engine.mp3';
import ParticleBackground from './ParticleBackground';

const StartLights = ({ progress, isPressing }: { progress: number, isPressing: boolean }) => {
  if (!isPressing && progress === 0) return null;

  const isGreen = progress >= 100;
  const lightsOn = isGreen ? 5 : Math.ceil(progress / 20);

  return (
    <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 sm:gap-2.5 p-2.5 sm:p-3 bg-[#001A30]/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in fade-in duration-300">
      {[...Array(5)].map((_, i) => {
        const isOn = i < lightsOn;
        const colorClass = isGreen
          ? 'bg-[#22c55e] shadow-[0_0_20px_#22c55e,0_0_40px_#22c55e]'
          : 'bg-[#E10600] shadow-[0_0_20px_#E10600,0_0_40px_#E10600]';

        return (
          <div key={i} className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-black/90 rounded-xl border border-white/5 shadow-inner">
             <div className={`w-4 h-4 sm:w-8 sm:h-8 rounded-full transition-all duration-75 ${isOn ? colorClass : 'bg-white/5'}`} />
             <div className={`w-4 h-4 sm:w-8 sm:h-8 rounded-full transition-all duration-75 ${isOn ? colorClass : 'bg-white/5'}`} />
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
        <rect x="10" y="15" width="20" height="5" fill="#001A30" />
        <rect x="15" y="20" width="5" height="15" fill="#001A30" />
        <path d="M20 35 L60 25 L120 25 L150 15 L180 30 L210 35 L230 40 L230 45 L10 45 Z" fill="#001A30"/>
        <path d="M60 25 L120 25 L150 15 L200 30" stroke="#FFB800" strokeWidth="3" fill="none"/>
        <path d="M30 35 L120 30 L160 20 L210 35" stroke="#E10600" strokeWidth="2" fill="none"/>
        <path d="M120 25 C130 15 140 15 150 25" stroke="#001A30" strokeWidth="3" fill="none"/>
        <path d="M210 40 L235 40 L235 45 L210 45 Z" fill="#E10600"/>
        <circle cx="45" cy="45" r="14" fill="#111"/>
        <circle cx="45" cy="45" r="7" fill="#222"/>
        <circle cx="45" cy="45" r="3" fill="#E10600"/>
        <circle cx="185" cy="45" r="14" fill="#111"/>
        <circle cx="185" cy="45" r="7" fill="#222"/>
        <circle cx="185" cy="45" r="3" fill="#E10600"/>
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
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden font-sans"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-[#001A30]/80 mix-blend-multiply" />

      {/* Background Animated Elements - Red Bull Colors (Navy, Red, Yellow) */}
      <div className="absolute inset-0 w-full h-full opacity-60">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_#E10600_0%,_transparent_50%)]" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_#FFB800_0%,_transparent_50%)]" />
      </div>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 w-full h-full"
           style={{
             backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(3)',
             transformOrigin: 'top center',
             opacity: 0.5
           }}
      />

      {/* Three.js Particle Background */}
      <ParticleBackground isPressing={isPressing} progress={progress} audioRef={audioRef} />

      {/* F1 Elements */}
      <StartLights progress={progress} isPressing={isPressing} />
      <F1Car progress={progress} />

      {/* Main Content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center p-8 text-center max-w-4xl transition-all duration-300"
      >

        {/* Intro Tag */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm bg-[#E10600] text-white text-sm font-bold tracking-[0.2em] mb-8 shadow-[0_0_15px_rgba(225,6,0,0.5)] transform -skew-x-12"
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
          {/* Glitch sub-layer */}
          <h1 className="absolute -left-1 -top-1 text-5xl md:text-8xl font-black text-[#E10600] tracking-tighter uppercase opacity-50 blur-[2px]">
            Ready to Race
          </h1>
          <h1 className="absolute -right-1 -bottom-1 text-5xl md:text-8xl font-black text-[#FFB800] tracking-tighter uppercase opacity-50 blur-[2px]">
            Ready to Race
          </h1>

          <h1 className="relative text-5xl md:text-8xl font-black text-white tracking-tighter uppercase drop-shadow-2xl italic">
            Ready To <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E10600] to-[#FFB800]">Race</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.div
           initial={{ y: 30, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
           className="mt-6 mb-12 flex flex-col items-center gap-2"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-wide uppercase">
            欢迎开启上海狂欢周末
          </h2>
          <p className="text-[#A0AAB4] text-lg font-medium tracking-wide mt-2">
          引擎轰鸣碰撞摇滚风暴，一场魔都竞速与梦龙狂欢的探索之旅。
          </p>
        </motion.div>

        {/* Enter Button */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2, ease: "backOut" }}
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
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 bg-[#FFB800] text-[#001A30] font-black text-xl uppercase tracking-wider transform -skew-x-12 transition-all hover:bg-white hover:scale-105 hover:shadow-[0_0_30px_rgba(255,184,0,0.6)] active:scale-95 overflow-hidden select-none touch-none"
          >
            {/* Progress Bar Background */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#E10600] z-0 transition-all duration-75 ease-linear pointer-events-none"
              style={{ width: `${progress}%` }}
            />

            <span className={`relative z-10 flex items-center gap-2 skew-x-12 ${isPressing || progress > 0 ? 'text-white' : ''}`}>
              <Zap size={20} className={isPressing || progress > 0 ? "fill-white" : "fill-[#001A30]"} />
              <span className="block">
                {isPressing ? `ENGINE STARTING ${progress}%` : "HOLD TO START"}
              </span>
              <motion.span
                animate={{ x: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <ArrowRight size={24} strokeWidth={3} />
              </motion.span>
            </span>
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-12 group-hover:animate-[shimmer_1s_infinite] pointer-events-none" />
          </button>
          {/* Hidden Audio Element for better browser compatibility */}
          <audio ref={audioRef} src={f1EngineSound} preload="auto" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-8 text-xs text-white/30 font-mono"
        >
          // MAX VERSTAPPEN #1 // ORACLE RED BULL RACING
        </motion.p>
      </div>
    </div>
  );
};

export default WelcomePage;
