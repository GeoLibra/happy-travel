import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Flag, ArrowRight, Zap } from 'lucide-react';

import bgImage from '../img/IMG_9596.jpg';
import f1EngineSound from '../audio/f1-engine.mp3';

interface WelcomeProps {
  onEnter: () => void;
}

const WelcomePage: React.FC<WelcomeProps> = ({ onEnter }) => {
  const [mounted, setMounted] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden font-sans"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
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

      {/* Speed Lines */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 bg-white/20 rounded-full"
          initial={{
            left: '-10%',
            top: `${Math.random() * 100}%`,
            width: Math.random() * 200 + 50,
            opacity: 0,
          }}
          animate={{
            left: '110%',
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 2 + 1,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "linear"
          }}
        />
      ))}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center max-w-4xl">

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
            onClick={onEnter}
            onMouseEnter={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.volume = 0.8;
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.catch(() => {
                    // Ignore autoplay errors quietly
                  });
                }
              }
            }}
            onMouseLeave={() => {
               if (audioRef.current) {
                   audioRef.current.pause();
                   audioRef.current.currentTime = 0;
               }
            }}
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 bg-[#FFB800] text-[#001A30] font-black text-xl uppercase tracking-wider transform -skew-x-12 transition-all hover:bg-white hover:scale-105 hover:shadow-[0_0_30px_rgba(255,184,0,0.6)] active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2 skew-x-12">
              <Zap size={20} className="fill-[#001A30]" />
              <span className="block group-hover:hidden">启动引擎 ENGINE START</span>
              <span className="hidden group-hover:block">唤醒狂欢 AWAKEN THE ROAR</span>
              <motion.span
                animate={{ x: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <ArrowRight size={24} strokeWidth={3} />
              </motion.span>
            </span>
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-12 group-hover:animate-[shimmer_1s_infinite]" />
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
