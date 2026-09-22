import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE_PLANES,
  DEFAULT_PLANE_ID,
  getPlane,
  phasePoint,
  growExtent,
  initialExtent,
  phaseGeometry,
  phaseSegments,
} from '../src/phase.js';
import { Trail } from '../src/render.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('planes have unique ids and getPlane falls back to the default', () => {
  assert.equal(new Set(PHASE_PLANES.map((p) => p.id)).size, PHASE_PLANES.length);
  assert.equal(getPlane('theta1-theta2').id, 'theta1-theta2');
  assert.equal(getPlane('nope').id, DEFAULT_PLANE_ID);
});

test('phasePoint reads the right state entries and wraps angles', () => {
  const state = [4, 1.5, -4, -2.5];
  const lower = phasePoint(state, getPlane('theta2-omega2'));
  close(lower.x, -4 + 2 * Math.PI, 1e-12, 'lower angle wrapped');
  assert.equal(lower.y, -2.5);
  const upper = phasePoint(state, getPlane('theta1-omega1'));
  close(upper.x, 4 - 2 * Math.PI, 1e-12, 'upper angle wrapped');
  assert.equal(upper.y, 1.5);
  const angles = phasePoint(state, getPlane('theta1-theta2'));
  close(angles.x, 4 - 2 * Math.PI, 1e-12, 'x wrapped');
  close(angles.y, -4 + 2 * Math.PI, 1e-12, 'y wrapped');
});

test('initialExtent fixes angle axes at pi and starts velocity axes small', () => {
  assert.deepEqual(initialExtent(getPlane('theta1-theta2')), { x: Math.PI, y: Math.PI });
  assert.deepEqual(initialExtent(getPlane('theta2-omega2')), { x: Math.PI, y: 2 });
});

test('growExtent only ever widens velocity axes and leaves angle axes alone', () => {
  const plane = getPlane('theta2-omega2');
  let extent = initialExtent(plane);
  extent = growExtent(extent, plane, [[0, 0, 0, 1]]);
  assert.deepEqual(extent, { x: Math.PI, y: 2 });
  extent = growExtent(extent, plane, [[0, 0, 0, -6], [0, 0, 0, 3]]);
  close(extent.y, 6.9, 1e-12, 'grows to 1.15 × fastest');
  extent = growExtent(extent, plane, [[0, 0, 0, 0.1]]);
  close(extent.y, 6.9, 1e-12, 'never shrinks');
  assert.equal(extent.x, Math.PI);
});

test('phaseGeometry maps the origin to the centre and the extents to the edges', () => {
  const g = phaseGeometry(200, 100, { x: Math.PI, y: 4 });
  assert.equal(g.toX(0), 100);
  assert.equal(g.toY(0), 50);
  close(g.toX(Math.PI), 200, 1e-9, 'right edge');
  close(g.toX(-Math.PI), 0, 1e-9, 'left edge');
  close(g.toY(4), 0, 1e-9, 'top edge');
  close(g.toY(-4), 100, 1e-9, 'bottom edge');
});

test('phaseSegments returns the trail oldest-first as one polyline when nothing wraps', () => {
  const trail = new Trail(10);
  trail.push(0, 0);
  trail.push(0.5, 1);
  trail.push(1, 2);
  const segs = phaseSegments(trail, getPlane('theta2-omega2'));
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0], [
    { x: 0, y: 0 },
    { x: 0.5, y: 1 },
    { x: 1, y: 2 },
  ]);
});

test('phaseSegments breaks the line where a wrapped angle jumps across ±π', () => {
  const trail = new Trail(10);
  trail.push(2.75, 1);
  trail.push(3.125, 1);
  trail.push(-3.125, 1); // wrapped from 3.158
  trail.push(-2.75, 1);
  const segs = phaseSegments(trail, getPlane('theta2-omega2'));
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0].map((p) => p.x), [2.75, 3.125]);
  assert.deepEqual(segs[1].map((p) => p.x), [-3.125, -2.75]);
});

test('phaseSegments drops single stranded points and ignores wraps on a velocity axis', () => {
  const trail = new Trail(10);
  trail.push(3.125, 0);
  trail.push(-3.125, 0);
  trail.push(-3.0, 4);
  const plane = getPlane('theta2-omega2');
  const segs = phaseSegments(trail, plane);
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0].map((p) => p.x), [-3.125, -3.0]);
  const both = getPlane('theta1-theta2');
  const angles = new Trail(4);
  angles.push(0, 3.125);
  angles.push(0, -3.125);
  angles.push(0.125, -3.0);
  assert.equal(phaseSegments(angles, both).length, 1);
  assert.equal(phaseSegments(new Trail(4), plane).length, 0);
});
