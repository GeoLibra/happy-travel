import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { digit } from './digit';

// ── CONFIGURATION & CONSTANTS ──
const TARGET_DATE = new Date('2026-03-15T15:00:00+08:00').getTime();
const RADIUS = 2.0; // Particle radius (increased for better stacking visibility)
const COLORS = ["#33B5E5", "#0099CC", "#AA66CC", "#9933CC", "#99CC00", "#669900", "#FFBB33", "#FF8800", "#FF4444", "#CC0000"];
const MAX_PARTICLES = 2000; // Cap to prevent lag from floor accumulation

interface Particle {
  x: number;
  y: number;
  g: number;     // Gravity
  vx: number;    // Velocity X
  vy: number;    // Velocity Y
  color: string;
}

const RaceCountdown: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Track previous time to detect changes for spawning particles
  const currentSecondsRef = useRef(-1);
  const currentMinutesRef = useRef(-1);
  const currentHoursRef = useRef(-1);
  const currentDaysRef = useRef(-1);

  // Store active bouncing particles
  const particlesRef = useRef<Particle[]>([]);

  // Function to calculate remaining time arrays
  const getRemainingTime = () => {
    const diff = TARGET_DATE - new Date().getTime();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    return {
      d: Math.floor(diff / (1000 * 60 * 60 * 24)),
      h: Math.floor((diff / (1000 * 60 * 60)) % 24),
      m: Math.floor((diff / 1000 / 60) % 60),
      s: Math.floor((diff / 1000) % 60),
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const wrapper = canvas.parentElement;
    if (!wrapper) return;

    // Track intersection visibility
    let isVisible = false;

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before scaling
      ctx.scale(dpr, dpr);

      // Clear particles on orientation change
      particlesRef.current = [];
    };

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    let animationFrameId: number;

    let curRadius = RADIUS;
    let RADIUS_L = curRadius + 1;
    let CELL = 2 * RADIUS_L;
    let DIGIT_W = 7 * CELL;
    let COLON_W = 4 * CELL;
    let DIGIT_GAP = 1 * CELL; // Space between digits in same unit
    let UNIT_GAP = 2 * CELL; // Space between unit and colon

    const renderDigit = (x: number, y: number, num: number, context: CanvasRenderingContext2D) => {
      // digit[10] is the colon ':'
      const matrix = digit[num];
      if (!matrix) return;

      context.fillStyle = num === 10 ? "#001A30" : "#E10600"; // Red for numbers, Dark for colon

      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          if (matrix[i][j] === 1) {
            context.beginPath();
            context.arc(
              x + j * CELL + RADIUS_L,
              y + i * CELL + RADIUS_L,
              RADIUS,
              0,
              2 * Math.PI
            );
            context.closePath();
            context.fill();
          }
        }
      }
    };

    const addParticles = (x: number, y: number, num: number) => {
      const matrix = digit[num];
      if (!matrix) return;
      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          if (matrix[i][j] === 1) {
            const particle: Particle = {
              x: x + j * CELL + RADIUS_L,
              y: y + i * CELL + RADIUS_L,
              g: 1.5 + Math.random(), // Gravity
              vx: Math.pow(-1, Math.ceil(Math.random() * 1000)) * 4,
              vy: -5,
              color: COLORS[Math.floor(Math.random() * COLORS.length)]
            };
            particlesRef.current.push(particle);
          }
        }
      }

      // Throttle array length to prevent infinite stacking lag
      if (particlesRef.current.length > MAX_PARTICLES) {
         particlesRef.current = particlesRef.current.slice(-MAX_PARTICLES);
      }
    };

    // Enhanced 1D height map for better stacking collision
    const columnHeights = new Map<number, number>();

    const updateParticles = () => {
      const pArr = particlesRef.current;
      columnHeights.clear();
      const FLOOR = window.innerHeight;

      // First pass: Build the height map of already settled particles
      // Use finer column resolution for better stacking
      const COLUMN_WIDTH = curRadius * 1.8; // Tighter columns for better stacking

      for (let i = 0; i < pArr.length; i++) {
        const p = pArr[i];
        if (p.vy === 0 && p.g === 0) {
           const colKey = Math.floor(p.x / COLUMN_WIDTH);
           const currentHeight = columnHeights.get(colKey) || FLOOR;
           if (p.y < currentHeight) {
              columnHeights.set(colKey, p.y);
           }
        }
      }

      // Second pass: Update physics and check collisions against height map
      for (let i = 0; i < pArr.length; i++) {
        const p = pArr[i];
        if (p.vy === 0 && p.g === 0) continue; // Skip settled particles

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g; // Apply gravity

        const colKey = Math.floor(p.x / COLUMN_WIDTH);
        const localFloor = (columnHeights.get(colKey) || FLOOR) - curRadius * 2; // Stack tighter

        // Bounce on calculated local floor (the viewport floor OR another particle)
        if (p.y >= localFloor) {
           p.y = localFloor;

           if (Math.abs(p.vy) < 2.0) { // Lower threshold for faster settling
              // Settle permanently
              p.vy = 0;
              p.g = 0;
              // Minimal jitter for cleaner stacking
              p.x += (Math.random() - 0.5) * curRadius * 0.3;
              p.vx = 0;

              // Update the column height immediately for next particles
              const settledColKey = Math.floor(p.x / COLUMN_WIDTH);
              const currentHeight = columnHeights.get(settledColKey) || FLOOR;
              if (p.y < currentHeight) {
                 columnHeights.set(settledColKey, p.y);
              }
           } else {
              p.vy = -p.vy * 0.35; // Less bouncy for faster stacking
              p.vx *= 0.7; // More horizontal friction
           }
        }
      }

      // Remove particles off-screen
      let cnt = 0;
      for (let i = 0; i < pArr.length; i++) {
        if (pArr[i].x + curRadius > 0 && pArr[i].x - curRadius < window.innerWidth) {
          pArr[cnt++] = pArr[i];
        }
      }
      pArr.length = cnt; // Truncate array while keeping max length small (performance)
    };

    const renderParticles = (context: CanvasRenderingContext2D) => {
      const pArr = particlesRef.current;
      for (let i = 0; i < pArr.length; i++) {
        context.fillStyle = pArr[i].color;
        context.beginPath();
        context.arc(pArr[i].x, pArr[i].y, curRadius, 0, 2 * Math.PI);
        context.closePath();
        context.fill();
      }
    };

    const checkTimeChanges = (newTime: ReturnType<typeof getRemainingTime>, startX: number, startY: number) => {
      let curX = startX;

      // Days (render conditionally)
      if (newTime.d > 0) {
        const dDigits = newTime.d >= 100 ? 3 : 2;
        if (dDigits === 3) {
          const d100 = Math.floor(newTime.d / 100);
          const prevD100 = Math.floor(currentDaysRef.current / 100);
          if (d100 !== prevD100) addParticles(curX, startY, d100);
          curX += DIGIT_W + DIGIT_GAP;
        }

        const d10 = Math.floor((newTime.d % 100) / 10);
        const prevD10 = Math.floor((currentDaysRef.current % 100) / 10);
        if (d10 !== prevD10) addParticles(curX, startY, d10);
        curX += DIGIT_W + DIGIT_GAP;

        const d1 = newTime.d % 10;
        const prevD1 = currentDaysRef.current % 10;
        if (d1 !== prevD1) addParticles(curX, startY, d1);

        curX += DIGIT_W + UNIT_GAP + COLON_W + UNIT_GAP;
      }

      // Hours
      const h10 = Math.floor(newTime.h / 10);
      const prevH10 = Math.floor(currentHoursRef.current / 10);
      if (h10 !== prevH10) addParticles(curX, startY, h10);
      curX += DIGIT_W + DIGIT_GAP;

      const h1 = newTime.h % 10;
      const prevH1 = currentHoursRef.current % 10;
      if (h1 !== prevH1) addParticles(curX, startY, h1);

      curX += DIGIT_W + UNIT_GAP + COLON_W + UNIT_GAP;

      // Minutes
      const m10 = Math.floor(newTime.m / 10);
      const prevM10 = Math.floor(currentMinutesRef.current / 10);
      if (m10 !== prevM10) addParticles(curX, startY, m10);
      curX += DIGIT_W + DIGIT_GAP;

      const m1 = newTime.m % 10;
      const prevM1 = currentMinutesRef.current % 10;
      if (m1 !== prevM1) addParticles(curX, startY, m1);

      curX += DIGIT_W + UNIT_GAP + COLON_W + UNIT_GAP;

      // Seconds
      const s10 = Math.floor(newTime.s / 10);
      const prevS10 = Math.floor(currentSecondsRef.current / 10);
      if (s10 !== prevS10) addParticles(curX, startY, s10);
      curX += DIGIT_W + DIGIT_GAP;

      const s1 = newTime.s % 10;
      const prevS1 = currentSecondsRef.current % 10;
      if (s1 !== prevS1) addParticles(curX, startY, s1);

      // Update refs
      currentDaysRef.current = newTime.d;
      currentHoursRef.current = newTime.h;
      currentMinutesRef.current = newTime.m;
      currentSecondsRef.current = newTime.s;
    };


    const render = () => {
      // Pause drawing and parsing when not visible on screen
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const rect = wrapper.getBoundingClientRect();
      const isLandscape = window.innerWidth > window.innerHeight;
      // Simpler positioning - just based on wrapper position
      const MARGIN_TOP = rect.top + 5;
      const CANVAS_W = rect.width;

      const time = getRemainingTime();
      const hasDays = time.d > 0;
      const dDigits = time.d >= 100 ? 3 : 2;

      // Make responsive to container width
      const availableWidth = CANVAS_W - 20;
      const baseTotalWidth = hasDays ? (dDigits === 3 ? 368 : 336) : 244;
      const scale = availableWidth / (baseTotalWidth * 1.25);

      if (scale < 1) {
         curRadius = Math.max(0.2, (5 * scale / 2) - 1);
      } else {
         curRadius = RADIUS;
      }

      RADIUS_L = curRadius + 1;
      CELL = 2 * RADIUS_L;
      DIGIT_W = 7 * CELL;
      COLON_W = 4 * CELL;
      DIGIT_GAP = 1 * CELL;
      UNIT_GAP = 2 * CELL;

      // Calculate dynamic left offset to center the text
      const daysWidth = hasDays ? (dDigits * DIGIT_W + (dDigits - 1) * DIGIT_GAP) : 0;
      const twoDigitWidth = 2 * DIGIT_W + DIGIT_GAP;
      const blockGap = UNIT_GAP + COLON_W + UNIT_GAP;

      const numBlocksGap = hasDays ? 3 : 2;
      const numDigitPairs = 3; // Hrs, Mins, Secs

      const totalWidth = daysWidth + (hasDays ? blockGap : 0) + (numBlocksGap * blockGap) + (numDigitPairs * twoDigitWidth) - blockGap;
      const dynamicMarginLeft = isLandscape ? rect.left + Math.max(0, Math.round((rect.width - totalWidth) / 2)) : Math.max(0, Math.round((window.innerWidth - totalWidth) / 2));

      // Initial check skip hook
      if (currentSecondsRef.current !== -1) {
         checkTimeChanges(time, dynamicMarginLeft, MARGIN_TOP);
      } else {
         // Setup refs initially without spawning
         currentDaysRef.current = time.d;
         currentHoursRef.current = time.h;
         currentMinutesRef.current = time.m;
         currentSecondsRef.current = time.s;
      }

      let curX = dynamicMarginLeft;

      // Days
      if (hasDays) {
        if (dDigits === 3) {
          renderDigit(curX, MARGIN_TOP, Math.floor(time.d / 100), ctx);
          curX += DIGIT_W + DIGIT_GAP;
        }
        renderDigit(curX, MARGIN_TOP, Math.floor((time.d % 100) / 10), ctx);
        curX += DIGIT_W + DIGIT_GAP;
        renderDigit(curX, MARGIN_TOP, time.d % 10, ctx);
        curX += DIGIT_W + UNIT_GAP;

        // Colon
        renderDigit(curX, MARGIN_TOP, 10, ctx);
        curX += COLON_W + UNIT_GAP;
      }

      // Hours
      renderDigit(curX, MARGIN_TOP, Math.floor(time.h / 10), ctx);
      curX += DIGIT_W + DIGIT_GAP;
      renderDigit(curX, MARGIN_TOP, time.h % 10, ctx);
      curX += DIGIT_W + UNIT_GAP;
      // Colon
      renderDigit(curX, MARGIN_TOP, 10, ctx);
      curX += COLON_W + UNIT_GAP;

      // Minutes
      renderDigit(curX, MARGIN_TOP, Math.floor(time.m / 10), ctx);
      curX += DIGIT_W + DIGIT_GAP;
      renderDigit(curX, MARGIN_TOP, time.m % 10, ctx);
      curX += DIGIT_W + UNIT_GAP;
      // Colon
      renderDigit(curX, MARGIN_TOP, 10, ctx);
      curX += COLON_W + UNIT_GAP;

      // Seconds
      renderDigit(curX, MARGIN_TOP, Math.floor(time.s / 10), ctx);
      curX += DIGIT_W + DIGIT_GAP;
      renderDigit(curX, MARGIN_TOP, time.s % 10, ctx);

      updateParticles();
      renderParticles(ctx);

      // Draw Labels below digits
      ctx.fillStyle = "#94a3b8";
      ctx.font = "800 13px 'Inter', sans-serif";
      ctx.textAlign = "center";

      const labelY = MARGIN_TOP + 65;

      let cx = dynamicMarginLeft;
      if (hasDays) {
        cx += daysWidth / 2;
        ctx.fillText("DAYS", cx, labelY);
        cx += daysWidth / 2 + blockGap + twoDigitWidth / 2;
      } else {
        cx += twoDigitWidth / 2;
      }

      ctx.fillText("HRS", cx, labelY);

      cx += twoDigitWidth / 2 + blockGap + twoDigitWidth / 2;
      ctx.fillText("MIN", cx, labelY);

      cx += twoDigitWidth / 2 + blockGap + twoDigitWidth / 2;
      ctx.fillText("SEC", cx, labelY);

      animationFrameId = requestAnimationFrame(render);
    };

    // Initialize IntersectionObserver to disable heavy UI processing if component is off-screen
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
         isVisible = true;
         // Refresh display immediately when scrolled back into view to avoid pop-in
         currentSecondsRef.current = -1;
      } else {
         isVisible = false;
      }
    }, { threshold: 0 });

    observer.observe(wrapper);

    render(); // Start loop

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', setCanvasSize);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-[100px] flex justify-center -mt-2 -mb-2 relative"
    >
      <canvas
         ref={canvasRef}
         className="fixed top-0 left-0 w-screen h-screen pointer-events-none drop-shadow-sm z-[15]"
         aria-label="Race Countdown Canvas"
         onClick={(e) => {
           console.log('[RaceCountdown] Canvas clicked (should not happen with pointer-events-none)', {
             target: e.target,
             currentTarget: e.currentTarget,
           });
         }}
      />
    </motion.div>
  );
};

export default RaceCountdown;
