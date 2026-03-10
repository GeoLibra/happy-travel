import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GPUParticleSystem, GPUEffectUniforms } from './effects/gpuParticles';
import { GodRays } from './effects/godRays';
import { AudioVisualizer } from './effects/audioVisualizer';
import { DEFAULT_FORCE_FIELD_PARAMS } from './effects/forceField';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface ParticleBackgroundProps {
  isPressing: boolean;
  progress: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  loadedModel?: THREE.Group | null;
  onCarClick?: () => void;
}

const COLORS = {
  red: new THREE.Color('#E10600'),
  yellow: new THREE.Color('#FFB800'),
  white: new THREE.Color('#ffffff'),
  navy: new THREE.Color('#001A30'),
};

const SPEED_LINE_COUNT = 100;
const CPU_PARTICLE_COUNT = 500;

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ isPressing, progress, audioRef, loadedModel, onCarClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track state in ref to avoid re-triggering the animation loop closure
  const stateRef = useRef({
    isPressing,
    progress,
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
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    stateRef.current.baseUniforms.uPixelRatio.value = pixelRatio;

    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

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
      console.log("Using CPU particles fallback");
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
        pPositions[i3 + 2] = (Math.random() - 0.5) * 150;

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
      scene.add(cpuParticles);
    }

    // ── 3D Lighting for F1 Model ──
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x001A30, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xFFB800, 1.5);
    mainLight.position.set(10, 20, 10);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xE10600, 1.0);
    rimLight.position.set(-10, 5, -5);
    scene.add(rimLight);

    // ── F1 Car 3D Model Integration ──
    let f1CarGroup: THREE.Group | null = null;

    // We'll check for modelRef.current dynamically in the animate loop to support late arrivals
    const checkModelInjection = () => {
      if (!f1CarGroup && modelRef.current) {
        f1CarGroup = modelRef.current;
        f1CarGroup.scale.set(16, 16, 16);
        f1CarGroup.rotation.y = 0; // Face the camera directly
        f1CarGroup.position.set(0, -10, -150); // Start deep in the screen
        f1CarGroup.visible = false;

        console.log("[DEBUG] Model injected. Vertices count hint:", f1CarGroup.children.length);

        f1CarGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.metalness = 0.8;
              mat.roughness = 0.2;
              mat.envMapIntensity = 1.0;
            }
          }
        });

        scene.add(f1CarGroup);

        // Performance Optimization: Pre-compile the model to avoid lag spikes
        if (renderer && scene && camera) {
          renderer.compile(scene, camera);
        }

        console.log("[ParticleBackground] 3D F1 Model dynamically injected and pre-compiled");
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

    const f1Trails = new THREE.LineSegments(trailGeometry, trailMaterial);
    f1Trails.visible = false;
    scene.add(f1Trails);



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
      uniforms: { uPixelRatio: { value: pixelRatio } },
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
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(vec2(uv.x * 0.3, uv.y));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, vec3(pow(1.0 - smoothstep(0.0, 0.5, d), 2.0)) * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const speedLines = new THREE.Points(lineGeometry, lineMaterial);
    scene.add(speedLines);


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
      s.baseUniforms.uExplosionForce.value = 0;

      // ── Camera Mouse Sway or OrbitControls ──
      if (s.progress >= 100) {
        if (!controls.enabled) {
          controls.enabled = true;
          if (f1CarGroup) controls.target.copy(f1CarGroup.position);
        }
        controls.update();
      } else {
        controls.enabled = false;
        s.mouse.x += (s.mouse.targetX - s.mouse.x) * 0.05;
        s.mouse.y += (s.mouse.targetY - s.mouse.y) * 0.05;
        camera.position.x = s.mouse.x * 3;
        camera.position.y = s.mouse.y * 2;
        camera.lookAt(0, 0, 0);
      }

      // ── Update Particles ──
      /*
      if (useGPU) {
        gpuParticles.update();
        if (gpuParticles.particles) {
          gpuParticles.particles.rotation.z = time * 0.02;
          gpuParticles.particles.rotation.y = Math.sin(time * 0.1) * 0.1;
        }
      } else */ if (cpuParticles && particlePhases) {
        // CPU fallback loop
        const pArr = cpuParticles.geometry.attributes.position.array as Float32Array;

        // Debug log (only log occasionally to avoid spam)
        if (Math.random() < 0.01) {
          console.log('[ParticleBackground] Particle state:', {
            progress: s.progress,
            isPressing: s.isPressing,
            shouldAccelerate: s.progress > 0 && s.progress < 100,
          });
        }

        for (let i = 0; i < CPU_PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          let dx, dy, dz;

          // 只要进度>0且<100，就向中心反向加速聚集
          if (s.progress > 0 && s.progress < 100) {
            const dirX = 0 - pArr[i3];
            const dirY = -25 - pArr[i3 + 1];
            const dist = Math.sqrt(dirX*dirX + dirY*dirY) || 1;
            const revForce = 2.0 + Math.pow(s.progress / 100, 2) * 12.0;
            dx = (dirX / dist) * revForce;
            dy = (dirY / dist) * revForce;
            dz = -revForce * 1.5;
          } else {
            // 默认漂浮状态
            dx = Math.sin(time * 0.3 + particlePhases[i]) * 0.02;
            dy = Math.cos(time * 0.2 + particlePhases[i] * 1.3) * 0.015;
            dz = 0.5;
          }

          pArr[i3] += dx; pArr[i3 + 1] += dy; pArr[i3 + 2] += dz;

          // 边界重置（只在正常漂浮状态下）
          if (s.progress === 0) {
            if (pArr[i3] < -100) pArr[i3] = 100;
            if (pArr[i3] > 100) pArr[i3] = -100;
            if (pArr[i3 + 1] < -75) pArr[i3 + 1] = 75;
            if (pArr[i3 + 1] > 75) pArr[i3 + 1] = -75;
            if (pArr[i3 + 2] > 80) {
              pArr[i3 + 2] = -80;
              pArr[i3] = (Math.random() - 0.5) * 200;
              pArr[i3 + 1] = (Math.random() - 0.5) * 150;
            }
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
           console.log("[DEBUG] Car visible and approaching");
           f1Trails.visible = true;
        }

        // 0-100% Progress mapping
        const progressFactor = s.progress / 100;

        // Position: Move from deep screen (-150) to hero position (0)
        // This prevents the car from feeling like it's "passing" the screen plane.
        const targetZ = -150 + (progressFactor * 150);
        f1CarGroup.position.z += (targetZ - f1CarGroup.position.z) * 0.1;
        f1CarGroup.position.x = 0; // Stay centered
        f1CarGroup.position.y = -10 + (progressFactor * 5) + Math.sin(time * 15) * 0.05;

        // Scale: Grow to a balanced size
        const targetScale = 8 + (progressFactor * 4); // Final scale 12
        f1CarGroup.scale.set(targetScale, targetScale, targetScale);

        // Rotation: Nose-out until 80%, then "Background Match" turn (135 deg)
        // Rotation: Nose-out until 80%, then "Background Match" turn (135 deg)
        // Disable interpolation when controls are active to not fight OrbitControls
        if (s.progress < 100) {
            const turnFactor = Math.min(1, Math.max(0, (s.progress - 80) / 20));

            // Y-axis: From 0 to 135 degrees (3/4 rear-to-side view)
            const targetRotY = turnFactor * (Math.PI * 0.25);
            f1CarGroup.rotation.y += (targetRotY - f1CarGroup.rotation.y) * 0.1;

            // X-axis: Tilt forward (top-down view) to see the roof
            const targetRotX = turnFactor * 0.25;
            f1CarGroup.rotation.x += (targetRotX - f1CarGroup.rotation.x) * 0.1;

            // Z-axis: Subtle dynamic lean
            const targetRotZ = turnFactor * 0.05 + Math.sin(time * 2) * 0.01;
            f1CarGroup.rotation.z += (targetRotZ - f1CarGroup.rotation.z) * 0.05;
        }
        // When progress >= 100, we just keep the final rotation values intact so it doesn't snap!

        // Update Trails (Trailing logic)
        const isStopped = s.progress >= 99;
        const tArr = trailGeometry.attributes.position.array as Float32Array;
        for(let i=0; i<TRAIL_COUNT; i++) {
            const trailBaseIdx = i * trailSegments * 3;
            for(let j=trailSegments-1; j>0; j--) {
                const cur = trailBaseIdx + j * 3;
                const prev = trailBaseIdx + (j-1) * 3;
                tArr[cur] = tArr[prev];
                tArr[cur+1] = tArr[prev+1];
                tArr[cur+2] = tArr[prev+2];
            }
            // Adjust trail origin based on current rotation (exhaust is behind car)
            const trailOffset = new THREE.Vector3(0, 1.5, -10).applyEuler(f1CarGroup.rotation);
            tArr[trailBaseIdx] = f1CarGroup.position.x + trailOffset.x;
            tArr[trailBaseIdx + 1] = f1CarGroup.position.y + trailOffset.y + (Math.random() - 0.5) * 2.0;
            tArr[trailBaseIdx + 2] = f1CarGroup.position.z + trailOffset.z;
        }
        trailGeometry.attributes.position.needsUpdate = true;



        // Fade trails if stopped
        if (isStopped) {
          f1Trails.visible = false;
        }
      } else if (f1CarGroup) {
        f1CarGroup.visible = false;
        f1Trails.visible = false;
      }

      // ── Update Speed Lines ──
      const lArr = lineGeometry.attributes.position.array as Float32Array;
      const accelFactor = s.isPressing ? 1.0 + (s.progress / 100) * 0.06 : 1.0;
      for (let i = 0; i < SPEED_LINE_COUNT; i++) {
        const i3 = i * 3;
        const speed = lSpeeds[i];
        if (s.isPressing) {
          lArr[i3 + 2] -= speed * accelFactor * 3.0;
          if (lArr[i3 + 2] < -150) {
            lArr[i3] = (Math.random() - 0.5) * 100;
            lArr[i3 + 1] = (Math.random() - 0.5) * 60;
            lArr[i3 + 2] = 50;
          }
        } else {
          lArr[i3 + 2] += speed * accelFactor * 0.5;
          if (lArr[i3 + 2] > 50) {
            lArr[i3] = (Math.random() - 0.5) * 100;
            lArr[i3 + 1] = (Math.random() - 0.5) * 60;
            lArr[i3 + 2] = -100;
          }
        }
      }
      lineGeometry.attributes.position.needsUpdate = true;

      // ── Render ──
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    };

    animate(performance.now());

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
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

      lineGeometry.dispose();
      lineMaterial.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      if (cpuParticles) {
        cpuParticles.geometry.dispose();
        (cpuParticles.material as THREE.Material).dispose();
      }

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audioRef]);

  return <div
    ref={containerRef}
    style={{ position: 'fixed', inset: 0, zIndex: 75, pointerEvents: progress >= 100 ? 'auto' : 'none' }}
    onMouseDown={(e) => {
      console.log('[ParticleBackground] MouseDown detected', {
        progress,
        pointerEvents: progress >= 100 ? 'auto' : 'none',
        target: e.target,
        tagName: (e.target as HTMLElement).tagName,
      });
    }}
    onClick={(e) => {
      console.log('[ParticleBackground] Click detected', {
        progress,
        pointerEvents: progress >= 100 ? 'auto' : 'none',
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target,
        tagName: (e.target as HTMLElement).tagName,
      });

      // Smart event forwarding when progress >= 100
      if (progress >= 100) {
        const canvas = containerRef.current?.querySelector('canvas');
        if (!canvas) {
          console.log('[ParticleBackground] Canvas not found');
          return;
        }

        // Check if click is near center (where 3D car is positioned)
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Calculate distance from center
        const distanceFromCenter = Math.sqrt(x * x + y * y);

        console.log('[ParticleBackground] Click position', {
          normalizedX: x,
          normalizedY: y,
          distanceFromCenter,
          threshold: 0.4,
        });

        // If click is near center (on the car), handle car click
        if (distanceFromCenter < 0.4) {
          console.log('[ParticleBackground] Click on 3D model (center region)');
          if (onCarClick) {
            console.log('[ParticleBackground] Calling onCarClick callback');
            onCarClick();
            e.stopPropagation();
          } else {
            console.log('[ParticleBackground] No onCarClick callback provided');
          }
          // Let OrbitControls handle the interaction
        } else {
          console.log('[ParticleBackground] Click on empty space, forwarding to underlying element');
          // Click is on empty space, forward to underlying element
          const target = containerRef.current;
          if (target) {
            // Temporarily disable pointer events to get element below
            target.style.pointerEvents = 'none';
            let underlyingElement = document.elementFromPoint(e.clientX, e.clientY);
            target.style.pointerEvents = 'auto';

            console.log('[ParticleBackground] Underlying element found:', {
              tagName: underlyingElement?.tagName,
              className: underlyingElement?.className,
              id: underlyingElement?.id,
              element: underlyingElement,
            });

            // If we found a child element (like span inside button), find the closest clickable parent
            if (underlyingElement) {
              // Find closest button or clickable element
              const clickableElement = underlyingElement.closest('button, a, [role="button"], [onclick]');
              if (clickableElement) {
                console.log('[ParticleBackground] Found clickable parent:', {
                  tagName: clickableElement.tagName,
                  className: clickableElement.className,
                });
                underlyingElement = clickableElement as HTMLElement;
              }
            }

            // Forward click to underlying element
            if (underlyingElement && underlyingElement !== target) {
              console.log('[ParticleBackground] Dispatching click event to underlying element');
              underlyingElement.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: e.clientX,
                clientY: e.clientY,
              }));
              console.log('[ParticleBackground] Click event dispatched successfully');
            } else {
              console.log('[ParticleBackground] No valid underlying element to forward to');
            }
          }
        }
      } else {
        console.log('[ParticleBackground] Progress < 100, pointer-events should be none');
      }
    }}
  />;
};

export default ParticleBackground;
