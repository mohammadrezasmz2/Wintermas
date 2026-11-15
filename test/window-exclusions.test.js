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
  assert.match(overlay,/bottomExcludedAt\(rectangles, settings\.bottomEdgeExcludeApps, x\)/);
  assert.match(overlay,/paintProfile\(ground, \[\.\.\.rectangles, \.\.\.bottomMasks\]/);
  assert.match(overlay,/clipPrecipitation\(ctx, \[\.\.\.rectangles, \.\.\.bottomExclusionMasks/);
  assert.match(autumn,/bottomExcludedAt\(rectangles,settings\.bottomEdgeExcludeApps/);
  assert.match(autumn,/drawPile\(ctx,ground,\[\.\.\.rectangles,\.\.\.bottomMasks\]/);
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
