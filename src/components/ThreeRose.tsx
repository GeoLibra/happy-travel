import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import localforage from "localforage";

localforage.config({
  name: "happy-travel-3d-cache",
  storeName: "models",
});

const MODEL_URL = "/models/rose.glb";

async function loadGltfWithCache(
  url: string,
  onProgress?: (p: number) => void
): Promise<any> {
  const loader = new GLTFLoader();

  const cached = await localforage.getItem<ArrayBuffer>(url);
  if (cached) {
    console.log("[ThreeRose] GLB loaded from cache");
    onProgress?.(100);
    return new Promise((resolve, reject) => {
      loader.parse(cached, "", resolve, reject);
    });
  }

  console.log("[ThreeRose] Fetching GLB from server");
  const response = await fetch(url);
  if (!response.body) throw new Error("Response body is null");

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) onProgress?.(Math.round((loaded / total) * 100));
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const buffer = merged.buffer;

  await localforage.setItem(url, buffer);
  return new Promise((resolve, reject) => {
    loader.parse(buffer, "", resolve, reject);
  });
}

// ✨ 新增：用 Canvas 动态生成一个发光圆点贴图，消除方形马赛克感
const createGlowTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    // 中心不透明，边缘透明，形成发光光晕
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
}

export default function ThreeRose({ isOpen }: ThreeRoseProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const initTimeout = setTimeout(() => {
      if (!mountRef.current) return;
      const W = mountRef.current.clientWidth || 600;
      const H = mountRef.current.clientHeight || 600;

      if (W === 0 || H === 0) return;

      startThreeScene(W, H);
    }, 100);

    return () => clearTimeout(initTimeout);
  }, [isOpen]);

  const startThreeScene = (W: number, H: number) => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    // 修改雾的颜色为黑色，凸显出橙色的光芒
    scene.fog = new THREE.Fog(0x000000, 5, 25);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    // 渲染器背景设置为深色/黑色，图2的效果必须在暗调背景下才好看
    renderer.setClearColor(0x050505, 1);
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

    // ✨ 优化 1：大幅增加粒子数量
    const particleCount = 40000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 1.5;
      positions[i3 + 2] = 0;

      // ✨ 优化 2：调整为金红/橙红配色，契合图2的余烬效果
      const colorMix = Math.random();
      if (colorMix < 0.5) {
        // 核心亮橙色 (50%)
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.4 + Math.random() * 0.3;
        colors[i3 + 2] = 0.1;
      } else if (colorMix < 0.8) {
        // 深红色 (30%)
        colors[i3] = 0.8 + Math.random() * 0.2;
        colors[i3 + 1] = 0.1 + Math.random() * 0.1;
        colors[i3 + 2] = 0.05;
      } else {
        // 点缀金黄色 (20%)
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.7 + Math.random() * 0.2;
        colors[i3 + 2] = 0.2 + Math.random() * 0.2;
      }

      // 粒子大小差异化
      sizes[i] = 0.01 + Math.random() * 0.03;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // ✨ 优化 3：赋予材质贴图及 AdditiveBlending
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.04, // 配合密度调小尺寸
      map: createGlowTexture(), // 使用圆形发光贴图
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending, // ✨ 核心：叠加发光模式
      depthWrite: false, // 保证重叠的粒子不会互相遮挡遮罩
      depthTest: true,
      sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    const modelGroup = new THREE.Group();
    modelGroup.visible = true;
    scene.add(modelGroup);

    let modelLoaded = false;
    let cancelled = false;

    loadGltfWithCache(MODEL_URL).then((gltf) => {
      if (cancelled) return;
      const model = gltf.scene;

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

      model.traverse((child: any) => {
        if (child.isMesh) {
          if (child.material) {
            child.material.side = THREE.DoubleSide;
          }
        }
      });

      modelGroup.add(model);
      model.updateMatrixWorld(true);

      const meshes: THREE.Mesh[] = [];
      model.traverse((child: any) => {
        if (child.isMesh) meshes.push(child);
      });

      if (meshes.length > 0) {
        const posAttr = particleGeometry.attributes.position;
        // 获取所有顶点以供随机采样
        const allVertices: THREE.Vector3[] = [];
        meshes.forEach(mesh => {
            const geoPos = mesh.geometry.attributes.position;
            if (geoPos) {
                for(let v = 0; v < geoPos.count; v++) {
                    const vertex = new THREE.Vector3(geoPos.getX(v), geoPos.getY(v), geoPos.getZ(v));
                    mesh.localToWorld(vertex);
                    allVertices.push(vertex);
                }
            }
        });

        if (allVertices.length > 0) {
            for (let i = 0; i < particleCount; i++) {
              // 随机取一个顶点
              const baseVertex = allVertices[Math.floor(Math.random() * allVertices.length)];

              // ✨ 优化 4：大幅减小发散程度，收紧轮廓，让形状更清晰
              const offsetValue = 0.02 + Math.random() * 0.03;
              const localPos = baseVertex.clone();
              localPos.x += (Math.random() - 0.5) * offsetValue;
              localPos.y += (Math.random() - 0.5) * offsetValue;
              localPos.z += (Math.random() - 0.5) * offsetValue;

              const i3 = i * 3;
              originalPositions[i3] = localPos.x;
              originalPositions[i3 + 1] = localPos.y;
              originalPositions[i3 + 2] = localPos.z;

              posAttr.setXYZ(i, localPos.x, localPos.y, localPos.z);
            }
            posAttr.needsUpdate = true;
        }
      }

      modelLoaded = true;
    });

    const PARTICLE_PHASE = 2500; // 稍微拉长纯粒子展示时间
    const TRANSITION_DUR = 2500;
    let t0: number | null = null;

    const easeInOutCubic = (t: number) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    let raf: number;
    const animate = (ts: number) => {
      raf = requestAnimationFrame(animate);

      if (!modelLoaded) {
        controls.update();
        renderer.render(scene, camera);
        return;
      }

      if (!t0) t0 = ts;
      const elapsed = ts - t0;

      if (elapsed < PARTICLE_PHASE) {
        particleSystem.visible = true;
        modelGroup.visible = false;
        particleMaterial.opacity = 0.8;

        const posAttr = particleGeometry.attributes.position;
        const sizeAttr = particleGeometry.attributes.size;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          // 削弱波动幅度，让点云更静谧高雅
          const floatOffset = Math.sin(elapsed * 0.001 + i * 0.1) * 0.008;
          const driftX = Math.cos(elapsed * 0.0008 + i * 0.15) * 0.004;
          const driftZ = Math.sin(elapsed * 0.0007 + i * 0.12) * 0.004;

          posAttr.setXYZ(
            i,
            originalPositions[i3] + driftX,
            originalPositions[i3 + 1] + floatOffset,
            originalPositions[i3 + 2] + driftZ
          );

          const baseSz = sizeAttr.getX(i);
          const pulse = 1 + Math.sin(elapsed * 0.002 + i * 0.2) * 0.1;
          sizeAttr.setX(i, baseSz * pulse);
        }
        posAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

      } else if (elapsed < PARTICLE_PHASE + TRANSITION_DUR) {
        const progress = (elapsed - PARTICLE_PHASE) / TRANSITION_DUR;
        const ease = easeInOutCubic(progress);

        particleMaterial.opacity = 0.8 * (1.0 - ease);
        particleSystem.visible = particleMaterial.opacity > 0.01;

        modelGroup.visible = true;
        modelGroup.traverse((child: any) => {
          if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = ease;
          }
        });

      } else {
        particleSystem.visible = false;
        modelGroup.visible = true;
      }

      // 让整体缓慢自转，效果更棒
      modelGroup.rotation.y = elapsed * 0.0002;
      particleSystem.rotation.y = elapsed * 0.0002;

      controls.update();
      renderer.render(scene, camera);
    };
    animate(0);

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
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  };

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "600px",
        minWidth: "600px",
        position: "relative",
        backgroundColor: "#050505" // 保证背景是暗色，AdditiveBlending 才明显
      }}
    />
  );
}