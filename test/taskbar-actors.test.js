import test from 'node:test';
import assert from 'node:assert/strict';
import { ploughBaselineForFloor, santaCenterForFloor, safeBottomFloor,
  PLOUGH_BOTTOM_EXTENT, SANTA_SPRITE_HALF_HEIGHT, SANTA_BOB_AMPLITUDE } from '../ui/taskbar-actors.js';

const nativeBar={id:'Shell_TrayWnd',taskbar:true,left:0,right:1920,top:1027,bottom:1080};
const workArea={id:'taskbar-fallback',taskbar:true,left:0,right:1920,top:1032,bottom:1080};

test('Windows workArea top takes priority over taskbar frame/shadow insets', () => {
  assert.equal(safeBottomFloor([nativeBar,workArea],960,1080),1032);
  assert.equal(safeBottomFloor([workArea,nativeBar],960,1080),1032);
});
test('fallback to native bar or display floor when workArea is absent', () => {
  assert.equal(safeBottomFloor([nativeBar],960,1080),1027);
  assert.equal(safeBottomFloor([],960,1080),1080);
  assert.equal(safeBottomFloor([nativeBar],2000,1080),1080);
});
test('snowplough tracks, bottom edge and Santa sleigh stay above taskbar top', () => {
  const floor=safeBottomFloor([nativeBar,workArea],500,1080);
  const plough=ploughBaselineForFloor(floor);
  const santa=santaCenterForFloor(floor);
  assert.ok(plough+PLOUGH_BOTTOM_EXTENT<=floor);
  assert.ok(santa+SANTA_SPRITE_HALF_HEIGHT+SANTA_BOB_AMPLITUDE<=floor);
  assert.ok(plough>=floor-8,'vehicle must not float above the line');
  assert.ok(santa+SANTA_SPRITE_HALF_HEIGHT>=floor-8,'sleigh runners stay close to line');
});
test('top- and side-docked taskbars must not become an imaginary bottom floor', () => {
  const top={id:'top',taskbar:true,left:0,right:1920,top:0,bottom:48};
  const side={id:'side',taskbar:true,left:0,right:52,top:0,bottom:1080};
  assert.equal(safeBottomFloor([top,side],20,1080),1080);
});
test('overlay and Electron both use the same authoritative taskbar contract', async () => {
  const {readFile}=await import('node:fs/promises');
  const overlay=await readFile(new URL('../ui/overlay.js',import.meta.url),'utf8');
  const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
  assert.match(overlay,/santaCenterForFloor\(safeBottomFloor\(taskbars, x, height\)\)/);
  assert.match(overlay,/const vehicleY = ploughBaselineForFloor\(floorY\)/);
  assert.match(main,/rectangles\.unshift\(\{ id: 'taskbar-fallback'/);
  assert.doesNotMatch(main,/!rectangles\.some\(rect => rect\.taskbar && rect\.bottom >= height - 1\)/);
});
