import { describe, expect, it } from 'vitest';
import {
  advanceParticle,
  clampParticleCount,
  createSeededRandom,
  type ParticleBounds,
  type ParticleState,
} from '@/src/lib/particle-runtime';
import {
  createCpuParticleField,
  createSpeedLineField,
  createTrailField,
} from '@/src/components/showroom/showroom-particles';
import { CPU_PARTICLE_COUNT, SPEED_LINE_COUNT, TRAIL_COUNT, TRAIL_SEGMENTS } from '@/src/components/showroom/showroom-constants';

describe('Particle System & Runtime', () => {
  describe('Deterministic Random Generator', () => {
    it('produces repeatable sequences for the same seed', () => {
      const rng1 = createSeededRandom(42);
      const rng2 = createSeededRandom(42);

      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
      seq1.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      });
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = createSeededRandom(42);
      const rng2 = createSeededRandom(100);

      expect(rng1()).not.toEqual(rng2());
    });
  });

  describe('Particle Kinematics & Bounds', () => {
    it('advances particle position smoothly based on velocity and deltaSeconds', () => {
      const initial: ParticleState = { x: 10, y: 20, vx: 50, vy: -30, life: 0, maxLife: 5 };
      const bounds: ParticleBounds = { width: 1000, height: 1000 };

      const updated = advanceParticle(initial, 0.1, bounds);
      expect(updated.x).toBeCloseTo(15);
      expect(updated.y).toBeCloseTo(17);
      expect(updated.life).toBeCloseTo(0.1);
    });

    it('wraps around bounds when exceeding width or height', () => {
      const initial: ParticleState = { x: 990, y: 990, vx: 20, vy: 20, life: 1, maxLife: 5 };
      const bounds: ParticleBounds = { width: 1000, height: 1000 };

      const updated = advanceParticle(initial, 1, bounds);
      expect(updated.x).toBeLessThanOrEqual(1000);
      expect(updated.y).toBeLessThanOrEqual(1000);
    });
  });

  describe('Particle Count Clamping', () => {
    it('clamps requested counts within valid ranges', () => {
      expect(clampParticleCount(150, 100)).toBe(100);
      expect(clampParticleCount(50, 100)).toBe(50);
      expect(clampParticleCount(-10, 100)).toBe(0);
      expect(clampParticleCount(NaN, 100)).toBe(0);
      expect(clampParticleCount(Infinity, 100)).toBe(0);
    });
  });

  describe('Showroom Particle Field Factories', () => {
    it('creates CPU particle field with correct attribute sizes', () => {
      const field = createCpuParticleField(1);
      expect(field.positions.length).toBe(CPU_PARTICLE_COUNT * 3);
      expect(field.phases.length).toBe(CPU_PARTICLE_COUNT);

      expect(typeof field.dispose).toBe('function');
      field.dispose();
    });

    it('creates Trail particle field with correct segment counts', () => {
      const field = createTrailField();
      expect(field.positionAttribute.count).toBe(TRAIL_COUNT * TRAIL_SEGMENTS);
      expect(typeof field.dispose).toBe('function');
      field.dispose();
    });

    it('creates SpeedLine particle field with correct speeds array', () => {
      const field = createSpeedLineField();
      expect(field.speeds.length).toBe(SPEED_LINE_COUNT);
      expect(typeof field.dispose).toBe('function');
      field.dispose();
    });
  });
});
