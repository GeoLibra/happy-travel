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
  burstScale?: number;
}

const MAX_PARTICLES = 32768;
const G = 4.2;
const BURST_SPREAD = 1.35;
const SIZE_SCALE = 0.28;
const INTENSITY = 1.6;
const FIRST_LAUNCH_DELAY_SECONDS = 2.0;
const RECURRING_LAUNCH_INTERVAL_SECONDS = 60.0;
const TAU = Math.PI * 2;

const PALETTE: THREE.Color[] = [
  new THREE.Color().setHSL(0 / 360, 1.0, 0.6),    // Red
  new THREE.Color().setHSL(25 / 360, 1.0, 0.58),  // Orange
  new THREE.Color().setHSL(48 / 360, 1.0, 0.6),   // Gold/Yellow
  new THREE.Color().setHSL(120 / 360, 0.9, 0.55), // Green
  new THREE.Color().setHSL(175 / 360, 1.0, 0.58), // Electric Cyan
  new THREE.Color().setHSL(210 / 360, 1.0, 0.6),  // Sky Blue
  new THREE.Color().setHSL(240 / 360, 1.0, 0.65), // Royal Blue
  new THREE.Color().setHSL(285 / 360, 0.95, 0.66),// Purple
  new THREE.Color().setHSL(335 / 360, 1.0, 0.68), // Neon Magenta
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
  if (r < 0.22) return 'willow';
  if (r < 0.44) return 'double';
  if (r < 0.62) return 'peony';
  if (r < 0.78) return 'palette';
  if (r < 0.90) return 'ring';
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

    // Vertex shader: Closed-form trajectory physics + camera billboard alignment
    this.material.vertexNode = Fn(() => {
      const birth = aPhys.z;
      const lifespan = aPhys.w;
      const age = uTime.sub(birth);
      const isDead = age.lessThan(float(0)).or(age.greaterThan(lifespan)).or(lifespan.lessThanEqual(float(0)));
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

    // Fragment shader: Exact 1:1 needle star flares + radial core over-exposure
    this.material.outputNode = Fn(() => {
      const birth = aPhys.z;
      const lifespan = aPhys.w;
      const age = uTime.sub(birth);
      const isDead = age.lessThan(float(0)).or(age.greaterThan(lifespan)).or(lifespan.lessThanEqual(float(0)));
      const lifeLeft = float(1).sub(age.div(lifespan.max(float(0.001)))).clamp(0, 1);
      const alpha = min(float(1), lifeLeft.mul(float(1.9)));

      const twSpeed = aTwink.x;
      const twPhase = aTwink.y;
      const hasTwinkle = twSpeed.greaterThan(float(0));
      const wave = sin(uTime.mul(twSpeed).add(twPhase));
      const twinkleVal = float(0.2).add(float(0.8).mul(float(0.5).add(float(0.5).mul(wave))));
      const finalTwinkle = hasTwinkle.select(twinkleVal, float(1));

      // Centered plane UV in [-0.5, 0.5]
      const uv = positionGeometry.xy;
      const r = uv.length().mul(2.0);
      const radial = float(1.0).sub(r).clamp(0, 1);
      const glow = pow(radial, float(2.5));

      // 4-pointed sharp needle star flares matching reference mt3d texture
      const ax = uv.x.abs().mul(2.0);
      const ay = uv.y.abs().mul(2.0);
      const fx = float(1.0).sub(ax).clamp(0, 1);
      const fy = float(1.0).sub(ay).clamp(0, 1);

      const flare1 = pow(fx, float(24.0)).mul(pow(fy, float(1.8)));
      const flare2 = pow(fy, float(24.0)).mul(pow(fx, float(1.8)));
      const star = flare1.add(flare2).mul(0.7);

      const texAlpha = glow.add(star).clamp(0, 1);
      const coreAlpha = pow(texAlpha, float(5.0)).mul(float(0.45));
      const col = mix(aColSize.xyz, vec3(1.0, 1.0, 1.0), coreAlpha);
      const finalAlpha = isDead.select(float(0), texAlpha.mul(alpha).mul(finalTwinkle).mul(uIntensity));

      return vec4(col, finalAlpha);
    })();

    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_PARTICLES);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.points = this.mesh;
  }

  public launchFestivalDisplay(): void {
    this.launchRandomFirework();
  }

  public launchRandomFirework(): void {
    if (this.disposed || this.shells.length > 0 || this.liveCount > 0) return;
    const x = rand(-5.0, 5.0);
    const z = rand(-2.0, -5.5);
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

    // Check automated launch schedule (first festival display at 2s, recurring every 60s)
    if (this.currentTime >= this.nextLaunchTime) {
      this.launchFestivalDisplay();
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
        shell.trailTimer = 0.012;
        // Rising rocket trail sparks
        for (let n = 0; n < 3; n += 1) {
          this.emit(
            shell.x + rand(-0.05, 0.05),
            shell.y + rand(-0.05, 0.05),
            shell.z + rand(-0.05, 0.05),
            rand(-0.2, 0.2),
            -shell.vy * 0.12 + rand(-0.15, 0.15),
            rand(-0.2, 0.2),
            1.0,
            0.82,
            0.45,
            0.75,
            rand(0.28, 0.52),
            1.8,
            0.4,
            rand(25, 45),
            Math.random() * TAU,
          );
        }
        // Bright leading comet core
        this.emit(shell.x, shell.y, shell.z, 0, 0, 0, 1, 0.98, 0.88, 1.2, 0.08, 0, 0, 0, 0);
      }

      // Peak of ascent
      if (shell.vy <= 0.6) {
        this.explode(shell);
        this.shells.splice(k, 1);
      }
    }
  }

  private explode(shell: FireworkShell): void {
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
    const scale = shell.burstScale || 1.0;
    const n = randInt(350, 480);
    const speed = rand(3.2, 4.6) * BURST_SPREAD * scale;
    const c = shell.color;
    const secondary = Math.random() < 0.45 ? pickRandomColor() : null;

    for (let i = 0; i < n; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.85, 1.15);
      const col = secondary && Math.random() < 0.5 ? secondary : c;
      const gl = Math.random() < 0.25;

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
        rand(0.75, 1.15),
        rand(1.5, 2.4),
        1.1,
        0.8,
        gl ? rand(16, 32) : 0,
        gl ? Math.random() * TAU : 0,
      );
    }
  }

  private burstPalette(shell: FireworkShell): void {
    const scale = shell.burstScale || 1.0;
    const n = randInt(360, 480);
    const speed = rand(3.2, 4.6) * BURST_SPREAD * scale;

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
        rand(0.75, 1.1),
        rand(1.5, 2.4),
        1.1,
        0.8,
        gl ? rand(16, 32) : 0,
        gl ? Math.random() * TAU : 0,
      );
    }
  }

  private burstWillow(shell: FireworkShell): void {
    const scale = shell.burstScale || 1.0;
    const strands = randInt(180, 240);
    const speed = rand(2.8, 4.0) * BURST_SPREAD * scale;

    for (let i = 0; i < strands; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.85, 1.1);
      const vx = rr * Math.cos(th) * sp;
      const vy = u * sp + rand(0.2, 0.7);
      const vz = rr * Math.sin(th) * sp;
      const life = rand(3.2, 4.2);

      // Lead golden spark
      this.emit(
        shell.x,
        shell.y,
        shell.z,
        vx,
        vy,
        vz,
        1.0,
        0.76,
        0.35,
        0.9,
        life,
        0.45,
        0.85,
      );

      // Dense cascading willow sub-particles (12 sparks per strand)
      for (let j = 1; j <= 12; j += 1) {
        const off = j * 0.055;
        const ll = life - off;
        if (ll <= 0.05) break;

        this.emit(
          shell.x,
          shell.y,
          shell.z,
          vx + rand(-0.05, 0.05),
          vy + rand(-0.05, 0.05),
          vz + rand(-0.05, 0.05),
          1.0,
          Math.max(0.42, 0.72 - j * 0.025),
          0.25,
          Math.max(0.45, 0.88 - j * 0.035),
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

  private burstDouble(shell: FireworkShell): void {
    const scale = shell.burstScale || 1.0;
    // 1:1 Sumida river double burst colors: Electric Cyan outer ring + Neon Pink inner core
    const c1 = new THREE.Color().setHSL(175 / 360, 1.0, 0.6);
    const c2 = new THREE.Color().setHSL(335 / 360, 1.0, 0.68);

    // Inner core dense ball
    for (let i = 0; i < 220; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = rand(1.8, 2.7) * BURST_SPREAD * scale;

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
        0.9,
        rand(1.4, 2.0),
        1.1,
        0.8,
      );
    }

    // Outer sparkling sphere
    for (let i = 0; i < 320; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = rand(3.6, 4.8) * BURST_SPREAD * scale;
      const gl = Math.random() < 0.35;

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
        1.0,
        rand(1.6, 2.5),
        0.95,
        0.8,
        gl ? rand(18, 32) : 0,
        gl ? Math.random() * TAU : 0,
      );
    }
  }

  private burstRing(shell: FireworkShell): void {
    const scale = shell.burstScale || 1.0;
    const nr = randInt(150, 190);
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

      const sp = rand(3.4, 4.4) * BURST_SPREAD * scale;
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
        0.95,
        rand(1.5, 2.3),
        0.9,
        0.75,
      );
    }

    for (let i = 0; i < 90; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = rand(1.3, 2.3) * BURST_SPREAD * scale;

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
        0.8,
        rand(1.1, 1.7),
        1.2,
        0.8,
      );
    }
  }

  private burstGlitter(shell: FireworkShell): void {
    const scale = shell.burstScale || 1.0;
    const n = randInt(300, 420);
    const speed = rand(3.0, 4.2) * BURST_SPREAD * scale;
    const gold = Math.random() < 0.5;
    const r = gold ? 1.0 : 0.85;
    const g = gold ? 0.88 : 0.92;
    const b = gold ? 0.55 : 1.0;

    for (let i = 0; i < n; i += 1) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.75, 1.15);

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
        rand(0.8, 1.15),
        rand(1.6, 2.6),
        1.0,
        0.8,
        rand(20, 38),
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
