import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const TARGET_DATE = new Date('2026-10-25T15:00:00+08:00').getTime(); // 2026 Chinese GP time

const RaceCountdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isCalculated, setIsCalculated] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = TARGET_DATE - new Date().getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
      setIsCalculated(true);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isCalculated) return null;

  const TimeUnit = ({ value, label }: { value: number, label: string }) => (
    <div className="flex flex-col items-center justify-center w-12">
        <span className="text-2xl font-black text-[#E10600] tracking-tighter tabular-nums drop-shadow-sm">
            {value.toString().padStart(2, '0')}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {label}
        </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center gap-2 -my-2"
    >
      <TimeUnit value={timeLeft.days} label="DAYS" />
      <span className="text-slate-300 font-black text-lg self-start mt-1">:</span>
      <TimeUnit value={timeLeft.hours} label="HRS" />
      <span className="text-slate-300 font-black text-lg self-start mt-1">:</span>
      <TimeUnit value={timeLeft.minutes} label="MIN" />
      <span className="text-[#E10600] font-black text-lg self-start mt-1 animate-pulse">:</span>
      <TimeUnit value={timeLeft.seconds} label="SEC" />
    </motion.div>
  );
};

export default RaceCountdown;
