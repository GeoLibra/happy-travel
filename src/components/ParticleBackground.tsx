import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  isPressing: boolean;
  progress: number;
}

// Red Bull palette
const COLORS = {
  red: new THREE.Color('#E10600'),
  yellow: new THREE.Color('#FFB800'),
  white: new THREE.Color('#ffffff'),
  navy: new THREE.Color('#001A30'),
};

const PARTICLE_COUNT = 1200;
const SPEED_LINE_COUNT = 200;

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ isPressing, progress }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isPressingRef = useRef(isPressing);
  const progressRef = useRef(progress);
  const clockRef = useRef(new THREE.Clock());

  // Keep refs in sync
  useEffect(() => { isPressingRef.current = isPressing; }, [isPressing]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseRef.current.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene Setup ──
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Floating Particles ──
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);
    const particleSizes = new Float32Array(PARTICLE_COUNT);
    const particlePhases = new Float32Array(PARTICLE_COUNT); // for individual animation offsets

    const colorOptions = [COLORS.red, COLORS.yellow, COLORS.white, COLORS.white];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      particlePositions[i3] = (Math.random() - 0.5) * 120;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 80;
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 80;

      const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      particleColors[i3] = color.r;
      particleColors[i3 + 1] = color.g;
      particleColors[i3 + 2] = color.b;

      particleSizes[i] = Math.random() * 2.5 + 0.5;
      particlePhases[i] = Math.random() * Math.PI * 2;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
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
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 1.5);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ── Speed Lines (rushing toward viewer) ──
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(SPEED_LINE_COUNT * 3);
    const lineSpeeds = new Float32Array(SPEED_LINE_COUNT);
    const lineColors = new Float32Array(SPEED_LINE_COUNT * 3);
    const lineSizes = new Float32Array(SPEED_LINE_COUNT);

    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      const i3 = i * 3;
      linePositions[i3] = (Math.random() - 0.5) * 100;
      linePositions[i3 + 1] = (Math.random() - 0.5) * 60;
      linePositions[i3 + 2] = Math.random() * -100;

      lineSpeeds[i] = Math.random() * 0.8 + 0.3;

      const color = Math.random() < 0.3 ? COLORS.red : Math.random() < 0.5 ? COLORS.yellow : COLORS.white;
      lineColors[i3] = color.r;
      lineColors[i3 + 1] = color.g;
      lineColors[i3 + 2] = color.b;

      lineSizes[i] = Math.random() * 3 + 1;
    }

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    lineGeometry.setAttribute('size', new THREE.BufferAttribute(lineSizes, 1));

    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
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
          // Elongated shape to simulate motion blur
          float d = length(vec2(uv.x * 0.3, uv.y));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 2.0);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const speedLines = new THREE.Points(lineGeometry, lineMaterial);
    scene.add(speedLines);

    // ── Animation Loop ──
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const elapsed = clockRef.current.getElapsedTime();

      const isPressNow = isPressingRef.current;
      const prog = progressRef.current;

      // Acceleration factor when pressing
      const accelFactor = isPressNow ? 1.0 + prog * 0.06 : 1.0;

      // Smooth mouse follow
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Camera subtle sway with mouse
      camera.position.x = mouse.x * 3;
      camera.position.y = mouse.y * 2;
      camera.lookAt(0, 0, 0);

      // ── Update floating particles ──
      const pPositions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const phase = particlePhases[i];

        // Gentle floating motion
        pPositions[i3] += Math.sin(elapsed * 0.3 + phase) * 0.02 * accelFactor;
        pPositions[i3 + 1] += Math.cos(elapsed * 0.2 + phase * 1.3) * 0.015 * accelFactor;
        pPositions[i3 + 2] += Math.sin(elapsed * 0.15 + phase * 0.7) * 0.01;

        // When pressing, particles drift sideways (wind from speed)
        if (isPressNow) {
          pPositions[i3] -= 0.03 * accelFactor;
        }

        // Wrap around boundaries
        if (pPositions[i3] < -60) pPositions[i3] = 60;
        if (pPositions[i3] > 60) pPositions[i3] = -60;
        if (pPositions[i3 + 1] < -40) pPositions[i3 + 1] = 40;
        if (pPositions[i3 + 1] > 40) pPositions[i3 + 1] = -40;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      (particleMaterial.uniforms.uTime as { value: number }).value = elapsed;

      // Slow rotation of the whole particle cloud
      particles.rotation.z = elapsed * 0.02;
      particles.rotation.y = Math.sin(elapsed * 0.1) * 0.1;

      // ── Update speed lines ──
      const lPositions = lineGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < SPEED_LINE_COUNT; i++) {
        const i3 = i * 3;
        const speed = lineSpeeds[i];

        // Move toward viewer (positive Z)
        lPositions[i3 + 2] += speed * accelFactor * (isPressNow ? 2.5 : 0.5);

        // Reset when past camera
        if (lPositions[i3 + 2] > 50) {
          lPositions[i3] = (Math.random() - 0.5) * 100;
          lPositions[i3 + 1] = (Math.random() - 0.5) * 60;
          lPositions[i3 + 2] = -100;
        }
      }
      lineGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // ── Resize Handler ──
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // ── Cleanup ──
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameRef.current);

      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default ParticleBackground;
