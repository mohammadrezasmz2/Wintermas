import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all three independent weather choices exist in settings and panel', async () => {
  const [main,panel,html,overlay]=await Promise.all([
    readFile(new URL('../main.js',import.meta.url),'utf8'),
    readFile(new URL('../ui/panel.js',import.meta.url),'utf8'),
    readFile(new URL('../ui/index.html',import.meta.url),'utf8'),
    readFile(new URL('../ui/overlay.js',import.meta.url),'utf8')
  ]);
  assert.match(main,/const weathers = \['snow', 'rain', 'autumn'\]/);
  assert.match(main,/autumnSpeed: 100/);
  for(const mode of ['snow','rain','autumn'])
    assert.match(html,new RegExp('name="weather" value="'+mode+'"'));
  assert.match(panel,/autumnSpeed/);
  assert.match(overlay,/autumn\.update\(dt, settings\)/);
  assert.match(overlay,/autumn\.sweep\(/);
  assert.match(overlay,/autumn\.onPointer\(/);
});
