import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULT_PRESET_ID, getPreset } from '../src/presets.js';
import { DEFAULT_PARAMS, energy } from '../src/physics.js';
import { createEnsemble, stepEnsemble, maxSeparation } from '../src/ensemble.js';

test('presets have unique ids and complete fields', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.name && p.description);
    assert.equal(p.state.length, 4);
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      assert.equal(typeof p.params[key], 'number', `${p.id} missing ${key}`);
    }
    assert.ok(p.params.m1 > 0 && p.params.m2 > 0 && p.params.l1 > 0 && p.params.l2 > 0);
    assert.ok(Number.isInteger(p.count) && p.count >= 1 && p.count <= 64);
    assert.ok(p.spread > 0 && p.spread < 0.01, `${p.id} spread should be tiny`);
  }
  assert.ok(getPreset(DEFAULT_PRESET_ID));
  assert.equal(getPreset('nope'), null);
});

test('the gentle preset stays regular and the butterfly preset diverges', () => {
  const gentle = getPreset('gentle');
  const butterfly = getPreset('butterfly');
  const dt = 1 / 240;
  const g = createEnsemble(gentle.state, gentle.count, gentle.spread);
  const b = createEnsemble(butterfly.state, butterfly.count, butterfly.spread);
  stepEnsemble(g, gentle.params, dt, 240 * 20);
  stepEnsemble(b, butterfly.params, dt, 240 * 20);
  assert.ok(maxSeparation(g) < 1e-3, `gentle ${maxSeparation(g)}`);
  assert.ok(maxSeparation(b) > 0.5, `butterfly ${maxSeparation(b)}`);
});

test('the flip preset carries enough energy for the lower bob to reach the top', () => {
  const flip = getPreset('flip');
  const { m2, l1, l2, g, m1 } = flip.params;
  const e = energy(flip.state, flip.params).total;
  // Lower bob at the top with the upper bob hanging straight down.
  const barrier = -(m1 + m2) * g * l1 + m2 * g * l2;
  assert.ok(e > barrier, `energy ${e} should exceed barrier ${barrier}`);
});
