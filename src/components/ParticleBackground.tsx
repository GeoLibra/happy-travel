import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GPUParticleSystem, GPUEffectUniforms } from './effects/gpuParticles';
import { GodRays } from './effects/godRays';
import { AudioVisualizer } from './effects/audioVisualizer';
import { DEFAULT_FORCE_FIELD_PARAMS } from './effects/forceField';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HologramShaderUniforms, applyHologramMaterial, revertHologramMaterial } from './hologram/HologramEffect';
import { getF1Depth, getTargetSpeed, stepF1Motion, type F1MotionState } from '../lib/f1-motion';
import {
  F1_ORBIT_MAX_POLAR_ANGLE,
  applyF1ArrivalRotation,
  createF1ArrivalState,
  dampF1ArrivalValue,
  getF1ScreenStableOrbitTarget,
  stepF1ArrivalState,
} from '../lib/f1-arrival-motion';
import { createF1ExplodedParts, getF1LocalBounds, resolveF1WheelNodes, updateF1ExplodedParts, type F1ExplodedPart } from '../lib/f1-model';
import { applyF1WheelAngle, createF1WheelMotionState, getF1WheelRenderAngle, stepF1WheelMotion } from '../lib/f1-wheel-motion';
import {
  CAR_DRAG_TOLERANCE_PX,
  CAR_HOLD_DELAY_MS,
  canStartCarHold,
  classifyCarRelease,
  classifyShowroomPointerLayer,
  isAdditionalCarGesturePointer,
  isPointInsideCarGestureBounds,
  stepStudioReveal,
} from '../lib/f1-showroom-interaction';
import { advanceF1AirflowTime, createF1Airflow } from './effects/f1Airflow';
import { createF1StudioLighting } from './effects/f1StudioLighting';
import { createStudioReflection } from './effects/studioReflection';
import {
  bindF1GlitchContextRecovery,
  createF1GlitchPostProcess,
  measureF1RendererProgramDelta,
  renderF1GlitchPrewarmSource,
  renderF1GlitchFrame,
  restoreF1GlitchPostProcess,
  type F1GlitchPostProcess,
} from '../lib/f1-glitch-postprocess';
import { getF1GlitchPulse } from '../lib/f1-glitch-sequence';
import { CPU_PARTICLE_COUNT, SPEED_LINE_COUNT, TOTAL_LINES } from './showroom/showroom-constants';
import { createCpuParticleField, createSpeedLineField, createTrailField } from './showroom/showroom-particles';
import { createShowroomTrack } from './showroom/showroom-track';

let hasWarnedF1GlitchPostProcessUnavailable = false;

const warnF1GlitchPostProcessUnavailable = () => {
  if (hasWarnedF1GlitchPostProcessUnavailable) return;
  hasWarnedF1GlitchPostProcessUnavailable = true;
  console.warn('[F1 glitch] Post-process unavailable');
};

interface ParticleBackgroundProps {
  isPressing: boolean;
  progress: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  loadedModel?: THREE.Group | null;
  onCarClick?: () => void;
  onCarManualInteraction?: () => void;
  exploded?: boolean;
  glitchProgress?: number | null;
}

interface F1RendererAuditSnapshot {
  status: string;
  sourcePrewarms: number;
  modelSourcePrewarms: number;
  modelSourceMisses: number;
  contextLosses: number;
  contextRestores: number;
  directFallbackFrames: number;
  activePulseFrames: number;
  unavailableCount: number;
  firstPulseProgramDeltas: number[];
}

type F1RendererAuditCanvas = HTMLCanvasElement & {
  __f1RendererAudit?: {
    snapshot(): F1RendererAuditSnapshot;
    loseContext(): boolean;
    restoreContext(): boolean;
  };
};

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  isPressing,
  progress,
  audioRef,
  loadedModel,
  onCarClick,
  onCarManualInteraction,
  exploded = false,
  glitchProgress = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const spaceKeyArmedRef = useRef(false);

  // Track state in ref to avoid re-triggering the animation loop closure
  const stateRef = useRef({
    isPressing,
    carHeld: false,
    progress,
    exploded,
    glitchProgress,
    explosionTime: 0,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
    baseUniforms: {
      uTime: { value: 0 },
      uDelta: { value: 0 },
      uIsPressing: { value: isPressing },
      uProgress: { value: progress },
      uExplosionForce: { value: 0 },
      uFieldScale: { value: DEFAULT_FORCE_FIELD_PARAMS.scale },
      uFieldStrength: { value: DEFAULT_FORCE_FIELD_PARAMS.strength },
      uFieldSpeed: { value: DEFAULT_FORCE_FIELD_PARAMS.speed },
      uBassLevel: { value: 0 },
      uPixelRatio: { value: 1 },
    } as GPUEffectUniforms
  });

  useEffect(() => {
    stateRef.current.isPressing = isPressing;
  }, [isPressing]);

  useEffect(() => {
    stateRef.current.exploded = exploded;
    if (exploded) stateRef.current.carHeld = false;
  }, [exploded]);

  useEffect(() => {
    stateRef.current.glitchProgress = glitchProgress;
  }, [glitchProgress]);

  const onCarClickRef = useRef(onCarClick);
  useEffect(() => {
    onCarClickRef.current = onCarClick;
  }, [onCarClick]);

  const onCarManualInteractionRef = useRef(onCarManualInteraction);
  useEffect(() => {
    onCarManualInteractionRef.current = onCarManualInteraction;
  }, [onCarManualInteraction]);

  const modelRef = useRef<THREE.Group | null>(null);
  useEffect(() => {
    modelRef.current = loadedModel || null;
  }, [loadedModel]);

  useEffect(() => {
    if (progress >= 70 && stateRef.current.progress < 70) {
      stateRef.current.explosionTime = -1; // -1 indicates it needs to be set to clock time
    }
    stateRef.current.progress = progress;
    if (progress < 100) stateRef.current.carHeld = false;
  }, [progress]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    stateRef.current.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    stateRef.current.mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Base Scene Setup ──
    const scene = new THREE.Scene(); // Main scene for Car
    const bgScene = new THREE.Scene(); // Background scene for lines

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    // Static camera for background
    const bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    bgCamera.position.z = 50;
    bgCamera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    stateRef.current.baseUniforms.uPixelRatio.value = pixelRatio;

    // We will render bgScene first, then scene on top without clearing
    renderer.autoClear = false;

    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const rendererAuditEnabled = new URLSearchParams(window.location.search)
      .get('f1RendererAudit') === '1';
    const rendererAudit: F1RendererAuditSnapshot = {
      status: 'initializing',
      sourcePrewarms: 0,
      modelSourcePrewarms: 0,
      modelSourceMisses: 0,
      contextLosses: 0,
      contextRestores: 0,
      directFallbackFrames: 0,
      activePulseFrames: 0,
      unavailableCount: 0,
      firstPulseProgramDeltas: [],
    };
    let expectsPrewarmedFirstPulse = false;
    const contextLossExtension = rendererAuditEnabled
      ? renderer.getContext().getExtension('WEBGL_lose_context')
      : null;
    const auditCanvas = renderer.domElement as F1RendererAuditCanvas;
    if (rendererAuditEnabled) {
      auditCanvas.__f1RendererAudit = {
        snapshot: () => ({
          ...rendererAudit,
          firstPulseProgramDeltas: [...rendererAudit.firstPulseProgramDeltas],
        }),
        loseContext: () => {
          if (!contextLossExtension) return false;
          contextLossExtension.loseContext();
          return true;
        },
        restoreContext: () => {
          if (!contextLossExtension) return false;
          contextLossExtension.restoreContext();
          return true;
        },
      };
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const usesLowPowerAirflow = prefersReducedMotion || window.innerWidth < 768;
    const glitchProfile = {
      mobile: window.innerWidth < 768,
      prefersReducedMotion,
    };
    let glitchPostProcess: F1GlitchPostProcess | null = null;
    const studioLighting = createF1StudioLighting(scene);
    const reflection = createStudioReflection({
      renderer,
      scene,
      camera,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      tier: prefersReducedMotion ? 'fallback' : 'reflective',
    });
    reflection.floor.position.y = -10.1;
    let airflow: ReturnType<typeof createF1Airflow> | null = null;
    const wheelMotion = createF1WheelMotionState();

    // ── Advanced Effects Initializers ──
    // const gpuParticles = new GPUParticleSystem(renderer);
    // const useGPU = gpuParticles.init(scene, stateRef.current.baseUniforms);
    const useGPU = false; // Force CPU fallback for now

    // const godRays = new GodRays();
    // const audioVisualizer = new AudioVisualizer();

    // We only connect audio after user interacted to bypass browser autoplay policies
    let audioConnected = false;

    // ── CPU Fallback Floating Particles ──
    let cpuParticleField: ReturnType<typeof createCpuParticleField> | null = null;
    if (!useGPU) {
      cpuParticleField = createCpuParticleField(pixelRatio);
      bgScene.add(cpuParticleField.points);
    }

    // ── 3D Lighting for F1 Model ──
    const ambientLight = new THREE.HemisphereLight(0xeaf6ff, 0x17324a, 1.65);
    scene.add(ambientLight);

    // Bright camera-side key light keeps the dark carbon-fibre pieces readable
    // when they separate and no longer receive light bounced from nearby parts.
    const mainLight = new THREE.DirectionalLight(0xfff4dc, 3.4);
    mainLight.position.set(8, 16, 24);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8bd8ff, 2.25);
    fillLight.position.set(-18, 8, 16);
    scene.add(fillLight);

    const lowerFillLight = new THREE.PointLight(0xffc85a, 2.4, 90, 1.4);
    lowerFillLight.position.set(4, -4, 18);
    scene.add(lowerFillLight);

    // Core inspection light. It sits at the assembled model's local center and
    // shines outward as parts separate, revealing the chassis and suspension.
    const explodedCoreLight = new THREE.PointLight(0x77e7ff, 0.35, 78, 1.15);
    const explodedCoreAnchor = new THREE.Vector3();
    const explodedCoreWorldPosition = new THREE.Vector3();
    scene.add(explodedCoreLight);

    const rimLight = new THREE.DirectionalLight(0xE10600, 1.8);
    rimLight.position.set(-10, 5, -5);
    scene.add(rimLight);

    // ── F1 Car 3D Model Integration ──
    let f1CarGroup: THREE.Group | null = null;
    let f1AssembledLocalBounds: THREE.Box3 | null = null;
    let f1Wheels: THREE.Object3D[] = [];
    let f1ExplodedParts: F1ExplodedPart[] = [];
    let explodeAmount = 0;
    let hasPlacedStudioFloor = false;
    const arrivalState = createF1ArrivalState();
    const assembledWorldBounds = new THREE.Box3();
    const assembledCenter = new THREE.Vector3();
    const neutralCameraTarget = new THREE.Vector3();
    const screenStableOrbitTarget = new THREE.Vector3();
    let isCarMaterialReplaced = false;
    const racingMotion: F1MotionState = { speed: 0, wheelAngle: 0 };
    let revalidateGlitchAfterModelInjection: (() => void) | null = null;

    // We'll check for modelRef.current dynamically in the animate loop to support late arrivals
    const checkModelInjection = () => {
      if (!f1CarGroup && modelRef.current) {
        f1CarGroup = modelRef.current;
        f1Wheels = resolveF1WheelNodes(f1CarGroup);
        f1ExplodedParts = createF1ExplodedParts(f1CarGroup);
        const initialScale = window.innerWidth < 640 ? 6 : 8;
        f1CarGroup.scale.setScalar(initialScale);
        f1CarGroup.rotation.y = 0; // Face the camera directly
        f1CarGroup.position.set(0, -10, getF1Depth(0));
        f1CarGroup.visible = false;
        f1CarGroup.updateMatrixWorld(true);

        f1AssembledLocalBounds = getF1LocalBounds(f1CarGroup);

        const assembledCenterWorld = new THREE.Box3()
          .setFromObject(f1CarGroup)
          .getCenter(new THREE.Vector3());
        explodedCoreAnchor.copy(f1CarGroup.worldToLocal(assembledCenterWorld));

        if (!isCarMaterialReplaced) {
            isCarMaterialReplaced = applyHologramMaterial(f1CarGroup);
        }

        airflow = createF1Airflow(usesLowPowerAirflow ? 'low' : 'high', {
          bounds: f1AssembledLocalBounds,
        });
        f1CarGroup.add(airflow.group);
        scene.add(f1CarGroup);

        // Performance Optimization: Pre-compile the model to avoid lag spikes
        if (renderer && scene && camera) {
          renderer.compile(scene, camera);
        }
        revalidateGlitchAfterModelInjection?.();
      }
    };

    // ── Interaction Controls (Orbit) ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = F1_ORBIT_MAX_POLAR_ANGLE;
    controls.minDistance = 28;
    controls.maxDistance = 68;
    controls.enabled = false;
    let hasSetOrbitTarget = false;
    let isOrbitInteractionReady = false;

    // ── Stopped-car gestures ──
    const raycaster = new THREE.Raycaster();
    const normalizedPointer = new THREE.Vector2();
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let isForwardingPointerCancel = false;
    let carGesture: {
      pointerId: number;
      startedAt: number;
      startX: number;
      startY: number;
      travelPx: number;
      startedOnCar: boolean;
      holdStarted: boolean;
    } | null = null;

    const cancelHoldTimer = () => {
      if (holdTimer === null) return;
      clearTimeout(holdTimer);
      holdTimer = null;
    };

    const clearCarGesture = (releaseCapture: boolean) => {
      cancelHoldTimer();
      stateRef.current.carHeld = false;
      const pointerId = carGesture?.pointerId;
      carGesture = null;
      if (
        releaseCapture
        && pointerId !== undefined
        && renderer.domElement.hasPointerCapture(pointerId)
      ) {
        renderer.domElement.releasePointerCapture(pointerId);
      }
    };

    const updateGestureTravel = (event: PointerEvent) => {
      if (!carGesture || carGesture.pointerId !== event.pointerId) return;
      carGesture.travelPx = Math.max(
        carGesture.travelPx,
        Math.hypot(event.clientX - carGesture.startX, event.clientY - carGesture.startY),
      );
      if (carGesture.travelPx > CAR_DRAG_TOLERANCE_PX) {
        cancelHoldTimer();
        if (carGesture.holdStarted) {
          stateRef.current.carHeld = false;
          carGesture.startedOnCar = false;
          carGesture.holdStarted = false;
          controls.enabled = stateRef.current.progress >= 100 && isOrbitInteractionReady;
        }
      }
    };

    const raycastHitsCar = (event: PointerEvent): boolean => {
      if (!f1CarGroup || !f1CarGroup.visible) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      normalizedPointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(normalizedPointer, camera);
      return raycaster.intersectObject(f1CarGroup, true).some(({ object }) => {
        let ancestor: THREE.Object3D | null = object;
        while (ancestor && ancestor !== f1CarGroup) {
          if (ancestor === airflow?.group) return false;
          ancestor = ancestor.parent;
        }
        return ancestor === f1CarGroup;
      });
    };

    const pointerIsInsideCanvas = (event: PointerEvent): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      return isPointInsideCarGestureBounds(event.clientX, event.clientY, rect);
    };

    const forwardPointerToUnderlyingWelcomeUi = (event: PointerEvent): boolean => {
      const interactiveUi = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>('[data-f1-welcome-action]'))
        .find((element): element is HTMLElement => element !== null);
      const owner = classifyShowroomPointerLayer({
        carHit: raycastHitsCar(event),
        interactiveUiHit: interactiveUi !== undefined,
      });
      if (owner !== 'ui' || !interactiveUi) return false;
      interactiveUi.click();
      return true;
    };

    const handleCarPointerDown = (event: PointerEvent) => {
      if (isAdditionalCarGesturePointer(carGesture?.pointerId ?? null, event.pointerId)) {
        clearCarGesture(false);
        controls.enabled = stateRef.current.progress >= 100 && isOrbitInteractionReady;
        return;
      }
      if (
        carGesture
        || !event.isPrimary
        || (event.pointerType === 'mouse' && event.button !== 0)
        || stateRef.current.progress < 100
      ) return;

      const startedOnCar = raycastHitsCar(event);
      if (!startedOnCar) return;

      carGesture = {
        pointerId: event.pointerId,
        startedAt: performance.now(),
        startX: event.clientX,
        startY: event.clientY,
        travelPx: 0,
        startedOnCar,
        holdStarted: false,
      };
      renderer.domElement.setPointerCapture(event.pointerId);
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!carGesture || carGesture.pointerId !== event.pointerId) return;
        if (canStartCarHold({
          elapsedMs: performance.now() - carGesture.startedAt,
          travelPx: carGesture.travelPx,
          startedOnCar: carGesture.startedOnCar,
          stopped: stateRef.current.progress >= 100,
          exploded: stateRef.current.exploded,
        })) {
          carGesture.holdStarted = true;
          onCarManualInteractionRef.current?.();
          stateRef.current.carHeld = true;
          controls.enabled = false;
        }
      }, CAR_HOLD_DELAY_MS);
    };

    const handleCarPointerMove = (event: PointerEvent) => {
      if (carGesture?.pointerId === event.pointerId && !pointerIsInsideCanvas(event)) {
        forwardCarPointerCancel();
        return;
      }
      updateGestureTravel(event);
    };

    const handleCarPointerUp = (event: PointerEvent) => {
      if (!carGesture || carGesture.pointerId !== event.pointerId) {
        if (
          event.isPrimary
          && (event.pointerType !== 'mouse' || event.button === 0)
          && stateRef.current.progress >= 100
        ) {
          forwardPointerToUnderlyingWelcomeUi(event);
        }
        return;
      }
      if (!pointerIsInsideCanvas(event)) {
        forwardCarPointerCancel();
        return;
      }
      updateGestureTravel(event);
      const holdStartedBeforeRelease = carGesture.holdStarted;
      const release = classifyCarRelease({
        elapsedMs: performance.now() - carGesture.startedAt,
        travelPx: carGesture.travelPx,
        startedOnCar: carGesture.startedOnCar,
        stopped: stateRef.current.progress >= 100,
        exploded: stateRef.current.exploded,
        holdStarted: carGesture.holdStarted,
      });

      if (release === 'toggle') onCarClickRef.current?.();
      if (release === 'end-hold') {
        stateRef.current.carHeld = false;
        if (!holdStartedBeforeRelease) onCarManualInteractionRef.current?.();
      }
      // Pointer capture is released automatically after pointerup (and by
      // OrbitControls); keeping it through this dispatch avoids a second
      // release racing the controls' own handler.
      clearCarGesture(false);
    };

    const handleCarPointerCancel = (event: PointerEvent) => {
      if (isForwardingPointerCancel) return;
      if (carGesture?.pointerId === event.pointerId) clearCarGesture(false);
    };

    const forwardCarPointerCancel = () => {
      if (!carGesture || isForwardingPointerCancel) return;
      const cancelledGesture = carGesture;
      isForwardingPointerCancel = true;
      try {
        renderer.domElement.dispatchEvent(new PointerEvent('pointercancel', {
          bubbles: true,
          cancelable: false,
          pointerId: cancelledGesture.pointerId,
          clientX: cancelledGesture.startX,
          clientY: cancelledGesture.startY,
          isPrimary: true,
        }));
      } finally {
        isForwardingPointerCancel = false;
        clearCarGesture(true);
      }
    };

    const handleCarLostPointerCapture = (event: PointerEvent) => {
      if (isForwardingPointerCancel) return;
      if (carGesture?.pointerId === event.pointerId) forwardCarPointerCancel();
    };

    const handleWindowBlur = () => forwardCarPointerCancel();

    // Capture phase lets the tap classifier run before OrbitControls releases
    // its own pointer capture on the same canvas.
    renderer.domElement.addEventListener('pointerdown', handleCarPointerDown, true);
    renderer.domElement.addEventListener('pointermove', handleCarPointerMove, true);
    renderer.domElement.addEventListener('pointerup', handleCarPointerUp, true);
    renderer.domElement.addEventListener('pointercancel', handleCarPointerCancel, true);
    renderer.domElement.addEventListener('lostpointercapture', handleCarLostPointerCapture, true);
    window.addEventListener('blur', handleWindowBlur);

    // ── High-Fidelity Speed Trails (Shader Lines) ──
    const trailField = createTrailField();

    // ── Cyberpunk Speed Hairlines (Fine Ground Lines & Sides) ──
    const showroomTrack = createShowroomTrack();
    const { mesh: hairMesh, data: hairData, scratch: dummyHair, material: hairMat } = showroomTrack;
    bgScene.add(hairMesh);

    // ── Speed Lines (CPU-driven, low cost) ──
    const speedLineField = createSpeedLineField();
    const { points: speedLines, geometry: lineGeometry, positions: lPositions, speeds: lSpeeds, material: lineMaterial } = speedLineField;
    lineMaterial.uniforms.uPixelRatio.value = pixelRatio;
    bgScene.add(speedLines);

    // ── Animation Loop ──
    const timer = new THREE.Timer();
    let airflowTime = 0;
    let studioReveal = 0;
    let frameId = 0;

    const renderShowroom = (target: THREE.WebGLRenderTarget | null) => {
      renderer.setRenderTarget(target);
      renderer.clear();
      // 1. Render background lines with stable camera.
      renderer.render(bgScene, bgCamera);
      // 2. Update the reflection and restore the requested composition target.
      const previousAutoClear = renderer.autoClear;
      renderer.autoClear = true;
      try {
        reflection.render();
      } finally {
        renderer.autoClear = previousAutoClear;
        renderer.setRenderTarget(target);
      }
      renderer.render(scene, camera);
    };

    const renderShowroomForGlitchPrewarm = (target: THREE.WebGLRenderTarget) => {
      const result = renderF1GlitchPrewarmSource({
        renderer,
        target,
        source: f1CarGroup,
        renderSource: renderShowroom,
      });
      rendererAudit.sourcePrewarms += 1;
      if (f1CarGroup) {
        if (!result.sourcePassParticipated) {
          rendererAudit.modelSourceMisses += 1;
          throw new Error('F1 glitch model source did not participate in target prewarm');
        }
        rendererAudit.modelSourcePrewarms += 1;
      }
      expectsPrewarmedFirstPulse = true;
    };

    const markGlitchPostProcessUnavailable = () => {
      rendererAudit.unavailableCount += 1;
      rendererAudit.status = 'fallback';
      warnF1GlitchPostProcessUnavailable();
    };

    const disableGlitchPostProcess = () => {
      if (!glitchPostProcess) return;
      glitchPostProcess.dispose();
      glitchPostProcess = null;
    };

    const initializeGlitchPostProcess = () => {
      glitchPostProcess = restoreF1GlitchPostProcess({
        glitchPostProcess,
        create: () => createF1GlitchPostProcess(
          renderer,
          window.innerWidth,
          window.innerHeight,
          window.devicePixelRatio,
          glitchProfile,
        ),
        renderSource: renderShowroomForGlitchPrewarm,
        onUnavailable: markGlitchPostProcessUnavailable,
      });
      if (glitchPostProcess) rendererAudit.status = 'prewarmed';
    };
    revalidateGlitchAfterModelInjection = initializeGlitchPostProcess;

    // Three restores its renderer state first because it registered its canvas
    // listener during construction. Rebuild and fully prewarm our driver-era
    // resources only after that restoration event reaches this later listener.
    const removeGlitchContextRecovery = bindF1GlitchContextRecovery(renderer.domElement, {
      onContextLost: () => {
        // The browser has already invalidated and released this context's GPU
        // handles. Drop the JS owner without issuing stale-context deletes;
        // restoration creates and validates a completely new resource set.
        glitchPostProcess = null;
        rendererAudit.contextLosses += 1;
        rendererAudit.status = 'context-lost';
      },
      onContextRestored: () => {
        rendererAudit.contextRestores += 1;
        initializeGlitchPostProcess();
      },
    });
    checkModelInjection();
    if (!f1CarGroup) initializeGlitchPostProcess();

    const animate = (timestamp: number) => {
      frameId = requestAnimationFrame(animate);
      checkModelInjection();

      timer.update(timestamp);
      const time = timer.getElapsed();
      const delta = Math.min(Math.max(timer.getDelta(), 0), 0.1);
      airflowTime = advanceF1AirflowTime(airflowTime, delta);

      const s = stateRef.current;
      const targetRacingSpeed = getTargetSpeed(s.progress, s.isPressing);
      stepF1Motion(racingMotion, targetRacingSpeed, delta);
      const racingSpeed = racingMotion.speed;
      stepF1WheelMotion(wheelMotion, s.carHeld, delta, prefersReducedMotion);
      if (airflow) {
        if (prefersReducedMotion) {
          airflow.update({
            time: airflowTime,
            holdIntensity: wheelMotion.holdIntensity * 0.35,
            reducedMotion: true,
          });
        } else {
          airflow.update({
            time: airflowTime,
            holdIntensity: wheelMotion.holdIntensity,
            reducedMotion: false,
          });
        }
      }
      studioLighting.update(wheelMotion.holdIntensity);

      applyF1WheelAngle(
        f1Wheels,
        getF1WheelRenderAngle(
          racingMotion.wheelAngle,
          wheelMotion.angle,
          prefersReducedMotion,
        ),
      );

      // Connect audio on first press
      /*
      if (s.isPressing && !audioConnected && audioRef?.current) {
        audioConnected = audioVisualizer.connect(audioRef.current);
        if (audioConnected) audioVisualizer.resume();
      }

      // Read audio data and map to force field
      const bands = audioVisualizer.getBands();
      s.baseUniforms.uBassLevel.value = bands.bass;
      s.baseUniforms.uFieldStrength.value = DEFAULT_FORCE_FIELD_PARAMS.strength + (bands.overall * 2.0);
      s.baseUniforms.uFieldSpeed.value = DEFAULT_FORCE_FIELD_PARAMS.speed + (bands.mid * 0.5);
      */
      // Update uniforms
      s.baseUniforms.uTime.value = time;
      s.baseUniforms.uDelta.value = delta;
      s.baseUniforms.uIsPressing.value = s.isPressing;
      s.baseUniforms.uProgress.value = s.progress;
      s.baseUniforms.uFieldSpeed.value = DEFAULT_FORCE_FIELD_PARAMS.speed + racingSpeed * 1.5;
      s.baseUniforms.uExplosionForce.value = 0;
      
      // Update Hologram/Progress Uniforms
      // Only animate hologram if progress is 100 (car is fully stopped).
      // Calculate a local progress from 0 to 1 over a few seconds starting when s.progress hit 100
      let hologramProgress = 0;
      if (s.progress >= 100) {
          // If we just hit 100, record the start time
          if (s.explosionTime < 0) {
              s.explosionTime = time;
          }
          
          // Animate hologram covering the car over 4.5 seconds (slower)
          const animationDuration = 4.5; 
          hologramProgress = Math.min(1.0, (time - s.explosionTime) / animationDuration);
          
          // Revert to original material when fully enveloped
          if (hologramProgress >= 1.0 && isCarMaterialReplaced && f1CarGroup) {
              if (revertHologramMaterial(f1CarGroup)) {
                  isCarMaterialReplaced = false; // Prevents calling it every frame
                  // The restored GLB materials have different target-specific
                  // programs from the hologram clones. Validate them now, while
                  // the clean hold still precedes the first glitch pulse.
                  revalidateGlitchAfterModelInjection?.();
              }
          }
      } else {
          s.explosionTime = -1; 
          // If user lets go before 100%, re-apply the hologram effect next time it shows
          if (!isCarMaterialReplaced && f1CarGroup) {
              isCarMaterialReplaced = applyHologramMaterial(f1CarGroup);
          }
      }
      
      HologramShaderUniforms.uHologramProgress.value = hologramProgress;
      HologramShaderUniforms.uTime.value = time;
      if (f1CarGroup) {
          f1CarGroup.updateMatrixWorld(); 
          HologramShaderUniforms.uGroupMatrixInverse.value.copy(f1CarGroup.matrixWorld).invert();
      }

      // ── Camera Mouse Sway or OrbitControls ──
      // The bgCamera (background lines) only responds to mouse sway, NEVER OrbitControls
      bgCamera.position.x += (s.mouse.targetX * 3 - bgCamera.position.x) * 0.05;
      bgCamera.position.y += (s.mouse.targetY * 2 - bgCamera.position.y) * 0.05;
      bgCamera.lookAt(0, 0, 0);

      if (s.progress >= 100) {
        if (s.carHeld || !isOrbitInteractionReady) {
          controls.enabled = false;
        } else {
          controls.enabled = true;
          controls.update();
        }
      } else {
        controls.enabled = false;
        camera.position.x = bgCamera.position.x;
        camera.position.y = bgCamera.position.y;
        camera.lookAt(0, 0, 0);
      }

      // ── Update Particles ──
      // Original CPU fallback loop restored for floating particles
      if (cpuParticleField) {
        const { points: cpuParticles, phases: particlePhases } = cpuParticleField;
        const pArr = cpuParticles.geometry.attributes.position.array as Float32Array;

        for (let i = 0; i < CPU_PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          let dx, dy, dz;

          // 只要进度>0且<100，就向中心反向加速聚集
          if (racingSpeed > 0.001) {
            const dirX = 0 - pArr[i3];
            const dirY = -25 - pArr[i3 + 1];
            const dist = Math.sqrt(dirX*dirX + dirY*dirY) || 1;
            const revForce = 2.0 + racingSpeed * racingSpeed * 12.0;
            dx = (dirX / dist) * revForce;
            dy = (dirY / dist) * revForce;
            dz = revForce * 1.5;

          } else {
            // 默认漂浮状态 (0% 和 100%)
            dx = Math.sin(time * 0.3 + particlePhases[i]) * 0.04;
            dy = Math.cos(time * 0.2 + particlePhases[i] * 1.3) * 0.03;
            dz = 0.5;
          }

          pArr[i3] += dx; pArr[i3 + 1] += dy; pArr[i3 + 2] += dz;

          // 边界重置：始终活跃，保证无论是在吸入中心还是漂浮时都不消失
          if (pArr[i3] < -200) pArr[i3] = 200;
          if (pArr[i3] > 200) pArr[i3] = -200;
          if (pArr[i3 + 1] < -150) pArr[i3 + 1] = 150;
          if (pArr[i3 + 1] > 150) pArr[i3 + 1] = -150;

          // Z轴动态循环：确保粒子永远在可见范围内循环
          if (pArr[i3 + 2] > 100) {
            pArr[i3 + 2] = -300;
          } else if (pArr[i3 + 2] < -300) {
            pArr[i3 + 2] = 100;
          }
        }
        cpuParticles.geometry.attributes.position.needsUpdate = true;
        (cpuParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
        cpuParticles.rotation.z = time * 0.02;
        cpuParticles.rotation.y = Math.sin(time * 0.1) * 0.1;
      }

      // ── Update F1 Car & Effects ──
      // Show car as soon as user starts pressing (0%+) or if progress >= 30% (auto-loading) or fully loaded
      if ((s.isPressing || s.progress >= 30) && f1CarGroup) {
        if (!f1CarGroup.visible) {
           f1CarGroup.visible = true;
        }

        // 0-100% Progress mapping
        const progressFactor = s.progress / 100;

        // Restore the original long-distance reveal while keeping the newer
        // wheel and environment motion.
        const targetZ = getF1Depth(s.progress);
        f1CarGroup.position.z = dampF1ArrivalValue(f1CarGroup.position.z, targetZ, delta, 8);
        f1CarGroup.position.x = 0; // Stay centered
        const engineVibration =
          (Math.sin(time * 42) * 0.035 + Math.sin(time * 19) * 0.02) * racingSpeed;
        const targetY = s.progress >= 100 ? -10 : -10 + engineVibration;
        f1CarGroup.position.y = dampF1ArrivalValue(f1CarGroup.position.y, targetY, delta, 10);

        // Keep the physically wider native RB20 inside narrow viewports while
        // preserving the established desktop framing.
        const finalScale = window.innerWidth < 640 ? 9 : 12;
        const targetScale = finalScale * (2 / 3 + progressFactor / 3);
        const settledScale = dampF1ArrivalValue(f1CarGroup.scale.x, targetScale, delta, 8);
        f1CarGroup.scale.setScalar(settledScale);

        // Rotation: keep the arrival lean in flight, then settle both pitch and
        // roll back to a level pose before the studio floor is revealed.
        applyF1ArrivalRotation(f1CarGroup.rotation, s.progress, racingSpeed, time);

        if (f1AssembledLocalBounds) {
          f1CarGroup.updateMatrixWorld(true);
          assembledWorldBounds
            .copy(f1AssembledLocalBounds)
            .applyMatrix4(f1CarGroup.matrixWorld);
          assembledWorldBounds.getCenter(assembledCenter);
        }

        const stoppedPoseSettled =
          s.progress >= 100
          && Math.abs(f1CarGroup.position.z - getF1Depth(100)) < 0.05
          && Math.abs(f1CarGroup.position.y + 10) < 0.015
          && Math.abs(f1CarGroup.scale.x - finalScale) < 0.02
          && racingSpeed < 0.01;
        stepF1ArrivalState(arrivalState, s.progress >= 100, stoppedPoseSettled, delta);

        if (!hasSetOrbitTarget && arrivalState.ready) {
          getF1ScreenStableOrbitTarget(
            camera.position,
            neutralCameraTarget,
            assembledCenter,
            screenStableOrbitTarget,
          );
          controls.target.copy(screenStableOrbitTarget);
          hasSetOrbitTarget = true;
        }

        if (!hasPlacedStudioFloor && hasSetOrbitTarget && f1AssembledLocalBounds) {
          reflection.floor.position.y = assembledWorldBounds.min.y - 0.03;
          hasPlacedStudioFloor = true;
        }

        if (
          !isOrbitInteractionReady
          && hasSetOrbitTarget
          && arrivalState.ready
        ) {
          isOrbitInteractionReady = true;
        }

        // Update Trails (Trailing logic) (Removed old shader trail logic)
        // ... handled elsewhere if needed

      } else if (f1CarGroup) {
        f1CarGroup.visible = false;
        stepF1ArrivalState(arrivalState, false, false, delta);
      }

      studioReveal = stepStudioReveal(
        studioReveal,
        arrivalState.ready && hasPlacedStudioFloor && hasSetOrbitTarget,
        delta,
      );
      reflection.setReveal(studioReveal);

      const explodeTarget = s.progress >= 100 && s.exploded ? 1 : 0;
      explodeAmount += (explodeTarget - explodeAmount) * (1 - Math.exp(-delta * 4.2));
      updateF1ExplodedParts(f1ExplodedParts, explodeAmount, delta, {
        floorY: reflection.floor.position.y,
        clearance: 0.03,
      });
      explodedCoreLight.intensity = 0.35 + explodeAmount * 7.15;
      if (f1CarGroup) {
        explodedCoreWorldPosition
          .copy(explodedCoreAnchor)
          .applyMatrix4(f1CarGroup.matrixWorld);
        explodedCoreLight.position.copy(explodedCoreWorldPosition);
      }

      // ── Update Hairline Road & Speed Lines Fading ──
      // The environment fades with the same damped speed as the wheels, so
      // completion settles instead of snapping at 100%.
      const trackOpacity = Math.min(1, racingSpeed * 1.2);
      // We no longer toggle visibility, we use smooth opacity so they fade out naturally
      // Update shader uniforms for hairMat
      hairMat.opacity = trackOpacity * 0.18;
      lineMaterial.uniforms.uOpacity.value = trackOpacity * 0.55;
      // Accelerate rapidly if pressing OR if progress is auto-completing (s.progress >= 30)
      const isTunnelMovingInward = racingSpeed > 0.001;
      const roadSpeed = 18 + Math.pow(racingSpeed, 1.35) * 1100;
      // Only update positions if they are actually visible (optimization)
      if (trackOpacity > 0) {
        for (let i = 0; i < TOTAL_LINES; i++) {
            const data = hairData[i];
            if (isTunnelMovingInward) {
                // Rush the road toward the viewer while the car stays framed.
                data.z += roadSpeed * data.speedMultiplier * delta;
                if (data.z > 150) {
                    data.z = -600 - Math.random() * 200;
                }
            } else {
                // Default: Normal chill driving forward, lines come AT you slowly
                data.z += 18 * data.speedMultiplier * delta;
                if (data.z > 150) {
                    data.z = -600 - Math.random() * 200; // spawn far back
                }
            }
            dummyHair.position.set(data.x, data.y, data.z);
            dummyHair.rotation.set(-Math.PI / 2, 0, 0);
            if (data.isVertical) {
               const faceAngle = Math.atan2(data.y + 10, Math.abs(data.x));
               dummyHair.rotateY(data.x < 0 ? -faceAngle : faceAngle);
            }
            dummyHair.scale.set(data.width, data.length, 1);
            dummyHair.updateMatrix();
            hairMesh.setMatrixAt(i, dummyHair.matrix);
        }
        hairMesh.instanceMatrix.needsUpdate = true;
      }

      speedLines.visible = trackOpacity > 0.01;
      if (speedLines.visible) {
        const pointSpeed = 120 + racingSpeed * 950;
        for (let i = 0; i < SPEED_LINE_COUNT; i++) {
          const i3 = i * 3;
          lPositions[i3 + 2] += pointSpeed * lSpeeds[i] * delta;
          if (lPositions[i3 + 2] > 45) {
            lPositions[i3 + 2] = -120 - Math.random() * 80;
          }
        }
        lineGeometry.attributes.position.needsUpdate = true;
      }

      // ── Render Dual Pass ──
      const activeGlitchProgress = stateRef.current.glitchProgress;
      const activeGlitchPulse = activeGlitchProgress === null
        ? 0
        : getF1GlitchPulse(activeGlitchProgress);
      const glitchFrameInput = {
        glitchPostProcess,
        progress: activeGlitchProgress,
        renderShowroom,
        onUnavailable: markGlitchPostProcessUnavailable,
      };
      let firstPulseProgramDelta: number | null = null;
      if (activeGlitchPulse > 0 && glitchPostProcess && expectsPrewarmedFirstPulse) {
        const measurement = measureF1RendererProgramDelta(
          () => renderer.info.programs.length,
          () => renderF1GlitchFrame(glitchFrameInput),
        );
        glitchPostProcess = measurement.result;
        firstPulseProgramDelta = measurement.delta;
      } else {
        glitchPostProcess = renderF1GlitchFrame(glitchFrameInput);
      }
      if (activeGlitchProgress !== null && !glitchPostProcess) {
        rendererAudit.directFallbackFrames += 1;
      }
      if (activeGlitchPulse > 0 && glitchPostProcess) {
        rendererAudit.activePulseFrames += 1;
        if (firstPulseProgramDelta !== null) {
          rendererAudit.firstPulseProgramDeltas.push(firstPulseProgramDelta);
          expectsPrewarmedFirstPulse = false;
        }
        rendererAudit.status = 'active';
      }
    };

    animate(performance.now());

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      bgCamera.aspect = window.innerWidth / window.innerHeight;
      bgCamera.updateProjectionMatrix();

      const nextPixelRatio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(nextPixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      stateRef.current.baseUniforms.uPixelRatio.value = nextPixelRatio;
      reflection.resize(window.innerWidth, window.innerHeight);
      if (glitchPostProcess) {
        try {
          glitchPostProcess.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
          glitchPostProcess.prewarm(renderShowroomForGlitchPrewarm);
        } catch {
          disableGlitchPostProcess();
          markGlitchPostProcessUnavailable();
        }
      }
      // godRays.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(frameId);
      removeGlitchContextRecovery();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('blur', handleWindowBlur);
      renderer.domElement.removeEventListener('pointerdown', handleCarPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', handleCarPointerMove, true);
      renderer.domElement.removeEventListener('pointerup', handleCarPointerUp, true);
      renderer.domElement.removeEventListener('pointercancel', handleCarPointerCancel, true);
      renderer.domElement.removeEventListener('lostpointercapture', handleCarLostPointerCapture, true);
      clearCarGesture(false);

      // gpuParticles.dispose(scene);
      // godRays.dispose();
      // audioVisualizer.dispose();

      showroomTrack.dispose();
      speedLineField.dispose();
      trailField.dispose();
      cpuParticleField?.dispose();

      if (airflow) {
        airflow.group.removeFromParent();
        airflow.dispose();
      }
      controls.dispose();
      studioLighting.dispose();
      reflection.dispose();
      if (glitchPostProcess) glitchPostProcess.dispose();
      delete auditCanvas.__f1RendererAudit;
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audioRef]);

  return <div
    ref={containerRef}
    role="button"
    tabIndex={progress >= 100 ? 0 : -1}
    aria-label="Interactive Formula One showroom car"
    aria-pressed={exploded}
    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFB800]"
    onClick={(event) => {
      if (progress >= 100 && event.detail === 0) onCarClick?.();
    }}
    onKeyDown={(event) => {
      if (progress < 100) return;
      if (event.repeat) {
        if (event.key === ' ') event.preventDefault();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        onCarClick?.();
      } else if (event.key === ' ') {
        event.preventDefault();
        spaceKeyArmedRef.current = true;
      }
    }}
    onKeyUp={(event) => {
      if (event.key === ' ') {
        event.preventDefault();
        const shouldActivate = progress >= 100 && spaceKeyArmedRef.current;
        spaceKeyArmedRef.current = false;
        if (shouldActivate) onCarClick?.();
      }
    }}
    onBlur={() => {
      spaceKeyArmedRef.current = false;
    }}
    style={{ position: 'fixed', inset: 0, zIndex: 95, pointerEvents: progress >= 100 ? 'auto' : 'none', cursor: progress >= 100 ? 'grab' : 'default' }}
  />;
};

export default ParticleBackground;
