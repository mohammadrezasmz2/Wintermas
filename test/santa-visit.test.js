import test from 'node:test';
import assert from 'node:assert/strict';
import { santaStops, bladeCrosses, isOnBottomSurface } from '../ui/santa-visit.js';

test('Santa plants a single tree if there is no snowman', () => {
  assert.deepEqual(santaStops([], 1200), [{ kind: 'tree', x: 648 }]);
});
test('Santa leaves individual gifts next to three snowmen, never random gifts', () => {
  const stops = santaStops([200, 700, 1040], 1200);
  assert.equal(stops.length, 3);
  assert.ok(stops.every(s => s.kind === 'gift'));
  assert.deepEqual(stops.map(s => s.x), [248, 652, 1088]);
});
test('plough hits gifts and trees while sweeping either direction', () => {
  assert.ok(bladeCrosses(180, 165, 160, 20));
  assert.ok(bladeCrosses(165, 180, 160, 20));
  assert.equal(bladeCrosses(180, 165, 10, 15), false);
});
test('only decorations at ground or taskbar level can be removed', () => {
  const floor = () => 950;
  assert.equal(isOnBottomSurface(948, 100, floor, 12), true);
  assert.equal(isOnBottomSurface(600, 100, floor, 12), false);
});
