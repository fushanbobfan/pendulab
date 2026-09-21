// Named starting configurations. Angles are in radians from the downward
// vertical; `count` and `spread` describe the ensemble released alongside the
// reference pendulum.

const deg = (d) => (d * Math.PI) / 180;

export const PRESETS = [
  {
    id: 'gentle',
    name: 'Gentle swing',
    description: 'Small angles: the motion is regular and the fan of pendulums stays together.',
    state: [deg(20), 0, deg(20), 0],
    params: { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81, damping: 0 },
    count: 12,
    spread: deg(0.01),
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    description: 'Both bobs raised high: the fan spreads within seconds even though the members differ by a hundredth of a degree.',
    state: [deg(120), 0, deg(120), 0],
    params: { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81, damping: 0 },
    count: 24,
    spread: deg(0.01),
  },
  {
    id: 'flip',
    name: 'Flip',
    description: 'Released from just below horizontal with the lower bob folded back: the lower bob has enough energy to loop over the top.',
    state: [deg(85), 0, deg(-150), 0],
    params: { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81, damping: 0 },
    count: 16,
    spread: deg(0.02),
  },
  {
    id: 'heavy-top',
    name: 'Heavy top',
    description: 'A massive upper bob barely feels the lower one, so the upper rod swings almost like a simple pendulum while the lower bob whips around.',
    state: [deg(100), 0, deg(100), 0],
    params: { m1: 10, m2: 1, l1: 1, l2: 1, g: 9.81, damping: 0 },
    count: 16,
    spread: deg(0.01),
  },
  {
    id: 'long-tail',
    name: 'Long tail',
    description: 'A short upper rod driving a long lower one: slow, sweeping lower arcs.',
    state: [deg(150), 0, deg(90), 0],
    params: { m1: 1, m2: 1, l1: 0.5, l2: 1.5, g: 9.81, damping: 0 },
    count: 16,
    spread: deg(0.01),
  },
  {
    id: 'moon',
    name: 'Moon gravity',
    description: 'One sixth of Earth gravity: the same release unfolds in slow motion.',
    state: [deg(120), 0, deg(120), 0],
    params: { m1: 1, m2: 1, l1: 1, l2: 1, g: 1.62, damping: 0 },
    count: 24,
    spread: deg(0.01),
  },
  {
    id: 'damped',
    name: 'Damped',
    description: 'Light friction drains the energy: chaos gives way to an ordinary decaying swing.',
    state: [deg(120), 0, deg(120), 0],
    params: { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81, damping: 0.15 },
    count: 16,
    spread: deg(0.01),
  },
];

export const DEFAULT_PRESET_ID = 'butterfly';

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}
