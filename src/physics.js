// Double pendulum dynamics: two point masses on massless rigid rods, the
// second hanging from the first. Angles are measured from the downward
// vertical, positive counter-clockwise; the state vector is
// [theta1, omega1, theta2, omega2].

export const DEFAULT_PARAMS = Object.freeze({
  m1: 1,
  m2: 1,
  l1: 1,
  l2: 1,
  g: 9.81,
  damping: 0,
});

/** Time derivative of the state under the Lagrangian equations of motion. */
export function derivatives(state, params = DEFAULT_PARAMS) {
  const [t1, w1, t2, w2] = state;
  const { m1, m2, l1, l2, g, damping = 0 } = params;
  const d = t1 - t2;
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  const denom = 2 * m1 + m2 - m2 * Math.cos(2 * d);

  const a1 =
    (-g * (2 * m1 + m2) * Math.sin(t1) -
      m2 * g * Math.sin(t1 - 2 * t2) -
      2 * sinD * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * cosD)) /
    (l1 * denom);

  const a2 =
    (2 *
      sinD *
      (w1 * w1 * l1 * (m1 + m2) +
        g * (m1 + m2) * Math.cos(t1) +
        w2 * w2 * l2 * m2 * cosD)) /
    (l2 * denom);

  return [w1, a1 - damping * w1, w2, a2 - damping * w2];
}

/** One classical fourth-order Runge–Kutta step of size dt. */
export function rk4Step(state, params, dt) {
  const k1 = derivatives(state, params);
  const k2 = derivatives(axpy(state, k1, dt / 2), params);
  const k3 = derivatives(axpy(state, k2, dt / 2), params);
  const k4 = derivatives(axpy(state, k3, dt), params);
  const out = new Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = state[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return out;
}

/** Advance the state by `steps` substeps of size dt. */
export function integrate(state, params, dt, steps) {
  let s = state;
  for (let i = 0; i < steps; i++) s = rk4Step(s, params, dt);
  return s;
}

function axpy(x, y, a) {
  return [x[0] + a * y[0], x[1] + a * y[1], x[2] + a * y[2], x[3] + a * y[3]];
}

/** Kinetic, potential and total mechanical energy of a state. */
export function energy(state, params = DEFAULT_PARAMS) {
  const [t1, w1, t2, w2] = state;
  const { m1, m2, l1, l2, g } = params;
  const kinetic =
    0.5 * m1 * l1 * l1 * w1 * w1 +
    0.5 *
      m2 *
      (l1 * l1 * w1 * w1 +
        l2 * l2 * w2 * w2 +
        2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2));
  const potential = -(m1 + m2) * g * l1 * Math.cos(t1) - m2 * g * l2 * Math.cos(t2);
  return { kinetic, potential, total: kinetic + potential };
}

/**
 * Cartesian bob positions relative to the pivot, with y pointing down so the
 * result can be drawn directly on a canvas.
 */
export function positions(state, params = DEFAULT_PARAMS) {
  const [t1, , t2] = state;
  const { l1, l2 } = params;
  const x1 = l1 * Math.sin(t1);
  const y1 = l1 * Math.cos(t1);
  return { x1, y1, x2: x1 + l2 * Math.sin(t2), y2: y1 + l2 * Math.cos(t2) };
}

/** Wrap an angle into (-pi, pi]. */
export function wrapAngle(a) {
  const twoPi = 2 * Math.PI;
  let r = a % twoPi;
  if (r > Math.PI) r -= twoPi;
  else if (r <= -Math.PI) r += twoPi;
  return r;
}

/**
 * Angular distance between two states in configuration space: the Euclidean
 * norm of the wrapped angle differences, ignoring velocities so that the
 * measure stays bounded.
 */
export function angularSeparation(a, b) {
  const d1 = wrapAngle(a[0] - b[0]);
  const d2 = wrapAngle(a[2] - b[2]);
  return Math.hypot(d1, d2);
}
