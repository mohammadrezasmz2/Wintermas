import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBottomEdgeApps, isExcludedBottomApp,
  bottomExclusionMasks, bottomExcludedAt } from '../ui/window-exclusions.js';

const cad={id:'123',left:15,top:55,right:1850,bottom:1030,
  processName:'SLDWORKS.exe',taskbar:false};
const browser={id:'456',left:250,top:150,right:720,bottom:710,
  processName:'firefox.exe',taskbar:false};
const taskbar={id:'taskbar',left:0,top:1032,right:1920,bottom:1080,taskbar:true};

test('accepts only safe executable basenames, case-insensitive and without duplicates',()=>{
  assert.deepEqual(normalizeBottomEdgeApps([' SLDWORKS.exe ', 'sldworks',
    'C:\\Program Files\\CAD\\Inventor.exe', '../no.exe',
    'not valid!*','',42]),['sldworks.exe','inventor.exe','no.exe']);
  assert.deepEqual(normalizeBottomEdgeApps({invalid:true}),[]);
});

test('SolidWorks is suppressed by default list, but unrelated apps remain visible',()=>{
  const excluded=['SLDWORKS.exe','Inventor.exe'];
  assert.equal(isExcludedBottomApp(cad,excluded),true);
  assert.equal(isExcludedBottomApp(browser,excluded),false);
  assert.equal(isExcludedBottomApp(taskbar,excluded),false);
  assert.equal(bottomExcludedAt([cad,browser,taskbar],excluded,300),true);
  assert.equal(bottomExcludedAt([cad,browser,taskbar],excluded,1890),false);
});

test('masks span full bottom region and respect an app window horizontal footprint',()=>{
  const covers=bottomExclusionMasks([browser,cad,taskbar],['SLDWORKS'],1080);
  assert.equal(covers.length,1);
  assert.equal(covers[0].left,15);
  assert.equal(covers[0].right,1850);
  assert.equal(covers[0].top,0);
  assert.ok(covers[0].bottom>1080);
  assert.equal(bottomExclusionMasks([browser],['SLDWORKS.exe'],1080).length,0);
});

test('normal mouse click does not create an accidental snowball; Ctrl+click still works',async()=>{
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../ui/overlay.js',import.meta.url),'utf8');
  assert.match(source,/const snow = next\.control \? snowAt\(next\) : null/);
  assert.match(source,/next\.control && snow/);
  assert.match(source,/else if \(action === 'snowball'\)/);
});

test('bottom snow, leaves, and actors are occluded by app content and per-app masks',async()=>{
  const {readFile}=await import('node:fs/promises');
  const overlay=await readFile(new URL('../ui/overlay.js',import.meta.url),'utf8');
  const autumn=await readFile(new URL('../ui/autumn.js',import.meta.url),'utf8');
  assert.match(overlay,/bottomMaskedAt\(bottomMasks, x\)/);
  // Taskbar effects must not disappear under normal application frames.
  assert.match(overlay,/paintProfile\(ground, \[\.\.\.taskbars, \.\.\.bottomMasks\]/);
  assert.match(overlay,/clipPrecipitation\(ctx, \[\.\.\.taskbars, \.\.\.bottomMasks\]/);
  assert.match(overlay,/paintBottomPlough\(now\)/);
  assert.match(overlay,/clipPrecipitation\(ctx, rectangles, width, height\)/);
  assert.match(autumn,/bottomMaskedAt\(lowerMasks,/);
  assert.match(autumn,/drawPile\(ctx,ground,\[\.\.\.taskbars,\.\.\.bottomMasks\]/);
});

test('wet edge stripes have zero display opacity; splashes remain',async()=>{
  const {readFile}=await import('node:fs/promises');
  const rain=await readFile(new URL('../ui/rain.js',import.meta.url),'utf8');
  assert.doesNotMatch(rain,/if \(wet\.size\) paintWetEdges\(ctx, rectangles\)/);
  assert.doesNotMatch(rain,/ctx\.strokeStyle = `rgba\(175, 211, 242,/);
  assert.match(rain,/if \(splashes\.length\) paintSplashes\(ctx\)/);
});

test('native window enumeration includes process basename for app exclusions',async()=>{
  const {readFile}=await import('node:fs/promises');
  const native=await readFile(new URL('../native/Desktop.cs',import.meta.url),'utf8');
  const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
  const panel=await readFile(new URL('../ui/panel.js',import.meta.url),'utf8');
  assert.match(native,/Process\.GetProcessById\(/);
  assert.match(native,/processName/);
  assert.match(main,/processName: rect\.processName \?\? ''/);
  assert.match(main,/bottomEdgeExcludeApps: \['SLDWORKS\.exe'\]/);
  assert.match(panel,/bottom-edge-exclude-apps/);
});

test('hidden SolidWorks cannot hide plough or taskbar snow behind an ordinary app',()=>{
  const normal={...browser,left:15,right:1850,top:10,bottom:1031};
  const covers=bottomExclusionMasks([normal,cad,taskbar],['SLDWORKS.exe'],1080);
  assert.deepEqual(covers,[],'front normal maximized window takes precedence');
  assert.equal(bottomExcludedAt([normal,cad,taskbar],['SLDWORKS.exe'],100,1080),false);
  const shown=bottomExclusionMasks([cad,normal,taskbar],['SLDWORKS.exe'],1080);
  assert.equal(shown.length,1,'front CAD app still hides its lower edge');
  assert.equal(shown[0].left,15);
});

test('partially covered CAD window masks only the visible portion of the bottom edge',()=>{
  const front={...browser,left:300,right:800,top:120,bottom:1031};
  const hidden=bottomExclusionMasks([front,cad,taskbar],['SLDWORKS.exe'],1080);
  assert.deepEqual(hidden.map(x=>[x.left,x.right]),[[15,300],[800,1850]]);
  assert.equal(bottomExcludedAt([front,cad,taskbar],['SLDWORKS.exe'],350,1080),false);
  assert.equal(bottomExcludedAt([front,cad,taskbar],['SLDWORKS.exe'],900,1080),true);
});

test('snowplough and Santa use their own lower-edge draw pass',async()=>{
  const {readFile}=await import('node:fs/promises');
  const src=await readFile(new URL('../ui/overlay.js',import.meta.url),'utf8');
  const scene=src.slice(src.indexOf('function drawScene(now, dt)'));
  const normalClip=scene.indexOf('clipPrecipitation(ctx, rectangles, width, height)');
  const snowProps=scene.indexOf('paintSnowProps(now)');
  const floorClip=scene.indexOf('clipPrecipitation(ctx, [...taskbars, ...bottomMasks]');
  const plough=scene.indexOf('paintBottomPlough(now)');
  assert.ok(normalClip>=0 && normalClip<snowProps);
  assert.ok(floorClip>snowProps && plough>floorClip);
  assert.match(scene,/for \(const p of accents\) if \(p.kind === 'santa'\) paintParticle\(p, now\);/);
  const body=src.slice(src.indexOf('function paintSnowProps(now)'),src.indexOf('function paintBottomPlough(now)'));
  assert.doesNotMatch(body,/drawPlough\(/,'the machine must not be drawn under the all-window clip');
});
