import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('autumn foliage no longer uses nine-point radial star leaves', async () => {
  const source=await readFile(new URL('../ui/autumn-art.js', import.meta.url),'utf8');
  const maple=source.slice(source.indexOf('function maple(ctx)'),source.indexOf('function oval(ctx)'));
  assert.match(maple,/bezierCurveTo/);
  assert.doesNotMatch(maple,/ctx\.lineTo\(41, -23\)/);
  assert.match(source,/ctx\.clip\(\);/);
  assert.match(source,/const earth = ctx\.createLinearGradient/);
});

test('solid leaf mound joins the snowplough blade in the right paint order', async () => {
  const overlay=await readFile(new URL('../ui/overlay.js', import.meta.url),'utf8');
  const art=await readFile(new URL('../ui/autumn-art.js', import.meta.url),'utf8');
  assert.match(overlay,/autumn\.drawMound\(ctx,[^;]+;\s*drawPlough\(ctx,[^;]+;/);
  assert.match(art,/ctx\.moveTo\(-35, 1\)/);
  assert.match(art,/ctx\.lineTo\(-35, -Math\.min\(23, 12 \+ peak \* \.46\)\)/);
});

test('leaf pile renderer uses local physical density and reduced leaf squash', async () => {
  const renderer=await readFile(new URL('../ui/autumn.js', import.meta.url),'utf8');
  assert.match(renderer,/leafPileProfile\(pile\.items,span\)/);
  assert.match(renderer,/settledLeafOffset\(pile\.items,/);
  assert.match(renderer,/settledLeafVisualSize\(item\.size,item\.layer\)/);
  assert.match(renderer,/\.02\),\.78\)/);
});
