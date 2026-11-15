// All decorative movers are rendered relative to the TOP of the real
// taskbar (or the desktop bottom on a display without a lower taskbar).
// drawPlough() extends +3px past its origin, with up to 2px of shadow.
// drawSanta() renders 216x72 with a 3px vertical bob, so its y is the center.
export const PLOUGH_BOTTOM_EXTENT = 4;
export const SANTA_SPRITE_HALF_HEIGHT = 36;
export const SANTA_BOB_AMPLITUDE = 3;

export function ploughBaselineForFloor(floor) {
  return floor - PLOUGH_BOTTOM_EXTENT;
}

export function santaCenterForFloor(floor) {
  // One pixel of safety keeps even the lowest animated runner on the surface.
  return floor - SANTA_SPRITE_HALF_HEIGHT - SANTA_BOB_AMPLITUDE - 1;
}

export function safeBottomFloor(rectangles, x, height) {
  // Windows workArea excludes the taskbar content; prefer this synthetic
  // rectangle over Shell_TrayWnd bounds which can include frame/shadow insets.
  const workArea = rectangles.find(rect => rect.id === 'taskbar-fallback' &&
    rect.taskbar && x >= rect.left && x < rect.right &&
    rect.top > height * .25 && rect.bottom >= height - 4);
  if (workArea) return workArea.top;
  let top = height;
  for (const rect of rectangles) {
    if (!rect.taskbar || x < rect.left || x >= rect.right) continue;
    // Bottom-docked only: side/top dock taskbars cannot define the bottom floor.
    if (rect.bottom < height - 4 || rect.top < height * 0.25) continue;
    top = Math.min(top, rect.top);
  }
  return top;
}
