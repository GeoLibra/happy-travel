import assert from 'node:assert/strict';

import { AirflowEffect } from '../src/components/showroom/airflow.ts';
import { RouteLineEffect } from '../src/components/showroom/route-line.ts';
import { selectShowroomQuality } from '../src/lib/showroom-quality.ts';

// 1. Verify AirflowEffect identity and quality step-down
const highQuality = selectShowroomQuality({ forceLevel: 'high' });
const lowQuality = selectShowroomQuality({ forceLevel: 'low' });
const reducedQuality = selectShowroomQuality({ prefersReducedMotion: true });

const highAirflow = new AirflowEffect(highQuality);
const lowAirflow = new AirflowEffect(lowQuality);
const reducedAirflow = new AirflowEffect(reducedQuality);

assert(highAirflow.count > lowAirflow.count, 'high quality must have more airflow particles than low quality');
assert(highAirflow.count > reducedAirflow.count, 'reduced motion must reduce airflow particle count');

// Assert geometry & attribute identity preservation across updates
const geomBefore = highAirflow.bufferGeometry;
const attrBefore = geomBefore.getAttribute('position');

highAirflow.update({ intensity: 0.5, speed: 1.2 });
highAirflow.update({ intensity: 0.9, speed: 2.0 });

const geomAfter = highAirflow.bufferGeometry;
const attrAfter = geomAfter.getAttribute('position');

assert.equal(geomBefore, geomAfter, 'update must preserve geometry object identity');
assert.equal(attrBefore, attrAfter, 'update must preserve attribute object identity without reallocation');

// Disposal check
highAirflow.dispose();
assert.equal(highAirflow.isEffectDisposed, true);

// 2. Verify RouteLineEffect identity and quality step-down
const rawPath = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
  { x: 10, y: 0, z: 10 },
];

const highRoute = new RouteLineEffect(rawPath, highQuality);
const lowRoute = new RouteLineEffect(rawPath, lowQuality);

assert(highRoute.segmentPointsCount > lowRoute.segmentPointsCount, 'high quality must resample more route points');

const routeGeomBefore = highRoute.bufferGeometry;
const routeAttrBefore = routeGeomBefore.getAttribute('position');

// Deterministic update & draw range check
highRoute.update(0.5);
assert.equal(routeGeomBefore.drawRange.count, Math.round(highRoute.segmentPointsCount * 0.5));

highRoute.update(1.0);
assert.equal(routeGeomBefore.drawRange.count, highRoute.segmentPointsCount);

const routeGeomAfter = highRoute.bufferGeometry;
const routeAttrAfter = routeGeomAfter.getAttribute('position');

assert.equal(routeGeomBefore, routeGeomAfter, 'route line update must preserve geometry identity');
assert.equal(routeAttrBefore, routeAttrAfter, 'route line update must preserve attribute identity');

highRoute.dispose();
assert.equal(highRoute.isEffectDisposed, true);

console.log('check:showroom-effects passed cleanly.');
