import * as THREE from 'three';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
} from 'three/webgpu';
import {
  Fn,
  cameraProjectionMatrix,
  exp,
  float,
  instancedBufferAttribute,
  min,
  mix,
  modelViewMatrix,
  positionGeometry,
  pow,
  sin,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

export type FireworkBurstType = 'peony' | 'palette' | 'willow' | 'ring' | 'double' | 'glitter';

export interface FireworkShell {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: THREE.Color;
  type: FireworkBurstType;
  trailTimer: number;
}

const MAX_PARTICLES = 16384;
const G = 4.2;
const BURST_SPREAD = 1.35;
const SIZE_SCALE = 0.55;
const INTENSITY = 2.5;
const FIRST_LAUNCH_DELAY_SECONDS = 2.0;
const RECURRING_LAUNCH_INTERVAL_SECONDS = 60.0;
const TAU = Math.PI * 2;

const PALETTE: THREE.Color[] = [
  new THREE.Color().setHSL(0 / 360, 1, 0.6),
  new THREE.Color().setHSL(22 / 360, 1, 0.58),
  new THREE.Color().setHSL(45 / 360, 1, 0.6),
  new THREE.Color().setHSL(120 / 360, 0.9, 0.55),
  new THREE.Color().setHSL(170 / 360, 0.95, 0.58),
  new THREE.Color().setHSL(205 / 360, 1, 0.6),
  new THREE.Color().setHSL(235 / 360, 1, 0.62),
  new THREE.Color().setHSL(280 / 360, 0.9, 0.66),
  new THREE.Color().setHSL(330 / 360, 1, 0.68),
];

function rand(minVal: number, maxVal: number): number {
  return minVal + Math.random() * (maxVal - minVal);
}

function randInt(minVal: number, maxVal: number): number {
  return Math.floor(rand(minVal, maxVal + 1));
}

function pickRandomColor(): THREE.Color {
  return PALETTE[randInt(0, PALETTE.length - 1)].clone();
}

function pickRandomBurstType(): FireworkBurstType {
  const r = Math.random();
  if (r < 0.24) return 'peony';
  if (r < 0.42) return 'palette';
  if (r < 0.58) return 'willow';
  if (r < 0.72) return 'ring';
  if (r < 0.86) return 'double';
  return 'glitter';
}

export class CountdownFireworksSystem {
  public readonly mesh: InstancedMesh;
  public readonly points: InstancedMesh; // Backward compatibility alias
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicNodeMaterial;

  private readonly aInitPos: Float32Array;
  private readonly aInitVel: Float32Array;
  private readonly aColSize: Float32Array;
  private readonly aPhys: Float32Array;
  private readonly aTwink: Float32Array;
  private readonly expiry: Float32Array;
  private readonly live: Int32Array;
  private readonly free: number[];

  private readonly ipAttr: InstancedBufferAttribute;
  private readonly ivAttr: InstancedBufferAttribute;
  private readonly csAttr: InstancedBufferAttribute;
  private readonly phAttr: InstancedBufferAttribute;
  private readonly twAttr: InstancedBufferAttribute;

  private liveCount = 0;
  private hi = 0;
  private dirtyLo = Infinity;
  private dirtyHi = 0;

  private startTime = -1;
  private currentTime = 0;
  private nextLaunchTime = FIRST_LAUNCH_DELAY_SECONDS;
  private shells: FireworkShell[] = [];
  private disposed = false;

  private readonly uTime = uniform(0);
  private readonly uSizeScale = uniform(SIZE_SCALE);
  private readonly uIntensity = uniform(INTENSITY);

  constructor() {
    this.aInitPos = new Float32Array(MAX_PARTICLES * 3);
    this.aInitVel = new Float32Array(MAX_PARTICLES * 3);
    this.aColSize = new Float32Array(MAX_PARTICLES * 4);
    this.aPhys = new Float32Array(MAX_PARTICLES * 4);
    this.aTwink = new Float32Array(MAX_PARTICLES * 2);
    this.expiry = new Float32Array(MAX_PARTICLES);
    this.live = new Int32Array(MAX_PARTICLES);
    this.free = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.free[i] = MAX_PARTICLES - 1 - i;
    }

    this.geometry = new PlaneGeometry(1, 1);
    this.ipAttr = new InstancedBufferAttribute(this.aInitPos, 3);
    this.ivAttr = new InstancedBufferAttribute(this.aInitVel, 3);
    this.csAttr = new InstancedBufferAttribute(this.aColSize, 4);
    this.phAttr = new InstancedBufferAttribute(this.aPhys, 4);
    this.twAttr = new InstancedBufferAttribute(this.aTwink, 2);

    for (const attr of [this.ipAttr, this.ivAttr, this.csAttr, this.phAttr, this.twAttr]) {
      attr.setUsage(DynamicDrawUsage);
    }

    this.geometry.setAttribute('aCenter', this.ipAttr);
    this.geometry.setAttribute('aInitVel', this.ivAttr);
    this.geometry.setAttribute('aColSize', this.csAttr);
    this.geometry.setAttribute('aPhys', this.phAttr);
    this.geometry.setAttribute('aTwink', this.twAttr);

    this.material = new MeshBasicNodeMaterial();
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.blending = THREE.AdditiveBlending;

    const uTime = this.uTime;
    const uSizeScale = this.uSizeScale;
    const uIntensity = this.uIntensity;

    const aCenter = instancedBufferAttribute(this.ipAttr) as ReturnType<typeof vec3>;
    const aInitVel = instancedBufferAttribute(this.ivAttr) as ReturnType<typeof vec3>;
    const aColSize = instancedBufferAttribute(this.csAttr) as ReturnType<typeof vec4>;
    const aPhys = instancedBufferAttribute(this.phAttr) as ReturnType<typeof vec4>;
    const aTwink = instancedBufferAttribute(this.twAttr) as ReturnType<typeof vec2>;

    this.material.vertexNode = Fn(() => {
      const birth = aPhys.z;
      const lifespan = aPhys.w;
      const age = uTime.sub(birth);
      const isDead = age.lessThan(float(0)).or(age.greaterThan(lifespan));
      const g = aPhys.x;
      const k = aPhys.y;
      const hasDrag = k.greaterThan(float(1e-4));
      const expTerm = exp(k.mul(age).negate());
      const f = float(1).sub(expTerm).div(k.max(float(1e-4)));

      const posXDrag = aCenter.x.add(aInitVel.x.mul(f));
      const posZDrag = aCenter.z.add(aInitVel.z.mul(f));
      const posYDrag = aCenter.y.add(aInitVel.y.mul(f)).sub(g.div(k.max(float(1e-4))).mul(age.sub(f)));

      const posXNoDrag = aCenter.x.add(aInitVel.x.mul(age));
      const posZNoDrag = aCenter.z.add(aInitVel.z.mul(age));
      const posYNoDrag = aCenter.y.add(aInitVel.y.mul(age)).sub(float(0.5).mul(g).mul(age).mul(age));

      const finalX = hasDrag.select(posXDrag, posXNoDrag);
      const finalY = hasDrag.select(posYDrag, posYNoDrag);
      const finalZ = hasDrag.select(posZDrag, posZNoDrag);

      const lifeLeft = float(1).sub(age.div(lifespan.max(float(0.001)))).clamp(0, 1);
      const sizeFade = float(0.55).add(float(0.45).mul(lifeLeft));
      const finalSize = isDead.select(float(0), aColSize.w.mul(sizeFade).mul(uSizeScale));

      const worldPos = isDead.select(vec3(0, -99999, 0), vec3(finalX, finalY, finalZ));
      const viewCenter = modelViewMatrix.mul(vec4(worldPos, 1.0)).xyz;
      const viewPos = viewCenter.add(vec3(positionGeometry.x.mul(finalSize), positionGeometry.y.mul(finalSize), 0.0));

      return cameraProjectionMatrix.mul(vec4(viewPos, 1.0));
    })();

    this.material.outputNode = Fn(() => {
      const birth = aPhys.z;
      const lifespan = aPhys.w;
      const age = uTime.sub(birth);
      const isDead = age.lessThan(float(0)).or(age.greaterThan(lifespan));
      const lifeLeft = float(1).sub(age.div(lifespan.max(float(0.001)))).clamp(0, 1);
      const alpha = min(float(1), lifeLeft.mul(float(1.9)));

      const twSpeed = aTwink.x;
      const twPhase = aTwink.y;
      const hasTwinkle = twSpeed.greaterThan(float(0));
      const wave = sin(uTime.mul(twSpeed).add(twPhase));
      const twinkleVal = float(0.2).add(float(0.8).mul(float(0.5).add(float(0.5).mul(wave))));
      const finalTwinkle = hasTwinkle.select(twinkleVal, float(1));

      // Centered plane UV in [-0.5, 0.5]
      const uvOffset = positionGeometry.xy;
      const dist = uvOffset.length().mul(2.0);
      const radialAlpha = float(1.0).sub(dist).clamp(0, 1);
      const glowAlpha = pow(radialAlpha, float(2.0));

      const flareX = float(1.0).sub(uvOffset.x.abs().mul(2.0)).clamp(0, 1);
      const flareY = float(1.0).sub(uvOffset.y.abs().mul(2.0)).clamp(0, 1);
      const crossStreak = pow(flareX, float(14.0)).mul(pow(flareY, float(1.5)))
        .add(pow(flareY, float(14.0)).mul(pow(flareX, float(1.5))))
        .mul(0.6);

      const texAlpha = glowAlpha.add(crossStreak).clamp(0, 1);
      const coreAlpha = pow(texAlpha, float(4)).mul(float(0.7));
      const col = mix(aColSize.xyz, vec3(1, 1, 1), coreAlpha);
      const finalAlpha = isDead.select(float(0), texAlpha.mul(alpha).mul(finalTwinkle).mul(uIntensity));

      return vec4(col, finalAlpha);
    })();

    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_PARTICLES);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.points = this.mesh;
  }

  public launchRandomFirework(): void {
    if (this.disposed) return;
    const x = rand(-5.5, 5.5);
    const z = rand(-2.0, -6.0);
    const y = 0;
    const vx = rand(-0.25, 0.25);
    const vz = rand(-0.25, 0.25);
    const vy = rand(5.2, 6.4);

    this.shells.push({
      x,
      y,
      z,
      vx,
      vy,
      vz,
      color: pickRandomColor(),
      type: pickRandomBurstType(),
      trailTimer: 0,
    });
  }

  public emit(
    px: number,
    py: number,
    pz: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    size: number,
    life: number,
    k: number,
    gravFac: number,
    twS = 0,
    twP = 0,
    birthDelay = 0,
  ): void {
    const idx = this.free.pop();
    if (idx === undefined) return;

    const delay = birthDelay || 0;
    const i3 = idx * 3;
    const i4 = idx * 4;
    const i2 = idx * 2;

    this.aInitPos[i3] = px;
    this.aInitPos[i3 + 1] = py;
    this.aInitPos[i3 + 2] = pz;

    this.aInitVel[i3] = vx;
    this.aInitVel[i3 + 1] = vy;
    this.aInitVel[i3 + 2] = vz;

    this.aColSize[i4] = r;
    this.aColSize[i4 + 1] = g;
    this.aColSize[i4 + 2] = b;
    this.aColSize[i4 + 3] = size;

    this.aPhys[i4] = G * gravFac;
    this.aPhys[i4 + 1] = k;
    this.aPhys[i4 + 2] = this.currentTime + delay;
    this.aPhys[i4 + 3] = life;

    this.aTwink[i2] = twS;
    this.aTwink[i2 + 1] = twP;

    this.expiry[idx] = this.currentTime + delay + life;
    this.live[this.liveCount] = idx;
    this.liveCount += 1;

    if (idx + 1 > this.hi) this.hi = idx + 1;
    if (idx < this.dirtyLo) this.dirtyLo = idx;
    if (idx + 1 > this.dirtyHi) this.dirtyHi = idx + 1;
  }

  public update(nowSeconds: number, dtSeconds: number): void {
    if (this.disposed) return;
    if (this.startTime < 0) {
      this.startTime = nowSeconds;
      this.nextLaunchTime = nowSeconds + FIRST_LAUNCH_DELAY_SECONDS;
    }
    this.currentTime = nowSeconds;
    this.uTime.value = nowSeconds;

    // Check automated launch schedule (first at 2s, recurring every 60s)
    if (this.currentTime >= this.nextLaunchTime) {
      this.launchRandomFirework();
      this.nextLaunchTime += RECURRING_LAUNCH_INTERVAL_SECONDS;
    }

    const dt = Math.min(0.05, Math.max(0, dtSeconds));
    this.updateShells(dt);
    this.reclaimExpired();
    this.uploadDirtyAttributes();
  }

  private updateShells(dt: number): void {
    for (let k = this.shells.length - 1; k >= 0; k -= 1) {
      const shell = this.shells[k];
      const drag = 1 - 0.08 * dt;

      shell.vy -= G * dt;
      shell.vx *= drag;
      shell.vy *= drag;
      shell.vz *= drag;

      shell.x += shell.vx * dt;
      shell.y += shell.vy * dt;
      shell.z += shell.vz * dt;

      shell.trailTimer -= dt;
      if (shell.trailTimer <= 0) {
        shell.trailTimer = 0.015;
        for (let n = 0; n < 2; n += 1) {
          this.emit(
            shell.x + rand(-0.06, 0.06),
            shell.y + rand(-0.06, 0.06),
            shell.z + rand(-0.06, 0.06),
            rand(-0.25, 0.25),
            -shell.vy * 0.08 + rand(-0.2, 0.2),
            rand(-0.25, 0.25),
            1.0,
            0.78,
            0.42,
            0.6,
            rand(0.25, 0.45),
            1.8,
            0.4,
            rand(25, 40),
            Math.random() * TAU,
          );
        }
        this.emit(shell.x, shell.y, shell.z, 0, 0, 0, 1, 0.95, 0.82, 0.9, 0.08, 0, 0, 0, 0);
      }

      // Peak of ascent
      if (shell.vy <= 0.6) {
        this.explode(shell);
        this.shells.splice(k, 1);
      }
    }
  }

  private explode(shell: FireworkShell): void {
    // Core flash
    this.emit(shell.x, shell.y, shell.z, 0, 0, 0, 1, 1, 0.95, 3.5, 0.15, 0, 0, 0, 0);

    switch (shell.type) {
      case 'willow':
        this.burstWillow(shell);
        break;
      case 'ring':
        this.burstRing(shell);
        break;
      case 'palette':
        this.burstPalette(shell);
        break;
      case 'double':
        this.burstDouble(shell);
        break;
      case 'glitter':
        this.burstGlitter(shell);
        break;
      default:
        this.burstPeony(shell);
    }
  }

  private burstPeony(shell: FireworkShell): void {
    const n = randInt(220, 320);
    const speed = rand(2.8, 4.2) * BURST_SPREAD;
    const c = shell.color;
    const secondary = Math.random() < 0.4 ? pickRandomColor() : null;

    for (let i = 0; i < n; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.85, 1.15);
      const col = secondary && Math.random() < 0.5 ? secondary : c;
      const gl = Math.random() < 0.22;

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        rr * Math.cos(th) * sp,
        u * sp,
        rr * Math.sin(th) * sp,
        col.r,
        col.g,
        col.b,
        rand(0.7, 1.1),
        rand(1.3, 2.1),
        1.1,
        0.8,
        gl ? rand(14, 28) : 0,
        gl ? Math.random() * TAU : 0,
      );
    }
  }

  private burstPalette(shell: FireworkShell): void {
    const n = randInt(220, 300);
    const speed = rand(2.8, 4.0) * BURST_SPREAD;

    for (let i = 0; i < n; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.8, 1.15);
      const col = pickRandomColor();
      const gl = Math.random() < 0.3;

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        rr * Math.cos(th) * sp,
        u * sp,
        rr * Math.sin(th) * sp,
        col.r,
        col.g,
        col.b,
        rand(0.7, 1.0),
        rand(1.3, 2.1),
        1.1,
        0.8,
        gl ? rand(14, 28) : 0,
        gl ? Math.random() * TAU : 0,
      );
    }
  }

  private burstWillow(shell: FireworkShell): void {
    const strands = randInt(120, 160);
    const speed = rand(2.6, 3.6) * BURST_SPREAD;

    for (let i = 0; i < strands; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.85, 1.1);
      const vx = rr * Math.cos(th) * sp;
      const vy = u * sp + rand(0.2, 0.6);
      const vz = rr * Math.sin(th) * sp;
      const life = rand(2.8, 3.8);

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        vx,
        vy,
        vz,
        1.0,
        0.72,
        0.32,
        0.8,
        life,
        0.45,
        0.85,
      );

      for (let j = 1; j <= 10; j += 1) {
        const off = j * 0.06;
        const ll = life - off;
        if (ll <= 0.06) break;

        this.emit(
          shell.x,
          shell.y,
          shell.z,
          vx + rand(-0.06, 0.06),
          vy + rand(-0.06, 0.06),
          vz + rand(-0.06, 0.06),
          1.0,
          Math.max(0.4, 0.66 - j * 0.025),
          0.22,
          Math.max(0.4, 0.8 - j * 0.04),
          ll,
          0.45,
          0.85,
          0,
          0,
          off,
        );
      }
    }
  }

  private burstRing(shell: FireworkShell): void {
    const nr = randInt(90, 120);
    const c = shell.color;
    const cc = pickRandomColor();
    const ax = Math.random() * Math.PI;
    const ay = Math.random() * Math.PI;
    const ca = Math.cos(ax);
    const sa = Math.sin(ax);
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);

    for (let i = 0; i < nr; i += 1) {
      const a = (i / nr) * TAU;
      const dx0 = Math.cos(a);
      const dy0 = 0;
      const dz0 = Math.sin(a);

      const y1 = dy0 * ca - dz0 * sa;
      const z1 = dy0 * sa + dz0 * ca;
      const x1 = dx0 * cy + z1 * sy;
      const z2 = -dx0 * sy + z1 * cy;

      const sp = rand(3.0, 3.8) * BURST_SPREAD;
      this.emit(
        shell.x,
        shell.y,
        shell.z,
        x1 * sp,
        y1 * sp,
        z2 * sp,
        c.r,
        c.g,
        c.b,
        0.8,
        rand(1.4, 2.0),
        0.9,
        0.75,
      );
    }

    for (let i = 0; i < 50; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = rand(1.2, 2.0) * BURST_SPREAD;

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        rr * Math.cos(th) * sp,
        u * sp,
        rr * Math.sin(th) * sp,
        cc.r,
        cc.g,
        cc.b,
        0.7,
        rand(1.0, 1.5),
        1.2,
        0.8,
      );
    }
  }

  private burstDouble(shell: FireworkShell): void {
    const c1 = shell.color;
    const c2 = pickRandomColor();

    for (let i = 0; i < 110; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = rand(1.6, 2.4) * BURST_SPREAD;

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        rr * Math.cos(th) * sp,
        u * sp,
        rr * Math.sin(th) * sp,
        c1.r,
        c1.g,
        c1.b,
        0.75,
        rand(1.2, 1.8),
        1.1,
        0.8,
      );
    }

    for (let i = 0; i < 150; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = rand(3.4, 4.4) * BURST_SPREAD;
      const gl = Math.random() < 0.3;

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        rr * Math.cos(th) * sp,
        u * sp,
        rr * Math.sin(th) * sp,
        c2.r,
        c2.g,
        c2.b,
        0.8,
        rand(1.5, 2.2),
        0.95,
        0.8,
        gl ? rand(16, 30) : 0,
        gl ? Math.random() * TAU : 0,
      );
    }
  }

  private burstGlitter(shell: FireworkShell): void {
    const n = randInt(180, 260);
    const speed = rand(2.6, 3.8) * BURST_SPREAD;
    const gold = Math.random() < 0.5;
    const r = gold ? 1.0 : 0.82;
    const g = gold ? 0.85 : 0.9;
    const b = gold ? 0.5 : 1.0;

    for (let i = 0; i < n; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.7, 1.15);

      this.emit(
        shell.x,
        shell.y,
        shell.z,
        rr * Math.cos(th) * sp,
        u * sp,
        rr * Math.sin(th) * sp,
        r,
        g,
        b,
        rand(0.7, 1.0),
        rand(1.5, 2.5),
        1.0,
        0.8,
        rand(18, 34),
        Math.random() * TAU,
      );
    }
  }

  private reclaimExpired(): void {
    let w = 0;
    for (let r = 0; r < this.liveCount; r += 1) {
      const idx = this.live[r];
      if (this.currentTime >= this.expiry[idx]) {
        this.free.push(idx);
      } else {
        this.live[w] = idx;
        w += 1;
      }
    }
    this.liveCount = w;
  }

  private uploadDirtyAttributes(): void {
    if (this.dirtyHi <= this.dirtyLo) return;
    this.ipAttr.needsUpdate = true;
    this.ivAttr.needsUpdate = true;
    this.csAttr.needsUpdate = true;
    this.phAttr.needsUpdate = true;
    this.twAttr.needsUpdate = true;
    this.dirtyLo = Infinity;
    this.dirtyHi = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.shells = [];
    this.geometry.dispose();
    this.material.dispose();
  }
}
