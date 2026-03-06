import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GPUParticleSystem, GPUEffectUniforms } from './effects/gpuParticles';
import { GodRays } from './effects/godRays';
import { AudioVisualizer } from './effects/audioVisualizer';
import { DEFAULT_FORCE_FIELD_PARAMS } from './effects/forceField';

interface ParticleBackgroundProps {
  isPressing: boolean;
  progress: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

const COLORS = {
  red: new THREE.Color('#E10600'),
  yellow: new THREE.Color('#FFB800'),
  white: new THREE.Color('#ffffff'),
  navy: new THREE.Color('#001A30'),
};

const SPEED_LINE_COUNT = 300;
const CPU_PARTICLE_COUNT = 3000;

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ isPressing, progress, audioRef }) => {
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

    // ── Explosion Core (Light source for God Rays) ──
    const coreGeometry = new THREE.SphereGeometry(8, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const explosionCore = new THREE.Mesh(coreGeometry, coreMaterial);
    explosionCore.position.set(0, -25, -40);
    scene.add(explosionCore);

    // ── Animation Loop ──
    const clock = new THREE.Clock();
    let frameId = 0;
    let prevTime = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();
      const delta = Math.min(time - prevTime, 0.1);
      prevTime = time;

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

      // Handle Explosion timing
      if (s.explosionTime === -1) {
        s.explosionTime = time;
      }
      const timeSinceExplosion = s.explosionTime > 0 ? time - s.explosionTime : 0;
      const isExploding = timeSinceExplosion < 1.5 && s.explosionTime > 0;
      const explosionForce = isExploding ? Math.max(0, 1.0 - timeSinceExplosion / 1.5) : 0;

      // Update uniforms
      s.baseUniforms.uTime.value = time;
      s.baseUniforms.uDelta.value = delta;
      s.baseUniforms.uIsPressing.value = s.isPressing;
      s.baseUniforms.uProgress.value = s.progress;
      s.baseUniforms.uExplosionForce.value = explosionForce;

      // Update Explosion Core visibility
      if (isExploding) {
        /*
        explosionCore.material.opacity = explosionForce;
        const scale = 1.0 + (1.0 - explosionForce) * 2.0;
        explosionCore.scale.set(scale, scale, scale);
        */
      } else {
        // explosionCore.material.opacity = 0;
      }

      // Camera Mouse Sway
      s.mouse.x += (s.mouse.targetX - s.mouse.x) * 0.05;
      s.mouse.y += (s.mouse.targetY - s.mouse.y) * 0.05;
      camera.position.x = s.mouse.x * 3;
      camera.position.y = s.mouse.y * 2;
      camera.lookAt(0, 0, 0);

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
        for (let i = 0; i < CPU_PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          let dx = Math.sin(time * 0.3 + particlePhases[i]) * 0.02;
          let dy = Math.cos(time * 0.2 + particlePhases[i] * 1.3) * 0.015;
          let dz = 0.5;

          if (s.isPressing && s.progress < 100) {
            const dirX = 0 - pArr[i3];
            const dirY = -25 - pArr[i3 + 1];
            const dist = Math.sqrt(dirX*dirX + dirY*dirY) || 1;
            const revForce = 2.0 + Math.pow(s.progress / 100, 2) * 12.0;
            dx = (dirX / dist) * revForce;
            dy = (dirY / dist) * revForce;
            dz = -revForce * 1.5;
          } else if (isExploding) {
            const dirX = pArr[i3] - 0;
            const dirY = pArr[i3 + 1] - (-25);
            const dirZ = pArr[i3 + 2] - (-40);
            const dist = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ) || 1;
            const pwr = explosionForce * 3.0;
            dx = (dirX / dist) * pwr + (Math.random()-0.5)*explosionForce*2;
            dy = (dirY / dist) * pwr + explosionForce * 0.8 + (Math.random()-0.5)*explosionForce*2;
            dz = (dirZ / dist) * pwr + (Math.random()-0.5)*explosionForce*2;
          }

          pArr[i3] += dx; pArr[i3 + 1] += dy; pArr[i3 + 2] += dz;

          if (!s.isPressing && !isExploding) {
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

      if (isExploding) {
        /*
        godRays.render(
          renderer,
          scene,
          camera,
          explosionForce,
          new THREE.Vector3(0, -25, -40) // Explosion center
        );
        */
      }
    };

    animate();

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

      coreGeometry.dispose();
      coreMaterial.dispose();

      lineGeometry.dispose();
      lineMaterial.dispose();
      if (cpuParticles) {
        cpuParticles.geometry.dispose();
        (cpuParticles.material as THREE.Material).dispose();
      }

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audioRef]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default ParticleBackground;
