const INF = 1e20;

export interface TinySdfOptions {
  fontSize?: number;
  buffer?: number;
  radius?: number;
  cutoff?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
}

export interface TinySdfGlyph {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  glyphWidth: number;
  glyphHeight: number;
  glyphTop: number;
  glyphLeft: number;
  glyphAdvance: number;
}

export class TinySDF {
  readonly buffer: number;
  readonly cutoff: number;
  readonly radius: number;
  readonly size: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly gridOuter: Float64Array;
  private readonly gridInner: Float64Array;
  private readonly f: Float64Array;
  private readonly z: Float64Array;
  private readonly v: Uint16Array;

  constructor({
    fontSize = 24,
    buffer = 3,
    radius = 8,
    cutoff = 0.25,
    fontFamily = 'sans-serif',
    fontWeight = 'normal',
    fontStyle = 'normal',
  }: TinySdfOptions = {}) {
    this.buffer = buffer;
    this.cutoff = cutoff;
    this.radius = radius;
    this.size = fontSize + buffer * 4;
    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('TinySDF requires a 2D canvas context');
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'black';
    this.ctx = ctx;
    this.gridOuter = new Float64Array(this.size * this.size);
    this.gridInner = new Float64Array(this.size * this.size);
    this.f = new Float64Array(this.size);
    this.z = new Float64Array(this.size + 1);
    this.v = new Uint16Array(this.size);
  }

  draw(char: string): TinySdfGlyph {
    const metrics = this.ctx.measureText(char);
    const glyphTop = Math.ceil(metrics.actualBoundingBoxAscent);
    const glyphLeft = 0;
    const glyphWidth = Math.max(
      0,
      Math.min(this.size - this.buffer, Math.ceil(metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft)),
    );
    const glyphHeight = Math.min(
      this.size - this.buffer,
      glyphTop + Math.ceil(metrics.actualBoundingBoxDescent),
    );
    const width = glyphWidth + 2 * this.buffer;
    const height = glyphHeight + 2 * this.buffer;
    const length = Math.max(width * height, 0);
    const data = new Uint8ClampedArray(length);
    const glyph: TinySdfGlyph = {
      data,
      width,
      height,
      glyphWidth,
      glyphHeight,
      glyphTop,
      glyphLeft,
      glyphAdvance: metrics.width,
    };
    if (glyphWidth === 0 || glyphHeight === 0) return glyph;

    const { ctx, buffer, gridInner, gridOuter } = this;
    ctx.clearRect(buffer, buffer, glyphWidth, glyphHeight);
    ctx.fillText(char, buffer, buffer + glyphTop);
    const imageData = ctx.getImageData(buffer, buffer, glyphWidth, glyphHeight);
    gridOuter.fill(INF, 0, length);
    gridInner.fill(0, 0, length);

    for (let y = 0; y < glyphHeight; y += 1) {
      for (let x = 0; x < glyphWidth; x += 1) {
        const alpha = imageData.data[4 * (y * glyphWidth + x) + 3] / 255;
        if (alpha === 0) continue;
        const index = (y + buffer) * width + x + buffer;
        if (alpha === 1) {
          gridOuter[index] = 0;
          gridInner[index] = INF;
        } else {
          const d = 0.5 - alpha;
          gridOuter[index] = d > 0 ? d * d : 0;
          gridInner[index] = d < 0 ? d * d : 0;
        }
      }
    }

    edt(gridOuter, 0, 0, width, height, width, this.f, this.v, this.z);
    edt(gridInner, buffer, buffer, glyphWidth, glyphHeight, width, this.f, this.v, this.z);

    for (let i = 0; i < length; i += 1) {
      const distance = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
      data[i] = Math.round(255 - 255 * (distance / this.radius + this.cutoff));
    }

    return glyph;
  }
}

function edt(
  data: Float64Array,
  x0: number,
  y0: number,
  width: number,
  height: number,
  gridSize: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array,
): void {
  for (let x = x0; x < x0 + width; x += 1) {
    edt1d(data, y0 * gridSize + x, gridSize, height, f, v, z);
  }
  for (let y = y0; y < y0 + height; y += 1) {
    edt1d(data, y * gridSize + x0, 1, width, f, v, z);
  }
}

function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  length: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array,
): void {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];

  for (let q = 1, k = 0, s = 0; q < length; q += 1) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }

  for (let q = 0, k = 0; q < length; q += 1) {
    while (z[k + 1] < q) k += 1;
    const r = v[k];
    const d = q - r;
    grid[offset + q * stride] = f[r] + d * d;
  }
}
