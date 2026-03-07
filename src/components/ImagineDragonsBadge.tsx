import React from 'react';
import { motion } from 'motion/react';
import { Music, Radio, Mic2 } from 'lucide-react';

interface ImagineDragonsBadgeProps {
  variant?: 'compact' | 'full';
  animated?: boolean;
}

const ImagineDragonsBadge: React.FC<ImagineDragonsBadgeProps> = ({
  variant = 'compact',
  animated = true
}) => {
  if (variant === 'compact') {
    return (
      <motion.div
        initial={animated ? { scale: 0, rotate: -10 } : false}
        animate={animated ? { scale: 1, rotate: 0 } : false}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white text-xs font-black rounded-md shadow-lg border border-white/20"
      >
        <Music size={12} className="animate-pulse" />
        <span className="tracking-wider">IMAGINE DRAGONS</span>
        <Radio size={12} className="animate-pulse" style={{ animationDelay: '0.5s' }} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={animated ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative p-4 bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 rounded-xl shadow-2xl border border-purple-400/30 overflow-hidden"
    >
      {/* Sound wave background */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
          <motion.path
            d="M0,50 Q25,20 50,50 T100,50 T150,50 T200,50"
            stroke="white"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M0,50 Q25,80 50,50 T100,50 T150,50 T200,50"
            stroke="white"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.5 }}
          />
        </svg>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center shadow-lg"
            animate={{
              boxShadow: [
                '0 0 20px rgba(168, 85, 247, 0.5)',
                '0 0 40px rgba(236, 72, 153, 0.8)',
                '0 0 20px rgba(168, 85, 247, 0.5)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Mic2 size={24} className="text-white" />
          </motion.div>
          <div>
            <div className="text-purple-300 text-xs font-bold tracking-widest uppercase">
              LOOM World Tour 2026
            </div>
            <div className="text-white text-lg font-black tracking-tight">
              IMAGINE DRAGONS
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Music size={24} className="text-pink-400" />
          <span className="text-[10px] text-white/60 font-bold">LIVE</span>
        </div>
      </div>
    </motion.div>
  );
};

export default ImagineDragonsBadge;
