import test from 'node:test';
import assert from 'node:assert/strict';
import { scissorFor, clipPrecipitation } from '../ui/precipitation-mask.js';
import { landing, bottomTaskbarAt } from '../ui/geometry.js';

test('scissor covers the inside of a window at high DPI', () => {
  assert.deepEqual(scissorFor({ left: 10, top: 20, right: 90, bottom: 80 }, 200, 200, 2),
    { x: 20, y: 40, width: 160, height: 120 });
});

test('offscreen windows clip only intersecting pixels', () => {
  assert.deepEqual(scissorFor({ left: -20, top: -10, right: 12, bottom: 15 }, 100, 100, 1),
    { x: 0, y: 85, width: 12, height: 15 });
  assert.equal(scissorFor({ left: 110, top: 10, right: 140, bottom: 30 }, 100, 100, 1), null);
});

test('Canvas2D clips each overlapping window independently', () => {
  const calls = [];
  const ctx = {
    beginPath: () => calls.push('begin'),
    rect: (...args) => calls.push(args),
    clip: rule => calls.push(rule),
  };
  clipPrecipitation(ctx, [
    { left: 10, top: 10, right: 60, bottom: 60 },
    { left: 40, top: 40, right: 80, bottom: 80 },
  ], 100, 100);
  assert.equal(calls.filter(value => value === 'evenodd').length, 2);
});

test('snowball and vehicle must use taskbar surface instead of screen bottom', () => {
  const taskbar = { id: 'tray', taskbar: true, left: 0, right: 1920, top: 1030, bottom: 1080 };
  assert.equal(bottomTaskbarAt([taskbar], 800, 1080), taskbar);
  assert.equal(bottomTaskbarAt([taskbar], 800, 1200), undefined);
  const hit = landing([taskbar], 800, 1020, 800, 1050, true);
  assert.equal(hit?.rect?.id, 'tray');
  assert.equal(landing([taskbar], 800, 1020, 800, 1050, false), null);
});
