import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { loadModelWithCache } from "../lib/model-loader";
import {
  createRoseBloomAction,
  getRoseArcStrength,
  getRoseAssemblyProgress,
  getRoseBloomDelta,
  getRoseHandoffProgress,
  getRosePresentationPitch,
  getRosePresentationYaw,
  ROSE_ASSEMBLY_MS,
  ROSE_BLOOM_START_MS,
  ROSE_MODEL_URL,
} from "../lib/rose-animation";



// 用 Canvas 动态生成一个发光圆点贴图
const createGlowTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
};

interface ThreeRoseProps {
  isOpen: boolean;
  onClose?: () => void; // 新增关闭回调
}

export default function ThreeRose({ isOpen, onClose }: ThreeRoseProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // 用于记录鼠标/手指点击的初始位置，区分“点击关闭”和“拖拽旋转”
  const pointerRef = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    let cleanupScene: (() => void) | undefined;
    const initTimeout = setTimeout(() => {
      if (!mountRef.current) return;
      const W = mountRef.current.clientWidth || 600;
      const H = mountRef.current.clientHeight || 600;

      if (W === 0 || H === 0) return;

      cleanupScene = startThreeScene(W, H);
    }, 100);

    return () => {
      clearTimeout(initTimeout);
      cleanupScene?.();
    };
  }, [isOpen]);

  const startThreeScene = (W: number, H: number) => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    // 移除 Fog 以保证背景彻底透明
    // scene.fog = new THREE.Fog(0x000000, 5, 25);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    // 背景设为完全透明 (alpha = 0)
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.5);
    key.position.set(5, 10, 5);
    scene.add(key);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.update();

    // 粒子系统配置
    const particleCount = 40000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const startPositions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const arcOffsets = new Float32Array(particleCount * 3);
    const heightRatios = new Float32Array(particleCount);
    const delayJitters = new Float32Array(particleCount);
    const particlePhases = new Float32Array(particleCount);
    const baseSizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      const radius = 3.4 + Math.random() * 2.2;
      startPositions[i3] = Math.cos(angle) * radius;
      startPositions[i3 + 1] = Math.sin(angle) * radius * 0.72;
      startPositions[i3 + 2] = -2.8 + Math.random() * 5.6;
      arcOffsets[i3] = -Math.sin(angle) * (0.35 + Math.random() * 0.9);
      arcOffsets[i3 + 1] = Math.cos(angle) * (0.2 + Math.random() * 0.65);
      arcOffsets[i3 + 2] = (Math.random() - 0.5) * 1.3;
      delayJitters[i] = Math.random();
      particlePhases[i] = Math.random() * Math.PI * 2;
      positions[i3] = startPositions[i3];
      positions[i3 + 1] = startPositions[i3 + 1];
      positions[i3 + 2] = startPositions[i3 + 2];

      // 金红/橙红配色
      const colorMix = Math.random();
      if (colorMix < 0.5) {
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.4 + Math.random() * 0.3;
        colors[i3 + 2] = 0.1;
      } else if (colorMix < 0.8) {
        colors[i3] = 0.8 + Math.random() * 0.2;
        colors[i3 + 1] = 0.1 + Math.random() * 0.1;
        colors[i3 + 2] = 0.05;
      } else {
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.7 + Math.random() * 0.2;
        colors[i3 + 2] = 0.2 + Math.random() * 0.2;
      }

      baseSizes[i] = 0.01 + Math.random() * 0.03;
      sizes[i] = baseSizes[i];
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 使用 AdditiveBlending 和贴图实现发光点云
    const glowTexture = createGlowTexture();
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.04,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    const modelGroup = new THREE.Group();
    modelGroup.visible = true;
    const presentationGroup = new THREE.Group();
    scene.add(presentationGroup);
    presentationGroup.add(particleSystem);
    presentationGroup.add(modelGroup);

    let modelLoaded = false;
    let cancelled = false;
    let model: THREE.Object3D | null = null;
    let roseAnimation: ReturnType<typeof createRoseBloomAction> = null;
    const materialStates: Array<{
      material: THREE.Material;
      opacity: number;
      transparent: boolean;
    }> = [];

    loadModelWithCache(ROSE_MODEL_URL).then((gltf) => {
      if (cancelled) return;
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const sc = 2.5 / maxDim;

      model.scale.setScalar(sc);
      model.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);

      model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
      model.updateMatrixWorld(true);

      const finalBox = new THREE.Box3().setFromObject(model);
      const finalCenter = new THREE.Vector3();
      finalBox.getCenter(finalCenter);

      if (Math.abs(finalCenter.x) > 0.01 || Math.abs(finalCenter.y) > 0.01 || Math.abs(finalCenter.z) > 0.01) {
        model.position.x -= finalCenter.x;
        model.position.y -= finalCenter.y;
        model.position.z -= finalCenter.z;
      }

      const capturedMaterials = new Set<THREE.Material>();
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!capturedMaterials.has(material)) {
            capturedMaterials.add(material);
            materialStates.push({
              material,
              opacity: material.opacity,
              transparent: material.transparent,
            });
          }
          material.side = THREE.DoubleSide;
        });
      });

      modelGroup.add(model);
      roseAnimation = createRoseBloomAction(model, gltf.animations);
      model.updateMatrixWorld(true);

      const meshes: THREE.Mesh[] = [];
      model.traverse((child: any) => {
        if (child.isMesh && child.visible) meshes.push(child);
      });

      const samplerEntries = meshes.flatMap((mesh) => {
        const sampler = new MeshSurfaceSampler(mesh).build();
        const distribution = sampler.distribution;
        const area = distribution?.[distribution.length - 1] ?? 0;
        return area > 0 ? [{ mesh, sampler, area }] : [];
      });
      const totalArea = samplerEntries.reduce((sum, entry) => sum + entry.area, 0);

      if (totalArea > 0) {
        const posAttr = particleGeometry.attributes.position;
        const samplePoint = new THREE.Vector3();
        let minTargetY = Infinity;
        let maxTargetY = -Infinity;

        for (let i = 0; i < particleCount; i++) {
          const selectedArea = Math.random() * totalArea;
          let accumulatedArea = 0;
          let selectedEntry = samplerEntries[samplerEntries.length - 1];
          for (const entry of samplerEntries) {
            accumulatedArea += entry.area;
            if (selectedArea <= accumulatedArea) {
              selectedEntry = entry;
              break;
            }
          }

          selectedEntry.sampler.sample(samplePoint);
          selectedEntry.mesh.localToWorld(samplePoint);
          const i3 = i * 3;
          targetPositions[i3] = samplePoint.x;
          targetPositions[i3 + 1] = samplePoint.y;
          targetPositions[i3 + 2] = samplePoint.z;
          minTargetY = Math.min(minTargetY, samplePoint.y);
          maxTargetY = Math.max(maxTargetY, samplePoint.y);
        }

        const targetHeight = maxTargetY - minTargetY;
        for (let i = 0; i < particleCount; i++) {
          heightRatios[i] = targetHeight > 0
            ? (targetPositions[i * 3 + 1] - minTargetY) / targetHeight
            : 0;
        }
        posAttr.needsUpdate = true;
      }

      modelLoaded = true;
    });

    let t0: number | null = null;
    let previousFrameTimestamp: number | null = null;
    let positionsSnappedToTarget = false;

    let raf: number;
    const animate = (ts: number) => {
      raf = requestAnimationFrame(animate);
      const frameDelta = previousFrameTimestamp === null
        ? 0
        : Math.max((ts - previousFrameTimestamp) / 1_000, 0);
      previousFrameTimestamp = ts;

      if (!modelLoaded) {
        controls.update();
        renderer.render(scene, camera);
        return;
      }

      if (t0 === null) t0 = ts;
      const elapsed = ts - t0;
      const bloomDelta = getRoseBloomDelta(elapsed, frameDelta);
      if (roseAnimation && bloomDelta > 0) {
        roseAnimation.mixer.update(bloomDelta);
      }

      if (elapsed >= ROSE_ASSEMBLY_MS && !positionsSnappedToTarget) {
        positions.set(targetPositions);
        particleGeometry.attributes.position.needsUpdate = true;
        positionsSnappedToTarget = true;
      }

      if (elapsed < ROSE_ASSEMBLY_MS) {
        particleSystem.visible = true;
        modelGroup.visible = false;
        particleMaterial.opacity = 0.8;

        const posAttr = particleGeometry.attributes.position;
        const sizeAttr = particleGeometry.attributes.size;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const progress = getRoseAssemblyProgress(elapsed, heightRatios[i], delayJitters[i]);
          const inverse = 1 - progress;
          const arcStrength = getRoseArcStrength(progress);
          const drift = Math.sin(elapsed * 0.003 + particlePhases[i]) * inverse * 0.06;

          positions[i3] = startPositions[i3] * inverse
            + targetPositions[i3] * progress
            + arcOffsets[i3] * arcStrength
            + drift;
          positions[i3 + 1] = startPositions[i3 + 1] * inverse
            + targetPositions[i3 + 1] * progress
            + arcOffsets[i3 + 1] * arcStrength
            + drift * 0.6;
          positions[i3 + 2] = startPositions[i3 + 2] * inverse
            + targetPositions[i3 + 2] * progress
            + arcOffsets[i3 + 2] * arcStrength;
          sizes[i] = baseSizes[i] * (0.9 + 0.1 * Math.sin(elapsed * 0.004 + particlePhases[i]));
        }
        posAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

      } else if (elapsed < ROSE_BLOOM_START_MS) {
        const handoff = getRoseHandoffProgress(elapsed);
        particleSystem.visible = handoff < 0.99;
        particleMaterial.opacity = 0.8 * (1 - handoff);
        modelGroup.visible = true;
        materialStates.forEach(({ material, opacity }) => {
          material.transparent = true;
          material.opacity = opacity * handoff;
        });
      } else {
        particleSystem.visible = false;
        modelGroup.visible = true;
        materialStates.forEach(({ material, opacity, transparent }) => {
          material.opacity = opacity;
          material.transparent = transparent;
        });
      }

      presentationGroup.rotation.y = getRosePresentationYaw(elapsed);
      presentationGroup.rotation.x = getRosePresentationPitch(elapsed);

      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      glowTexture.dispose();
      roseAnimation?.action.stop();
      if (model) roseAnimation?.mixer.uncacheRoot(model);
      materialStates.forEach(({ material, opacity, transparent }) => {
        material.opacity = opacity;
        material.transparent = transparent;
      });
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  };

  // 记录按下位置和时间
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  // 判断是点击还是拖动
  const handlePointerUp = (e: React.PointerEvent) => {
    const dx = e.clientX - pointerRef.current.x;
    const dy = e.clientY - pointerRef.current.y;
    const dt = Date.now() - pointerRef.current.time;

    // 如果鼠标位移小于 5 像素，且按压时间小于 300 毫秒，则判定为点击
    if (Math.sqrt(dx * dx + dy * dy) < 5 && dt < 300) {
      onClose?.();
    }
  };

  return (
    <div
      ref={mountRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "600px",
        minWidth: "600px",
        position: "relative",
        backgroundColor: "transparent", // 改为完全透明
        cursor: "pointer" // 提示用户可点击
      }}
    />
  );
}
