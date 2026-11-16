import { join, win32 } from 'node:path';
import { normalizeBottomEdgeApps } from './window-exclusions.js';

// Keep new defaults separate from earlier releases that saved startup:false
// without recording whether the user had actually chosen to disable startup.
export const STARTUP_PREFERENCE_VERSION = 1;
export const CAD_EXCLUSIONS_VERSION = 1;

export function migratePreferences(settings, stored = null) {
  const next = { ...settings };
  if (!stored || typeof stored !== 'object') return { settings: next, changed: false };
  let changed = false;
  if (stored.startupPreferenceVersion !== STARTUP_PREFERENCE_VERSION) {
    next.startup = true;
    next.startupPreferenceVersion = STARTUP_PREFERENCE_VERSION;
    changed = true;
  }
  if (stored.cadExclusionsVersion !== CAD_EXCLUSIONS_VERSION) {
    next.bottomEdgeExcludeApps = normalizeBottomEdgeApps([
      ...next.bottomEdgeExcludeApps, 'acad.exe',
    ]);
    next.cadExclusionsVersion = CAD_EXCLUSIONS_VERSION;
    changed = true;
  }
  return { settings: next, changed };
}

export function startupShortcutPath(appData) {
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Wintermas.lnk');
}

export function isWintermasExecutable(target) {
  return typeof target === 'string' && win32.basename(target).toLowerCase() === 'wintermas.exe';
}

export function isLegacyWintermasLoginItem(item) {
  return item?.name?.toLowerCase() === 'wintermas' &&
    item.scope === 'user' && isWintermasExecutable(item.path);
}
