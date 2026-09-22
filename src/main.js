import { energy, positions } from './physics.js';
import {
  createEnsemble,
  stepEnsemble,
  maxSeparation,
  DivergenceLog,
  estimateLyapunov,
} from './ensemble.js';
import { PRESETS, DEFAULT_PRESET_ID, getPreset } from './presets.js';
import { Trail, drawStage, drawChart, drawPhase } from './render.js';
import { PHASE_PLANES, DEFAULT_PLANE_ID, getPlane, phasePoint, growExtent, initialExtent } from './phase.js';
import { stageGeometry, pickBob, dragAngles } from './interaction.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const chart = $('chart');
const phase = $('phase');
const ctx = stage.getContext('2d');
const chartCtx = chart.getContext('2d');
const phaseCtx = phase.getContext('2d');

const DT = 1 / 240; // physics substep in seconds
const MAX_FRAME = 0.1; // clamp long frames so a background tab does not explode
const TRAIL_LENGTH = 500;
const PHASE_LENGTH = 1200;
const LOG_INTERVAL = 1 / 30;

const controls = {
  preset: $('preset'),
  presetDescription: $('preset-description'),
  theta1: $('theta1'),
  theta2: $('theta2'),
  m1: $('m1'),
  m2: $('m2'),
  l1: $('l1'),
  l2: $('l2'),
  gravity: $('gravity'),
  damping: $('damping'),
  count: $('count'),
  spread: $('spread'),
  speed: $('speed'),
  trails: $('trails'),
  phasePlane: $('phase-plane'),
  pause: $('pause'),
  release: $('release'),
  save: $('save'),
  status: $('status'),
};

let pixelRatio = 1;

/** Size a canvas's backing store to its CSS box times the device pixel ratio. */
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return false;
  pixelRatio = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round(rect.width * pixelRatio);
  const h = Math.round(rect.height * pixelRatio);
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

/** Logical (CSS pixel) size of the stage, which the geometry helpers work in. */
function stageSize() {
  return { width: stage.width / pixelRatio, height: stage.height / pixelRatio };
}

const sim = {
  states: [],
  params: null,
  trails: [],
  phaseTrails: [],
  plane: getPlane(DEFAULT_PLANE_ID),
  extent: initialExtent(getPlane(DEFAULT_PLANE_ID)),
  log: new DivergenceLog(4000),
  time: 0,
  sinceLog: 0,
  paused: false,
  lastFrame: null,
  drag: null, // { bob, resume } while a bob is being dragged
};

const deg = (d) => (d * Math.PI) / 180;
const num = (el) => Number(el.value);

function readParams() {
  return {
    m1: num(controls.m1),
    m2: num(controls.m2),
    l1: num(controls.l1),
    l2: num(controls.l2),
    g: num(controls.gravity),
    damping: num(controls.damping),
  };
}

function readSpread() {
  return deg(Math.pow(10, num(controls.spread)));
}

function updateOutputs() {
  $('theta1-value').textContent = `${controls.theta1.value}°`;
  $('theta2-value').textContent = `${controls.theta2.value}°`;
  $('m1-value').textContent = num(controls.m1).toFixed(1);
  $('m2-value').textContent = num(controls.m2).toFixed(1);
  $('l1-value').textContent = num(controls.l1).toFixed(2);
  $('l2-value').textContent = num(controls.l2).toFixed(2);
  $('gravity-value').textContent = num(controls.gravity).toFixed(2);
  $('damping-value').textContent = num(controls.damping).toFixed(2);
  $('count-value').textContent = controls.count.value;
  $('spread-value').textContent = `${Math.pow(10, num(controls.spread)).toPrecision(2)}°`;
  $('speed-value').textContent = `${num(controls.speed).toFixed(1)}×`;
}

function release() {
  const base = [deg(num(controls.theta1)), 0, deg(num(controls.theta2)), 0];
  const count = Math.round(num(controls.count));
  sim.params = readParams();
  sim.states = createEnsemble(base, count, readSpread());
  sim.trails = Array.from({ length: count }, () => new Trail(TRAIL_LENGTH));
  resetPhase();
  sim.log.clear();
  sim.time = 0;
  sim.sinceLog = 0;
  sim.log.push(0, maxSeparation(sim.states));
  recordTrails();
  draw();
  updateStatus();
}

function recordTrails() {
  for (let i = 0; i < sim.states.length; i++) {
    const p = positions(sim.states[i], sim.params);
    sim.trails[i].push(p.x2, p.y2);
    const q = phasePoint(sim.states[i], sim.plane);
    sim.phaseTrails[i].push(q.x, q.y);
  }
  sim.extent = growExtent(sim.extent, sim.plane, sim.states);
}

/** Forget the phase trajectories and let the velocity axis start small again. */
function resetPhase() {
  sim.phaseTrails = Array.from({ length: sim.states.length }, () => new Trail(PHASE_LENGTH));
  sim.extent = initialExtent(sim.plane);
}

function setPlane(id) {
  sim.plane = getPlane(id);
  controls.phasePlane.value = sim.plane.id;
  resetPhase();
  recordTrails();
  draw();
}

function stepPlane(delta) {
  const idx = PHASE_PLANES.findIndex((p) => p.id === sim.plane.id);
  setPlane(PHASE_PLANES[(idx + delta + PHASE_PLANES.length) % PHASE_PLANES.length].id);
}

function applyPreset(id) {
  const p = getPreset(id);
  if (!p) return;
  controls.preset.value = id;
  controls.presetDescription.textContent = p.description;
  controls.theta1.value = Math.round((p.state[0] * 180) / Math.PI);
  controls.theta2.value = Math.round((p.state[2] * 180) / Math.PI);
  controls.m1.value = p.params.m1;
  controls.m2.value = p.params.m2;
  controls.l1.value = p.params.l1;
  controls.l2.value = p.params.l2;
  controls.gravity.value = p.params.g;
  controls.damping.value = p.params.damping;
  controls.count.value = p.count;
  controls.spread.value = Math.log10((p.spread * 180) / Math.PI).toFixed(1);
  updateOutputs();
  release();
}

function setPaused(paused) {
  sim.paused = paused;
  controls.pause.textContent = paused ? 'Resume' : 'Pause';
  controls.pause.setAttribute('aria-pressed', String(paused));
  if (!paused) sim.lastFrame = null;
}

function stepPreset(delta) {
  const idx = PRESETS.findIndex((p) => p.id === controls.preset.value);
  const next = (idx + delta + PRESETS.length) % PRESETS.length;
  applyPreset(PRESETS[next].id);
}

/** Download the stage on an opaque background so the trails read on any viewer. */
function saveImage() {
  const out = document.createElement('canvas');
  out.width = stage.width;
  out.height = stage.height;
  const octx = out.getContext('2d');
  octx.fillStyle = '#070b14';
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(stage, 0, 0);
  const a = document.createElement('a');
  const t1 = controls.theta1.value;
  const t2 = controls.theta2.value;
  a.download = `pendulab-${controls.preset.value}-${t1}-${t2}-${sim.time.toFixed(1)}s.png`;
  a.href = out.toDataURL('image/png');
  a.click();
}

function updateStatus() {
  const e = energy(sim.states[0], sim.params);
  const sep = maxSeparation(sim.states);
  const lyap = estimateLyapunov(sim.log);
  const parts = [
    `t = ${sim.time.toFixed(1)} s`,
    `E = ${e.total.toFixed(2)} J`,
  ];
  if (sim.states.length > 1) {
    parts.push(`spread = ${sep < 1e-3 ? sep.toExponential(1) : sep.toFixed(3)} rad`);
    if (lyap !== null) parts.push(`λ ≈ ${lyap.toFixed(2)} /s`);
  }
  controls.status.textContent = parts.join(' · ');
}

function draw() {
  drawStage(ctx, sim.states, sim.params, sim.trails, { showTrails: controls.trails.checked, pixelRatio });
  drawChart(chartCtx, sim.log, { pixelRatio });
  drawPhase(phaseCtx, sim.states, sim.phaseTrails, sim.plane, sim.extent, { pixelRatio });
}

let statusTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (sim.paused) return;
  if (sim.lastFrame === null) {
    sim.lastFrame = now;
    return;
  }
  const elapsed = Math.min(MAX_FRAME, (now - sim.lastFrame) / 1000) * num(controls.speed);
  sim.lastFrame = now;

  const steps = Math.max(1, Math.round(elapsed / DT));
  stepEnsemble(sim.states, sim.params, DT, steps);
  sim.time += steps * DT;
  sim.sinceLog += steps * DT;
  if (sim.sinceLog >= LOG_INTERVAL) {
    sim.log.push(sim.time, maxSeparation(sim.states));
    sim.sinceLog = 0;
  }
  recordTrails();
  draw();

  statusTimer += elapsed;
  if (statusTimer > 0.2) {
    statusTimer = 0;
    updateStatus();
  }
}

function canvasPoint(ev) {
  const rect = stage.getBoundingClientRect();
  const { width, height } = stageSize();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * width,
    y: ((ev.clientY - rect.top) / rect.height) * height,
  };
}

function currentGeometry() {
  const { width, height } = stageSize();
  return stageGeometry(width, height, sim.states[0], sim.params);
}

function bindDragging() {
  stage.addEventListener('pointerdown', (ev) => {
    const { x, y } = canvasPoint(ev);
    const bob = pickBob(x, y, currentGeometry());
    if (!bob) return;
    ev.preventDefault();
    stage.setPointerCapture(ev.pointerId);
    sim.drag = { bob, resume: !sim.paused };
    setPaused(true);
    stage.classList.add('dragging');
  });

  stage.addEventListener('pointermove', (ev) => {
    const { x, y } = canvasPoint(ev);
    const g = currentGeometry();
    if (!sim.drag) {
      stage.classList.toggle('grabbable', pickBob(x, y, g) !== 0);
      return;
    }
    const [t1, t2] = dragAngles(sim.drag.bob, x, y, sim.states[0], g);
    controls.theta1.value = Math.round((t1 * 180) / Math.PI);
    controls.theta2.value = Math.round((t2 * 180) / Math.PI);
    updateOutputs();
    release();
  });

  const finish = (ev) => {
    if (!sim.drag) return;
    const { resume } = sim.drag;
    sim.drag = null;
    stage.classList.remove('dragging');
    if (stage.hasPointerCapture(ev.pointerId)) stage.releasePointerCapture(ev.pointerId);
    if (resume) setPaused(false);
  };
  stage.addEventListener('pointerup', finish);
  stage.addEventListener('pointercancel', finish);
}

function bind() {
  bindDragging();
  for (const p of PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    controls.preset.append(opt);
  }
  controls.preset.addEventListener('change', () => applyPreset(controls.preset.value));
  for (const p of PHASE_PLANES) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    controls.phasePlane.append(opt);
  }
  controls.phasePlane.value = sim.plane.id;
  controls.phasePlane.addEventListener('change', () => setPlane(controls.phasePlane.value));

  const rerelease = ['theta1', 'theta2', 'm1', 'm2', 'l1', 'l2', 'gravity', 'damping', 'count', 'spread'];
  for (const key of rerelease) {
    controls[key].addEventListener('input', () => {
      updateOutputs();
      release();
    });
  }
  controls.speed.addEventListener('input', updateOutputs);
  controls.trails.addEventListener('change', draw);
  controls.pause.addEventListener('click', () => setPaused(!sim.paused));
  controls.release.addEventListener('click', release);
  controls.save.addEventListener('click', saveImage);

  document.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLElement && /^(input|select|textarea|button)$/i.test(ev.target.tagName)) return;
    switch (ev.key) {
      case ' ':
        ev.preventDefault();
        setPaused(!sim.paused);
        break;
      case 'r':
      case 'R':
        release();
        break;
      case 't':
      case 'T':
        controls.trails.checked = !controls.trails.checked;
        draw();
        break;
      case 's':
      case 'S':
        saveImage();
        break;
      case 'p':
      case 'P':
        stepPlane(1);
        break;
      case '[':
        stepPreset(-1);
        break;
      case ']':
        stepPreset(1);
        break;
      default:
    }
  });
}

bind();
fitCanvas(stage);
fitCanvas(chart);
fitCanvas(phase);
applyPreset(DEFAULT_PRESET_ID);
const observer = new ResizeObserver(() => {
  const changed = fitCanvas(stage) | fitCanvas(chart) | fitCanvas(phase);
  if (changed && sim.params) draw();
});
observer.observe(stage);
observer.observe(chart);
observer.observe(phase);
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
requestAnimationFrame(frame);
