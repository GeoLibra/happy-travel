import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { applyF1WheelAngle, createF1WheelMotionState, getF1WheelRenderAngle, stepF1WheelMotion } from '../src/lib/f1-wheel-motion';

const state = createF1WheelMotionState();
for (let i = 0; i < 60; i++) stepF1WheelMotion(state, true, 1 / 60, false);
assert(state.velocity > 4);
assert(state.holdIntensity > 0.95);
const releaseVelocity = state.velocity;
for (let i = 0; i < 30; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < releaseVelocity && state.velocity > 0);
for (let i = 0; i < 180; i++) stepF1WheelMotion(state, false, 1 / 60, false);
assert(state.velocity < 0.02);
assert(state.holdIntensity < 0.02);

const wheel = new THREE.Group();
wheel.position.set(1, 2, 3);
wheel.rotation.set(0.1, 0.2, 0.3);
applyF1WheelAngle([wheel], 1.25);
assert.deepEqual(wheel.position.toArray(), [1, 2, 3]);
assert.equal(wheel.rotation.x, 1.25);
assert.equal(wheel.rotation.y, 0.2);
assert.equal(wheel.rotation.z, 0.3);

const reducedMotionState = createF1WheelMotionState();
for (let i = 0; i < 120; i++) {
  stepF1WheelMotion(reducedMotionState, true, 1 / 60, true);
}
assert.equal(reducedMotionState.velocity, 0, 'reduced-motion hold must keep wheel velocity at zero');
assert.equal(reducedMotionState.angle, 0, 'reduced-motion hold must keep wheel angle at zero');

assert.equal(
  getF1WheelRenderAngle(1.25, 0.5, false),
  1.75,
  'arrival travel and stopped-car hold must both contribute to visible wheel rotation',
);
assert.equal(
  getF1WheelRenderAngle(1.25, 0.5, true),
  0,
  'reduced motion must suppress visible wheel rotation',
);

const particleBackgroundSource = readFileSync(
  new URL('../src/components/ParticleBackground.tsx', import.meta.url),
  'utf8',
);

const sceneSetup = particleBackgroundSource.indexOf('const scene = new THREE.Scene()');
const rendererSetup = particleBackgroundSource.indexOf('const renderer = new THREE.WebGLRenderer');
const wheelMotionSetup = particleBackgroundSource.indexOf('const wheelMotion = createF1WheelMotionState()');
const airflowSetup = particleBackgroundSource.indexOf('airflow = createF1Airflow(');
const studioLightingSetup = particleBackgroundSource.indexOf('const studioLighting = createF1StudioLighting(scene)');
const reflectionSetup = particleBackgroundSource.indexOf('const reflection = createStudioReflection({');

assert(sceneSetup >= 0, 'ParticleBackground must create the main scene');
assert(rendererSetup > sceneSetup, 'ParticleBackground must create the renderer after the main scene');
assert(wheelMotionSetup > rendererSetup, 'ParticleBackground must create wheel motion after renderer setup');
assert(airflowSetup > rendererSetup, 'ParticleBackground must create airflow after renderer setup');
assert(studioLightingSetup > rendererSetup, 'ParticleBackground must create studio lighting after renderer setup');
assert(reflectionSetup > rendererSetup, 'ParticleBackground must create reflection after renderer setup');

const modelInjection = particleBackgroundSource.indexOf('const checkModelInjection');
const airflowAttachment = particleBackgroundSource.indexOf('f1CarGroup.add(airflow.group)', modelInjection);
const modelCompilation = particleBackgroundSource.indexOf('renderer.compile(scene, camera)', modelInjection);
assert(
  airflowSetup > modelInjection && airflowSetup < airflowAttachment,
  'ParticleBackground must create bounded airflow only after model injection',
);
assert(
  airflowAttachment > modelInjection && airflowAttachment < modelCompilation,
  'ParticleBackground must attach airflow to the F1 car before renderer compilation',
);

assert.match(
  particleBackgroundSource,
  /carHeld:\s*false/,
  'ParticleBackground must track stopped-car holds independently from start progress',
);
assert.match(particleBackgroundSource, /stepF1WheelMotion\(wheelMotion, s\.carHeld, delta, prefersReducedMotion\)/);
assert.match(particleBackgroundSource, /holdIntensity: wheelMotion\.holdIntensity/);
assert.doesNotMatch(particleBackgroundSource, /stepF1WheelMotion\(wheelMotion, s\.isPressing/);
assert.match(particleBackgroundSource, /new THREE\.Raycaster\(\)/);
assert.match(particleBackgroundSource, /raycaster\.intersectObject\(f1CarGroup, true\)/);
assert.match(particleBackgroundSource, /controls\.minPolarAngle = Math\.PI \/ 3/);
assert.match(particleBackgroundSource, /controls\.maxPolarAngle = Math\.PI \/ 2 - 0\.04/);
assert.match(particleBackgroundSource, /controls\.enablePan = false/);
assert.match(particleBackgroundSource, /reflection\.setReveal\(studioReveal\)/);
assert.match(particleBackgroundSource, /updateF1ExplodedParts\([\s\S]*?floorY: reflection\.floor\.position\.y/);
assert.match(
  particleBackgroundSource,
  /onCarManualInteraction\?: \(\) => void;/,
  'ParticleBackground must expose a focused accepted-hold callback',
);
assert.match(
  particleBackgroundSource,
  /carGesture\.holdStarted = true;[\s\S]*?onCarManualInteractionRef\.current\?\.\(\);[\s\S]*?stateRef\.current\.carHeld = true;/,
  'timer-accepted holds must cancel pending automatic explosion before activating hold visuals',
);
assert.match(
  particleBackgroundSource,
  /const holdStartedBeforeRelease = carGesture\.holdStarted;[\s\S]*?if \(release === 'end-hold'\) \{[\s\S]*?if \(!holdStartedBeforeRelease\) onCarManualInteractionRef\.current\?\.\(\);/,
  'an exact-deadline release must report manual interaction when its hold timer has not fired',
);
assert.match(
  particleBackgroundSource,
  /if \(carGesture\.travelPx > CAR_DRAG_TOLERANCE_PX\) \{[\s\S]*?if \(carGesture\.holdStarted\) \{[\s\S]*?stateRef\.current\.carHeld = false;[\s\S]*?carGesture\.startedOnCar = false;[\s\S]*?carGesture\.holdStarted = false;[\s\S]*?controls\.enabled = stateRef\.current\.progress >= 100 && isOrbitInteractionReady;/,
  'dragging beyond tolerance after hold activation must stop the hold and invalidate release toggling',
);
assert.match(
  particleBackgroundSource,
  /if \(isAdditionalCarGesturePointer\(carGesture\?\.pointerId \?\? null, event\.pointerId\)\) \{[\s\S]*?clearCarGesture\(false\);[\s\S]*?controls\.enabled = stateRef\.current\.progress >= 100 && isOrbitInteractionReady;[\s\S]*?return;/,
  'an additional pointer must synchronously cancel custom hold state before OrbitControls handles it',
);
assert.match(
  particleBackgroundSource,
  /const pointerIsInsideCanvas = \(event: PointerEvent\)[\s\S]*?isPointInsideCarGestureBounds\([\s\S]*?const handleCarPointerMove = \(event: PointerEvent\) => \{[\s\S]*?!pointerIsInsideCanvas\(event\)[\s\S]*?forwardCarPointerCancel\(\);[\s\S]*?return;/,
  'captured pointer movement outside the canvas must cancel pending and active holds',
);
assert.match(
  particleBackgroundSource,
  /let isOrbitInteractionReady = false;/,
  'camera target initialization and user OrbitControls readiness must have separate state',
);
assert.match(
  particleBackgroundSource,
  /if \(s\.progress >= 100\) \{[\s\S]*?if \(s\.carHeld \|\| !isOrbitInteractionReady\) \{[\s\S]*?controls\.enabled = false;[\s\S]*?\} else \{[\s\S]*?controls\.enabled = true;/,
  'the primary stopped camera path must wait for settling before enabling user controls',
);

const finalStoppedZ = particleBackgroundSource.indexOf(
  'dampF1ArrivalValue(f1CarGroup.position.z, targetZ, delta, 8)',
);
const finalStoppedY = particleBackgroundSource.indexOf(
  'dampF1ArrivalValue(f1CarGroup.position.y, targetY, delta, 10)',
);
const finalScale = particleBackgroundSource.indexOf(
  'dampF1ArrivalValue(f1CarGroup.scale.x, targetScale, delta, 8)',
  finalStoppedY,
);
const floorPlacement = particleBackgroundSource.indexOf(
  'reflection.floor.position.y = assembledWorldBounds.min.y - 0.03;',
  finalScale,
);
const stableOrbitTargetProjection = particleBackgroundSource.indexOf(
  'getF1ScreenStableOrbitTarget(',
  finalScale,
);
const orbitTargetCommit = particleBackgroundSource.indexOf(
  'controls.target.copy(screenStableOrbitTarget);',
  stableOrbitTargetProjection,
);
const floorPlacementCommit = particleBackgroundSource.indexOf(
  'hasPlacedStudioFloor = true;',
  floorPlacement,
);
const revealAdvance = particleBackgroundSource.indexOf(
  'studioReveal = stepStudioReveal(',
  orbitTargetCommit,
);
const stoppedPoseGate = particleBackgroundSource.indexOf(
  '&& arrivalState.ready',
  orbitTargetCommit,
);
const orbitInteractionReadyCommit = particleBackgroundSource.indexOf(
  'isOrbitInteractionReady = true;',
  stoppedPoseGate,
);

assert(finalStoppedZ >= 0, 'the final car depth must be damped instead of snapped');
assert(finalStoppedY >= 0, 'the final assembled Y must be damped instead of snapped');
assert(finalStoppedZ < finalStoppedY, 'depth damping must run before final Y/scale damping');
assert(finalScale > finalStoppedY, 'final scale damping must run after final assembled Y');
assert(
  stableOrbitTargetProjection > finalScale && orbitTargetCommit > stableOrbitTargetProjection,
  'orbit target must be projected onto the unchanged arrival view ray before it is committed',
);
assert(
  floorPlacement > orbitTargetCommit
    && floorPlacementCommit > floorPlacement
    && revealAdvance > floorPlacementCommit,
  'the final camera target and floor placement must both commit before positive reveal',
);
assert(
  stoppedPoseGate > orbitTargetCommit && orbitInteractionReadyCommit > stoppedPoseGate,
  'user OrbitControls enablement must remain separately gated on arrival readiness after target setup',
);
assert.match(
  particleBackgroundSource,
  /studioReveal = stepStudioReveal\([\s\S]*?arrivalState\.ready && hasPlacedStudioFloor && hasSetOrbitTarget,[\s\S]*?delta,[\s\S]*?\);/,
  'the floor reveal must not advance until final floor placement and camera target are committed',
);
assert.match(
  particleBackgroundSource,
  /stepF1ArrivalState\(arrivalState, s\.progress >= 100, stoppedPoseSettled, delta\)/,
  'studio placement must require the shared four-frame settle and hold controller',
);
assert.equal(
  particleBackgroundSource.match(/reflection\.floor\.position\.y = assembledWorldBounds\.min\.y - 0\.03;/g)?.length,
  1,
  'the measured floor Y must be written only once so it cannot jump later',
);
assert.equal(
  particleBackgroundSource.match(/hasSetOrbitTarget = true;/g)?.length,
  1,
  'orbit target must only be committed once before the reveal starts',
);
assert.doesNotMatch(
  particleBackgroundSource,
  /controls\.target\.lerpVectors\(/,
  'arrival must not retarget the camera toward the car and lift it in screen space',
);
const floorCommitBlock = particleBackgroundSource.slice(floorPlacement, revealAdvance);
assert.doesNotMatch(
  floorCommitBlock,
  /controls\.target\.(copy|set|lerp)|controls\.update\(\)/,
  'floor appearance must not mutate the camera target and move the stopped car',
);
assert.match(
  particleBackgroundSource,
  /const forwardCarPointerCancel = \(\) => \{[\s\S]*?renderer\.domElement\.dispatchEvent\(new PointerEvent\('pointercancel',[\s\S]*?clearCarGesture\(true\);/,
  'abnormal gesture termination must dispatch pointercancel through the canvas before custom cleanup',
);
assert.match(
  particleBackgroundSource,
  /const handleCarLostPointerCapture =[\s\S]*?forwardCarPointerCancel\(\);[\s\S]*?const handleWindowBlur = \(\) => forwardCarPointerCancel\(\);/,
  'lost capture and window blur must share the guarded pointercancel path',
);
assert.match(particleBackgroundSource, /role="button"/);
assert.match(particleBackgroundSource, /aria-pressed=\{exploded\}/);
assert.match(
  particleBackgroundSource,
  /onClick=\{\(event\) => \{[\s\S]*?event\.detail === 0[\s\S]*?onCarClick\?\.\(\);/,
  'only zero-detail AT/synthetic clicks may activate through the React click path',
);
assert.match(
  particleBackgroundSource,
  /onKeyDown=\{\(event\) => \{[\s\S]*?event\.repeat[\s\S]*?event\.key === 'Enter'[\s\S]*?onCarClick\?\.\(\);/,
  'Enter activation must ignore held/repeated keydown events',
);
assert.match(
  particleBackgroundSource,
  /onKeyUp=\{\(event\) => \{[\s\S]*?event\.key === ' '[\s\S]*?spaceKeyArmedRef\.current[\s\S]*?onCarClick\?\.\(\);/,
  'Space must activate once on keyup after a non-repeated keydown',
);
assert.match(
  particleBackgroundSource,
  /focus-visible:ring-2[\s\S]*?focus-visible:ring-inset[\s\S]*?focus-visible:ring-\[#FFB800\]/,
  'the full-canvas accessible control must expose a visible focus-visible ring',
);
assert.match(
  particleBackgroundSource,
  /applyF1WheelAngle\([\s\S]*?getF1WheelRenderAngle\([\s\S]*?racingMotion\.wheelAngle,[\s\S]*?wheelMotion\.angle,[\s\S]*?prefersReducedMotion/,
  'ParticleBackground must render both arrival travel and stopped-car hold wheel angles',
);
assert.match(
  particleBackgroundSource,
  /airflow\.update\(\{[\s\S]*?holdIntensity: wheelMotion\.holdIntensity,[\s\S]*?\}\);/,
  'ParticleBackground must pass decaying wheel hold intensity to airflow',
);
assert.match(
  particleBackgroundSource,
  /holdIntensity: wheelMotion\.holdIntensity \* 0\.35/,
  'ParticleBackground must reduce airflow intensity under reduced motion',
);
assert.doesNotMatch(
  particleBackgroundSource,
  /holdIntensity:\s*s\.isPressing\s*\?\s*wheelMotion\.holdIntensity\s*:\s*0/,
  'ParticleBackground must not cut airflow opacity to zero immediately on release',
);

const reflectionRender = particleBackgroundSource.indexOf('reflection.render()');
const mainSceneRender = particleBackgroundSource.indexOf('renderer.render(scene, camera)', reflectionRender);
assert(
  reflectionRender >= 0 && reflectionRender < mainSceneRender,
  'ParticleBackground must render reflection before the main scene',
);
assert.match(
  particleBackgroundSource,
  /const previousAutoClear = renderer\.autoClear;[\s\S]*?renderer\.autoClear = true;[\s\S]*?reflection\.render\(\);[\s\S]*?renderer\.autoClear = previousAutoClear;/,
  'ParticleBackground must clear reflection targets without changing the dual-pass renderer mode',
);
assert.match(
  particleBackgroundSource,
  /reflection\.resize\(window\.innerWidth, window\.innerHeight\);/,
  'ParticleBackground must resize reflection with the viewport',
);

const airflowDispose = particleBackgroundSource.indexOf('airflow.dispose()');
const studioLightingDispose = particleBackgroundSource.indexOf('studioLighting.dispose()');
const reflectionDispose = particleBackgroundSource.indexOf('reflection.dispose()');
const rendererDispose = particleBackgroundSource.indexOf('renderer.dispose()');
assert(airflowDispose >= 0 && airflowDispose < rendererDispose, 'ParticleBackground must dispose airflow before the renderer');
assert(studioLightingDispose >= 0 && studioLightingDispose < rendererDispose, 'ParticleBackground must dispose studio lighting before the renderer');
assert(reflectionDispose >= 0 && reflectionDispose < rendererDispose, 'ParticleBackground must dispose reflection before the renderer');
