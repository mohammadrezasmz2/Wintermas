import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLeaf, pointerImpulse, sweepLeafItems, pileLayer } from '../ui/autumn-physics.js';

function leaf() {
  return { x: 100, y: 100, vx: 0, vy: 30, size: 12, phase: 1.4,
    angle: 0, flip: 0, spin: 1.1, weight: 0.8 };
}
test('autumn leaves flutter, drift with wind and rotate as they fall', () => {
  const a = leaf(), b = leaf();
  for (let i=0; i<50; i++) {
    advanceLeaf(a, .016, -45, i*.016);
    advanceLeaf(b, .016, 65, i*.016);
  }
  assert.ok(a.y > 100 && b.y > 100);
  assert.ok(a.x < b.x, 'wind influences horizontal movement');
  assert.notEqual(a.angle, 0);
  assert.notEqual(a.flip, 0);
});
test('mouse swipe creates lift and horizontal vortex for nearby leaves', () => {
  const near = leaf(), far = {...leaf(), x: 700};
  assert.equal(pointerImpulse(near,{x:110,y:101},600,120),true);
  assert.ok(near.vx > 10 && near.vy < 30);
  assert.equal(pointerImpulse(far,{x:110,y:101},600,120),false);
  assert.equal(pointerImpulse(far,{x:700,y:100},0,0),false);
});
test('sweeper only collects taskbar leaves physically crossed by blade', () => {
  const rect={left:0,right:600};
  const items=[40,75,96,140,190].map(offset=>({offset,size:12}));
  assert.equal(sweepLeafItems(items,rect,108,80),2);
  assert.deepEqual(items.map(x=>x.offset),[40,140,190]);
  assert.equal(sweepLeafItems(items,rect,108,80),0);
});
test('local leaf piles stack irregularly rather than creating straight lines', () => {
  const items=Array.from({length:32},(_,i)=>({offset:100+i%7,size:10}));
  assert.equal(pileLayer(items,103),7);
  assert.equal(pileLayer(items,490),0);
});
