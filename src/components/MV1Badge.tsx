import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Flag } from 'lucide-react';

interface MV1BadgeProps {
  variant?: 'compact' | 'full';
  animated?: boolean;
}

const MV1Badge: React.FC<MV1BadgeProps> = ({ variant = 'compact', animated = true }) => {
  if (variant === 'compact') {
    return (
      <motion.div
        initial={animated ? { scale: 0, rotate: -180 } : false}
        animate={animated ? { scale: 1, rotate: 0 } : false}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-[#001A30] to-[#E10600] text-white text-xs font-black rounded-md shadow-lg transform -skew-x-12 border border-[#FFB800]/30"
      >
        <Trophy size={12} className="skew-x-12 text-[#FFB800]" />
        <span className="skew-x-12 tracking-wider">MAX VERSTAPPEN</span>
        <span className="skew-x-12 text-[#FFB800]">#1</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={animated ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative p-4 bg-gradient-to-br from-[#001A30] via-[#001A30] to-[#E10600] rounded-xl shadow-2xl border border-[#FFB800]/20 overflow-hidden"
    >
      {/* Racing stripes background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#FFB800]" />
        <div className="absolute top-2 left-0 w-full h-0.5 bg-[#E10600]" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FFB800]" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#FFB800] rounded-lg flex items-center justify-center transform -skew-x-12 shadow-lg">
            <span className="text-2xl font-black text-[#001A30] skew-x-12">#1</span>
          </div>
          <div>
            <div className="text-[#FFB800] text-xs font-bold tracking-widest uppercase">
              Oracle Red Bull Racing
            </div>
            <div className="text-white text-lg font-black tracking-tight">
              MAX VERSTAPPEN
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Trophy size={24} className="text-[#FFB800]" />
          <span className="text-[10px] text-white/60 font-bold">4x CHAMPION</span>
        </div>
      </div>

      {/* Checkered flag pattern corner */}
      <div
        className="absolute -bottom-2 -right-2 w-16 h-16 opacity-20 rotate-45"
        style={{
          backgroundImage: 'repeating-conic-gradient(#FFB800 0% 25%, #fff 0% 50%)',
          backgroundSize: '8px 8px',
        }}
      />
    </motion.div>
  );
};

export default MV1Badge;
