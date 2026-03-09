import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeRoseProps {
  isOpen: boolean;
}

export default function ThreeRose({ isOpen }: ThreeRoseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const roseGroupRef = useRef<THREE.Group | null>(null);
  const petalsRef = useRef<THREE.Mesh[]>([]);
  const animIdRef = useRef<number>(0);
  const bloomProgressRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current || !isOpen) {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = 0;
      }
      return;
    }

    // Clear previous
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfff5f7);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.4, 3.2);
    camera.lookAt(0, 0.2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(320, 320);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
    light1.position.set(2, 4, 3);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0xffd1dc, 0.4);
    light2.position.set(-2, 1, -1);
    scene.add(light2);

    // Rose group
    const roseGroup = new THREE.Group();
    scene.add(roseGroup);
    roseGroupRef.current = roseGroup;

    // Petal shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.25, 0.1, 0.4, 0.3, 0.4, 0.6);
    shape.bezierCurveTo(0.38, 0.9, 0.15, 1.0, 0, 1.0);
    shape.bezierCurveTo(-0.15, 1.0, -0.38, 0.9, -0.4, 0.6);
    shape.bezierCurveTo(-0.4, 0.3, -0.25, 0.1, 0, 0);

    const petalGeo = new THREE.ShapeGeometry(shape, 16);
    
    // Add curve to petal
    const positions = petalGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = Math.pow(x * 0.7, 2) * 0.35 + Math.pow((y - 0.5) * 0.5, 2) * 0.3;
      positions.setZ(i, z);
    }
    petalGeo.computeVertexNormals();

    const petals: THREE.Mesh[] = [];
    const layers = 5;
    const petalsPerLayer = [5, 7, 9, 11, 13];

    for (let layer = 0; layer < layers; layer++) {
      const t = layer / (layers - 1);
      const color = new THREE.Color(
        0.8 - t * 0.3,
        0.05 + t * 0.25,
        0.08 + t * 0.15
      );
      const material = new THREE.MeshPhysicalMaterial({
        color,
        side: THREE.DoubleSide,
        roughness: 0.35,
        metalness: 0.1,
        clearcoat: 0.2,
        emissive: new THREE.Color(color.r * 0.15, color.g * 0.08, color.b * 0.08),
      });

      const count = petalsPerLayer[layer];
      const radius = 0.1 + layer * 0.09;
      const height = layer * 0.05;
      const baseAngle = layer * 0.35;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + baseAngle;
        const petal = new THREE.Mesh(petalGeo, material.clone());

        petal.userData = {
          targetScale: 0.5 + layer * 0.12,
          targetRotX: Math.PI / 2 + layer * 0.08,
          delay: layer * 0.12 + i * 0.02,
        };

        petal.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        petal.rotation.set(Math.PI / 2 + 0.4, angle, 0);
        petal.scale.setScalar(0.02);

        roseGroup.add(petal);
        petals.push(petal);
      }
    }

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a5a3d, roughness: 0.5 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = -0.15;
    roseGroup.add(stem);

    petalsRef.current = petals;
    bloomProgressRef.current = 0;

    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !roseGroupRef.current) return;

      roseGroupRef.current.rotation.y += 0.002;

      if (bloomProgressRef.current < 1) {
        bloomProgressRef.current += 0.015;
        const p = Math.min(bloomProgressRef.current, 1);

        petalsRef.current.forEach((petal) => {
          const { targetScale, targetRotX, delay } = petal.userData;
          const pp = Math.max(0, Math.min(1, (p - delay) / 0.85));
          if (pp > 0) {
            const epp = 1 - Math.pow(1 - pp, 3);
            petal.scale.setScalar(THREE.MathUtils.lerp(0.02, targetScale, epp));
            petal.rotation.x = THREE.MathUtils.lerp(Math.PI / 2 + 0.4, targetRotX, epp);
          }
        });
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animIdRef.current = requestAnimationFrame(animate);
    };

    animIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = 0;
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef} 
      style={{ width: 320, height: 320 }}
    />
  );
}
