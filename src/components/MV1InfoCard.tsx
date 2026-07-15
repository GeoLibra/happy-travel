import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Flag, X, Award, TrendingUp } from 'lucide-react';
import { useI18n } from '../i18n';

interface MV1InfoCardProps {
  onClose?: () => void;
}

const MV1InfoCard: React.FC<MV1InfoCardProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

  const achievements = [
    { year: '2021', title: t('driver.achievement.2021'), icon: Trophy },
    { year: '2022', title: t('driver.achievement.2022'), icon: Award },
    { year: '2023', title: t('driver.achievement.2023'), icon: TrendingUp },
    { year: '2024', title: t('driver.achievement.2024'), icon: Trophy },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative bg-gradient-to-br from-[#001A30] via-[#001A30] to-[#E10600] rounded-2xl shadow-2xl overflow-hidden border border-[#FFB800]/30 max-w-md"
    >
      {/* Racing stripes background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#E10600] via-[#FFB800] to-[#001A30]" />
        <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-[#001A30] via-[#FFB800] to-[#E10600]" />
      </div>

      {/* Checkered flag pattern */}
      <div
        className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'repeating-conic-gradient(#FFB800 0% 25%, #fff 0% 50%)',
          backgroundSize: '16px 16px',
        }}
      />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-[#FFB800] rounded-xl flex items-center justify-center transform -skew-x-12 shadow-lg">
              <span className="text-3xl font-black text-[#001A30] skew-x-12">#1</span>
            </div>
            <div>
              <div className="text-[#FFB800] text-xs font-bold tracking-widest uppercase">
                Oracle Red Bull Racing
              </div>
              <div className="text-white text-xl font-black tracking-tight">
                MAX VERSTAPPEN
              </div>
              <div className="text-white/60 text-xs font-medium">
                {t('driver.country')} • 1997.09.30
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors p-1"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center border border-white/10">
            <div className="text-2xl font-black text-[#FFB800]">4</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider">{t('driver.championships')}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center border border-white/10">
            <div className="text-2xl font-black text-[#E10600]">71</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider">{t('driver.wins')}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center border border-white/10">
            <div className="text-2xl font-black text-white">48</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider">{t('driver.poles')}</div>
          </div>
        </div>

        {/* Expandable Achievements */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left text-white/80 text-sm font-bold mb-2 flex items-center justify-between hover:text-white transition-colors"
        >
          <span>{t('driver.highlights')}</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <Flag size={16} />
          </motion.div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-2">
                {achievements.map((achievement, idx) => {
                  const Icon = achievement.icon;
                  return (
                    <motion.div
                      key={achievement.year}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10"
                    >
                      <div className="w-8 h-8 bg-[#FFB800]/20 rounded-lg flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-[#FFB800]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-sm font-bold">{achievement.title}</div>
                        <div className="text-white/40 text-xs">{achievement.year}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-white/60 text-xs italic text-center">
          "Simply lovely"
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default MV1InfoCard;
