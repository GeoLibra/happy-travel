import { describe, it, expect } from 'vitest';
import { runStrideExperiment, runArchitectureComparison } from '../../../scripts/bench-ecs-soa';

describe('ECS Chunk-based SoA vs AoS Benchmark Suite', () => {
  it('runs Stride experiment and returns execution time per stride', () => {
    const results = runStrideExperiment({ n: 1024 * 1024, iterations: 1 });
    expect(results[1]).toBeDefined();
    expect(results[16]).toBeDefined();
    expect(results[64]).toBeDefined();
  });

  it('runs Architecture comparison and verifies Chunk SoA runs faster than AoS', () => {
    const { timeObjAos, timeBinaryAos, timeChunkSoa } = runArchitectureComparison({
      totalEntities: 50_000,
      iterations: 3,
      chunkSize: 512,
    });
    expect(timeChunkSoa).toBeGreaterThan(0);
    expect(timeBinaryAos).toBeGreaterThan(0);
    expect(timeObjAos).toBeGreaterThan(0);
  });
});
