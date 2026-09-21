# pendulab

An interactive double-pendulum chaos lab in the browser. Pose one pendulum,
release a fan of nearly identical copies alongside it, and watch differences
of a hundredth of a degree grow into completely different motion.

**Live demo:** https://fushanbobfan.github.io/pendulab/

Runs with no build step and no dependencies. The dynamics, ensemble
bookkeeping, presets, chart geometry and pointer maths are plain ES modules
covered by a Node test suite; only the page glue touches the DOM.

## Quick start

Open `index.html` in a browser, or serve the folder:

```bash
npm run serve
# then visit http://localhost:8080
```

The dev server is a ~40-line dependency-free static file server; any other
static server works too.

## What you can do

| Control | Effect |
| --- | --- |
| Preset | Load a named starting configuration (see below) |
| Upper / lower angle | Starting angles from the downward vertical, in degrees |
| Upper / lower mass | Bob masses; the drawn bob radius scales with the cube root |
| Upper / lower length | Rod lengths; the stage rescales so the pendulum always fits |
| Gravity | From a gentle 0.5 m/s² to 25 m/s² |
| Damping | Linear angular friction; 0 keeps the motion conservative |
| Pendulums | How many copies are released, 1 to 64 |
| Spread | Total angular offset between the first and last copy, from 0.0001° to 1° on a log slider |
| Speed | Playback rate; the physics step stays fixed |
| Trails | Show or hide the fading paths of the lower bobs |
| Pause / Release | Freeze the motion, or drop everything again from the current pose |
| Save image | Download the stage as a PNG |

Drag either bob of the white reference pendulum to pose it: the upper bob
swings the whole pendulum rigidly, the lower bob moves only the lower rod.
The motion pauses while you drag and resumes when you let go.

Keyboard: `Space` pause, `R` release again, `T` trails, `S` save image,
`[` / `]` previous or next preset.

### Presets

| Preset | What it shows |
| --- | --- |
| Gentle swing | Small angles: regular motion, the fan stays together |
| Butterfly | Both bobs raised to 120°: the fan tears apart within seconds |
| Flip | Enough energy for the lower bob to loop over the top |
| Heavy top | A massive upper bob swings like a simple pendulum while the lower bob whips around |
| Long tail | A short upper rod driving a long lower one |
| Moon gravity | The same release at one sixth of Earth gravity |
| Damped | Light friction turns chaos back into a decaying swing |

## Reading the chart

Below the stage a chart plots the largest angular separation between the
reference pendulum and any copy, on a logarithmic axis over the last thirty
seconds. In a chaotic regime that curve climbs along a straight line before
saturating near a few radians, which is exponential growth of the initial
difference. The status line reports the slope of that line as `λ`, a rough
estimate of the largest Lyapunov exponent in inverse seconds, fitted only to
samples that have left the floor and not yet saturated. For the gentle preset
the line stays flat and `λ` sits near zero.

## How it works

- `src/physics.js`: the Lagrangian equations of motion for two point masses on
  massless rods, a classical fourth-order Runge–Kutta step, energy, bob
  positions and angle helpers. The fixed physics step is 1/240 s.
- `src/ensemble.js`: builds the perturbed copies, steps them together, measures
  their separation, keeps a rolling divergence log and fits the Lyapunov
  estimate.
- `src/presets.js`: the named configurations.
- `src/render.js`: hue-spread member colours, fading trail buffers, the
  fit-to-canvas scale and the log-axis chart geometry, plus the canvas calls.
- `src/interaction.js`: bob picking and the drag-to-pose maths.
- `src/main.js`: page glue.

## Tests

```bash
npm test
```

The suite checks equilibrium and mirror symmetry of the equations, energy
conservation over a long chaotic run, the small-angle period against
2π√(l/g), that damping drains energy, that the gentle preset stays regular
while the butterfly preset diverges, the Lyapunov fit on synthetic
exponentials, trail and chart geometry, and the drag maths.

## License

MIT
