// Physics for trees placed or released on the desktop. The anchor position
// is the bottom of the pot; collision is with the window/taskbar TOP edge.
export function dropTreeAt(point, rectangles) {
  const x = point.x, y = point.y;
  // A click inside an application (or near its top) attaches to its top edge,
  // never to an arbitrary spot inside the application surface.
  const window = rectangles.find(rect => !rect.taskbar &&
    x >= rect.left && x < rect.right &&
    y >= rect.top - 10 && y < rect.bottom);
  if (window) return { anchor: { id: window.id, x: x - window.left, y: 0 },
    falling: false, vy: 0, onBottom: false };
  return { anchor: { x, y }, falling: true, vy: 0, onBottom: false };
}

export function fallTree(tree, dt, rectangles, floorAt, resolve) {
  if (!tree?.anchor || tree.anchor.id) return false;
  const point = tree.anchor;
  const floor = floorAt(point.x);
  if (tree.onBottom) {
    // Keep the pot exactly on the taskbar top even after display changes.
    const changed = point.y !== floor;
    point.y = floor;
    return changed;
  }
  if (!tree.falling) return false;
  const previous = point.y;
  tree.vy = Math.min(780, (tree.vy ?? 0) + 620 * Math.max(0, dt));
  const proposed = previous + tree.vy * Math.max(0, dt);
  let target = floor, landedOn = null;
  for (const rect of rectangles) {
    if (rect.taskbar || rect.left > point.x || rect.right <= point.x) continue;
    if (rect.top + 0.5 < previous || rect.top > proposed) continue;
    if (rect.top < target) {
      target = rect.top;
      landedOn = rect;
    }
  }
  if (proposed >= target || previous >= floor) {
    if (landedOn) {
      tree.anchor = { id: landedOn.id, x: point.x - landedOn.left, y: 0 };
      tree.onBottom = false;
    } else {
      point.y = floor;
      tree.onBottom = true;
    }
    tree.vy = 0;
    tree.falling = false;
  } else {
    point.y = Math.min(proposed, floor);
  }
  return true;
}

// Pot image extends at most a pixel below y. Keeping the anchor at floor
// ensures the decoration never enters the reserved taskbar region.
export function treeBottomIsSafe(tree, floorAt, resolve) {
  const point = resolve(tree.anchor);
  return !point || point.y <= floorAt(point.x) + 0.01;
}
