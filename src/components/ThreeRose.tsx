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

interface ThreeRoseProps {
  isOpen: boolean;
}

export default function ThreeRose({ isOpen }: ThreeRoseProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    // 等待容器渲染完成
    const initTimeout = setTimeout(() => {
      if (!mountRef.current) return;
      const W = mountRef.current.clientWidth || 600;
      const H = mountRef.current.clientHeight || 600;

      console.log("[ThreeRose] Container size:", W, "x", H);
      if (W === 0 || H === 0) {
        console.warn("[ThreeRose] Container has zero size!");
        return;
      }

      startThreeScene(W, H);
    }, 100);

    return () => {
      clearTimeout(initTimeout);
    };
  }, [isOpen]);

  const startThreeScene = (W: number, H: number) => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1b4a42, 10, 22);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    console.log("[ThreeRose] Camera at origin level, looking at center");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const key = new THREE.DirectionalLight(0xfff0e0, 2.5);
    key.position.set(5, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xaaffee, 0.6);
    rim.position.set(-5, 5, -5);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.update();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 粒子系统 - 优化为点云效果
    const particleCount = 5000;
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

      // 更丰富的颜色变化 - 从深红到粉红到金色
      const colorMix = Math.random();
      if (colorMix < 0.6) {
        // 深红色粒子 (60%)
        colors[i3] = 0.6 + Math.random() * 0.3;
        colors[i3 + 1] = 0.05 + Math.random() * 0.1;
        colors[i3 + 2] = 0.1 + Math.random() * 0.15;
      } else if (colorMix < 0.85) {
        // 粉红色粒子 (25%)
        colors[i3] = 0.9 + Math.random() * 0.1;
        colors[i3 + 1] = 0.3 + Math.random() * 0.2;
        colors[i3 + 2] = 0.4 + Math.random() * 0.2;
      } else {
        // 金色/橙色粒子 (15%)
        colors[i3] = 0.95 + Math.random() * 0.05;
        colors[i3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i3 + 2] = 0.2 + Math.random() * 0.2;
      }

      // 更多样化的粒子大小
      sizes[i] = 0.02 + Math.random() * 0.08;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending, // 改为正常混合，避免过度发光
      depthWrite: false,
      depthTest: true, // 启用深度测试，增加空间感
      sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.visible = true;
    scene.add(particleSystem);

    const modelGroup = new THREE.Group();
    modelGroup.visible = true; // 始终显示模型
    scene.add(modelGroup);

    let modelLoaded = false;
    let cancelled = false;

    loadGltfWithCache(MODEL_URL)
      .then((gltf) => {
        if (cancelled) return;
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        console.log("[ThreeRose] ===== ORIGINAL MODEL =====");
        console.log("[ThreeRose] Original size:", size.toArray());
        console.log("[ThreeRose] Original box min:", box.min.toArray());
        console.log("[ThreeRose] Original box max:", box.max.toArray());

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const sc = 2.5 / maxDim;
        console.log("[ThreeRose] Scale factor:", sc);

        model.scale.setScalar(sc);
        model.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        const scaledSize = new THREE.Vector3();
        scaledBox.getSize(scaledSize);

        console.log("[ThreeRose] ===== SCALED MODEL =====");
        console.log("[ThreeRose] Scaled size:", scaledSize.toArray());
        console.log("[ThreeRose] Scaled box min:", scaledBox.min.toArray());
        console.log("[ThreeRose] Scaled box max:", scaledBox.max.toArray());
        console.log("[ThreeRose] Scaled center:", scaledCenter.toArray());

        // 把模型中心放在原点 (0, 0, 0)
        model.position.set(
          -scaledCenter.x,
          -scaledCenter.y,
          -scaledCenter.z
        );

        // 更新后重新计算
        model.updateMatrixWorld(true);
        const finalBox = new THREE.Box3().setFromObject(model);
        const finalCenter = new THREE.Vector3();
        finalBox.getCenter(finalCenter);

        console.log("[ThreeRose] ===== AFTER FIRST POSITIONING =====");
        console.log("[ThreeRose] Model position:", model.position.toArray());
        console.log("[ThreeRose] Final center:", finalCenter.toArray());

        // 如果中心不在原点，再次调整
        if (Math.abs(finalCenter.x) > 0.01 || Math.abs(finalCenter.y) > 0.01 || Math.abs(finalCenter.z) > 0.01) {
          model.position.x -= finalCenter.x;
          model.position.y -= finalCenter.y;
          model.position.z -= finalCenter.z;
          console.log("[ThreeRose] Corrected position:", model.position.toArray());
        }

        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.side = THREE.DoubleSide;
              if (child.material.color) {
                child.material.color.multiplyScalar(1.1);
              }
            }
          }
        });

        modelGroup.add(model);
        model.updateMatrixWorld(true);

        // 从模型采样粒子位置
        const meshes: THREE.Mesh[] = [];
        model.traverse((child: any) => {
          if (child.isMesh) meshes.push(child);
        });

        if (meshes.length > 0) {
          const posAttr = particleGeometry.attributes.position;

          for (let i = 0; i < particleCount; i++) {
            const mesh = meshes[Math.floor(Math.random() * meshes.length)];
            const geometry = mesh.geometry;

            if (geometry.attributes.position) {
              const geoPos = geometry.attributes.position;
              const idx = Math.floor(Math.random() * geoPos.count);
              const localPos = new THREE.Vector3(
                geoPos.getX(idx),
                geoPos.getY(idx),
                geoPos.getZ(idx)
              );

              mesh.localToWorld(localPos);

              // 增加随机偏移，让粒子更分散，形成点云效果
              const offset = 0.15 + Math.random() * 0.1;
              localPos.x += (Math.random() - 0.5) * offset;
              localPos.y += (Math.random() - 0.5) * offset;
              localPos.z += (Math.random() - 0.5) * offset;

              const i3 = i * 3;
              originalPositions[i3] = localPos.x;
              originalPositions[i3 + 1] = localPos.y;
              originalPositions[i3 + 2] = localPos.z;

              posAttr.setXYZ(i, localPos.x, localPos.y, localPos.z);
            }
          }
          posAttr.needsUpdate = true;

          console.log("[ThreeRose] ===== PARTICLES =====");
          console.log("[ThreeRose] Particle 0:", [originalPositions[0], originalPositions[1], originalPositions[2]]);
          console.log("[ThreeRose] Particle 100:", [originalPositions[300], originalPositions[301], originalPositions[302]]);
        }

        modelLoaded = true;
        console.log("[ThreeRose] Model loaded and particles sampled");
      })
      .catch((err) => {
        console.error("[ThreeRose] Failed to load GLB:", err);
      });

    // 动画
    const PARTICLE_PHASE = 1500;
    const TRANSITION_DUR = 2500;
    let t0: number | null = null;

    const easeInOutCubic = (t: number): number => {
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

      // 阶段1: 粒子形态
      if (elapsed < PARTICLE_PHASE) {
        particleSystem.visible = true;
        modelGroup.visible = false;
        particleMaterial.opacity = 0.85;

        const posAttr = particleGeometry.attributes.position;
        const sizeAttr = particleGeometry.attributes.size;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          // 更自然的浮动效果
          const floatOffset = Math.sin(elapsed * 0.001 + i * 0.1) * 0.02;
          const driftX = Math.cos(elapsed * 0.0008 + i * 0.15) * 0.01;
          const driftZ = Math.sin(elapsed * 0.0007 + i * 0.12) * 0.01;

          posAttr.setXYZ(
            i,
            originalPositions[i3] + driftX,
            originalPositions[i3 + 1] + floatOffset,
            originalPositions[i3 + 2] + driftZ
          );

          // 粒子大小微妙变化
          const baseSz = sizeAttr.getX(i);
          const pulse = 1 + Math.sin(elapsed * 0.003 + i * 0.2) * 0.15;
          sizeAttr.setX(i, baseSz * pulse);
        }
        posAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
      }
      // 阶段2: 过渡
      else if (elapsed < PARTICLE_PHASE + TRANSITION_DUR) {
        const progress = (elapsed - PARTICLE_PHASE) / TRANSITION_DUR;
        const ease = easeInOutCubic(progress);

        particleMaterial.opacity = 1.0 - ease;
        particleSystem.visible = particleMaterial.opacity > 0.01;

        modelGroup.visible = true;
        modelGroup.traverse((child: any) => {
          if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = ease;
          }
        });

        const posAttr = particleGeometry.attributes.position;
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const shrink = 1 - ease * 0.2;
          posAttr.setXYZ(
            i,
            originalPositions[i3] * shrink,
            originalPositions[i3 + 1],
            originalPositions[i3 + 2] * shrink
          );
        }
        posAttr.needsUpdate = true;
      }
      // 阶段3: 模型
      else {
        particleSystem.visible = false;
        modelGroup.visible = true;

        modelGroup.traverse((child: any) => {
          if (child.isMesh && child.material) {
            // 保留 transparent=true 以确保材质正确渲染
          }
        });
      }

      if (elapsed > PARTICLE_PHASE) {
        const rotTime = elapsed - PARTICLE_PHASE;
        modelGroup.rotation.y = rotTime * 0.0003;
        particleSystem.rotation.y = rotTime * 0.0003;
      }

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

    const cleanup = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };

    return cleanup;
  };

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "600px",
        minWidth: "600px",
        position: "relative"
      }}
    />
  );
}
