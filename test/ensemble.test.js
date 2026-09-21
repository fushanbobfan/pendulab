import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '../src/physics.js';
import {
  createEnsemble,
  stepEnsemble,
  maxSeparation,
  DivergenceLog,
  estimateLyapunov,
} from '../src/ensemble.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('createEnsemble spreads members evenly over [0, spread] on the chosen angle', () => {
  const base = [1, 0, 2, 0];
  const e = createEnsemble(base, 5, 0.04, 'theta2');
  assert.equal(e.length, 5);
  assert.deepEqual(e[0], base);
  close(e[4][2], 2.04, 1e-12, 'last member offset');
  close(e[2][2], 2.02, 1e-12, 'middle member offset');
  assert.equal(e[3][0], 1, 'theta1 untouched');
  const e1 = createEnsemble(base, 3, 0.1, 'theta1');
  close(e1[2][0], 1.1, 1e-12, 'theta1 axis');
  assert.equal(e1[2][2], 2);
});

test('createEnsemble does not alias the base state or its members', () => {
  const base = [0.5, 0, 0.5, 0];
  const e = createEnsemble(base, 2, 0.01);
  e[0][0] = 99;
  assert.equal(base[0], 0.5);
  assert.equal(e[1][0], 0.5);
});

test('createEnsemble with one member returns the base state and zero separation', () => {
  const e = createEnsemble([1, 0, 1, 0], 1, 0.5);
  assert.equal(e.length, 1);
  assert.deepEqual(e[0], [1, 0, 1, 0]);
  assert.equal(maxSeparation(e), 0);
  assert.throws(() => createEnsemble([0, 0, 0, 0], 0, 0.1), RangeError);
});

test('a chaotic ensemble diverges while a gentle one stays together', () => {
  const dt = 1 / 240;
  const chaotic = createEnsemble([Math.PI * 0.9, 0, Math.PI * 0.9, 0], 4, 1e-6);
  const gentle = createEnsemble([0.2, 0, 0.2, 0], 4, 1e-6);
  const start = maxSeparation(chaotic);
  stepEnsemble(chaotic, DEFAULT_PARAMS, dt, 240 * 15);
  stepEnsemble(gentle, DEFAULT_PARAMS, dt, 240 * 15);
  assert.ok(maxSeparation(chaotic) > 1e-2, `chaotic separation ${maxSeparation(chaotic)}`);
  assert.ok(maxSeparation(gentle) < 1e-4, `gentle separation ${maxSeparation(gentle)}`);
  assert.ok(start < 1e-5);
});

test('DivergenceLog keeps only the newest samples', () => {
  const log = new DivergenceLog(3);
  for (let i = 0; i < 5; i++) log.push(i, i * 10);
  assert.equal(log.length, 3);
  assert.deepEqual(log.times, [2, 3, 4]);
  assert.deepEqual(log.values, [20, 30, 40]);
  log.clear();
  assert.equal(log.length, 0);
});

test('estimateLyapunov recovers the exponent of a synthetic exponential', () => {
  const log = new DivergenceLog();
  const lambda = 1.7;
  for (let t = 0; t <= 10; t += 0.05) log.push(t, 1e-8 * Math.exp(lambda * t));
  const est = estimateLyapunov(log, { floor: 1e-9, saturation: 1 });
  close(est, lambda, 1e-9, 'fitted slope');
});

test('estimateLyapunov ignores the floor and saturated tail', () => {
  const log = new DivergenceLog();
  for (let t = 0; t <= 20; t += 0.05) {
    const v = Math.min(2, Math.max(1e-12, 1e-8 * Math.exp(1.2 * t)));
    log.push(t, v);
  }
  const est = estimateLyapunov(log, { floor: 1e-9, saturation: 1 });
  close(est, 1.2, 1e-6, 'slope on the growth window only');
});

test('estimateLyapunov returns null without enough usable samples', () => {
  const log = new DivergenceLog();
  for (let t = 0; t < 10; t++) log.push(t, 5); // all saturated
  assert.equal(estimateLyapunov(log), null);
  const flat = new DivergenceLog();
  for (let i = 0; i < 30; i++) flat.push(3, 1e-3); // all at the same time
  assert.equal(estimateLyapunov(flat), null);
});
