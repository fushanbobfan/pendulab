import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARAMS,
  derivatives,
  rk4Step,
  integrate,
  energy,
  positions,
  wrapAngle,
  angularSeparation,
} from '../src/physics.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('hanging at rest is an equilibrium', () => {
  const d = derivatives([0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) close(d[i], 0, 0, `component ${i}`);
});

test('a small displacement accelerates the bobs back toward the vertical', () => {
  // With both rods aligned the lower rod feels no torque at that instant.
  const aligned = derivatives([0.1, 0, 0.1, 0]);
  assert.ok(aligned[1] < 0, 'theta1 acceleration points back to zero');
  close(aligned[3], 0, 1e-12, 'aligned rods leave theta2 unaccelerated');
  // Displace only the lower bob: it swings back while dragging the top bob forward.
  const lower = derivatives([0, 0, 0.1, 0]);
  assert.ok(lower[3] < 0, 'theta2 acceleration points back to zero');
  assert.ok(lower[1] > 0, 'the top bob is pulled toward the lower one');
});

test('the equations are mirror-symmetric under theta -> -theta', () => {
  const s = [1.2, 0.3, -0.7, 1.1];
  const m = [-1.2, -0.3, 0.7, -1.1];
  const d = derivatives(s);
  const dm = derivatives(m);
  for (let i = 0; i < 4; i++) close(dm[i], -d[i], 1e-12, `component ${i}`);
});

test('energy is conserved by RK4 over a long chaotic run', () => {
  const params = { ...DEFAULT_PARAMS };
  let s = [Math.PI * 0.75, 0, Math.PI * 0.5, 0];
  const e0 = energy(s, params).total;
  const dt = 1 / 1000;
  s = integrate(s, params, dt, 20000); // 20 simulated seconds
  const e1 = energy(s, params).total;
  close(e1, e0, 1e-4 * Math.abs(e0) + 1e-4, 'total energy');
});

test('damping bleeds energy out of the system', () => {
  const params = { ...DEFAULT_PARAMS, damping: 0.5 };
  let s = [1.5, 0, 1.0, 0];
  const e0 = energy(s, params).total;
  s = integrate(s, params, 1 / 500, 2500);
  const e1 = energy(s, params).total;
  assert.ok(e1 < e0 - 1, `energy should drop noticeably, got ${e0} -> ${e1}`);
});

test('a single-pendulum-like small swing has the textbook period', () => {
  // Two equal rods with a negligible lower mass reduce to a simple pendulum of
  // length l1 for the top bob; check the small-angle period 2*pi*sqrt(l/g).
  const params = { m1: 1, m2: 1e-6, l1: 1, l2: 1, g: 9.81 };
  const expected = 2 * Math.PI * Math.sqrt(1 / 9.81);
  let s = [0.02, 0, 0.02, 0];
  const dt = 1 / 2000;
  let t = 0;
  let crossings = 0;
  let prev = s[0];
  let lastCross = null;
  const periods = [];
  while (crossings < 4) {
    s = rk4Step(s, params, dt);
    t += dt;
    if (prev < 0 && s[0] >= 0) {
      if (lastCross !== null) periods.push(t - lastCross);
      lastCross = t;
      crossings++;
    }
    prev = s[0];
  }
  const avg = periods.reduce((a, b) => a + b, 0) / periods.length;
  close(avg, expected, 0.01, 'small-angle period');
});

test('rk4Step matches one large step against many small ones', () => {
  const s0 = [2.0, 0, 2.5, 0];
  const big = rk4Step(s0, DEFAULT_PARAMS, 0.01);
  const small = integrate(s0, DEFAULT_PARAMS, 0.001, 10);
  for (let i = 0; i < 4; i++) close(big[i], small[i], 1e-6, `component ${i}`);
});

test('positions hang straight down at rest and reach the full length', () => {
  const p = positions([0, 0, 0, 0], { ...DEFAULT_PARAMS, l1: 1.5, l2: 0.5 });
  close(p.x1, 0, 1e-12, 'x1');
  close(p.y1, 1.5, 1e-12, 'y1');
  close(p.x2, 0, 1e-12, 'x2');
  close(p.y2, 2.0, 1e-12, 'y2');
  const horizontal = positions([Math.PI / 2, 0, Math.PI / 2, 0]);
  close(horizontal.x2, 2, 1e-12, 'x2 horizontal');
  close(horizontal.y2, 0, 1e-12, 'y2 horizontal');
});

test('potential energy is minimal at the bottom and maximal upside down', () => {
  const down = energy([0, 0, 0, 0]).potential;
  const up = energy([Math.PI, 0, Math.PI, 0]).potential;
  const side = energy([Math.PI / 2, 0, Math.PI / 2, 0]).potential;
  assert.ok(down < side && side < up);
  close(side, 0, 1e-12, 'horizontal configuration has zero potential');
});

test('wrapAngle maps into (-pi, pi]', () => {
  close(wrapAngle(Math.PI + 0.1), -Math.PI + 0.1, 1e-12, 'just past pi');
  close(wrapAngle(-Math.PI - 0.1), Math.PI - 0.1, 1e-12, 'just below -pi');
  close(wrapAngle(7 * Math.PI), Math.PI, 1e-12, 'odd multiple of pi');
  close(wrapAngle(4 * Math.PI), 0, 1e-12, 'even multiple of pi');
  close(wrapAngle(0.5), 0.5, 1e-12, 'already in range');
});

test('angularSeparation ignores velocity and respects wrapping', () => {
  close(angularSeparation([0, 5, 0, -5], [0, 0, 0, 0]), 0, 1e-12, 'velocity only');
  close(angularSeparation([Math.PI - 0.01, 0, 0, 0], [-Math.PI + 0.01, 0, 0, 0]), 0.02, 1e-12, 'across the seam');
  close(angularSeparation([0.3, 0, 0, 0], [0, 0, 0.4, 0]), 0.5, 1e-12, 'euclidean norm');
});
