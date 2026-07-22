import assert from 'node:assert/strict';

import { createShowroomDirectorFrame } from '../src/lib/showroom-director.ts';

// 1. Chapter 1: Material (progress 0.09)
const materialFrame = createShowroomDirectorFrame(0.09);
assert.equal(materialFrame.chapterId, 'material');
assert.equal(materialFrame.car.explodeAmount, 0, 'material chapter car explodeAmount must be 0');
assert(materialFrame.camera.fov >= 45 && materialFrame.camera.fov <= 48);
assert.equal(materialFrame.effects.airflowIntensity, 0.1);

// 2. Chapter 2: Aero (progress 0.30)
const aeroFrame = createShowroomDirectorFrame(0.30);
assert.equal(aeroFrame.chapterId, 'aero');
assert(aeroFrame.car.explodeAmount > 0, 'aero chapter should show slight explosion');
assert(aeroFrame.effects.airflowIntensity > 0.5, 'aero chapter airflow intensity should be high');

// 3. Chapter 3: Power (progress 0.52)
const powerFrame = createShowroomDirectorFrame(0.52);
assert.equal(powerFrame.chapterId, 'power');
assert(powerFrame.car.explodeAmount >= 0.3, 'power chapter should have high explode amount');
assert.equal(powerFrame.effects.particleOpacity, 0.8);

// 4. Chapter 4: Circuit (progress 0.72)
const circuitFrame = createShowroomDirectorFrame(0.72);
assert.equal(circuitFrame.chapterId, 'circuit');
assert(circuitFrame.effects.gridIntensity >= 0.6, 'circuit chapter grid intensity should be high');
assert(circuitFrame.camera.fov >= 50, 'circuit chapter wide FOV');

// 5. Chapter 5: Weekend (progress 0.90)
const weekendFrame = createShowroomDirectorFrame(0.90);
assert.equal(weekendFrame.chapterId, 'weekend');
assert.equal(weekendFrame.car.explodeAmount, 0, 'weekend chapter car explodeAmount must reset to 0');
assert.equal(weekendFrame.effects.particleOpacity, 1.0);

// Audio integration check
const startFrame = createShowroomDirectorFrame(0);
assert.equal(startFrame.audio.volume, 0);

const endFrame = createShowroomDirectorFrame(1.0);
assert.equal(endFrame.audio.volume, 1.0);

// Out of bounds safety
const negFrame = createShowroomDirectorFrame(-0.5);
assert.equal(negFrame.chapterId, 'material');

const overFrame = createShowroomDirectorFrame(1.5);
assert.equal(overFrame.chapterId, 'weekend');

console.log('check:showroom-director passed cleanly.');
