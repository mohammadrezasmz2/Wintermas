import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('snow diameter slider is persisted, snow-only and broadcast', async () => {
  const [main, panel, html] = await Promise.all([
    readFile(new URL('../main.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/panel.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /snowDiameter: 5/);
  assert.match(main, /'snowDiameter'/);
  assert.match(html, /id="snow-diameter".*min="2".*max="12"/);
  assert.match(panel, /snowDiameter: Number\(id\('snow-diameter'\)\.value\)/);
  assert.match(panel, /'snow-diameter-option'\)\.hidden = weather !== 'snow'/);
});

test('GPU, CPU and released snow all share a diameter, not snowbank mass', async () => {
  const [overlay, renderer] = await Promise.all([
    readFile(new URL('../ui/overlay.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/snow-renderer.js', import.meta.url), 'utf8'),
  ]);
  assert.match(overlay, /const shares = powderShares\(depth,/);
  assert.match(overlay, /const diameter = snowDiameter\(settings.snowDiameter\)/);
  assert.match(overlay, /size: diameter/);
  assert.match(overlay, /size: snowDiameter\(settings.snowDiameter\)/);
  assert.match(overlay, /setVisibleSnowDiameter\(particles, accents, settings.snowDiameter\)/);
  assert.match(overlay, /for \(const flake of particles\) paintParticle\(flake, 0\)/);
  assert.match(renderer, /gl_PointSize = max\(1\.0, flake\.z \* scale\)/);
});
