import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('native desktop tracker transmits the HWND of an active Win32 move', async () => {
  const native=await readFile(new URL('../native/Desktop.cs',import.meta.url),'utf8');
  assert.match(native,/GetGUIThreadInfo\(0, ref gui\)/);
  assert.match(native,/gui\.hwndMoveSize/);
  assert.match(native,/movingWindow/);
});
test('Electron forwards native move events to the renderer', async () => {
  const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
  assert.match(main,/moving = null, icons = \[\] \} = JSON\.parse\(line\)/);
  assert.match(main,/minimized, moving,/);
  assert.match(main,/icons: desktopIcons/);
});
test('renderer hides stale window snow immediately and releases powder on drag', async () => {
  const overlay=await readFile(new URL('../ui/overlay.js',import.meta.url),'utf8');
  assert.match(overlay,/updateWindowDrag\(frame\.mouse, now, frame\.moving\)/);
  assert.match(overlay,/movingWindowDrag\.moved = true/);
  assert.match(overlay,/spill\(pile, nativeMoving\)/);
  assert.match(overlay,/piles\.delete\(nativeMoving\)/);
  assert.match(overlay,/hideMovingWindowSnow\(rect\.id, movingWindowDrag/);
});
