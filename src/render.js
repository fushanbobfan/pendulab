// Drawing helpers for the pendulum stage and the divergence chart. The pure
// pieces (colours, trails, chart geometry) are exported separately from the
// canvas calls so they can be unit tested.

import { positions } from './physics.js';

/** Hue-spread colour for member i of an ensemble; the reference is white. */
export function memberColor(i, count, alpha = 1) {
  if (i === 0) return `rgba(255, 255, 255, ${alpha})`;
  const hue = count > 1 ? 200 + (320 * (i - 1)) / Math.max(1, count - 1) : 200;
  return `hsla(${hue % 360}, 85%, 62%, ${alpha})`;
}

/** Fixed-capacity ring buffer of points for a fading trail. */
export class Trail {
  constructor(capacity = 400) {
    this.capacity = capacity;
    this.xs = new Float32Array(capacity);
    this.ys = new Float32Array(capacity);
    this.head = 0;
    this.length = 0;
  }

  push(x, y) {
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.head = (this.head + 1) % this.capacity;
    if (this.length < this.capacity) this.length++;
  }

  clear() {
    this.head = 0;
    this.length = 0;
  }

  /** Point k steps back from the newest (k = 0 is the newest). */
  at(k) {
    const idx = (this.head - 1 - k + this.capacity * 2) % this.capacity;
    return { x: this.xs[idx], y: this.ys[idx] };
  }
}

/** Pixels per metre so the fully extended pendulum fits inside the canvas. */
export function fitScale(width, height, l1, l2, margin = 24) {
  const reach = l1 + l2;
  return Math.max(1, (Math.min(width, height) / 2 - margin) / reach);
}

/**
 * Map a divergence log onto chart pixels on a log10 vertical axis clipped to
 * [floor, ceiling]. Returns points in drawing order plus the y pixel positions
 * of the decade gridlines.
 */
export function chartGeometry(log, width, height, { floor = 1e-8, ceiling = 10, window = 30 } = {}) {
  const points = [];
  if (log.length === 0) return { points, decades: [] };
  const tEnd = log.times[log.length - 1];
  const tStart = Math.max(log.times[0], tEnd - window);
  const span = Math.max(1e-9, tEnd - tStart);
  const lf = Math.log10(floor);
  const lc = Math.log10(ceiling);
  for (let i = 0; i < log.length; i++) {
    const t = log.times[i];
    if (t < tStart) continue;
    const v = Math.min(ceiling, Math.max(floor, log.values[i]));
    const x = ((t - tStart) / span) * width;
    const y = height - ((Math.log10(v) - lf) / (lc - lf)) * height;
    points.push({ x, y });
  }
  const decades = [];
  for (let d = Math.ceil(lf); d <= Math.floor(lc); d++) {
    decades.push({ exponent: d, y: height - ((d - lf) / (lc - lf)) * height });
  }
  return { points, decades };
}

/** Draw the pivot, rods, bobs and trails for every member of the ensemble. */
export function drawStage(ctx, states, params, trails, options = {}) {
  const { showTrails = true, showRods = true, bobRadius = 6, pixelRatio = 1 } = options;
  const width = ctx.canvas.width / pixelRatio;
  const height = ctx.canvas.height / pixelRatio;
  const scale = fitScale(width, height, params.l1, params.l2);
  const ox = width / 2;
  const oy = height / 2;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (showTrails) {
    for (let i = 0; i < trails.length; i++) {
      const trail = trails[i];
      if (trail.length < 2) continue;
      ctx.lineWidth = i === 0 ? 1.6 : 1.1;
      // Draw oldest to newest in fading segments so the head is brightest.
      const segments = 6;
      const per = Math.ceil(trail.length / segments);
      for (let s = 0; s < segments; s++) {
        const from = Math.min(trail.length - 1, (segments - s) * per);
        const to = Math.max(0, (segments - s - 1) * per);
        if (from <= to) continue;
        ctx.strokeStyle = memberColor(i, states.length, 0.08 + (0.6 * (s + 1)) / segments);
        ctx.beginPath();
        const p0 = trail.at(from);
        ctx.moveTo(ox + p0.x * scale, oy + p0.y * scale);
        for (let k = from - 1; k >= to; k--) {
          const p = trail.at(k);
          ctx.lineTo(ox + p.x * scale, oy + p.y * scale);
        }
        ctx.stroke();
      }
    }
  }

  // Non-reference members first so the reference sits on top.
  for (let i = states.length - 1; i >= 0; i--) {
    const p = positions(states[i], params);
    const x1 = ox + p.x1 * scale;
    const y1 = oy + p.y1 * scale;
    const x2 = ox + p.x2 * scale;
    const y2 = oy + p.y2 * scale;
    const color = memberColor(i, states.length, i === 0 ? 1 : 0.85);
    if (showRods) {
      ctx.strokeStyle = memberColor(i, states.length, i === 0 ? 0.9 : 0.35);
      ctx.lineWidth = i === 0 ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    const r = i === 0 ? bobRadius : bobRadius * 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x1, y1, r * Math.cbrt(params.m1), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y2, r * Math.cbrt(params.m2), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw the log-scale separation chart with decade gridlines. */
export function drawChart(ctx, log, options = {}) {
  const { pixelRatio = 1, ...geometry } = options;
  const width = ctx.canvas.width / pixelRatio;
  const height = ctx.canvas.height / pixelRatio;
  const pad = { left: 44, right: 8, top: 8, bottom: 20 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { points, decades } = chartGeometry(log, w, h, geometry);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  for (const d of decades) {
    const y = pad.top + d.y;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + w, y);
    ctx.stroke();
    if (d.exponent % 2 === 0) ctx.fillText(`1e${d.exponent}`, pad.left - 6, y);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('separation (rad), last 30 s', pad.left, height - 4);

  if (points.length < 2) return;
  ctx.strokeStyle = 'rgba(255, 196, 92, 0.95)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pad.left + points[0].x, pad.top + points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(pad.left + points[i].x, pad.top + points[i].y);
  ctx.stroke();
}
