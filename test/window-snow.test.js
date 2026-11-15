import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReleaseWindowSnow } from '../ui/window-snow.js';

const settings = { weather: 'snow', enabled: true, paused: false };
const windowPile = { rect: { id: 'A2', left: 10, top: 225, right: 900, bottom: 760, taskbar: false },
  profile: new Float32Array([2, 6, 3]) };
const taskbarPile = { rect: { id: 'TB', left: 0, top: 1000, right: 1920, bottom: 1080, taskbar: true },
  profile: new Float32Array([6, 6]) };

test('clicking X and closing a snow-covered window releases its entire bank', () => {
  // Closed windows do not appear among minimized HWNDs: an absent next
  // rectangle alone must be enough to trigger the release.
  assert.equal(shouldReleaseWindowSnow(windowPile, undefined, settings), true);
  assert.equal(shouldReleaseWindowSnow(windowPile, null, settings), true);
});
test('minimizing still releases snow exactly as closing does', () => {
  assert.equal(shouldReleaseWindowSnow(windowPile, undefined, settings), true);
});
test('a still-visible window keeps its bank', () => {
  assert.equal(shouldReleaseWindowSnow(windowPile, windowPile.rect, settings), false);
});
test('taskbar piles do not become phantom falling flakes when taskbar changes', () => {
  assert.equal(shouldReleaseWindowSnow(taskbarPile, undefined, settings), false);
});
test('no snow is released by inactive snow mode, rain, autumn, or pause', () => {
  assert.equal(shouldReleaseWindowSnow(windowPile, undefined, { ...settings, weather: 'rain' }), false);
  assert.equal(shouldReleaseWindowSnow(windowPile, undefined, { ...settings, weather: 'autumn' }), false);
  assert.equal(shouldReleaseWindowSnow(windowPile, undefined, { ...settings, paused: true }), false);
  assert.equal(shouldReleaseWindowSnow(windowPile, undefined, { ...settings, enabled: false }), false);
});
