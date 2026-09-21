import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '../src/physics.js';
import { stageGeometry, pickBob, angleFromPointer, dragAngles } from '../src/interaction.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('stageGeometry places the bobs where the renderer draws them', () => {
  const g = stageGeometry(400, 400, [0, 0, 0, 0], DEFAULT_PARAMS);
  assert.equal(g.ox, 200);
  assert.equal(g.oy, 200);
  close(g.bob1.x, 200, 1e-9, 'bob1 x');
  close(g.bob1.y, 200 + g.scale, 1e-9, 'bob1 y hangs one rod length down');
  close(g.bob2.y, 200 + 2 * g.scale, 1e-9, 'bob2 y hangs two rod lengths down');
});

test('pickBob prefers the lower bob and returns 0 away from both', () => {
  const g = stageGeometry(400, 400, [Math.PI / 2, 0, Math.PI / 2, 0], DEFAULT_PARAMS);
  assert.equal(pickBob(g.bob2.x + 3, g.bob2.y - 2, g), 2);
  assert.equal(pickBob(g.bob1.x - 4, g.bob1.y + 4, g), 1);
  assert.equal(pickBob(10, 10, g), 0);
  // When both bobs coincide the lower bob wins.
  const stacked = { ...g, bob1: { x: 50, y: 50 }, bob2: { x: 50, y: 50 } };
  assert.equal(pickBob(50, 50, stacked), 2);
});

test('angleFromPointer follows the physics sign convention', () => {
  close(angleFromPointer(0, 0, 0, 10), 0, 1e-12, 'straight down');
  close(angleFromPointer(0, 0, 10, 0), Math.PI / 2, 1e-12, 'to the right');
  close(angleFromPointer(0, 0, -10, 0), -Math.PI / 2, 1e-12, 'to the left');
  close(Math.abs(angleFromPointer(0, 0, 0, -10)), Math.PI, 1e-12, 'straight up');
});

test('dragging the upper bob moves the whole pendulum rigidly', () => {
  const state = [0.3, 0, 0.8, 0];
  const g = stageGeometry(400, 400, state, DEFAULT_PARAMS);
  const target = angleFromPointer(g.ox, g.oy, g.ox + 100, g.oy + 20);
  const [t1, t2] = dragAngles(1, g.ox + 100, g.oy + 20, state, g);
  close(t1, target, 1e-12, 'theta1 follows the pointer');
  close(t2 - t1, 0.5, 1e-12, 'relative angle preserved');
});

test('dragging the lower bob only rotates the lower rod', () => {
  const state = [0.3, 0, 0.8, 0];
  const g = stageGeometry(400, 400, state, DEFAULT_PARAMS);
  const [t1, t2] = dragAngles(2, g.bob1.x - 40, g.bob1.y + 40, state, g);
  assert.equal(t1, 0.3);
  close(t2, -Math.PI / 4, 1e-12, 'theta2 points down-left');
  assert.deepEqual(dragAngles(0, 0, 0, state, g), [0.3, 0.8]);
});
