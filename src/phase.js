// Phase-portrait helpers: which pair of state variables to plot, how to map
// them onto a square canvas, and how to cut a wrapped-angle trajectory into
// drawable segments. Pure, so the whole module is unit tested.

import { wrapAngle } from './physics.js';

/** The planes the portrait can show. Angles wrap; velocities autoscale. */
export const PHASE_PLANES = [
  {
    id: 'theta2-omega2',
    name: 'Lower angle vs. speed',
    xLabel: 'θ₂',
    yLabel: 'ω₂',
    x: (s) => s[2],
    y: (s) => s[3],
    xAngle: true,
    yAngle: false,
  },
  {
    id: 'theta1-omega1',
    name: 'Upper angle vs. speed',
    xLabel: 'θ₁',
    yLabel: 'ω₁',
    x: (s) => s[0],
    y: (s) => s[1],
    xAngle: true,
    yAngle: false,
  },
  {
    id: 'theta1-theta2',
    name: 'Upper angle vs. lower angle',
    xLabel: 'θ₁',
    yLabel: 'θ₂',
    x: (s) => s[0],
    y: (s) => s[2],
    xAngle: true,
    yAngle: true,
  },
];

export const DEFAULT_PLANE_ID = PHASE_PLANES[0].id;

export function getPlane(id) {
  return PHASE_PLANES.find((p) => p.id === id) || PHASE_PLANES[0];
}

/** Coordinates of a state in the given plane, angles wrapped into (-π, π]. */
export function phasePoint(state, plane) {
  const x = plane.x(state);
  const y = plane.y(state);
  return { x: plane.xAngle ? wrapAngle(x) : x, y: plane.yAngle ? wrapAngle(y) : y };
}

/**
 * The velocity axis grows to fit the fastest motion seen so far and never
 * shrinks until reset, so the picture does not breathe every frame. Angle axes
 * are fixed at ±π. Returns the half-extent of each axis.
 */
export function growExtent(previous, plane, states) {
  let x = plane.xAngle ? Math.PI : previous.x;
  let y = plane.yAngle ? Math.PI : previous.y;
  for (const s of states) {
    const p = phasePoint(s, plane);
    if (!plane.xAngle) x = Math.max(x, Math.abs(p.x) * 1.15);
    if (!plane.yAngle) y = Math.max(y, Math.abs(p.y) * 1.15);
  }
  return { x, y };
}

/** Starting half-extents: π for angles, a modest 2 rad/s for velocities. */
export function initialExtent(plane) {
  return { x: plane.xAngle ? Math.PI : 2, y: plane.yAngle ? Math.PI : 2 };
}

/** Pixel mapping for a plot area of the given size centred on the origin. */
export function phaseGeometry(width, height, extent) {
  const sx = width / (2 * extent.x);
  const sy = height / (2 * extent.y);
  return {
    toX: (x) => width / 2 + x * sx,
    toY: (y) => height / 2 - y * sy,
  };
}

/**
 * Split a trail of phase points into polylines, breaking wherever a wrapped
 * angle jumps across ±π so no line is drawn straight through the plot.
 * `trail.at(k)` gives the k-th newest point; segments come back oldest first.
 */
export function phaseSegments(trail, plane) {
  const segments = [];
  if (trail.length === 0) return segments;
  let current = [];
  let prev = null;
  for (let k = trail.length - 1; k >= 0; k--) {
    const p = trail.at(k);
    if (prev !== null) {
      const jumpX = plane.xAngle && Math.abs(p.x - prev.x) > Math.PI;
      const jumpY = plane.yAngle && Math.abs(p.y - prev.y) > Math.PI;
      if (jumpX || jumpY) {
        if (current.length > 1) segments.push(current);
        current = [];
      }
    }
    current.push(p);
    prev = p;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}
