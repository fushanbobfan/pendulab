// Pointer helpers for posing the reference pendulum by dragging its bobs.
// Everything here works in canvas pixel coordinates with the pivot at the
// centre and y pointing down, matching the renderer.

import { positions } from './physics.js';
import { fitScale } from './render.js';

/** Screen-space geometry of the reference pendulum for a canvas of this size. */
export function stageGeometry(width, height, state, params) {
  const scale = fitScale(width, height, params.l1, params.l2);
  const ox = width / 2;
  const oy = height / 2;
  const p = positions(state, params);
  return {
    scale,
    ox,
    oy,
    bob1: { x: ox + p.x1 * scale, y: oy + p.y1 * scale },
    bob2: { x: ox + p.x2 * scale, y: oy + p.y2 * scale },
  };
}

/**
 * Which bob (1 or 2) a pointer at (x, y) is grabbing, or 0 when neither is
 * within `radius` pixels. The lower bob wins ties because it sits on top.
 */
export function pickBob(x, y, geometry, radius = 18) {
  const d2 = Math.hypot(x - geometry.bob2.x, y - geometry.bob2.y);
  if (d2 <= radius) return 2;
  const d1 = Math.hypot(x - geometry.bob1.x, y - geometry.bob1.y);
  if (d1 <= radius) return 1;
  return 0;
}

/**
 * Angle from the downward vertical of the ray from (cx, cy) to (x, y), in
 * radians, positive counter-clockwise on a y-down canvas. Matches the sign
 * convention of the physics module so a bob dragged to the right of the
 * pivot has a positive angle.
 */
export function angleFromPointer(cx, cy, x, y) {
  return Math.atan2(x - cx, y - cy);
}

/**
 * New [theta1, theta2] after dragging bob `which` to (x, y). Dragging the
 * upper bob swings the whole pendulum rigidly (theta2 keeps its offset from
 * theta1); dragging the lower bob only moves the lower rod.
 */
export function dragAngles(which, x, y, state, geometry) {
  const [t1, , t2] = state;
  if (which === 1) {
    const nt1 = angleFromPointer(geometry.ox, geometry.oy, x, y);
    return [nt1, t2 + (nt1 - t1)];
  }
  if (which === 2) {
    return [t1, angleFromPointer(geometry.bob1.x, geometry.bob1.y, x, y)];
  }
  return [t1, t2];
}
