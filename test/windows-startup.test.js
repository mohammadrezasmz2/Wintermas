import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  migratePreferences, startupShortcutPath, isWintermasExecutable,
  isLegacyWintermasLoginItem,
} from '../ui/startup-config.js';

const previous = {
  startup: false, startupPreferenceVersion: 1, cadExclusionsVersion: 1,
  weather: 'rain', enabled: true, paused: false,
  bottomEdgeExcludeApps: ['sldworks.exe'],
};

test('migrate old installations whose saved startup:false came from the previous default', () => {
  const old = { startup: false, weather: 'autumn', bottomEdgeExcludeApps: ['sldworks.exe'] };
  const { settings, changed } = migratePreferences(previous, old);
  assert.equal(changed, true);
  assert.equal(settings.startup, true);
  assert.equal(settings.weather, 'rain');
  assert.deepEqual(settings.bottomEdgeExcludeApps, ['sldworks.exe', 'acad.exe']);
  assert.equal(settings.startupPreferenceVersion, 1);
  assert.equal(settings.cadExclusionsVersion, 1);
  assert.equal(previous.startup, false, 'do not mutate the input');
});

test('keep a user disabling startup after this migration and keep custom app exclusions', () => {
  const newer = { ...previous, bottomEdgeExcludeApps: ['sldworks.exe', 'inventor.exe'] };
  const { settings, changed } = migratePreferences(newer, {
    startup: false, startupPreferenceVersion: 1,
    cadExclusionsVersion: 1, bottomEdgeExcludeApps: ['sldworks.exe', 'inventor.exe'],
  });
  assert.equal(changed, false);
  assert.equal(settings.startup, false);
  assert.deepEqual(settings.bottomEdgeExcludeApps, ['sldworks.exe', 'inventor.exe']);
});

test('add AutoCAD to existing custom exclusion lists once without deleting existing entries', () => {
  const { settings } = migratePreferences(previous, {
    startupPreferenceVersion: 1, cadExclusionsVersion: 0,
  });
  assert.deepEqual(settings.bottomEdgeExcludeApps, ['sldworks.exe', 'acad.exe']);
  const already = migratePreferences({
    ...previous, bottomEdgeExcludeApps: ['sldworks.exe', 'acad.exe'],
  }, { startupPreferenceVersion: 1, cadExclusionsVersion: 1 });
  assert.equal(already.changed, false);
});

test('shortcut management only recognizes the Wintermas app and never foreign startup keys', () => {
  const shortcut = startupShortcutPath('C:/Users/Example/AppData/Roaming');
  assert.ok(shortcut.endsWith('Wintermas.lnk'));
  assert.ok(shortcut.includes('Startup'));
  assert.equal(isWintermasExecutable('C:\\Apps\\Wintermas.exe'), true);
  assert.equal(isWintermasExecutable('C:\\Apps\\DifferentApp.exe'), false);
  assert.equal(isLegacyWintermasLoginItem({
    name: 'Wintermas', scope: 'user', path: 'C:\\Apps\\Wintermas.exe',
  }), true);
  assert.equal(isLegacyWintermasLoginItem({
    name: 'DifferentApp', scope: 'user', path: 'C:\\Apps\\Wintermas.exe',
  }), false);
  assert.equal(isLegacyWintermasLoginItem({
    name: 'Wintermas', scope: 'machine', path: 'C:\\Apps\\Wintermas.exe',
  }), false);
  assert.equal(isLegacyWintermasLoginItem({
    name: 'Wintermas', scope: 'user', path: 'C:\\Apps\\DifferentApp.exe',
  }), false);
});

test('startup registration writes only a shortcut and removes at most the named legacy own-key', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(main, /shell\.writeShortcutLink\(shortcut, 'create'/);
  assert.match(main, /isWintermasExecutable\(shell\.readShortcutLink\(shortcut\)\.target\)/);
  assert.match(main, /\(old\.launchItems \?\? \[\]\)\.some\(isLegacyWintermasLoginItem\)/);
  assert.match(main, /name: 'Wintermas', openAtLogin: false/);
  assert.doesNotMatch(main, /openAtLogin: true/);
  const panel = await readFile(new URL('../ui/panel.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
  assert.match(index, /id="startup"/);
  assert.match(panel, /update\(\{ startup: id\('startup'\)\.checked \}\)/);
});
