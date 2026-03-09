import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import localforage from "localforage";

// ═══════════════════════════════════════════════════════════════
// localforage 配置（与 model-loader.ts 保持一致）
// ═══════════════════════════════════════════════════════════════
localforage.config({
  name: "happy-travel-3d-cache",
  storeName: "models",
});

const MODEL_URL = "/models/red_rose3.obj";

// ═══════════════════════════════════════════════════════════════
// OBJ 带缓存加载（复用 model-loader.ts 的流式读取 + 缓存策略）
// OBJ 是纯文本，缓存为 string；GLTF 是二进制，缓存为 ArrayBuffer
// ═══════════════════════════════════════════════════════════════
async function loadObjWithCache(
  url: string,
  onProgress?: (p: number) => void
): Promise<THREE.Group> {
  const loader = new OBJLoader();

  // 尝试从缓存读取
  const cached = await localforage.getItem<string>(url);
  if (cached) {
    console.log("[ThreeRose] OBJ loaded from cache");
    onProgress?.(100);
    return loader.parse(cached);
  }

  // 缓存未命中，流式 fetch
  console.log("[ThreeRose] Fetching OBJ from server");
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

  // 合并 chunks → 文本
  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(merged);

  // 写入缓存
  await localforage.setItem(url, text);

  return loader.parse(text);
}

// ═══════════════════════════════════════════════════════════════
// 纹理（茎用，花头由 OBJ 材质接管）
// ═══════════════════════════════════════════════════════════════
function createStemTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "#183818");
  g.addColorStop(0.4, "#2d6b2d");
  g.addColorStop(0.6, "#347a34");
  g.addColorStop(1, "#183818");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════
interface ThreeRoseProps {
  isOpen: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════
export default function ThreeRose({ isOpen }: ThreeRoseProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth || 600;
    const H = mountRef.current.clientHeight || 600;

    // ── 场景 ─────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1b4a42, 10, 22);

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 50);
    camera.position.set(0, 3.0, 5.2);
    camera.lookAt(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);

    // ── 灯光 ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffe8d0, 1.1));

    const key = new THREE.DirectionalLight(0xfff0e0, 3.0);
    key.position.set(2.5, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 15;
    key.shadow.camera.left = -2.5;
    key.shadow.camera.right = 2.5;
    key.shadow.camera.top = 2.5;
    key.shadow.camera.bottom = -2.5;
    scene.add(key);

    const fill = new THREE.PointLight(0xff2244, 1.5, 10);
    fill.position.set(-2.5, 3.5, 1.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xaaffee, 0.5);
    rim.position.set(0, 2, -5);
    scene.add(rim);

    // ── 轨道控制 ─────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.6, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.update();

    // ── 材质（茎/叶/萼片用） ─────────────────────────────
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x1a331a, // Darker green
      side: THREE.DoubleSide,
      roughness: 0.9,
    });

    // ── 花茎 ─────────────────────────────────────────────
    // 基于用户提供的有机曲线映射至场景比例 (0 -> 2.42)
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.01, 0, 0.01),
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(-0.01, 1.4, -0.01),
      new THREE.Vector3(0.02, 2.0, 0.01),
      new THREE.Vector3(0, 2.4, 0),
    ]);
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 64, 0.022, 12, false),
      greenMat
    );
    stemMesh.castShadow = true;
    scene.add(stemMesh);

    // ── 叶片 (Bezier Shape) ─────────────────────────────
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.04, 0.08, 0.16, 0.12, 0.24, 0);
    leafShape.bezierCurveTo(0.16, -0.12, 0.04, -0.08, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape);

    const leafGroup = new THREE.Group();
    scene.add(leafGroup);

    // 叶片位置 (t 沿曲线)
    const leafPositions = [
      { t: 0.35, side: 1 },
      { t: 0.55, side: -1 },
      { t: 0.75, side: 1 },
    ];

    leafPositions.forEach((pos) => {
      const p = stemCurve.getPoint(pos.t);
      const tangent = stemCurve.getTangent(pos.t);

      const g = new THREE.Group();
      g.position.copy(p);

      // 叶柄 (Petiole)
      const petiole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8),
        greenMat
      );
      petiole.rotation.z = pos.side * Math.PI / 3;
      petiole.position.x = pos.side * 0.05;
      g.add(petiole);

      // 叶片主瓣
      const leaf = new THREE.Mesh(leafGeo, greenMat);
      leaf.position.set(pos.side * 0.15, pos.side * 0.05, 0);
      leaf.rotation.set(Math.PI / 2, pos.side * Math.PI / 2, 0);
      leaf.scale.setScalar(0.8);
      leaf.castShadow = true;
      g.add(leaf);

      leafGroup.add(g);
    });

    // ── 刺 (Thorns) ───────────────────────────────────────
    const thornGeo = new THREE.ConeGeometry(0.008, 0.05, 4);
    const thornGroup = new THREE.Group();
    scene.add(thornGroup);

    for (let i = 0; i < 15; i++) {
        const t = 0.1 + (i * 0.06);
        const p = stemCurve.getPoint(t);
        const angle = i * Math.PI * 0.75;
        const mesh = new THREE.Mesh(thornGeo, greenMat);
        mesh.position.set(
            p.x + Math.cos(angle) * 0.02,
            p.y,
            p.z + Math.sin(angle) * 0.02
        );
        mesh.rotation.set(Math.PI / 2, 0, angle);
        mesh.castShadow = true;
        thornGroup.add(mesh);
    }

    // ── 花托 & 萼片 (Calyx) ───────────────────────────────
    const receptacle = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      greenMat
    );
    receptacle.position.set(0, 2.4, 0);
    scene.add(receptacle);

    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const ss = new THREE.Shape();
      ss.moveTo(0, 0);
      ss.bezierCurveTo(0.07, 0.02, 0.1, 0.22, 0.04, 0.42);
      ss.bezierCurveTo(0.02, 0.52, -0.02, 0.52, -0.04, 0.42);
      ss.bezierCurveTo(-0.1, 0.22, -0.07, 0.02, 0, 0);
      const sm = new THREE.Mesh(
        new THREE.ShapeGeometry(ss, 10),
        greenMat
      );
      sm.position.set(Math.cos(ang) * 0.08, 2.41, Math.sin(ang) * 0.08);
      sm.rotation.set(0.6, ang + Math.PI, 0, "YXZ");
      sm.scale.setScalar(0.2); // 萼片较小
      scene.add(sm);
    }

    const headGroup = new THREE.Group();
    // 花头挂载点位于花茎顶端
    headGroup.position.set(0, 2.4, 0);
    // 初始缩放为 0
    headGroup.scale.setScalar(0);
    scene.add(headGroup);

    const components = {
        stem: stemMesh,
        leaves: leafGroup,
        thorns: thornGroup,
        head: headGroup
    };

    let cancelled = false;

    loadObjWithCache(MODEL_URL, (p) => {
      console.log(`[ThreeRose] OBJ progress: ${p}%`);
    })
      .then((obj) => {
        if (cancelled) return;

        // 应用材质
        obj.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const mat = new THREE.MeshStandardMaterial({
            metalness: 0,
            roughness: 0.65,
            side: THREE.DoubleSide,
          });
          if (mesh.name === "rose" || mesh.name === "") {
            mat.color.set("#b22222");
          } else if (
            mesh.name === "calyx" ||
            mesh.name === "leaf1" ||
            mesh.name === "leaf2"
          ) {
            mat.color.set("#1a4a1a");
          } else {
            mat.color.set("#b22222");
          }
          mesh.material = mat;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });

        // 居中：原点对齐模型底部中心，与花茎顶端无缝衔接
        const box = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        box.getCenter(center);
        obj.position.x = -center.x;
        obj.position.z = -center.z;
        obj.position.y = -box.min.y - 1.5;

        // 旋转对齐（根据模型朝向调整）
        obj.rotation.y = Math.PI / 1.7;

        // 根据模型实际尺寸自动缩放到合适大小
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 1.2; // 花头目标直径
        obj.scale.setScalar(targetSize / maxDim);

        headGroup.add(obj);
        console.log("[ThreeRose] OBJ model added to scene");
      })
      .catch((err) => {
        console.error("[ThreeRose] Failed to load OBJ:", err);
      });

    // ── 绽放动画 ──────────────────────────────────────────
    const TOTAL_DUR = 3200;
    let t0: number | null = null;

    const easeOutBack = (t: number, overshoot = 1.2): number => {
      const c1 = overshoot;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    let raf: number;
    const animate = (ts: number) => {
      raf = requestAnimationFrame(animate);
      if (!t0) t0 = ts;
      const gT = Math.min((ts - t0) / TOTAL_DUR, 1.0);

      // 1. 花茎先生长 (0.0 -> 0.5)
      const stemProg = Math.min(1, gT / 0.5);
      components.stem.scale.set(1, stemProg, 1);

      // 2. 叶片和刺在生长过程中出现 (0.2 -> 0.6)
      const detailProg = Math.max(0, Math.min(1, (gT - 0.2) / 0.4));
      components.leaves.scale.setScalar(detailProg);
      components.thorns.scale.setScalar(detailProg);

      // 3. 花头绽放 (0.4 -> 1.0)
      const headRaw = Math.max(0, Math.min(1, (gT - 0.4) / 0.6));
      const headScale = easeOutBack(headRaw);
      components.head.scale.setScalar(headScale);

      // 花头缓慢自转
      components.head.rotation.y = ts * 0.00018 + headRaw * 0.4;

      controls.update();
      renderer.render(scene, camera);
    };
    animate(0);

    // ── 响应式 ───────────────────────────────────────────
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
  }, [isOpen]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", minHeight: "500px" }}
    />
  );
}
