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

const PARTICLE_COUNT = 3000; // 增加粒子数量，让效果更密集
const SPEED_LINE_COUNT = 300; // 也增加速度线

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
  const explosionTimeRef = useRef(0); // Tracks time since explosion triggered

  // Keep refs in sync
  useEffect(() => {
    isPressingRef.current = isPressing;
  }, [isPressing]);

  useEffect(() => {
    // If progress hit 100, trigger explosion timeline
    if (progress >= 100 && progressRef.current < 100) {
      explosionTimeRef.current = clockRef.current.getElapsedTime();
    }
    progressRef.current = progress;
  }, [progress]);

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
      // 更大的初始分布范围
      particlePositions[i3] = (Math.random() - 0.5) * 200;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 150;
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 150;

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
      const accelFactor = isPressNow ? 1.0 + (prog / 100) * 0.06 : 1.0;

      // Smooth mouse follow
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Camera subtle sway with mouse
      camera.position.x = mouse.x * 3;
      camera.position.y = mouse.y * 2;
      camera.lookAt(0, 0, 0);

      // Evaluate Explosion State
      const timeSinceExplosion = elapsed - explosionTimeRef.current;
      const isExploding = timeSinceExplosion < 1.5 && explosionTimeRef.current > 0;
      const explosionForce = isExploding ? Math.max(0, 1.0 - timeSinceExplosion / 1.5) * 8.0 : 0;

      // ── Update floating particles ──
      const pPositions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const phase = particlePhases[i];

        const px = pPositions[i3];
        const py = pPositions[i3 + 1];
        const pz = pPositions[i3 + 2];

        // Default: 粒子向屏幕外（Z轴正方向）运动
        let dx = Math.sin(elapsed * 0.3 + phase) * 0.02;
        let dy = Math.cos(elapsed * 0.2 + phase * 1.3) * 0.015;
        let dz = 0.5; // 正常向屏幕外飘动

        if (isPressNow && prog < 100) {
          // REVERSE GATHERING: 粒子反向（向屏幕里）加速
          // 不管粒子在哪，都向屏幕深处（负Z方向）加速，同时向按钮XY位置聚集
          const targetX = 0;
          const targetY = -25;

          // XY方向：向按钮聚集
          const dirX = targetX - px;
          const dirY = targetY - py;
          const distXY = Math.sqrt(dirX*dirX + dirY*dirY) || 1;

          // 反向加速力，随着进度增加而增强
          const reverseForce = (2.0 + Math.pow(prog / 100, 2) * 12.0);

          dx = (dirX / distXY) * reverseForce;
          dy = (dirY / distXY) * reverseForce;
          // Z方向：强制向屏幕里（负方向）加速
          dz = -reverseForce * 1.5;

          // Debug: 打印第一个粒子的信息
          if (i === 0 && Math.random() < 0.01) {
            console.log('Particle 0:', { pz, dz, reverseForce, prog });
          }
        }
        else if (isExploding) {
          // EXPLOSION PHASE: Boom outward from the button center
          const centerX = 0;
          const centerY = -25;
          const centerZ = -40; // 与聚集点相同

          const dirX = px - centerX;
          const dirY = py - centerY;
          const dirZ = pz - centerZ;

          // Normalize vector
          const dist = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ) || 1;

          // 强大的爆炸力，向外扩散
          const explosionPower = explosionForce * 3.0;
          dx = (dirX / dist) * explosionPower;
          dy = (dirY / dist) * explosionPower + explosionForce * 0.8; // 向上偏移
          dz = (dirZ / dist) * explosionPower;

          // 添加随机性让爆炸更自然
          dx += (Math.random() - 0.5) * explosionForce * 2;
          dy += (Math.random() - 0.5) * explosionForce * 2;
          dz += (Math.random() - 0.5) * explosionForce * 2;
        }

        pPositions[i3]     += dx;
        pPositions[i3 + 1] += dy;
        pPositions[i3 + 2] += dz;

        // Wrap around boundaries only when NOT exploding/gathering so they don't pop weirdly
        if (!isPressNow && !isExploding) {
          if (pPositions[i3] < -100) pPositions[i3] = 100;
          if (pPositions[i3] > 100) pPositions[i3] = -100;
          if (pPositions[i3 + 1] < -75) pPositions[i3 + 1] = 75;
          if (pPositions[i3 + 1] > 75) pPositions[i3 + 1] = -75;
          // Z轴循环：粒子飞出屏幕外后从后面重新出现
          if (pPositions[i3 + 2] > 80) {
            pPositions[i3 + 2] = -80;
            pPositions[i3] = (Math.random() - 0.5) * 200;
            pPositions[i3 + 1] = (Math.random() - 0.5) * 150;
          }
        }
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

        if (isPressNow) {
          // 按住时：速度线反向（向屏幕里）加速
          lPositions[i3 + 2] -= speed * accelFactor * 3.0;

          // Reset when too far back
          if (lPositions[i3 + 2] < -150) {
            lPositions[i3] = (Math.random() - 0.5) * 100;
            lPositions[i3 + 1] = (Math.random() - 0.5) * 60;
            lPositions[i3 + 2] = 50;
          }
        } else {
          // 正常：向屏幕外（向用户）
          lPositions[i3 + 2] += speed * accelFactor * 0.5;

          // Reset when past camera
          if (lPositions[i3 + 2] > 50) {
            lPositions[i3] = (Math.random() - 0.5) * 100;
            lPositions[i3 + 1] = (Math.random() - 0.5) * 60;
            lPositions[i3 + 2] = -100;
          }
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
