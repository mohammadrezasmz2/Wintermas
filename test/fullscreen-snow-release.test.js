import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isFullscreenSnowWindow, planFullscreenSnowfall } from '../ui/window-snow.js';

const full = { id: 'MAX', left: 0, top: 0, right: 1920, bottom: 1040, taskbar: false };
const small = { id: 'APP', left: 130, top: 120, right: 1450, bottom: 900, taskbar: false };

test('only fullscreen and work-area-maximized windows get gradual releases', () => {
  assert.equal(isFullscreenSnowWindow(full, 1920, 1080), true);
  assert.equal(isFullscreenSnowWindow({ ...full, bottom: 1080 }, 1920, 1080), true);
  assert.equal(isFullscreenSnowWindow(small, 1920, 1080), false);
  assert.equal(isFullscreenSnowWindow({ ...full, left: 200 }, 1920, 1080), false);
  assert.equal(isFullscreenSnowWindow({ ...full, taskbar: true }, 1920, 1080), false);
  assert.equal(isFullscreenSnowWindow(full, 0, 1080), false);
});

test('fullscreen snow converts into sparse small groups across time and width', () => {
  const profile = new Float32Array(120).fill(8);
  const planned = planFullscreenSnowfall({ rect: full, profile });
  assert.equal(planned.length, 40);
  assert.ok(planned.every(event => event.count >= 1 && event.count <= 3));
  assert.ok(planned.every(event => event.delay >= 0 && event.delay < 2600));
  assert.ok(planned.some(event => event.delay > 1800));
  assert.ok(planned.some(event => event.delay < 300));
  assert.ok(planned.every((event, i) => i === 0 || planned[i - 1].delay <= event.delay));
  assert.ok(Math.max(...planned.map(event => event.x)) -
    Math.min(...planned.map(event => event.x)) > 500);
  assert.deepEqual(planFullscreenSnowfall({ rect: full, profile: new Float32Array(10) }), []);
});

test('fullscreen close/minimize is routed to normal fine snowflakes, not the old powder dump', async () => {
  const overlay = await readFile(new URL('../ui/overlay.js', import.meta.url), 'utf8');
  const close = overlay.slice(overlay.indexOf('    } else if (!next) {'),
    overlay.indexOf('    } else {', overlay.indexOf('    } else if (!next) {')));
  assert.match(close, /isFullscreenSnowWindow\(pile\.rect, width, height\)/);
  assert.match(close, /queueFullscreenSnowfall\(pile\)/);
  assert.match(close, /else spill\(pile, id\)/);
  assert.ok(close.indexOf('queueFullscreenSnowfall(pile)') < close.indexOf('piles.delete(id)'));
  const update = overlay.slice(overlay.indexOf('function updateParticles(dt) {'),
    overlay.indexOf("  if (settings.weather === 'autumn') {", overlay.indexOf('function updateParticles(dt) {')));
  assert.match(update, /pendingFullscreenSnow\[0\]\.due <= now/);
  assert.match(update, /const flake = spawnFlake\(\)/);
  assert.doesNotMatch(update, /releaseSnow\(/);
});
