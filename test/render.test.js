import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberColor, Trail, fitScale, chartGeometry } from '../src/render.js';
import { DivergenceLog } from '../src/ensemble.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('memberColor gives the reference white and the others distinct hues', () => {
  assert.match(memberColor(0, 8), /^rgba\(255, 255, 255/);
  const hues = new Set();
  for (let i = 1; i < 8; i++) {
    const m = memberColor(i, 8).match(/^hsla\((\d+(?:\.\d+)?)/);
    assert.ok(m, 'hsla format');
    hues.add(Math.round(Number(m[1])));
  }
  assert.equal(hues.size, 7);
  assert.match(memberColor(3, 8, 0.25), /0\.25\)$/);
});

test('Trail keeps the newest points in order and wraps around', () => {
  const t = new Trail(3);
  t.push(1, 10);
  t.push(2, 20);
  assert.equal(t.length, 2);
  assert.deepEqual(t.at(0), { x: 2, y: 20 });
  assert.deepEqual(t.at(1), { x: 1, y: 10 });
  t.push(3, 30);
  t.push(4, 40);
  assert.equal(t.length, 3);
  assert.deepEqual(t.at(0), { x: 4, y: 40 });
  assert.deepEqual(t.at(2), { x: 2, y: 20 });
  t.clear();
  assert.equal(t.length, 0);
});

test('fitScale keeps the fully extended pendulum inside the shorter side', () => {
  const s = fitScale(600, 400, 1, 1, 24);
  close(s * 2, 400 / 2 - 24, 1e-9, 'reach in pixels');
  assert.ok(fitScale(10, 10, 5, 5) >= 1, 'never collapses below one pixel per metre');
});

test('chartGeometry maps a log onto a clipped log10 axis within the last window', () => {
  const log = new DivergenceLog();
  for (let t = 0; t <= 40; t += 1) log.push(t, 1e-8 * Math.pow(10, t / 4));
  const { points, decades } = chartGeometry(log, 300, 100, { floor: 1e-8, ceiling: 10, window: 30 });
  assert.equal(points.length, 31, 'only the last 30 s of samples');
  close(points[0].x, 0, 1e-9, 'window start at the left edge');
  close(points.at(-1).x, 300, 1e-9, 'newest sample at the right edge');
  // Values above the ceiling are clipped to the top of the chart.
  close(points.at(-1).y, 0, 1e-9, 'saturated at the top');
  assert.equal(decades.length, 10, 'decade lines from 1e-8 to 1e1');
  close(decades[0].y, 100, 1e-9, 'floor decade at the bottom');
  close(decades.at(-1).y, 0, 1e-9, 'ceiling decade at the top');
  for (let i = 1; i < points.length; i++) assert.ok(points[i].y <= points[i - 1].y, 'monotone rise');
});

test('chartGeometry handles an empty log', () => {
  const { points, decades } = chartGeometry(new DivergenceLog(), 100, 50);
  assert.deepEqual(points, []);
  assert.deepEqual(decades, []);
});
