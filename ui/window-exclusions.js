// App-specific opt-out for decorative snow/leaf accumulation along the bottom.
// Matching is exact and case-insensitive; no path or title substring matching.
export function normalizeBottomEdgeApps(value) {
  if (!Array.isArray(value)) return [];
  const names=[];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const item=raw.trim().replace(/\\/g,'/').split('/').pop().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_. -]{0,79}$/.test(item)) continue;
    const normalized=item.endsWith('.exe')?item:item+'.exe';
    if (!names.includes(normalized)) names.push(normalized);
    if (names.length >= 32) break;
  }
  return names;
}

export function isExcludedBottomApp(rect, entries) {
  if (!rect || rect.taskbar || !rect.processName) return false;
  const current=String(rect.processName).trim().toLowerCase();
  const normalized=current.endsWith('.exe')?current:current+'.exe';
  return normalizeBottomEdgeApps(entries).includes(normalized);
}

// A selected CAD window hides the bottom decorations across its horizontal
// footprint, even when its status bar ends a few pixels above the taskbar.
// This is a drawing mask, not a global deletion of the user's accumulated snow.
export function bottomExclusionMasks(rectangles, entries, height) {
  if (!Array.isArray(entries) || !entries.length) return [];
  return rectangles.filter(r=>isExcludedBottomApp(r,entries)).map(rect=>({
    id:'bottom-exclusion-'+rect.id,
    left:rect.left, right:rect.right, top:0,
    bottom:height+64, taskbar:false
  }));
}
export function bottomExcludedAt(rectangles, entries, x) {
  return rectangles.some(rect=>x>=rect.left && x<rect.right &&
    isExcludedBottomApp(rect,entries));
}
