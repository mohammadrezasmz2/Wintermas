// Snow resting on *desktop icon artwork*, not on its text label.
// The native helper provides the actual top-edge alpha contour wherever
// Windows can expose the shell icon image. Values are 0..1000 (-1 transparent).
// No filenames, screenshot pixels, or icon images are transferred to Electron.
export const ICON_PROFILE_COLUMNS = 24;
export const ICON_SNOW_MAX_DEPTH = 8.5;

export function iconContactY(icon, x) {
  if (!icon || !Array.isArray(icon.contour) || icon.contour.length < 4 ||
      icon.right <= icon.left || x < icon.left || x >= icon.right) return null;
  const index = Math.min(icon.contour.length - 1,
    Math.max(0, Math.floor((x - icon.left) / (icon.right - icon.left) * icon.contour.length)));
  const sample = icon.contour[index];
  if (!Number.isFinite(sample) || sample < 0 || sample > 1000) return null;
  return icon.top + (icon.bottom - icon.top) * sample / 1000;
}

export function iconObscuredByWindow(windows, x, y) {
  return windows.some(rect => rect.left <= x && x < rect.right &&
    rect.top <= y && y < rect.bottom);
}

export function iconSnowLanding(icons, windows, x0, y0, x1, y1) {
  if (y1 <= y0 || !Array.isArray(icons) || !icons.length) return null;
  let closest = null;
  for (const icon of icons) {
    if (x1 < icon.left || x1 >= icon.right) continue;
    const surface = iconContactY(icon, x1);
    if (surface === null || y0 > surface || y1 < surface) continue;
    const factor = (surface - y0) / (y1 - y0);
    const x = x0 + (x1 - x0) * factor;
    if (x < icon.left || x >= icon.right) continue;
    // A window is above desktop icons regardless of the app z-index; never
    // settle snow on icons that are hidden by an open application.
    if (iconObscuredByWindow(windows, x, surface)) continue;
    if (!closest || surface < closest.y) closest = { icon, x, y: surface };
  }
  return closest;
}

export function preferIconHit(windowHit, iconHit) {
  if (!iconHit) return windowHit;
  if (!windowHit) return iconHit;
  return windowHit.rect.top <= iconHit.y ? windowHit : iconHit;
}

export function placeIconSnow(piles, hit, amount = 1) {
  if (!hit || !hit.icon) return;
  const rect = hit.icon;
  let pile = piles.get(rect.id);
  const n = Math.max(4, rect.contour?.length || ICON_PROFILE_COLUMNS);
  if (!pile || pile.profile.length !== n) {
    pile = { rect, profile: new Float32Array(n) };
    piles.set(rect.id, pile);
  }
  pile.rect = rect;
  const index = Math.min(n - 1, Math.max(0,
    Math.floor((hit.x - rect.left) / (rect.right - rect.left) * n)));
  for (const [offset, weight] of [[0, 1.6],[-1,.56],[1,.56],[-2,.22],[2,.22]]) {
    const i = index + offset;
    if (i < 0 || i >= n || rect.contour[i] < 0) continue;
    pile.profile[i] = Math.min(ICON_SNOW_MAX_DEPTH, pile.profile[i] + amount * weight);
  }
}

export function iconRectChanged(a, b) {
  if (!a || !b) return true;
  if (Math.abs(a.left - b.left) > 2 || Math.abs(a.top - b.top) > 2 ||
    Math.abs(a.right - b.right) > 2 || Math.abs(a.bottom - b.bottom) > 2) return true;
  if (a.contour?.length !== b.contour?.length) return true;
  for (let i = 0; i < a.contour.length; i++)
    if (a.contour[i] !== b.contour[i]) return true;
  return false;
}

export function syncIconSnow(piles, icons, onDisplaced) {
  const current = new Map(icons.map(icon => [icon.id, icon]));
  let changed = false;
  for (const [id, pile] of piles) {
    const next = current.get(id);
    if (!next || iconRectChanged(pile.rect, next)) {
      // Removing or moving a desktop shortcut releases the old powder rather
      // than letting a white blob hang where its artwork used to be.
      onDisplaced?.(pile);
      piles.delete(id);
      changed = true;
    } else pile.rect = next;
  }
  return changed;
}

export function paintIconSnow(ctx, piles, now = 0) {
  for (const pile of piles.values()) {
    const {rect, profile} = pile;
    const cell = (rect.right - rect.left) / profile.length;
    if (cell <= 0) continue;
    for (let i = 0; i < profile.length; i++) {
      const depth = profile[i];
      if (depth < .7 || rect.contour[i] < 0) continue;
      const x = rect.left + i * cell;
      const y = iconContactY(rect, x + cell * .5);
      if (y === null) continue;
      const top = y - depth;
      const gradient = ctx.createLinearGradient(0, top, 0, y + .7);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(.56, '#f0f7ff');
      gradient.addColorStop(1, '#b8cce5');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      // Micro-scopes follow each original icon-alpha strip: round app icons
      // receive curved snow, folders mostly a flatter rim, and thin antennas
      // only collect frost where opaque artwork actually exists.
      ctx.moveTo(x - .45, y + .45);
      ctx.bezierCurveTo(x - .3, y - depth * .56,
        x + cell * .17, top + .3 * Math.sin(i * 2.3 + now*.00003),
        x + cell * .52, top);
      ctx.quadraticCurveTo(x + cell * .92, top + depth * .12,
        x + cell + .45, y + .45);
      ctx.closePath();
      ctx.fill();
    }
  }
}
