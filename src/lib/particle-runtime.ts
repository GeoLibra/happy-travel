export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface ParticleBounds {
  width: number;
  height: number;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function advanceParticle(
  particle: ParticleState,
  deltaSeconds: number,
  bounds: ParticleBounds
): ParticleState {
  let x = particle.x + particle.vx * deltaSeconds;
  let y = particle.y + particle.vy * deltaSeconds;
  let life = particle.life + deltaSeconds;

  if (x < 0) x = bounds.width;
  if (x > bounds.width) x = 0;
  if (y < 0) y = bounds.height;
  if (y > bounds.height) y = 0;

  return {
    ...particle,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    life: Number.isFinite(life) ? life : 0,
  };
}

export function clampParticleCount(requested: number, maximum: number): number {
  if (requested <= 0 || !Number.isFinite(requested)) return 0;
  return Math.min(Math.floor(requested), Math.max(0, maximum));
}
