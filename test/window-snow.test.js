import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSpillMinimizedPile } from '../ui/window-snow.js';
test('minimizing a tracked window releases its snow', () => {
  assert.equal(shouldSpillMinimizedPile('A2', ['C9', 'A2']), true);
});
test('closing or hiding does not spawn ghost snow', () => {
  assert.equal(shouldSpillMinimizedPile('A2', ['C9']), false);
  assert.equal(shouldSpillMinimizedPile('A2'), false);
});
