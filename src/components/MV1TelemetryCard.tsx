import React from 'react';
import { motion } from 'motion/react';
import { X, Cpu, Gauge, Wind, Zap } from 'lucide-react';
import MV1Badge from './MV1Badge';

interface Props {
  onClose: () => void;
}

const MV1TelemetryCard = ({ onClose }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="bg-[#001A30]/95 backdrop-blur-xl border border-white/20 p-6 md:p-8 rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,26,48,0.8)] relative overflow-hidden"
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Accent Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E10600] via-[#FFB800] to-transparent" />

      {/* Header */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <MV1Badge animated={true} />
          <h2 className="text-2xl font-black text-white italic mt-3 tracking-wide">
            RB20 X-RAY DATA
          </h2>
          <p className="text-[#FFB800] text-sm font-bold tracking-wider uppercase mt-1">
            Oracle Red Bull Racing
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-[#E10600] hover:text-white transition-colors border border-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Cpu size={16} className="text-[#E10600]" />
            <span className="text-xs font-bold uppercase tracking-wider">Power Unit</span>
          </div>
          <p className="text-white font-mono text-lg font-bold">RBPTH002</p>
          <p className="text-xs text-slate-500 mt-1">Honda RBPT 1.6 L V6 t</p>
        </div>

        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Gauge size={16} className="text-[#FFB800]" />
            <span className="text-xs font-bold uppercase tracking-wider">Top Speed</span>
          </div>
          <p className="text-white font-mono text-lg font-bold flex items-baseline gap-1">
            352 <span className="text-xs text-[#E10600]">KM/H</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Est. Shanghai Straight</p>
        </div>

        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Wind size={16} className="text-[#00c2ff]" />
            <span className="text-xs font-bold uppercase tracking-wider">Downforce</span>
          </div>
          <p className="text-white font-mono text-lg font-bold flex items-baseline gap-1">
             Max <span className="text-xs text-[#E10600]">LOAD</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">High-drag config</p>
        </div>

        <div className="bg-black/40 border border-white/10 p-4 rounded-xl">
           <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Zap size={16} className="text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-wider">ERS Dep</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 mb-1">
             <div className="bg-gradient-to-r from-yellow-500 to-red-500 h-1.5 rounded-full w-[85%]" />
          </div>
          <p className="text-xs text-right font-mono text-white/80">85% OPTIMAL</p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 relative z-10 flex items-center justify-between">
         <div className="flex gap-2 text-xs font-mono text-slate-500">
            <span>SYS: <span className="text-emerald-400">ONLINE</span></span>
            <span>|</span>
            <span>TLM: <span className="text-emerald-400">ACTIVE</span></span>
         </div>
         <div className="animate-pulse text-[#E10600] flex items-center gap-1 text-xs font-black italic">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />
            LIVE DATA
         </div>
      </div>
    </motion.div>
  );
};

export default MV1TelemetryCard;
