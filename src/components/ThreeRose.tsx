import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface ThreeRoseProps {
  isOpen: boolean;
}

export default function ThreeRose({ isOpen }: ThreeRoseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    roseGroup: THREE.Group;
    petals: THREE.Mesh[];
    animationId: number;
    bloomProgress: number;
  } | null>(null);

  const createPetalShape = useCallback(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.3, 0.1, 0.5, 0.35, 0.5, 0.7);
    shape.bezierCurveTo(0.45, 0.95, 0.2, 1.0, 0, 1.0);
    shape.bezierCurveTo(-0.2, 1.0, -0.45, 0.95, -0.5, 0.7);
    shape.bezierCurveTo(-0.5, 0.35, -0.3, 0.1, 0, 0);
    return shape;
  }, []);

  const createPetalGeometry = useCallback(() => {
    const shape = createPetalShape();
    const geometry = new THREE.ShapeGeometry(shape, 16);
    
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const curveZ = Math.pow(x, 2) * 0.25 + Math.pow(y - 0.4, 2) * 0.2;
      positions.setZ(i, curveZ);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [createPetalShape]);

  const createRoseMaterial = useCallback((layer: number, totalLayers: number) => {
    const ratio = layer / totalLayers;
    const color = new THREE.Color(
      0.75 - ratio * 0.25,
      0.08 + ratio * 0.35,
      0.12 + ratio * 0.18
    );
    
    return new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(color.r * 0.15, color.g * 0.1, color.b * 0.1),
    });
  }, []);

  const buildRose = useCallback(() => {
    if (!sceneRef.current) return;
    const { roseGroup } = sceneRef.current;
    
    while (roseGroup.children.length > 0) {
      roseGroup.remove(roseGroup.children[0]);
    }

    const petals: THREE.Mesh[] = [];
    const petalGeometry = createPetalGeometry();
    const layers = 4;
    const petalsPerLayer = [4, 6, 8, 10];

    for (let layer = 0; layer < layers; layer++) {
      const material = createRoseMaterial(layer, layers);
      const count = petalsPerLayer[layer];
      const radius = 0.18 + layer * 0.14;
      const height = layer * 0.1;
      const baseAngle = layer * 0.4;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + baseAngle;
        const petal = new THREE.Mesh(petalGeometry, material.clone());
        
        petal.userData = {
          targetScale: 0.7 + layer * 0.12,
          targetRotX: Math.PI / 2 + layer * 0.12,
          delay: layer * 0.15 + i * 0.03,
        };

        petal.position.set(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );
        
        petal.rotation.set(Math.PI / 2 + 0.6, angle, 0);
        petal.scale.setScalar(0.05);
        roseGroup.add(petal);
        petals.push(petal);
      }
    }

    const stemGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.4, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = -0.2;
    roseGroup.add(stem);

    sceneRef.current.petals = petals;
    sceneRef.current.bloomProgress = 0;
  }, [createPetalGeometry, createRoseMaterial]);

  useEffect(() => {
    if (!containerRef.current || !isOpen) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.6, 3);
    camera.lookAt(0, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(400, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainLight.position.set(2, 4, 3);
    scene.add(mainLight);
    
    const backLight = new THREE.DirectionalLight(0xffdddd, 0.6);
    backLight.position.set(-2, 2, -2);
    scene.add(backLight);

    const roseGroup = new THREE.Group();
    scene.add(roseGroup);

    sceneRef.current = { renderer, roseGroup, petals: [], animationId: 0, bloomProgress: 0 };
    buildRose();

    const animate = () => {
      if (!sceneRef.current) return;
      const { roseGroup, petals, bloomProgress } = sceneRef.current;
      
      roseGroup.rotation.y += 0.004;
      roseGroup.position.y = Math.sin(Date.now() * 0.0015) * 0.03;

      if (bloomProgress < 1) {
        sceneRef.current.bloomProgress += 0.018;
        const p = Math.min(sceneRef.current.bloomProgress, 1);
        const ep = 1 - Math.pow(1 - p, 3);

        petals.forEach((petal) => {
          const { targetScale, targetRotX, delay } = petal.userData;
          const pp = Math.max(0, Math.min(1, (p - delay) / 0.7));
          if (pp > 0) {
            const epp = 1 - Math.pow(1 - pp, 2);
            petal.scale.setScalar(THREE.MathUtils.lerp(0.05, targetScale, epp));
            petal.rotation.x = THREE.MathUtils.lerp(Math.PI / 2 + 0.6, targetRotX, epp);
          }
        });
      }

      renderer.render(scene, camera);
      sceneRef.current.animationId = requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);
    sceneRef.current.animationId = animId;

    return () => {
      cancelAnimationFrame(animId);
      sceneRef.current = null;
      renderer.dispose();
    };
  }, [isOpen, buildRose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef} 
      className="w-[400px] h-[400px] mx-auto"
      style={{ cursor: 'grab' }}
    />
  );
}
