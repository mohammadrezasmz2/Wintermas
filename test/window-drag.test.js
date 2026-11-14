import test from 'node:test';
import assert from 'node:assert/strict';
import { titlebarWindowAt, draggedEnough, hideMovingWindowSnow } from '../ui/window-drag.js';

const fileExplorer = { id:'EXP', left:100, top:35, right:1300, bottom:860 };
const taskbar = { id:'BAR', left:0, top:970, right:1920, bottom:1080, taskbar:true };

test('pointer down in titlebar identifies the topmost eligible app', () => {
  const others=[taskbar,fileExplorer];
  assert.equal(titlebarWindowAt(others,{x:850,y:57})?.id, 'EXP');
  assert.equal(titlebarWindowAt(others,{x:850,y:390}),null);
  assert.equal(titlebarWindowAt(others,{x:1260,y:57}),null, 'do not intercept Windows close buttons');
  assert.equal(titlebarWindowAt([taskbar],{x:450,y:1000}),null);
});
test('do not assume a window move merely from a click without displacement', () => {
  const start={id:'EXP',startX:850,startY:57};
  assert.equal(draggedEnough(start,{x:850,y:57}),false);
  assert.equal(draggedEnough(start,{x:852,y:58}),false);
  assert.equal(draggedEnough(start,{x:850,y:52}),true);
});
test('old position is hidden on mouse down, even before a new DWM rectangle', () => {
  const hold=new Map();
  const pending={id:'EXP',startX:850,startY:57,moved:false};
  assert.equal(hideMovingWindowSnow('EXP',pending,hold,100),true);
  assert.equal(hideMovingWindowSnow('BAR',pending,hold,100),false);
});
test('the old snow remains hidden after release until geometry catches up', () => {
  const hold=new Map([['EXP',434]]);
  assert.equal(hideMovingWindowSnow('EXP',undefined,hold,200),true);
  assert.equal(hideMovingWindowSnow('EXP',undefined,hold,434),false);
  assert.equal(hideMovingWindowSnow('EXP',undefined,hold,500),false);
});
test('unrelated windows keep their snow while another window is dragged', () => {
  const hold=new Map([['EXP',410]]);
  assert.equal(hideMovingWindowSnow('OTHER', {id:'EXP'}, hold,200),false);
});
