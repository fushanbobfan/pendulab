# pendulab

An interactive double-pendulum chaos lab in the browser. Swing one pendulum,
release a fan of nearly identical ones, and watch tiny differences in the
starting angle grow into completely different motion.

**Live demo:** https://fushanbobfan.github.io/pendulab/

Runs with no build step and no dependencies. The physics is a plain ES module
covered by a Node test suite; only the page glue touches the DOM.

## Quick start

Open `index.html` in a browser, or serve the folder:

```bash
npm run serve
# then visit http://localhost:8080
```

## Tests

```bash
npm test
```

## License

MIT
