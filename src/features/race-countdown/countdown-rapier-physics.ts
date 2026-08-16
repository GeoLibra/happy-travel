import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface CountdownRapierOptions {
  maxParticles?: number;
  cubeSize?: number;
  gravity?: { x: number; y: number; z: number };
  restitution?: number;
  friction?: number;
  groundDwellSeconds?: number;
  fadeSeconds?: number;
}

export type VoxelParticleState = 'inactive' | 'falling' | 'dwelling' | 'fading';

let rapierInitPromise: Promise<typeof RAPIER> | null = null;

export async function initRapier(): Promise<typeof RAPIER> {
  if (!rapierInitPromise) {
    rapierInitPromise = RAPIER.init().then(() => RAPIER);
  }
  return rapierInitPromise;
}

export class CountdownRapierPhysics {
  public static readonly DEFAULT_MAX_PARTICLES = 600;
  public static readonly DEFAULT_CUBE_SIZE = 0.155;
  public static readonly DEFAULT_GRAVITY = { x: 0, y: -12.0, z: 0 };
  public static readonly DEFAULT_RESTITUTION = 0.22;
  public static readonly DEFAULT_FRICTION = 0.65;
  public static readonly DEFAULT_DWELL_SECONDS = 12.0;
  public static readonly DEFAULT_FADE_SECONDS = 0.4;
  public static readonly TARGET_ACTIVE_CAP = 250;

  public readonly world: RAPIER.World;
  public readonly groundCollider: RAPIER.Collider;
  public readonly boundaryColliders: RAPIER.Collider[] = [];
  public vehicleCollider: RAPIER.Collider | null = null;

  public readonly maxParticles: number;
  public readonly cubeSize: number;
  public readonly groundDwellSeconds: number;
  public readonly fadeSeconds: number;

  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly slotActive: Uint8Array;
  private readonly states: VoxelParticleState[];
  private readonly dwellTimes: Float32Array;
  private readonly fadeTimes: Float32Array;
  public readonly scales: Float32Array;
  public readonly noiseOrigins: Float32Array;
  private readonly activeIndices: Int32Array;
  private activeCount = 0;
  private poolIndex = 0;

  private readonly tempPos = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();
  private readonly tempScale = new THREE.Vector3();
  private readonly tempMatrix = new THREE.Matrix4();
  private disposed = false;

  public static async create(options: CountdownRapierOptions = {}): Promise<CountdownRapierPhysics> {
    await initRapier();
    return new CountdownRapierPhysics(options);
  }

  constructor(options: CountdownRapierOptions = {}) {
    this.maxParticles = options.maxParticles ?? CountdownRapierPhysics.DEFAULT_MAX_PARTICLES;
    this.cubeSize = options.cubeSize ?? CountdownRapierPhysics.DEFAULT_CUBE_SIZE;
    this.groundDwellSeconds = options.groundDwellSeconds ?? CountdownRapierPhysics.DEFAULT_DWELL_SECONDS;
    this.fadeSeconds = options.fadeSeconds ?? CountdownRapierPhysics.DEFAULT_FADE_SECONDS;

    const gravity = options.gravity ?? CountdownRapierPhysics.DEFAULT_GRAVITY;
    this.world = new RAPIER.World(gravity);

    const restitution = options.restitution ?? CountdownRapierPhysics.DEFAULT_RESTITUTION;
    const friction = options.friction ?? CountdownRapierPhysics.DEFAULT_FRICTION;

    // Ground collider at Y = 0 (thick cuboid with top surface at Y = 0)
    const groundDesc = RAPIER.ColliderDesc.cuboid(50, 1.0, 50)
      .setTranslation(0, -1.0, 0)
      .setRestitution(restitution)
      .setFriction(friction);
    this.groundCollider = this.world.createCollider(groundDesc);

    // Invisible perimeter containment walls so cubes don't fly to infinity
    const wallLeft = RAPIER.ColliderDesc.cuboid(1.0, 10.0, 40.0).setTranslation(-18.0, 10.0, 0);
    const wallRight = RAPIER.ColliderDesc.cuboid(1.0, 10.0, 40.0).setTranslation(18.0, 10.0, 0);
    const wallBack = RAPIER.ColliderDesc.cuboid(40.0, 10.0, 1.0).setTranslation(0, 10.0, -16.0);
    const wallFront = RAPIER.ColliderDesc.cuboid(40.0, 10.0, 1.0).setTranslation(0, 10.0, 16.0);

    this.boundaryColliders.push(
      this.world.createCollider(wallLeft),
      this.world.createCollider(wallRight),
      this.world.createCollider(wallBack),
      this.world.createCollider(wallFront),
    );

    this.slotActive = new Uint8Array(this.maxParticles);
    this.states = new Array(this.maxParticles).fill('inactive');
    this.dwellTimes = new Float32Array(this.maxParticles).fill(-1);
    this.fadeTimes = new Float32Array(this.maxParticles).fill(-1);
    this.scales = new Float32Array(this.maxParticles).fill(0);
    this.noiseOrigins = new Float32Array(this.maxParticles * 3);
    this.activeIndices = new Int32Array(this.maxParticles);

    const half = this.cubeSize / 2;
    for (let i = 0; i < this.maxParticles; i += 1) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, -999, 0)
        .setLinearDamping(0.85)
        .setAngularDamping(1.2);
      const body = this.world.createRigidBody(bodyDesc);
      body.setEnabled(false);

      const colliderDesc = RAPIER.ColliderDesc.cuboid(half, half, half)
        .setRestitution(restitution)
        .setFriction(friction)
        .setDensity(1.0);
      this.world.createCollider(colliderDesc, body);
      this.bodies.push(body);
    }
  }

  public spawnCube(
    worldX: number,
    worldY: number,
    worldZ: number,
    noiseOrigin: [number, number, number],
    initialVel?: [number, number, number],
    initialAngVel?: [number, number, number],
  ): number {
    if (this.disposed) return -1;

    const p = this.poolIndex;
    this.poolIndex = (this.poolIndex + 1) % this.maxParticles;

    const body = this.bodies[p];
    body.setEnabled(true);
    body.setTranslation({ x: worldX, y: worldY, z: worldZ }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);

    const vx = initialVel ? initialVel[0] : (Math.random() - 0.5) * 1.2;
    const vy = initialVel ? initialVel[1] : (Math.random() - 0.5) * 0.3;
    const vz = initialVel ? initialVel[2] : (Math.random() - 0.5) * 0.7;
    body.setLinvel({ x: vx, y: vy, z: vz }, true);

    const wx = initialAngVel ? initialAngVel[0] : (Math.random() - 0.5) * 5.0;
    const wy = initialAngVel ? initialAngVel[1] : (Math.random() - 0.5) * 5.0;
    const wz = initialAngVel ? initialAngVel[2] : (Math.random() - 0.5) * 5.0;
    body.setAngvel({ x: wx, y: wy, z: wz }, true);
    body.wakeUp();

    this.slotActive[p] = 1;
    this.states[p] = 'falling';
    this.dwellTimes[p] = -1;
    this.fadeTimes[p] = -1;
    this.scales[p] = 1.0;
    this.noiseOrigins[p * 3] = noiseOrigin[0];
    this.noiseOrigins[p * 3 + 1] = noiseOrigin[1];
    this.noiseOrigins[p * 3 + 2] = noiseOrigin[2];

    this.activeIndices[this.activeCount] = p;
    this.activeCount += 1;

    return p;
  }

  public step(dt: number): void {
    if (this.disposed || dt <= 0) return;
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));

    this.world.timestep = clampedDt;
    this.world.step();

    if (this.activeCount === 0) return;

    // Dynamic pressure relief: if many cubes accumulate in piles, accelerate dwell timer of oldest cubes
    const pressureMultiplier = this.activeCount > CountdownRapierPhysics.TARGET_ACTIVE_CAP
      ? (this.activeCount / CountdownRapierPhysics.TARGET_ACTIVE_CAP) * 1.5
      : 1.0;

    let write = 0;
    for (let n = 0; n < this.activeCount; n += 1) {
      const p = this.activeIndices[n];
      if (this.slotActive[p] === 0) continue;

      const body = this.bodies[p];
      const state = this.states[p];

      if (state === 'fading') {
        const nextFade = this.fadeTimes[p] + clampedDt;
        const remainingScale = Math.max(0, 1 - nextFade / this.fadeSeconds);
        this.scales[p] = remainingScale;
        this.fadeTimes[p] = nextFade;

        if (remainingScale <= 0) {
          this.slotActive[p] = 0;
          this.states[p] = 'inactive';
          body.setEnabled(false);
          continue;
        }

        this.activeIndices[write] = p;
        write += 1;
        continue;
      }

      if (state === 'dwelling') {
        const nextDwell = this.dwellTimes[p] + clampedDt * pressureMultiplier;
        this.dwellTimes[p] = nextDwell;

        if (nextDwell >= this.groundDwellSeconds) {
          this.states[p] = 'fading';
          this.fadeTimes[p] = 0;
          // Disable rigid body physics while shrinking to avoid CPU contact solving
          body.setEnabled(false);
        }

        this.activeIndices[write] = p;
        write += 1;
        continue;
      }

      // state === 'falling'
      const vel = body.linvel();
      const angVel = body.angvel();
      const linSpeed = Math.hypot(vel.x, vel.y, vel.z);
      const angSpeed = Math.hypot(angVel.x, angVel.y, angVel.z);
      const pos = body.translation();

      // Check if settled (on floor or atop stack pile anywhere below spawn height)
      const isLowSpeed = linSpeed < 0.20 && angSpeed < 0.35;
      const isSleeping = body.isSleeping();
      const isBelowSpawn = pos.y <= 3.5;

      if ((isSleeping || isLowSpeed) && isBelowSpawn) {
        this.states[p] = 'dwelling';
        this.dwellTimes[p] = 0;
        body.sleep();
      }

      this.activeIndices[write] = p;
      write += 1;
    }

    this.activeCount = write;
  }

  public updateVehicleCollider(
    position: { x: number; y: number; z: number },
    halfExtents: { x: number; y: number; z: number } = { x: 1.1, y: 0.4, z: 2.2 },
  ): void {
    if (this.disposed) return;
    if (this.vehicleCollider) {
      this.vehicleCollider.setTranslation(position);
    } else {
      const desc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setTranslation(position.x, position.y, position.z)
        .setRestitution(0.3)
        .setFriction(0.6);
      this.vehicleCollider = this.world.createCollider(desc);
    }
  }

  public removeVehicleCollider(): void {
    if (this.vehicleCollider && !this.disposed) {
      this.world.removeCollider(this.vehicleCollider, false);
      this.vehicleCollider = null;
    }
  }

  public syncToInstancedMesh(
    mesh: THREE.InstancedMesh,
    scaleAttr?: THREE.InstancedBufferAttribute,
    noiseAttr?: THREE.InstancedBufferAttribute,
  ): void {
    if (this.disposed) return;
    let anyNeedsUpdate = false;

    for (let i = 0; i < this.maxParticles; i += 1) {
      const active = this.slotActive[i] === 1;
      const scale = this.scales[i];

      if (!active || scale <= 0) {
        this.tempMatrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, this.tempMatrix);
        anyNeedsUpdate = true;
        continue;
      }

      const body = this.bodies[i];
      const pos = body.translation();
      const rot = body.rotation();

      this.tempPos.set(pos.x, pos.y, pos.z);
      this.tempQuat.set(rot.x, rot.y, rot.z, rot.w);
      this.tempScale.set(scale, scale, scale);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      mesh.setMatrixAt(i, this.tempMatrix);
      anyNeedsUpdate = true;
    }

    if (anyNeedsUpdate) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (scaleAttr) {
      scaleAttr.array.set(this.scales);
      scaleAttr.needsUpdate = true;
    }
    if (noiseAttr) {
      noiseAttr.array.set(this.noiseOrigins);
      noiseAttr.needsUpdate = true;
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getParticleState(index: number): VoxelParticleState {
    if (index < 0 || index >= this.maxParticles) return 'inactive';
    return this.states[index];
  }

  public reset(): void {
    if (this.disposed) return;
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (this.slotActive[i] === 1) {
        this.bodies[i].setEnabled(false);
      }
    }
    this.slotActive.fill(0);
    this.states.fill('inactive');
    this.dwellTimes.fill(-1);
    this.fadeTimes.fill(-1);
    this.scales.fill(0);
    this.noiseOrigins.fill(0);
    this.activeCount = 0;
    this.poolIndex = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    this.bodies.length = 0;
    this.boundaryColliders.length = 0;
    this.vehicleCollider = null;
    this.world.free();
  }
}
