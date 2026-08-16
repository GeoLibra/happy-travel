export class CountdownStackHeightfield {
  private readonly minX = -14;
  private readonly maxX = 14;
  private readonly minY = -6;
  private readonly maxY = 8;
  private readonly cellSize = 0.12;
  private readonly cols: number;
  private readonly rows: number;
  private readonly grid: Float32Array;

  /** Maximum stack height in world units (maintains clearance below digits) */
  public readonly maxHeight = 0.45;

  constructor() {
    this.cols = Math.ceil((this.maxX - this.minX) / this.cellSize);
    this.rows = Math.ceil((this.maxY - this.minY) / this.cellSize);
    this.grid = new Float32Array(this.cols * this.rows);
  }

  public queryHeight(x: number, y: number): number {
    const col = Math.floor((x - this.minX) / this.cellSize);
    const row = Math.floor((y - this.minY) / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.grid[row * this.cols + col];
  }

  public queryGradient(x: number, y: number): { gx: number; gy: number } {
    const col = Math.floor((x - this.minX) / this.cellSize);
    const row = Math.floor((y - this.minY) / this.cellSize);
    if (col <= 0 || col >= this.cols - 1 || row <= 0 || row >= this.rows - 1) {
      return { gx: 0, gy: 0 };
    }
    const idx = row * this.cols + col;
    const hL = this.grid[idx - 1];
    const hR = this.grid[idx + 1];
    const hD = this.grid[(row - 1) * this.cols + col];
    const hU = this.grid[(row + 1) * this.cols + col];
    return {
      gx: (hR - hL) / (2 * this.cellSize),
      gy: (hU - hD) / (2 * this.cellSize),
    };
  }

  public deposit(x: number, y: number, amount: number): void {
    const col = Math.floor((x - this.minX) / this.cellSize);
    const row = Math.floor((y - this.minY) / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;

    const idx = row * this.cols + col;
    const current = this.grid[idx];
    const added = Math.min(this.maxHeight - current, amount);
    if (added <= 0) return;

    this.grid[idx] = current + added;

    // Gentle sandpile diffusion to neighbors
    const spread = added * 0.25;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nc = col + dx;
        const nr = row + dy;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
          const nIdx = nr * this.cols + nc;
          if (this.grid[nIdx] < this.grid[idx] - 0.04) {
            this.grid[nIdx] = Math.min(this.maxHeight, this.grid[nIdx] + spread);
          }
        }
      }
    }
  }

  public reset(): void {
    this.grid.fill(0);
  }
}
