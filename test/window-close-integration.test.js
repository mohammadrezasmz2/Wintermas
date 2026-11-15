import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('window close: release powder before deleting the abandoned pile', async () => {
  const overlay = await readFile(new URL('../ui/overlay.js', import.meta.url), 'utf8');
  const closeBranch = overlay.slice(overlay.indexOf('    } else if (!next) {'),
    overlay.indexOf('    } else {', overlay.indexOf('    } else if (!next) {')));
  assert.match(closeBranch, /shouldReleaseWindowSnow\(pile, next, settings\)/);
  assert.match(closeBranch, /spill\(pile, id\)/);
  assert.match(closeBranch, /piles\.delete\(id\)/);
  assert.ok(closeBranch.indexOf('spill(pile, id)') < closeBranch.indexOf('piles.delete(id)'),
    'the snow shower must be created before the old HWND pile is removed');
  assert.doesNotMatch(closeBranch, /shouldSpillMinimizedPile/);
});

test('released snow uses the active snow diameter and remains free of its window', async () => {
  const overlay = await readFile(new URL('../ui/overlay.js', import.meta.url), 'utf8');
  const release = overlay.slice(overlay.indexOf('function releaseSnow('),
    overlay.indexOf('function updateWindowDrag('));
  assert.match(release, /const diameter = snowDiameter\(settings\.snowDiameter\)/);
  assert.match(release, /kind: 'chunk'/);
  assert.match(release, /size: diameter/);
  assert.match(release, /avoidId/);
  assert.match(release, /function spill\(pile, avoidId = null\)/);
});
