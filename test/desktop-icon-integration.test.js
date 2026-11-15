import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('desktop icon positions and silhouette are read safely without process injection',async()=>{
 const native=await readFile(new URL('../native/DesktopIcons.cs',import.meta.url),'utf8');
 const source=await readFile(new URL('../native/Desktop.cs',import.meta.url),'utf8');
 const build=await readFile(new URL('../scripts/build-native.js',import.meta.url),'utf8');
 assert.match(native,/AutomationElement\.FromHandle\(listView\)/);
 assert.match(native,/SHGetFileInfo\(/);
 assert.match(native,/GetPixel\(x, y\)\.A >= 85/);
 assert.doesNotMatch(native,/VirtualAllocEx|WriteProcessMemory|OpenProcess\(/);
 assert.match(source,/DesktopIcons\.Snapshot\(\)/);
 assert.match(build,/DesktopIcons\.cs/);
 assert.match(build,/UIAutomationClient\.dll/);
});

test('Electron forwards icon bounds and only alpha profiles to each display',async()=>{
 const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
 assert.match(main,/desktopIcons\.push\(\{ id: 'desktop-icon-'/);
 assert.match(main,/contour: icon\.contour/);
 assert.match(main,/icons: desktopIcons/);
 assert.doesNotMatch(main,/icon\.name/);
});

test('snow supports independent silhouette banks and does not draw through apps',async()=>{
 const overlay=await readFile(new URL('../ui/overlay.js',import.meta.url),'utf8');
 assert.match(overlay,/iconSnowLanding\(desktopIcons, rectangles/);
 assert.match(overlay,/if \(hit\.icon\) placeIconSnow\(iconPiles, hit\)/);
 assert.match(overlay,/clipPrecipitation\(ctx, rectangles, width, height\);\s*paintIconSnow/);
 assert.match(overlay,/iconPiles\.clear\(\)/);
});
