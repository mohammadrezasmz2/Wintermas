import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLeaf, pointerImpulse, sweepLeafItems, pileLayer, settledLeafOffset, leafPileProfile, settledLeafVisualSize } from '../ui/autumn-physics.js';

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

test('settled leaves slide into nearby clusters but do not teleport', () => {
  const items=[{offset:100},{offset:105},{offset:98},{offset:103}];
  const next=settledLeafOffset(items,115,500,.5);
  assert.ok(next>90 && next<115);
  const isolated=settledLeafOffset(items,300,500,.5);
  assert.equal(isolated,300);
});

test('dense leaf clusters form isolated organic mounds, not a full-width strip', () => {
  const leaves=[
    ...Array.from({length:28},(_,i)=>({offset:74+(i%7)-3})),
    ...Array.from({length:10},(_,i)=>({offset:273+(i%5)-2})),
  ];
  const {step,heights}=leafPileProfile(leaves,400);
  const at=x=>heights[Math.floor(x/step)];
  assert.ok(at(74)>at(273), 'more leaves produce a taller local mound');
  assert.ok(at(74)>10);
  assert.ok(at(200)<1,'empty middle of the window remains clear');
  assert.ok(at(0)<1 && at(395)<1,'pile tapers to nothing at edges');
  assert.ok([...heights].every(h=>h>=0&&h<=30));
});

test('a sparse isolated leaf cannot create a long straight snowbank', () => {
  const {heights}=leafPileProfile([{offset:100}],300);
  assert.ok([...heights].filter(h=>h>1.1).length<=2);
});

test('grounded leaves stay legible instead of shrinking to tiny grains', () => {
  assert.ok(settledLeafVisualSize(13, 0) >= 10);
  assert.ok(settledLeafVisualSize(13, 5) > 14);
  assert.ok(settledLeafVisualSize(13, 100) < 16);
});
test('local autumn banks are visibly taller at equal leaf density', () => {
  const items=Array.from({length:12},(_,i)=>({offset:90+i%8}));
  const {heights,step}=leafPileProfile(items,320);
  assert.ok(heights[Math.round(94/step)] >= 8);
  assert.ok(heights[Math.round(240/step)] <= 1);
});
