import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#E10600', '#FFB800', '#3b82f6', '#8b5cf6', '#10b981', '#ffffff'];

interface Particle {
  id: string;
  color: string;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
}

export default function MiniFirework() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);

  // Sync position with the anchor
  useEffect(() => {
    setIsMounted(true);
    const updatePos = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        // Offset slightly to be exactly on the corner edge
        setPos({ top: rect.top - 10, left: rect.left + 10 });
      }
    };

    updatePos();
    // Capture scroll events from any parent container
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);

    // Fallback interval to keep position locked during fast scrolling or layout shifts
    const posInterval = setInterval(updatePos, 30);

    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
      clearInterval(posInterval);
    };
  }, []);

  // Continuous particle emitter logic
  useEffect(() => {
    let particleCount = 0;
    let isActive = true;

    const emitParticle = () => {
      if (!isActive) return;

      const newParticle = {
        id: `${Date.now()}-${particleCount++}`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        // Spray upwards/outwards like a continuous bouquet:
        // Angle carefully tuned to fan out wide toward the top-right and straight up
        // between -160 degrees and -20 degrees approx
        angle: -(Math.PI * 0.1) - (Math.random() * Math.PI * 0.8),
        distance: 80 + Math.random() * 80, // Throw distance (larger to allow them to separate)
        size: 3 + Math.random() * 5,
        delay: 0,
        duration: 0.8 + Math.random() * 0.6
      };

      setParticles(prev => [...prev, newParticle]);

      // Clean up the individual particle after its animation
      setTimeout(() => {
        if (isActive) {
          setParticles(prev => prev.filter(p => p.id !== newParticle.id));
        }
      }, 1500);
    };

    // Continuous stream (every 60-100ms)
    const interval = setInterval(() => {
      emitParticle();
      // Occasionally emit 2-3 at once for a richer stream
      if (Math.random() > 0.4) {
        emitParticle();
        if (Math.random() > 0.7) emitParticle();
      }
    }, 60);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  const fireworkContent = (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999, // Absolute top layer, guaranteeing no clipping
        width: 0,
        height: 0
      }}
    >
      <AnimatePresence>
        {particles.map(p => {
          // Final destination coordinates (The widely fanned-out blossom)
          const finalX = Math.cos(p.angle) * p.distance * 1.5; // Stretch it wider
          const finalY = Math.sin(p.angle) * p.distance;

          return (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: finalX,
                // Add a gravity drop (+80px) to the final Y
                y: finalY + 80,
                scale: [0, p.size > 4 ? 1.2 : 1, 0],
                opacity: [1, 1, 0]
              }}
              transition={{
                duration: p.duration,
                // X travels continuously outward
                x: { ease: "linear", duration: p.duration },
                // Y shoots up super fast (cubic-bezier) then falls down, creating the "stem" then "bloom" arc
                y: { ease: [0.2, 0, 0.4, 1.5], duration: p.duration }
              }}
              className="absolute rounded-full shadow-[0_0_8px_currentColor]"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                color: p.color,
                marginTop: -p.size / 2,
                marginLeft: -p.size / 2
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {/* Invisible anchor inside the scrolling container */}
      <div ref={anchorRef} className="absolute inset-0 pointer-events-none" />
      {/* Render the actual fireworks directly into document.body */}
      {isMounted && createPortal(fireworkContent, document.body)}
    </>
  );
}
