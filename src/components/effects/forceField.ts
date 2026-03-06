/**
 * 3D Force Field Distortion — Curl Noise Flow Field
 *
 * Generates divergence-free velocity vectors using the curl of a 3D simplex noise field.
 * This produces organic, fluid-like particle motion with no sinks or sources.
 */

// ── 3D Simplex Noise (compact implementation) ──

const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

// Permutation table (doubled to avoid overflow)
const perm = new Uint8Array(512);
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

// Seed the permutation table
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher–Yates shuffle with fixed seed for reproducibility
  let seed = 42;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();

function dot3(g: number[], x: number, y: number, z: number): number {
  return g[0] * x + g[1] * y + g[2] * z;
}

function simplex3D(xin: number, yin: number, zin: number): number {
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const X0 = i - t, Y0 = j - t, Z0 = k - t;
  const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3, y2 = y0 - j2 + 2.0 * G3, z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3, y3 = y0 - 1.0 + 3.0 * G3, z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255, jj = j & 255, kk = k & 255;

  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * dot3(grad3[perm[ii + perm[jj + perm[kk]]] % 12], x0, y0, z0); }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * dot3(grad3[perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12], x1, y1, z1); }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * dot3(grad3[perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12], x2, y2, z2); }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 > 0) { t3 *= t3; n3 = t3 * t3 * dot3(grad3[perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12], x3, y3, z3); }

  return 32.0 * (n0 + n1 + n2 + n3);
}

// ── Curl Noise ──

const EPS = 0.001;

/**
 * Computes the curl of a 3D noise field at a given point.
 * Returns a divergence-free velocity vector [vx, vy, vz].
 */
export function curlNoise(
  x: number, y: number, z: number,
  scale: number, time: number, speed: number
): [number, number, number] {
  const sx = x * scale + time * speed;
  const sy = y * scale + time * speed * 0.7;
  const sz = z * scale + time * speed * 0.5;

  // We use 3 different noise "channels" offset by large values
  // to get 3 independent scalar fields, then compute the curl
  const offset1 = 100.0;
  const offset2 = 200.0;

  // Partial derivatives via finite differences for noise field F = (F1, F2, F3)
  // curl(F) = (dF3/dy - dF2/dz, dF1/dz - dF3/dx, dF2/dx - dF1/dy)

  const dF3dy = (simplex3D(sx + offset2, sy + EPS, sz) - simplex3D(sx + offset2, sy - EPS, sz)) / (2 * EPS);
  const dF2dz = (simplex3D(sx + offset1, sy, sz + EPS) - simplex3D(sx + offset1, sy, sz - EPS)) / (2 * EPS);

  const dF1dz = (simplex3D(sx, sy, sz + EPS) - simplex3D(sx, sy, sz - EPS)) / (2 * EPS);
  const dF3dx = (simplex3D(sx + offset2 + EPS, sy, sz) - simplex3D(sx + offset2 - EPS, sy, sz)) / (2 * EPS);

  const dF2dx = (simplex3D(sx + offset1 + EPS, sy, sz) - simplex3D(sx + offset1 - EPS, sy, sz)) / (2 * EPS);
  const dF1dy = (simplex3D(sx, sy + EPS, sz) - simplex3D(sx, sy - EPS, sz)) / (2 * EPS);

  return [
    dF3dy - dF2dz,
    dF1dz - dF3dx,
    dF2dx - dF1dy,
  ];
}

/**
 * GLSL implementation of simplex noise + curl noise for use in GPU compute shaders.
 * This is injected into the compute shader so the GPU can compute force field directly.
 */
export const CURL_NOISE_GLSL = /* glsl */ `
// --- 3D Simplex Noise (GLSL) ---
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// --- Curl Noise ---
vec3 curlNoise(vec3 p, float time, float scale, float speed) {
  vec3 sp = p * scale + vec3(time * speed, time * speed * 0.7, time * speed * 0.5);
  float eps = 0.01;

  // Three offset noise channels
  float o1 = 100.0;
  float o2 = 200.0;

  // Partial derivatives via finite differences
  float dF3dy = (snoise(vec3(sp.x + o2, sp.y + eps, sp.z)) - snoise(vec3(sp.x + o2, sp.y - eps, sp.z))) / (2.0 * eps);
  float dF2dz = (snoise(vec3(sp.x + o1, sp.y, sp.z + eps)) - snoise(vec3(sp.x + o1, sp.y, sp.z - eps))) / (2.0 * eps);

  float dF1dz = (snoise(vec3(sp.x, sp.y, sp.z + eps)) - snoise(vec3(sp.x, sp.y, sp.z - eps))) / (2.0 * eps);
  float dF3dx = (snoise(vec3(sp.x + o2 + eps, sp.y, sp.z)) - snoise(vec3(sp.x + o2 - eps, sp.y, sp.z))) / (2.0 * eps);

  float dF2dx = (snoise(vec3(sp.x + o1 + eps, sp.y, sp.z)) - snoise(vec3(sp.x + o1 - eps, sp.y, sp.z))) / (2.0 * eps);
  float dF1dy = (snoise(vec3(sp.x, sp.y + eps, sp.z)) - snoise(vec3(sp.x, sp.y - eps, sp.z))) / (2.0 * eps);

  return vec3(
    dF3dy - dF2dz,
    dF1dz - dF3dx,
    dF2dx - dF1dy
  );
}
`;

export interface ForceFieldParams {
  scale: number;   // Spatial frequency (default 0.02)
  strength: number; // Intensity (0–3)
  speed: number;   // Temporal evolution speed (default 0.3)
}

export const DEFAULT_FORCE_FIELD_PARAMS: ForceFieldParams = {
  scale: 0.02,
  strength: 1.5,
  speed: 0.3,
};
