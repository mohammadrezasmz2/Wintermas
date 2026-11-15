// Anticipate a title-bar move before the next native window-geometry sample.
// DWM can move a window first and report its new rectangle several ms later;
// old window snow must not be painted floating over the NEW window position.
export function titlebarWindowAt(rectangles, pointer) {
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
  for (const rect of rectangles) {
    if (rect.taskbar) continue;
    const w = rect.right - rect.left, h = rect.bottom - rect.top;
    if (w < 120 || h < 75) continue;
    // Keep away from resize edges, and standard top-right window buttons.
    const inset = Math.min(22, w * .08);
    const band = Math.min(64, Math.max(36, h * .13));
    if (pointer.x < rect.left + inset || pointer.x > rect.right - Math.min(110, w * .16)) continue;
    if (pointer.y < rect.top + 3 || pointer.y > rect.top + band) continue;
    return rect;
  }
  return null;
}

export function draggedEnough(drag, pointer, threshold = 4) {
  return Boolean(drag && pointer &&
    Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) >= threshold);
}

// During a press, suppress even the first stale frame; after release, keep
// the snow hidden briefly until the new desktop coordinates have caught up.
export function hideMovingWindowSnow(id, drag, until, now) {
  return Boolean(id && (drag?.id === id || (until?.get(id) ?? 0) > now));
}
