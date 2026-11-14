import test from 'node:test';
import assert from 'node:assert/strict';
import { shedOnWindowMotion, naturalSnowHeights, keepBallAboveTaskbar, canStackBall, needsAutoPlough, sweepSnowProfile, bladeTouchesBall } from '../ui/snow-behavior.js';

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
  assert.ok(result.dislodged.length <= 40);
  assert.ok([...bank].every(value => value > 0 && value < 9));
  assert.ok([...bank].every(value => value >= 0));
});
test('profile slopes down to zero at both window ends', () => {
  const values = naturalSnowHeights(new Float32Array(120).fill(12), 5);
  assert.ok(values[0] < values[3] && values[3] < values[10]);
  assert.ok(values[119] < values[116] && values[116] < values[109]);
  assert.ok(values[0] < 1.2 && values[119] < 1.2);
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

test('upward window yank ejects snow along the full width and reduces bank depth', () => {
  const bank = new Float32Array(330).fill(11);
  const events = shedOnWindowMotion(bank, { dx: 0, dy: -28, lastVy: 0 }, 0.02);
  assert.ok(events.dislodged.length >= 25);
  assert.ok(events.dislodged.some(event => event.index > 270));
  assert.ok(events.dislodged.some(event => event.index < 50));
  assert.ok([...bank].every(value => value < 11));
  assert.ok([...bank].reduce((a,b) => a + b, 0) < 330 * 9);
});
test('moderate upward drag releases snow before very high speed', () => {
  const bank = new Float32Array(100).fill(9);
  const result = shedOnWindowMotion(bank, { dx: 0, dy: -3, lastVy: -90 }, 0.02);
  assert.ok(result.dislodged.length > 0);
});

test('snow moves with slow upward drag without crumbling', () => {
  const bank = new Float32Array(330).fill(8);
  const events = shedOnWindowMotion(bank, { dx: 0, dy: -1.5, lastVy: -35 }, 0.03);
  assert.equal(events.dislodged.length, 0);
});
test('blade collects only the snow it actually crosses', () => {
  const bed = { rect: { left: 0 }, profile: new Float32Array([6, 6, 6, 6, 6, 6, 6, 6]) };
  const collected = sweepSnowProfile(bed, 25, 18, 6);
  assert.ok(collected.area > 0);
  assert.ok(collected.cells > 0 && collected.cells < 8);
  const second = sweepSnowProfile(bed, 25, 18, 6);
  assert.equal(second.area, 0);
});
test('blade can pick up a snowball and snowman root at taskbar height', () => {
  const root = { x: 75, y: 280, size: 20 };
  assert.ok(bladeTouchesBall(root, 90, 65, 300));
  assert.equal(bladeTouchesBall({ x: 75, y: 100, size: 20 }, 90, 65, 300), false);
  assert.equal(bladeTouchesBall(root, 220, 200, 300), false);
});
