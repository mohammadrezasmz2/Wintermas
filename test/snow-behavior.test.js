import test from 'node:test';
import assert from 'node:assert/strict';
import { shedOnWindowMotion, naturalSnowHeights, keepBallAboveTaskbar, canStackBall, needsAutoPlough } from '../ui/snow-behavior.js';

test('snow follows a slowly moved window without shedding', () => {
  const bank = new Float32Array(50).fill(9);
  const result = shedOnWindowMotion(bank, { dx: 3, dy: 2 }, 0.05);
  assert.equal(result.dislodged.length, 0);
  assert.equal(bank[0], 9);
});
test('fast motion throws a bounded fraction of snow, not the whole window', () => {
  const bank = new Float32Array(80).fill(9);
  const result = shedOnWindowMotion(bank, { dx: 140, dy: -45 }, 0.06);
  assert.ok(result.dislodged.length > 0);
  assert.ok(result.dislodged.length <= 16);
  assert.ok([...bank].some(value => value === 9));
  assert.ok([...bank].every(value => value >= 0));
});
test('natural snowbank remains rounded and nonnegative', () => {
  const ridge = naturalSnowHeights(new Float32Array([0, 0, 10, 12, 12, 0, 0]), 17);
  assert.equal(ridge.length, 7);
  assert.ok([...ridge].every(value => value >= 0 && value <= 24));
});
test('snowballs never cross taskbar including while dragged below the taskbar', () => {
  const bar = { taskbar: true, left: 0, right: 1920, top: 1032, bottom: 1080 };
  const ball = { x: 1900, y: 1070, size: 30, vy: 500 };
  assert.equal(keepBallAboveTaskbar(ball, [bar], 1080), 1032);
  assert.equal(ball.y + ball.size, 1032);
  assert.equal(ball.vy, 0);
});
test('snowman stacking accepts dropped balls near the top of a supported base', () => {
  const base = { x: 200, y: 940, size: 26, support: 'ground' };
  const head = { x: 202, y: 884, size: 20 };
  assert.ok(canStackBall(head, base));
  assert.equal(canStackBall({ x: 500, y: 884, size: 20 }, base), false);
});
test('automatic snowplough waits for a filled lower ledge', () => {
  const bed = { rect: { taskbar: true }, profile: new Float32Array(100).fill(9) };
  assert.ok(needsAutoPlough([bed], null));
  bed.profile.fill(2);
  assert.equal(needsAutoPlough([bed], null), false);
});
