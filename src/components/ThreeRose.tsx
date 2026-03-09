import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// ═══════════════════════════════════════════════════════════════
// 参数曲面花瓣几何生成器
// ═══════════════════════════════════════════════════════════════
function buildPetalGeometry({
  width = 0.6,
  height = 1.0,
  bowDepth = 0.28,
  curlDepth = 0.22,
  tipCurl = 0.18,
  baseNarrow = 0.55,
  segU = 24,
  segV = 32,
}: {
  width?: number;
  height?: number;
  bowDepth?: number;
  curlDepth?: number;
  tipCurl?: number;
  baseNarrow?: number;
  segU?: number;
  segV?: number;
} = {}) {
  const verts: number[] = [];
  const uvArr: number[] = [];
  const idxArr: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;

    // 轮廓宽度：底部收窄 + sin 卵形 + 顶端收圆
    const baseW = Math.pow(v, 0.35);
    const tipW = 1 - Math.pow(Math.max(0, v - 0.75) / 0.25, 2);
    const narrowBase = 1 - baseNarrow * Math.pow(1 - v, 2.5);
    const profileW = Math.sin(v * Math.PI) * 0.7 + 0.3 * baseW;
    const finalW = profileW * tipW * narrowBase * width;

    // 纵向弓形
    const bowZ = Math.sin(v * Math.PI) * bowDepth;

    // 顶端外翻
    const tipFactor = Math.max(0, (v - 0.82) / 0.18);
    const tipZ = -Math.pow(tipFactor, 2) * tipCurl;

    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const uc = u - 0.5;

      const x = uc * 2 * finalW;
      const y = v * height;

      // 横向内卷：边缘卷，中心不卷
      const curlProfile =
        Math.sin(v * Math.PI * 0.9 + 0.1) * (1 - Math.pow(v, 3));
      const curlZ =
        -Math.pow(Math.abs(uc) * 2, 1.8) * curlDepth * curlProfile;

      const z = bowZ + curlZ + tipZ;

      verts.push(x, y, z);
      uvArr.push(u, v);
    }
  }

  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      idxArr.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
  geo.setIndex(idxArr);
  geo.computeVertexNormals();
  return geo;
}

// ═══════════════════════════════════════════════════════════════
// 纹理
// ═══════════════════════════════════════════════════════════════
function createPetalTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;

  // 径向渐变底色：深红→鲜红→粉边
  const g = ctx.createRadialGradient(256, 380, 20, 256, 256, 280);
  g.addColorStop(0.0, "#7a0010");
  g.addColorStop(0.3, "#b8001a");
  g.addColorStop(0.6, "#d42030");
  g.addColorStop(0.85, "#e04050");
  g.addColorStop(1.0, "#ee7080");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  // 纵向渐变：根部更暗
  const vg = ctx.createLinearGradient(0, 512, 0, 0);
  vg.addColorStop(0.0, "rgba(30,0,0,0.55)");
  vg.addColorStop(0.25, "rgba(20,0,0,0.2)");
  vg.addColorStop(0.6, "rgba(0,0,0,0.0)");
  vg.addColorStop(1.0, "rgba(255,180,180,0.12)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 512, 512);

  // 两侧暗边（卷曲阴影感）
  const eg = ctx.createLinearGradient(0, 0, 512, 0);
  eg.addColorStop(0.0, "rgba(0,0,0,0.4)");
  eg.addColorStop(0.18, "rgba(0,0,0,0.0)");
  eg.addColorStop(0.82, "rgba(0,0,0,0.0)");
  eg.addColorStop(1.0, "rgba(0,0,0,0.4)");
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, 512, 512);

  // 中央高光条
  const hl = ctx.createLinearGradient(220, 0, 292, 0);
  hl.addColorStop(0, "rgba(255,200,200,0.0)");
  hl.addColorStop(0.5, "rgba(255,200,200,0.13)");
  hl.addColorStop(1, "rgba(255,200,200,0.0)");
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, 512, 512);

  return new THREE.CanvasTexture(c);
}

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

interface PetalData {
  mesh: THREE.Mesh;
  spiralAngle: number;
  layerIdx: number;
  targetTilt: number;
  targetRadius: number;
  targetHeight: number;
  initTilt: number;
  initRadius: number;
  initHeight: number;
}

interface LayerConfig {
  count: number;
  tilt: number;
  radius: number;
  heightOff: number;
  scale: number;
  curl: number;
  bow: number;
  baseNarrow: number;
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
    // 透明背景，融入 Modal
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

    // ── 材质 ─────────────────────────────────────────────
    const petalTex = createPetalTexture();
    const stemTex = createStemTexture();

    const newPetalMat = () =>
      new THREE.MeshStandardMaterial({
        map: petalTex,
        side: THREE.DoubleSide,
        roughness: 0.38,
        metalness: 0.0,
        transparent: false,
      });

    const stemMat = new THREE.MeshStandardMaterial({
      map: stemTex,
      roughness: 0.8,
      metalness: 0.0,
    });

    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x2a6030,
      side: THREE.DoubleSide,
      roughness: 0.65,
    });

    // ── 花茎 ─────────────────────────────────────────────
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.07, 0.45, 0.02),
      new THREE.Vector3(-0.05, 0.95, -0.01),
      new THREE.Vector3(0.04, 1.5, 0.01),
      new THREE.Vector3(0, 2.0, 0),
    ]);
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 48, 0.025, 8, false),
      stemMat
    );
    stemMesh.castShadow = true;
    scene.add(stemMesh);

    // ── 叶片 ─────────────────────────────────────────────
    const addLeaf = (
      pos: THREE.Vector3,
      ry: number,
      rx: number,
      sc: number
    ) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(0.28, 0.04, 0.48, 0.38, 0.2, 0.72);
      s.bezierCurveTo(0.08, 0.88, -0.08, 0.88, -0.2, 0.72);
      s.bezierCurveTo(-0.48, 0.38, -0.28, 0.04, 0, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 18), greenMat);
      m.scale.setScalar(sc);
      m.position.copy(pos);
      m.rotation.set(rx, ry, 0, "YXZ");
      m.castShadow = true;
      scene.add(m);
    };
    addLeaf(new THREE.Vector3(0.09, 0.95, 0), 0.55, -0.4, 0.65);
    addLeaf(new THREE.Vector3(-0.07, 1.38, 0), -0.75, -0.35, 0.52);

    // ── 花托 & 萼片 ───────────────────────────────────────
    const receptacle = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x2a6030, roughness: 0.7 })
    );
    receptacle.position.set(0, 2.06, 0);
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
        greenMat.clone()
      );
      sm.position.set(Math.cos(ang) * 0.1, 2.08, Math.sin(ang) * 0.1);
      sm.rotation.set(0.52, ang + Math.PI, 0, "YXZ");
      scene.add(sm);
    }

    // ════════════════════════════════════════════════════════
    // 核心：5层分层 + 黄金角叶序 构建玫瑰花头
    // ════════════════════════════════════════════════════════
    const GOLDEN = 2.39996323; // 黄金角 rad ≈ 137.5°
    const CENTER = new THREE.Vector3(0, 2.42, 0);

    // 从内到外5层，参数精心调校
    const layers: LayerConfig[] = [
      // 第1层：最内，近乎竖直的筒形花心
      { count: 3,  tilt: 0.10, radius: 0.055, heightOff:  0.28, scale: 0.30, curl: 0.62, bow: 0.20, baseNarrow: 0.72 },
      // 第2层：内层包裹
      { count: 5,  tilt: 0.30, radius: 0.14,  heightOff:  0.18, scale: 0.44, curl: 0.50, bow: 0.25, baseNarrow: 0.65 },
      // 第3层：中层半开
      { count: 6,  tilt: 0.58, radius: 0.26,  heightOff:  0.06, scale: 0.60, curl: 0.36, bow: 0.27, baseNarrow: 0.58 },
      // 第4层：中外层展开
      { count: 7,  tilt: 0.85, radius: 0.40,  heightOff: -0.07, scale: 0.74, curl: 0.24, bow: 0.25, baseNarrow: 0.50 },
      // 第5层：最外层充分展开
      { count: 8,  tilt: 1.12, radius: 0.57,  heightOff: -0.20, scale: 0.90, curl: 0.14, bow: 0.21, baseNarrow: 0.42 },
    ];

    // 每层预生成共享几何（节省内存）
    const layerGeos = layers.map((cfg) =>
      buildPetalGeometry({
        width: 0.52,
        height: 0.88,
        bowDepth: cfg.bow,
        curlDepth: cfg.curl,
        tipCurl: 0.12 + (1 - cfg.curl) * 0.1,
        baseNarrow: cfg.baseNarrow,
      })
    );

    const allPetals: PetalData[] = [];
    let globalIdx = 0;

    layers.forEach((cfg, layerIdx) => {
      for (let i = 0; i < cfg.count; i++) {
        const spiralAngle = globalIdx * GOLDEN;
        globalIdx++;

        // 花蕾初始状态（紧闭）
        const initTilt = 0.05 + layerIdx * 0.02;
        const initRadius = 0.02 + layerIdx * 0.01;
        const initHeight = cfg.heightOff + 0.18 * (1 - layerIdx / (layers.length - 1));

        const mesh = new THREE.Mesh(layerGeos[layerIdx], newPetalMat());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.scale.setScalar(cfg.scale);
        mesh.rotation.order = "YXZ";
        mesh.rotation.y = spiralAngle + Math.PI;
        mesh.rotation.x = initTilt;
        mesh.position.set(
          CENTER.x + Math.cos(spiralAngle) * initRadius,
          CENTER.y + initHeight,
          CENTER.z + Math.sin(spiralAngle) * initRadius
        );
        scene.add(mesh);

        allPetals.push({
          mesh,
          spiralAngle,
          layerIdx,
          targetTilt: cfg.tilt,
          targetRadius: cfg.radius,
          targetHeight: cfg.heightOff,
          initTilt,
          initRadius,
          initHeight,
        });
      }
    });

    // ════════════════════════════════════════════════════════
    // 绽放动画：外层先开 → 内层后开
    // ════════════════════════════════════════════════════════
    const TOTAL_DUR = 6000;
    let t0: number | null = null;

    const easeOutBack = (t: number, overshoot = 1.2): number => {
      const c1 = overshoot;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let raf: number;
    const animate = (ts: number) => {
      raf = requestAnimationFrame(animate);
      if (!t0) t0 = ts;
      const gT = Math.min((ts - t0) / TOTAL_DUR, 1.0);

      allPetals.forEach((p) => {
        // 外层(layerIdx=4)无延迟，内层(layerIdx=0)延迟最大
        const delayFrac =
          (layers.length - 1 - p.layerIdx) / (layers.length - 1);
        const delay = delayFrac * 0.30;
        const raw = Math.max(0, Math.min(1, (gT - delay) / (1.0 - delay)));
        const localT = easeOutBack(raw);
        const smoothT = easeInOutCubic(raw);

        p.mesh.rotation.x =
          p.initTilt + (p.targetTilt - p.initTilt) * localT;
        const r = p.initRadius + (p.targetRadius - p.initRadius) * localT;
        p.mesh.position.set(
          CENTER.x + Math.cos(p.spiralAngle) * r,
          CENTER.y + p.initHeight + (p.targetHeight - p.initHeight) * smoothT,
          CENTER.z + Math.sin(p.spiralAngle) * r
        );
      });

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
