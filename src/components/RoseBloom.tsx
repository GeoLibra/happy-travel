import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';

interface RoseBloomProps {
  show: boolean;
  onClose: () => void;
}

const RoseBloom: React.FC<RoseBloomProps> = ({ show, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const roseGroupRef = useRef<THREE.Group | null>(null);
  const petalsRef = useRef<THREE.Mesh[]>([]);
  const fallingPetalsRef = useRef<THREE.Mesh[]>([]);
  const animationRef = useRef<number | null>(null);
  const bloomProgressRef = useRef(0);
  const [isReady, setIsReady] = useState(false);

  // Create petal shape
  const createPetalShape = () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.3, 0.1, 0.5, 0.4, 0.5, 0.8);
    shape.bezierCurveTo(0.5, 1.2, 0.2, 1.5, 0, 1.6);
    shape.bezierCurveTo(-0.2, 1.5, -0.5, 1.2, -0.5, 0.8);
    shape.bezierCurveTo(-0.5, 0.4, -0.3, 0.1, 0, 0);
    return shape;
  };

  const createPetal = (color: THREE.Color, size: number, layer: number, index: number): THREE.Mesh => {
    const shape = createPetalShape();
    const geometry = new THREE.ShapeGeometry(shape, 12);
    
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = -Math.pow(x, 2) * 0.3 - Math.pow(y - 0.8, 2) * 0.4;
      positions[i + 2] = z * (1 + layer * 0.1);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhysicalMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.1,
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });

    const petal = new THREE.Mesh(geometry, material);
    
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const angle = index * goldenAngle + layer * 0.5;
    const radius = (layer * 0.15 + 0.05) * size;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = layer * 0.08 * size;
    
    petal.position.set(x, y, z);
    
    const targetAngle = Math.atan2(z, x);
    petal.rotation.y = -targetAngle + Math.PI / 2;
    petal.rotation.x = 0.2 + layer * 0.1 + Math.random() * 0.1;
    petal.rotation.z = Math.random() * 0.3 - 0.15;
    
    petal.scale.setScalar(size * (1 - layer * 0.08));
    
    (petal.userData as any).initialRotationX = petal.rotation.x;
    (petal.userData as any).targetRotationX = -Math.PI / 3 - layer * 0.2;
    (petal.userData as any).layer = layer;
    (petal.userData as any).delay = layer * 0.3 + index * 0.05;
    
    return petal;
  };

  const createRose = () => {
    const roseGroup = new THREE.Group();
    const petals: THREE.Mesh[] = [];

    const colors = [
      new THREE.Color(0x8B0000),
      new THREE.Color(0xA51111),
      new THREE.Color(0xC41E3A),
      new THREE.Color(0xDC143C),
      new THREE.Color(0xE34234),
      new THREE.Color(0xF08080),
    ];

    const layers = [6, 8, 10, 12, 10, 8];
    let petalIndex = 0;

    layers.forEach((count, layer) => {
      const color = colors[Math.min(layer, colors.length - 1)];
      const size = 1.2 - layer * 0.08;
      
      for (let i = 0; i < count; i++) {
        const petal = createPetal(color, size, layer, petalIndex);
        petals.push(petal);
        roseGroup.add(petal);
        petalIndex++;
      }
    });

    const coreGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8B0000,
      roughness: 0.6,
      metalness: 0.1,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.3;
    roseGroup.add(core);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    roseGroup.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7);
    roseGroup.add(directionalLight);

    const pointLight = new THREE.PointLight(0xff6b6b, 0.8, 10);
    pointLight.position.set(-2, 3, -2);
    roseGroup.add(pointLight);

    return { group: roseGroup, petals };
  };

  const createFallingPetals = () => {
    const particles: THREE.Mesh[] = [];
    const geometry = new THREE.PlaneGeometry(0.1, 0.15);
    const material = new THREE.MeshBasicMaterial({
      color: 0xDC143C,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });

    for (let i = 0; i < 30; i++) {
      const particle = new THREE.Mesh(geometry, material.clone());
      particle.position.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 4
      );
      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      (particle.userData as any) = {
        velocity: {
          x: (Math.random() - 0.5) * 0.02,
          y: -Math.random() * 0.03 - 0.01,
          z: (Math.random() - 0.5) * 0.02,
        },
        rotationSpeed: {
          x: (Math.random() - 0.5) * 0.05,
          y: (Math.random() - 0.5) * 0.05,
          z: (Math.random() - 0.5) * 0.05,
        },
      };
      particles.push(particle);
    }
    return particles;
  };

  useEffect(() => {
    if (!containerRef.current || !show) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 0.3, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const { group, petals } = createRose();
    roseGroupRef.current = group;
    petalsRef.current = petals;
    scene.add(group);

    // Start closed
    petals.forEach((petal) => {
      const ud = petal.userData as any;
      petal.rotation.x = Math.PI / 2 - ud.layer * 0.3;
      petal.visible = false;
    });

    const fallingPetals = createFallingPetals();
    fallingPetalsRef.current = fallingPetals;
    fallingPetals.forEach((p) => {
      p.visible = false;
      scene.add(p);
    });

    // Add ground glow
    const glowGeometry = new THREE.PlaneGeometry(10, 10);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x330000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -2;
    scene.add(glow);

    setIsReady(true);
    bloomProgressRef.current = 0;

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      bloomProgressRef.current += 0.008;
      const progress = Math.min(bloomProgressRef.current, 1);

      // Animate rose blooming
      petalsRef.current.forEach((petal) => {
        const ud = petal.userData as any;
        const petalStart = ud.delay;
        const petalProgress = Math.max(0, Math.min(1, (progress - petalStart) / 0.5));
        
        if (progress > ud.delay - 0.