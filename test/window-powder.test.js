import test from 'node:test';
import assert from 'node:assert/strict';
import { shakeSnowOffWindow } from '../ui/window-powder.js';

test('moving a snow-covered window up turns ALL snow into drifting powder', () => {
  const bank = new Float32Array(120).fill(9);
  const chunks = shakeSnowOffWindow(bank, -5);
  assert.ok(chunks.length >= 60);
  assert.ok([...bank].every(x => x === 0), 'no residual horizontal snow line');
  assert.ok(Math.abs(chunks.reduce((sum, x) => sum + x.mass, 0) - 1080) < 0.1);
  assert.ok(chunks.every(x => x.mass > 0));
});

test('moving a snow-covered window down also clears the entire snow line', () => {
  const bank = new Float32Array([1, 3, 2, 0.7, 8]);
  const mass = shakeSnowOffWindow(bank, 4).reduce((sum, x) => sum + x.mass, 0);
  assert.ok(Math.abs(mass - 14.7) < 0.01);
  assert.deepEqual([...bank], [0,0,0,0,0]);
});

test('stationary and tiny vertical jitter do not throw settled snow', () => {
  const bank = new Float32Array(40).fill(4);
  assert.deepEqual(shakeSnowOffWindow(bank, 0), []);
  assert.deepEqual(shakeSnowOffWindow(bank, 1.5), []);
  assert.ok([...bank].every(x => x === 4));
});
