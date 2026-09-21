// An ensemble of double pendulums released from almost the same state. The
// first member is the reference; the others are offset by tiny, evenly spaced
// perturbations so that sensitive dependence on initial conditions is visible
// as the fan of bobs spreads apart.

import { rk4Step, angularSeparation } from './physics.js';

/**
 * Build the initial states for `count` pendulums. Member i is offset from the
 * base state by (i / (count - 1)) * spread on the chosen angle, so the ensemble
 * spans [0, spread] radians around the reference.
 */
export function createEnsemble(base, count, spread, axis = 'theta2') {
  if (count < 1) throw new RangeError('count must be at least 1');
  const index = axis === 'theta1' ? 0 : 2;
  const states = [];
  for (let i = 0; i < count; i++) {
    const s = base.slice();
    if (count > 1) s[index] += (i / (count - 1)) * spread;
    states.push(s);
  }
  return states;
}

/** Advance every member by `steps` RK4 substeps of size dt (in place). */
export function stepEnsemble(states, params, dt, steps) {
  for (let i = 0; i < states.length; i++) {
    let s = states[i];
    for (let k = 0; k < steps; k++) s = rk4Step(s, params, dt);
    states[i] = s;
  }
  return states;
}

/**
 * Largest angular separation between the reference (member 0) and any other
 * member. Returns 0 for a single-member ensemble.
 */
export function maxSeparation(states) {
  let max = 0;
  for (let i = 1; i < states.length; i++) {
    const d = angularSeparation(states[0], states[i]);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Rolling record of separation over time, used for the divergence chart and
 * the Lyapunov exponent estimate.
 */
export class DivergenceLog {
  constructor(capacity = 2000) {
    this.capacity = capacity;
    this.times = [];
    this.values = [];
  }

  push(t, separation) {
    this.times.push(t);
    this.values.push(separation);
    if (this.times.length > this.capacity) {
      this.times.shift();
      this.values.shift();
    }
  }

  clear() {
    this.times.length = 0;
    this.values.length = 0;
  }

  get length() {
    return this.times.length;
  }
}

/**
 * Estimate the largest Lyapunov exponent from a divergence log by fitting a
 * straight line to ln(separation) against time, using only samples in the
 * exponential-growth window: after the separation has left the floor and
 * before it saturates near `saturation` radians. Returns null when fewer than
 * `minSamples` usable points exist.
 */
export function estimateLyapunov(log, { floor = 1e-9, saturation = 1, minSamples = 20 } = {}) {
  const ts = [];
  const ys = [];
  for (let i = 0; i < log.length; i++) {
    const v = log.values[i];
    if (v <= floor || v >= saturation) continue;
    ts.push(log.times[i]);
    ys.push(Math.log(v));
  }
  if (ts.length < minSamples) return null;
  const n = ts.length;
  let st = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    st += ts[i];
    sy += ys[i];
  }
  const mt = st / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (ts[i] - mt) * (ys[i] - my);
    den += (ts[i] - mt) * (ts[i] - mt);
  }
  if (den === 0) return null;
  return num / den;
}
