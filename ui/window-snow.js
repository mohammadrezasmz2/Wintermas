// Snow on a former window ledge must become falling powder BEFORE the
// associated pile is deleted. The window can disappear from Win32 geometry
// because it was closed, minimised, or hidden by the owning application.
// It must not silently take its snow with it.
export function shouldReleaseWindowSnow(pile, nextRect, settings) {
  return Boolean(pile && pile.rect && !pile.rect.taskbar && !nextRect &&
    settings?.weather === 'snow' && settings.enabled && !settings.paused);
}


// A maximized / fullscreen application covers almost the entire display's
// usable desktop. A work-area-maximized window stops above the taskbar.
export function isFullscreenSnowWindow(rect, width, height) {
  if (!rect || rect.taskbar || !(width > 0 && height > 0)) return false;
  const margin = Math.min(24, width * 0.03, height * 0.04);
  return rect.left <= margin && rect.top <= margin &&
    rect.right >= width - margin &&
    rect.bottom >= height * 0.85 &&
    rect.right - rect.left >= width * 0.95 &&
    rect.bottom - rect.top >= height * 0.85;
}

// Turn a fullscreen ridge into a light, time-spread snowfall instead of one
// instantaneous mass release. Individual flakes use the normal snow engine,
// so they never become oversized chunks when the window disappears.
export function planFullscreenSnowfall(pile, columnWidth = 6) {
  if (!pile?.profile?.length || !pile.rect) return [];
  const groups = [];
  const step = 3;
  for (let start = 0; start < pile.profile.length; start += step) {
    let mass = 0;
    let weightedX = 0;
    for (let i = start; i < Math.min(start + step, pile.profile.length); i++) {
      const depth = Math.max(0, pile.profile[i]);
      mass += depth;
      weightedX += (i + 0.5) * depth;
    }
    if (mass < 1.2) continue;
    groups.push({
      x: pile.rect.left + columnWidth * weightedX / mass,
      y: pile.rect.top - Math.min(12, mass / step) - 4,
      count: Math.min(3, Math.max(1, Math.ceil(mass / 14))),
    });
  }
  // Low-discrepancy timing distributes flakes across the width instead of
  // sending a visible left-to-right wall of snow.
  return groups.map((group, index) => ({
    ...group, delay: ((index * 0.61803398875) % 1) * 2600,
  })).sort((a, b) => a.delay - b.delay);
}
