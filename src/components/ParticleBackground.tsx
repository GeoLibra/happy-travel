import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GPUParticleSystem, GPUEffectUniforms } from './effects/gpuParticles';
import { GodRays } from './effects/godRays';
import { AudioVisualizer } from './effects/audioVisualizer';
import { DEFAULT_FORCE_FIELD_PARAMS } from './effects/forceField';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HologramShaderUniforms, applyHologramMaterial, revertHologramMaterial } from './hologram/HologramEffect';
import { getF1Depth, getTargetSpeed, stepF1Motion, type F1MotionState } from '../lib/f1-motion';
import { createF1ExplodedParts, resolveF1WheelNodes, updateF1ExplodedParts, type F1ExplodedPart } from '../lib/f1-model';
import { applyF1WheelAngle, createF1WheelMotionState, stepF1WheelMotion } from '../lib/f1-wheel-motion';
import { createF1Airflow } from './effects/f1Airflow';
import { createF1StudioLighting } from './effects/f1StudioLighting';
import { createStudioReflection } from './effects/studioReflection';

interface ParticleBackgroundProps {
  isPressing: boolean;
  progress: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  loadedModel?: THREE.Group | null;
  onCarClick?: () => void;
  exploded?: boolean;
}

const COLORS = {
  red: new THREE.Color('#E10600'),
  yellow: new THREE.Color('#FFB800'),
  white: new THREE.Color('#ffffff'),
  navy: new THREE.Color('#001A30'),
};

const SPEED_LINE_COUNT = 100;
const CPU_PARTICLE_COUNT = 1000;

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ isPressing, progress, audioRef, loadedModel, onCarClick, exploded = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track state in ref to avoid re-triggering the animation loop closure
  const stateRef = useRef({
    isPressing,
    progress,
    exploded,
    explosionTime: 0,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
    baseUniforms: {
      uTime: { value: 0 },
      uDelta: { value: 0 },
      uIsPressing: { value: isPressing },
      uProgress: { value: progress },
      uExplosionForce: { value: 0 },
      uFieldScale: { value: DEFAULT_FORCE_FIELD_PARAMS.scale },
      uFieldStrength: { value: DEFAULT_FORCE_FIELD_PARAMS.strength },
      uFieldSpeed: { value: DEFAULT_FORCE_FIELD_PARAMS.speed },
      uBassLevel: { value: 0 },
      uPixelRatio: { value: 1 },
    } as GPUEffectUniforms
  });

  useEffect(() => {
    stateRef.current.isPressing = isPressing;
  }, [isPressing]);

  useEffect(() => {
    stateRef.current.exploded = exploded;
  }, [exploded]);

  const modelRef = useRef<THREE.Group | null>(null);
  useEffect(() => {
    modelRef.current = loadedModel || null;
  }, [loadedModel]);

  useEffect(() => {
    if (progress >= 70 && stateRef.current.progress < 70) {
      stateRef.current.explosionTime = -1; // -1 indicates it needs to be set to clock time
    }
    stateRef.current.progress = progress;
  }, [progress]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    stateRef.current.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    stateRef.current.mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Base Scene Setup ──
    const scene = new THREE.Scene(); // Main scene for Car
    const bgScene = new THREE.Scene(); // Background scene for lines

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    // Static camera for background
    const bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    bgCamera.position.z = 50;
    bgCamera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    stateRef.current.baseUniforms.uPixelRatio.value = pixelRatio;

    // We will render bgScene first, then scene on top without clearing
    renderer.autoClear = false;

    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const usesLowPowerEffects = prefersReducedMotion || window.innerWidth < 768;
    const studioLighting = createF1StudioLighting(scene);
    const reflection = createStudioReflection({
      renderer,
      scene,
      camera,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      tier: usesLowPowerEffects ? 'fallback' : 'reflective',
    });
    reflection.floor.position.y = -10.1;
    const airflow = createF1Airflow(usesLowPowerEffects ? 'low' : 'high');
    const wheelMotion = createF1WheelMotionState();

    // ── Advanced Effects Initializers ──
    // const gpuParticles = new GPUParticleSystem(renderer);
    // const useGPU = gpuParticles.init(scene, stateRef.current.baseUniforms);
    const useGPU = false; // Force CPU fallback for now

    // const godRays = new GodRays();
    // const audioVisualizer = new AudioVisualizer();

    // We only connect audio after user interacted to bypass browser autoplay policies
    let audioConnected = false;

    // ── CPU Fallback Floating Particles ──
    let cpuParticles: THREE.Points | null = null;
    let particlePhases: Float32Array | null = null;

    if (!useGPU) {

      const pGeometry = new THREE.BufferGeometry();
      const pPositions = new Float32Array(CPU_PARTICLE_COUNT * 3);
      const pColors = new Float32Array(CPU_PARTICLE_COUNT * 3);
      const pSizes = new Float32Array(CPU_PARTICLE_COUNT);
      particlePhases = new Float32Array(CPU_PARTICLE_COUNT);

      const colorOptions = [COLORS.red, COLORS.yellow, COLORS.white, COLORS.white];

      for (let i = 0; i < CPU_PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        pPositions[i3] = (Math.random() - 0.5) * 200;
        pPositions[i3 + 1] = (Math.random() - 0.5) * 150;
        pPositions[i3 + 2] = (Math.random() - 0.5) * 160;

        const c = colorOptions[Math.floor(Math.random() * colorOptions.length)];
        pColors[i3] = c.r; pColors[i3 + 1] = c.g; pColors[i3 + 2] = c.b;

        pSizes[i] = Math.random() * 2.5 + 0.5;
        particlePhases[i] = Math.random() * Math.PI * 2;
      }

      pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      pGeometry.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
      pGeometry.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

      const pMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
        },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          uniform float uTime;
          uniform float uPixelRatio;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float dist = length(mvPosition.xyz);
          vAlpha = smoothstep(80.0, 20.0, dist) * 0.8;
            gl_PointSize = size * uPixelRatio * (50.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            gl_FragColor = vec4(vColor, vec3(pow(1.0 - smoothstep(0.0, 0.5, d), 1.5)) * vAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      cpuParticles = new THREE.Points(pGeometry, pMaterial);
      bgScene.add(cpuParticles);
    }

    // ── 3D Lighting for F1 Model ──
    const ambientLight = new THREE.HemisphereLight(0xeaf6ff, 0x17324a, 1.65);
    scene.add(ambientLight);

    // Bright camera-side key light keeps the dark carbon-fibre pieces readable
    // when they separate and no longer receive light bounced from nearby parts.
    const mainLight = new THREE.DirectionalLight(0xfff4dc, 3.4);
    mainLight.position.set(8, 16, 24);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8bd8ff, 2.25);
    fillLight.position.set(-18, 8, 16);
    scene.add(fillLight);

    const lowerFillLight = new THREE.PointLight(0xffc85a, 2.4, 90, 1.4);
    lowerFillLight.position.set(4, -4, 18);
    scene.add(lowerFillLight);

    // Core inspection light. It sits at the assembled model's local center and
    // shines outward as parts separate, revealing the chassis and suspension.
    const explodedCoreLight = new THREE.PointLight(0x77e7ff, 0.35, 78, 1.15);
    const explodedCoreAnchor = new THREE.Vector3();
    const explodedCoreWorldPosition = new THREE.Vector3();
    scene.add(explodedCoreLight);

    const rimLight = new THREE.DirectionalLight(0xE10600, 1.8);
    rimLight.position.set(-10, 5, -5);
    scene.add(rimLight);

    // ── F1 Car 3D Model Integration ──
    let f1CarGroup: THREE.Group | null = null;
    let f1Wheels: THREE.Object3D[] = [];
    let f1ExplodedParts: F1ExplodedPart[] = [];
    let explodeAmount = 0;
    let isCarMaterialReplaced = false;
    const racingMotion: F1MotionState = { speed: 0, wheelAngle: 0 };

    // We'll check for modelRef.current dynamically in the animate loop to support late arrivals
    const checkModelInjection = () => {
      if (!f1CarGroup && modelRef.current) {
        f1CarGroup = modelRef.current;
        f1Wheels = resolveF1WheelNodes(f1CarGroup);
        f1ExplodedParts = createF1ExplodedParts(f1CarGroup);
        f1CarGroup.scale.set(8, 8, 8);
        f1CarGroup.rotation.y = 0; // Face the camera directly
        f1CarGroup.position.set(0, -10, getF1Depth(0));
        f1CarGroup.visible = false;
        f1CarGroup.updateMatrixWorld(true);

        const assembledCenterWorld = new THREE.Box3()
          .setFromObject(f1CarGroup)
          .getCenter(new THREE.Vector3());
        explodedCoreAnchor.copy(f1CarGroup.worldToLocal(assembledCenterWorld));

        if (!isCarMaterialReplaced) {
            isCarMaterialReplaced = applyHologramMaterial(f1CarGroup);
        }

        f1CarGroup.add(airflow.group);
        scene.add(f1CarGroup);

        // Performance Optimization: Pre-compile the model to avoid lag spikes
        if (renderer && scene && camera) {
          renderer.compile(scene, camera);
        }
      }
    };

    // ── Interaction Controls (Orbit) ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 100;
    controls.enabled = false;

    // ── High-Fidelity Speed Trails (Shader Lines) ──
    const TRAIL_COUNT = 15;
    const trailSegments = 20;
    const trailGeometry = new THREE.BufferGeometry();
    const trailPosAttrib = new Float32Array(TRAIL_COUNT * trailSegments * 3);
    const trailColorAttrib = new Float32Array(TRAIL_COUNT * trailSegments * 3);
    const trailAlphaAttrib = new Float32Array(TRAIL_COUNT * trailSegments);

    for(let i=0; i<TRAIL_COUNT; i++) {
        const color = Math.random() < 0.4 ? COLORS.red : Math.random() < 0.7 ? COLORS.yellow : COLORS.white;
        for(let j=0; j<trailSegments; j++) {
            const idx = (i * trailSegments + j);
            trailColorAttrib[idx * 3] = color.r;
            trailColorAttrib[idx * 3 + 1] = color.g;
            trailColorAttrib[idx * 3 + 2] = color.b;
            trailAlphaAttrib[idx] = 1.0 - (j / trailSegments);
        }
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPosAttrib, 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColorAttrib, 3));
    trailGeometry.setAttribute('alpha', new THREE.BufferAttribute(trailAlphaAttrib, 1));

    const trailMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `
        attribute vec3 color;
        attribute float alpha;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = alpha;
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha * 0.6);
        }
      `
    });

    // ── Cyberpunk Speed Hairlines (Fine Ground Lines & Sides) ──
    const HAIRLINE_COUNT = 3000; // Extremely dense to form a solid road
    const SIDE_LINE_COUNT = 400; // Vertical lines on the edges
    const TOTAL_LINES = HAIRLINE_COUNT + SIDE_LINE_COUNT;

    // Base geometry: simple thin plane. We will scale it in instanceMatrix.
    const hairGeo = new THREE.PlaneGeometry(1, 1);
    // Move pivot to front edge so they scale from camera outwards nicely
    hairGeo.translate(0, 0, -0.5);

    const hairMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const hairMesh = new THREE.InstancedMesh(hairGeo, hairMat, TOTAL_LINES);

    // The road needs to stay locked to the car's bottom, no matter the progress
    hairMesh.position.y = -10.05;

    const hairData: { x: number, y: number, z: number, speedMultiplier: number, length: number, width: number, isVertical: boolean }[] = [];
    const dummyHair = new THREE.Object3D();

    for (let i = 0; i < TOTAL_LINES; i++) {
        const isVertical = i >= HAIRLINE_COUNT;

        let x, y, z;
        let c: THREE.Color;
        const rng = Math.random();

        if (!isVertical) {
            // -- GROUND LINES --
            // Spread X: concentrated in the center, tapering out. Range ~[-35, 35]
            const xDist = (Math.pow(Math.random(), 3.0) * 45);
            x = Math.random() < 0.5 ? xDist : -xDist;
            y = 0; // Flat on the road

            // Strict color matching based on the reference image
            if (Math.abs(x) < 4) {
                 // Center track: Bright exhaust lines. Mostly fine white, some bright blue/purple hues
                 c = rng > 0.95 ? new THREE.Color('#d4e4ff') : COLORS.white;
            } else if (x < -2) {
                // Left side: Icy cyan blue to deep blue
                c = new THREE.Color().lerpColors(new THREE.Color('#00ccff'), new THREE.Color('#0033cc'), Math.abs(x)/45);
            } else if (x > 2) {
                // Right side: Bright magenta to deep purple
                c = new THREE.Color().lerpColors(new THREE.Color('#e040fb'), new THREE.Color('#651fff'), Math.abs(x)/45);
            } else {
                 c = COLORS.white;
            }
        } else {
            // -- SIDE WALL LINES --
            // Like a U-shaped half-pipe. They run parallel to the road (pointing down Z),
            // but their positions curve up the side walls.
            const wallCurveX = 30 + Math.random() * 25; // How far out they are (X)
            x = Math.random() < 0.5 ? wallCurveX : -wallCurveX;
            // Curve up into the sky. The further out (X), the higher (Y)
            const curveFactor = Math.abs(x) - 30; // 0 to 25
            y = Math.pow(Math.random(), 2.0) * (curveFactor * 8);

            if (x < 0) {
                 // Left wall: deep blue
                 c = new THREE.Color().lerpColors(new THREE.Color('#0055ff'), new THREE.Color('#001155'), y/200);
            } else {
                 // Right wall: deep purple
                 c = new THREE.Color().lerpColors(new THREE.Color('#9900ff'), new THREE.Color('#220044'), y/200);
            }
        }

        z = (Math.random() - 0.5) * 800; // Deep back to right behind camera

        // Variance
        // Very long lines to create continuous feel without gaps
        const length = 100 + Math.random() * 300;

        // Fine hairlines: mostly very thin, rarely thick
        let width;
        if (!isVertical && Math.abs(x) < 3 && rng > 0.98) {
             width = 1.0 + Math.random() * 1.5; // Rare thick center glowing lines
        } else {
             width = 0.05 + Math.random() * 0.4;
        }

        const speedMultiplier = 0.5 + Math.random() * 0.8;

        // Apply
        dummyHair.position.set(x, y, z);

        // ALL lines point straight forward along the Z axis (parallel to the ground)!
        dummyHair.rotation.set(-Math.PI / 2, 0, 0);

        // If it's a wall line, we tilt its face towards the camera (rotating around its roll axis, which is now World Z)
        if (isVertical) {
             const faceAngle = Math.atan2(y + 10, Math.abs(x));
             dummyHair.rotateY(x < 0 ? -faceAngle : faceAngle);
        }

        dummyHair.scale.set(width, length, 1);
        dummyHair.updateMatrix();
        hairMesh.setMatrixAt(i, dummyHair.matrix);
        hairMesh.setColorAt(i, c);

        hairData.push({ x, y, z, speedMultiplier, length, width, isVertical });
    }
    hairMesh.instanceMatrix.needsUpdate = true;
    if (hairMesh.instanceColor) hairMesh.instanceColor.needsUpdate = true;

    bgScene.add(hairMesh);

    // ── Speed Lines (CPU-driven, low cost) ──
    const lineGeometry = new THREE.BufferGeometry();
    const lPositions = new Float32Array(SPEED_LINE_COUNT * 3);
    const lSpeeds = new Float32Array(SPEED_LINE_COUNT);
    const lColors = new Float32Array(SPEED_LINE_COUNT * 3);
    const lSizes = new Float32Array(SPEED_LINE_COUNT);

    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      const i3 = i * 3;
      lPositions[i3] = (Math.random() - 0.5) * 100;
      lPositions[i3 + 1] = (Math.random() - 0.5) * 60;
      lPositions[i3 + 2] = Math.random() * -100;
      lSpeeds[i] = Math.random() * 0.8 + 0.3;

      const color = Math.random() < 0.3 ? COLORS.red : Math.random() < 0.5 ? COLORS.yellow : COLORS.white;
      lColors[i3] = color.r; lColors[i3 + 1] = color.g; lColors[i3 + 2] = color.b;

      lSizes[i] = Math.random() * 3 + 1;
    }

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(lPositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lColors, 3));
    lineGeometry.setAttribute('size', new THREE.BufferAttribute(lSizes, 1));

    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio }, uOpacity: { value: 1.0 } },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = -mvPosition.z;
          vAlpha = smoothstep(100.0, 10.0, depth) * 0.7;
          gl_PointSize = size * uPixelRatio * (80.0 / depth);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uOpacity;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(vec2(uv.x * 0.3, uv.y));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, vec3(pow(1.0 - smoothstep(0.0, 0.5, d), 2.0)) * vAlpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const speedLines = new THREE.Points(lineGeometry, lineMaterial);
    speedLines.visible = false; // Hidden initially
    bgScene.add(speedLines);


    // ── Animation Loop ──
    const timer = new THREE.Timer();
    let frameId = 0;

    const animate = (timestamp: number) => {
      frameId = requestAnimationFrame(animate);
      checkModelInjection();

      timer.update(timestamp);
      const time = timer.getElapsed();
      const delta = Math.min(timer.getDelta(), 0.1);

      const s = stateRef.current;
      const targetRacingSpeed = getTargetSpeed(s.progress, s.isPressing);
      stepF1Motion(racingMotion, targetRacingSpeed, delta);
      const racingSpeed = racingMotion.speed;
      stepF1WheelMotion(wheelMotion, s.isPressing, delta, prefersReducedMotion);
      airflow.update({
        time,
        holdIntensity: wheelMotion.holdIntensity,
        reducedMotion: prefersReducedMotion,
      });
      studioLighting.update(wheelMotion.holdIntensity);

      const explodeTarget = s.progress >= 100 && s.exploded ? 1 : 0;
      explodeAmount += (explodeTarget - explodeAmount) * (1 - Math.exp(-delta * 4.2));
      updateF1ExplodedParts(f1ExplodedParts, explodeAmount, delta);
      explodedCoreLight.intensity = 0.35 + explodeAmount * 7.15;
      if (f1CarGroup) {
        explodedCoreWorldPosition
          .copy(explodedCoreAnchor)
          .applyMatrix4(f1CarGroup.matrixWorld);
        explodedCoreLight.position.copy(explodedCoreWorldPosition);
      }

      applyF1WheelAngle(f1Wheels, wheelMotion.angle);

      // Connect audio on first press
      /*
      if (s.isPressing && !audioConnected && audioRef?.current) {
        audioConnected = audioVisualizer.connect(audioRef.current);
        if (audioConnected) audioVisualizer.resume();
      }

      // Read audio data and map to force field
      const bands = audioVisualizer.getBands();
      s.baseUniforms.uBassLevel.value = bands.bass;
      s.baseUniforms.uFieldStrength.value = DEFAULT_FORCE_FIELD_PARAMS.strength + (bands.overall * 2.0);
      s.baseUniforms.uFieldSpeed.value = DEFAULT_FORCE_FIELD_PARAMS.speed + (bands.mid * 0.5);
      */
      // Update uniforms
      s.baseUniforms.uTime.value = time;
      s.baseUniforms.uDelta.value = delta;
      s.baseUniforms.uIsPressing.value = s.isPressing;
      s.baseUniforms.uProgress.value = s.progress;
      s.baseUniforms.uFieldSpeed.value = DEFAULT_FORCE_FIELD_PARAMS.speed + racingSpeed * 1.5;
      s.baseUniforms.uExplosionForce.value = 0;
      
      // Update Hologram/Progress Uniforms
      // Only animate hologram if progress is 100 (car is fully stopped).
      // Calculate a local progress from 0 to 1 over a few seconds starting when s.progress hit 100
      let hologramProgress = 0;
      if (s.progress >= 100) {
          // If we just hit 100, record the start time
          if (s.explosionTime < 0) {
              s.explosionTime = time;
          }
          
          // Animate hologram covering the car over 4.5 seconds (slower)
          const animationDuration = 4.5; 
          hologramProgress = Math.min(1.0, (time - s.explosionTime) / animationDuration);
          
          // Revert to original material when fully enveloped
          if (hologramProgress >= 1.0 && isCarMaterialReplaced && f1CarGroup) {
              if (revertHologramMaterial(f1CarGroup)) {
                  isCarMaterialReplaced = false; // Prevents calling it every frame
              }
          }
      } else {
          s.explosionTime = -1; 
          // If user lets go before 100%, re-apply the hologram effect next time it shows
          if (!isCarMaterialReplaced && f1CarGroup) {
              isCarMaterialReplaced = applyHologramMaterial(f1CarGroup);
          }
      }
      
      HologramShaderUniforms.uHologramProgress.value = hologramProgress;
      HologramShaderUniforms.uTime.value = time;
      if (f1CarGroup) {
          f1CarGroup.updateMatrixWorld(); 
          HologramShaderUniforms.uGroupMatrixInverse.value.copy(f1CarGroup.matrixWorld).invert();
      }

      // ── Camera Mouse Sway or OrbitControls ──
      // The bgCamera (background lines) only responds to mouse sway, NEVER OrbitControls
      bgCamera.position.x += (s.mouse.targetX * 3 - bgCamera.position.x) * 0.05;
      bgCamera.position.y += (s.mouse.targetY * 2 - bgCamera.position.y) * 0.05;
      bgCamera.lookAt(0, 0, 0);

      if (s.progress >= 100) {
        if (!controls.enabled) {
          controls.enabled = true;
          // Set target to the fixed ground zero instead of the car group, which drifts
          controls.target.set(0, 0, 0);
        }
        controls.update();
      } else {
        controls.enabled = false;
        camera.position.x = bgCamera.position.x;
        camera.position.y = bgCamera.position.y;
        camera.lookAt(0, 0, 0);
      }

      // ── Update Particles ──
      // Original CPU fallback loop restored for floating particles
      if (cpuParticles && particlePhases) {
        const pArr = cpuParticles.geometry.attributes.position.array as Float32Array;

        for (let i = 0; i < CPU_PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          let dx, dy, dz;

          // 只要进度>0且<100，就向中心反向加速聚集
          if (racingSpeed > 0.001) {
            const dirX = 0 - pArr[i3];
            const dirY = -25 - pArr[i3 + 1];
            const dist = Math.sqrt(dirX*dirX + dirY*dirY) || 1;
            const revForce = 2.0 + racingSpeed * racingSpeed * 12.0;
            dx = (dirX / dist) * revForce;
            dy = (dirY / dist) * revForce;
            dz = revForce * 1.5;

          } else {
            // 默认漂浮状态 (0% 和 100%)
            dx = Math.sin(time * 0.3 + particlePhases[i]) * 0.04;
            dy = Math.cos(time * 0.2 + particlePhases[i] * 1.3) * 0.03;
            dz = 0.5;
          }

          pArr[i3] += dx; pArr[i3 + 1] += dy; pArr[i3 + 2] += dz;

          // 边界重置：始终活跃，保证无论是在吸入中心还是漂浮时都不消失
          if (pArr[i3] < -200) pArr[i3] = 200;
          if (pArr[i3] > 200) pArr[i3] = -200;
          if (pArr[i3 + 1] < -150) pArr[i3 + 1] = 150;
          if (pArr[i3 + 1] > 150) pArr[i3 + 1] = -150;

          // Z轴动态循环：确保粒子永远在可见范围内循环
          if (pArr[i3 + 2] > 100) {
            pArr[i3 + 2] = -300;
          } else if (pArr[i3 + 2] < -300) {
            pArr[i3 + 2] = 100;
          }
        }
        cpuParticles.geometry.attributes.position.needsUpdate = true;
        (cpuParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
        cpuParticles.rotation.z = time * 0.02;
        cpuParticles.rotation.y = Math.sin(time * 0.1) * 0.1;
      }

      // ── Update F1 Car & Effects ──
      // Show car as soon as user starts pressing (0%+) or if progress >= 30% (auto-loading) or fully loaded
      if ((s.isPressing || s.progress >= 30) && f1CarGroup) {
        if (!f1CarGroup.visible) {
           f1CarGroup.visible = true;
        }

        // 0-100% Progress mapping
        const progressFactor = s.progress / 100;

        // Restore the original long-distance reveal while keeping the newer
        // wheel and environment motion.
        const targetZ = getF1Depth(s.progress);
        f1CarGroup.position.z += (targetZ - f1CarGroup.position.z) * 0.1;
        f1CarGroup.position.x = 0; // Stay centered
        const engineVibration =
          (Math.sin(time * 42) * 0.035 + Math.sin(time * 19) * 0.02) * racingSpeed;
        f1CarGroup.position.y = -10 + engineVibration;

        // Scale: Grow to a balanced size
        const targetScale = 8 + (progressFactor * 4); // Final scale 12
        f1CarGroup.scale.set(targetScale, targetScale, targetScale);

        // Rotation: Background Match turn without tilting the car into the floor
        if (s.progress < 100) {
            const turnFactor = Math.min(1, progressFactor * 1.25);

            // Y-axis: From 0 to 135 degrees (3/4 rear-to-side view)
            const targetRotY = turnFactor * (Math.PI * 0.25);
            f1CarGroup.rotation.y += (targetRotY - f1CarGroup.rotation.y) * 0.1;

            // X-axis: Stay flat on the road (remove tilt)
            f1CarGroup.rotation.x += (0 - f1CarGroup.rotation.x) * 0.1;

            // Z-axis: Subtle dynamic lean
            const targetRotZ =
              turnFactor * 0.05 +
              Math.sin(time * 10) * 0.008 * racingSpeed +
              Math.sin(time * 26) * 0.004 * racingSpeed;
            f1CarGroup.rotation.z += (targetRotZ - f1CarGroup.rotation.z) * 0.05;
        }
        // When progress >= 100, we just keep the final rotation values intact so it doesn't snap!

        // Update Trails (Trailing logic) (Removed old shader trail logic)
        // ... handled elsewhere if needed

      } else if (f1CarGroup) {
        f1CarGroup.visible = false;
      }

      // ── Update Hairline Road & Speed Lines Fading ──

      // The environment fades with the same damped speed as the wheels, so
      // completion settles instead of snapping at 100%.
      const trackOpacity = Math.min(1, racingSpeed * 1.2);

      // We no longer toggle visibility, we use smooth opacity so they fade out naturally
      // Update shader uniforms for hairMat
        
        
        hairMat.opacity = trackOpacity * 0.18;
      lineMaterial.uniforms.uOpacity.value = trackOpacity * 0.55;

      // Accelerate rapidly if pressing OR if progress is auto-completing (s.progress >= 30)
      const isTunnelMovingInward = racingSpeed > 0.001;
      const roadSpeed = 18 + Math.pow(racingSpeed, 1.35) * 1100;

      // Only update positions if they are actually visible (optimization)
      if (trackOpacity > 0) {
        for (let i = 0; i < TOTAL_LINES; i++) {
            const data = hairData[i];

            if (isTunnelMovingInward) {
                // Rush the road toward the viewer while the car stays framed.
                data.z += roadSpeed * data.speedMultiplier * delta;

                if (data.z > 150) {
                    data.z = -600 - Math.random() * 200;
                }
            } else {
                // Default: Normal chill driving forward, lines come AT you slowly
                data.z += 18 * data.speedMultiplier * delta;

                if (data.z > 150) {
                    data.z = -600 - Math.random() * 200; // spawn far back
                }
            }

            dummyHair.position.set(data.x, data.y, data.z);

            dummyHair.rotation.set(-Math.PI / 2, 0, 0);
            if (data.isVertical) {
               const faceAngle = Math.atan2(data.y + 10, Math.abs(data.x));
               dummyHair.rotateY(data.x < 0 ? -faceAngle : faceAngle);
            }

            dummyHair.scale.set(data.width, data.length, 1);
            dummyHair.updateMatrix();
            hairMesh.setMatrixAt(i, dummyHair.matrix);
        }
        hairMesh.instanceMatrix.needsUpdate = true;
      }

      speedLines.visible = trackOpacity > 0.01;
      if (speedLines.visible) {
        const pointSpeed = 120 + racingSpeed * 950;
        for (let i = 0; i < SPEED_LINE_COUNT; i++) {
          const i3 = i * 3;
          lPositions[i3 + 2] += pointSpeed * lSpeeds[i] * delta;
          if (lPositions[i3 + 2] > 45) {
            lPositions[i3 + 2] = -120 - Math.random() * 80;
          }
        }
        lineGeometry.attributes.position.needsUpdate = true;
      }

      // ── Render Dual Pass ──
      renderer.setRenderTarget(null);
      renderer.clear();
      // 1. Render background lines with stable camera
      renderer.render(bgScene, bgCamera);
      // 2. Render car with OrbitControls camera on top
      const previousAutoClear = renderer.autoClear;
      renderer.autoClear = true;
      reflection.render();
      renderer.autoClear = previousAutoClear;
      renderer.render(scene, camera);
    };

    animate(performance.now());

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      bgCamera.aspect = window.innerWidth / window.innerHeight;
      bgCamera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
      reflection.resize(window.innerWidth, window.innerHeight);
      // godRays.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);

      // gpuParticles.dispose(scene);
      // godRays.dispose();
      // audioVisualizer.dispose();

      hairGeo.dispose();
      hairMat.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      if (cpuParticles) {
        cpuParticles.geometry.dispose();
        (cpuParticles.material as THREE.Material).dispose();
      }

      airflow.group.removeFromParent();
      airflow.dispose();
      studioLighting.dispose();
      reflection.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audioRef]);

  return <div
    ref={containerRef}
    style={{ position: 'fixed', inset: 0, zIndex: 75, pointerEvents: progress >= 100 ? 'auto' : 'none', cursor: progress >= 100 ? 'grab' : 'default' }}
    onMouseDown={(e) => {

    }}
    onClick={(e) => {
      // Smart event forwarding when progress >= 100
      if (progress >= 100) {
        const target = containerRef.current;
        const canvas = containerRef.current?.querySelector('canvas');
        if (!target || !canvas) return;

        // The Three.js layer sits above the welcome content so the car remains
        // visible. Resolve a clickable element at the same screen coordinate
        // before treating the click as a car/orbit interaction.
        const previousPointerEvents = target.style.pointerEvents;
        target.style.pointerEvents = 'none';
        const underlyingElement = document.elementFromPoint(e.clientX, e.clientY);
        target.style.pointerEvents = previousPointerEvents;

        const clickableElement = underlyingElement?.closest<HTMLElement>(
          'button, a, [role="button"], [onclick]'
        );
        if (clickableElement) {
          clickableElement.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
          }));
          e.stopPropagation();
          return;
        }

        // Check if click is near center (where 3D car is positioned)
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Calculate distance from center
        const distanceFromCenter = Math.sqrt(x * x + y * y);



        // If click is near center (on the car), handle car click.
        if (distanceFromCenter < 0.4 && onCarClick) {
          onCarClick();
          e.stopPropagation();
          // Let OrbitControls handle the interaction
        }
      }
    }}
  />;
};

export default ParticleBackground;
