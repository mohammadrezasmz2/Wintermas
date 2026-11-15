import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SNOW_DIAMETER, snowDiameter, powderShares,
  setVisibleSnowDiameter } from '../ui/snow-diameter.js';

test('diameter uses a persisted, bounded size in pixels', () => {
  assert.equal(snowDiameter(undefined), DEFAULT_SNOW_DIAMETER);
  assert.equal(snowDiameter(2), 2);
  assert.equal(snowDiameter(9), 9);
  assert.equal(snowDiameter(-20), 2);
  assert.equal(snowDiameter(99), 12);
});
test('large window snow mass becomes several same-size flakes', () => {
  const shares = powderShares(28);
  assert.ok(shares.length > 1);
  assert.ok(shares.length <= 6);
  assert.ok(Math.abs(shares.reduce((sum, v) => sum + v, 0) - 28) < 0.001);
});
test('snow renderer diameter matches released window snow particles', () => {
  const falling = [{ kind: 'snow', size: 1 }, { kind: 'snow', size: 7 }];
  const accents = [{ kind: 'chunk', size: 15, deposit: 20 },
    { kind: 'magic', size: 2 }, { kind: 'chunk', size: 0.6, deposit: 1 }];
  setVisibleSnowDiameter(falling, accents, 4);
  assert.deepEqual(falling.map(f => f.size), [4,4]);
  assert.deepEqual(accents.map(p => p.size), [4,2,4]);
  assert.equal(accents[0].deposit, 20);
  setVisibleSnowDiameter(falling, accents, 10);
  assert.deepEqual(falling.map(f => f.size), [10,10]);
  assert.deepEqual([accents[0].size,accents[2].size], [10,10]);
});
test('no powder produced if below threshold or particle budget exhausted', () => {
  assert.deepEqual(powderShares(0), []);
  assert.deepEqual(powderShares(40, 0), []);
  assert.equal(powderShares(40, 2).length, 2);
});
