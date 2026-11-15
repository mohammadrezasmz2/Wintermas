// Snow settling only on the visible ARTWORK of Windows desktop icons.
// Windows supplies the artwork bounds and 24 alpha top-edge samples.
// The bank is drawn as a few smooth, connected pillows rather than 24
// separate vertical trapezoids (which used to look like a white comb).
export const ICON_PROFILE_COLUMNS = 24;
export const ICON_SNOW_MAX_DEPTH = 6.2;

// An icon's alpha bitmap may contain letters, little holes, and internal
// details far BELOW its upper silhouette. Those are not snowy ledges. Restrict
// snow to the highest visible crest, so it cannot run into the middle of
// Recycle Bin, a monitor screen, or an application's logo.
export function iconUpperContour(icon) {
  if (!icon || !Array.isArray(icon.contour)) return null;
  const ordered = icon.contour.filter(v => Number.isFinite(v) && v >= 0 &&
    v <= 1000).sort((a,b) => a-b);
  if (ordered.length < 3) return null;
  return ordered[Math.floor((ordered.length - 1) * 0.08)];
}

export function iconContactY(icon, x) {
  if (!icon || !Array.isArray(icon.contour) || icon.contour.length < 4 ||
      icon.right <= icon.left || x < icon.left || x >= icon.right) return null;
  const index = Math.min(icon.contour.length - 1,
    Math.max(0, Math.floor((x - icon.left) / (icon.right - icon.left) * icon.contour.length)));
  const sample = icon.contour[index], crest = iconUpperContour(icon);
  if (crest === null || !Number.isFinite(sample) || sample < 0 || sample > 1000) return null;
  const h = icon.bottom - icon.top;
  const drop = (sample - crest) * h / 1000;
  // Shell art sometimes has tall corners, deep logo cutouts and diagonal
  // shoulders.  The old 12-16px tolerance painted those *interior* features
  // and made a jagged snow crown on Recycle Bin and 3D app icons.
  const limit = icon.trusted === false ? 1.8 : Math.min(5.5, Math.max(3.5, h * .065));
  if (drop < -.2 || drop > limit) return null;
  // Stay outside the top visible pixels with a shallow, curved support line.
  // Never let an alpha notch pull a snow cap far down into an application logo.
  const topCrest = icon.top + h * crest / 1000 - 1.6;
  return topCrest + Math.min(2.4, drop * .52);
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
    // The icon's actual opaque edge is a FIXED anchor. Never derive a new
    // anchor from an accumulated snow profile or small UIA rescan jitter.
    const frozenRect = { ...rect, contour: [...rect.contour] };
    pile = { rect: frozenRect, surface: fixedIconSurface(frozenRect),
      profile: new Float32Array(n) };
    piles.set(rect.id, pile);
  }
  const index = Math.min(n - 1, Math.max(0,
    Math.floor((hit.x - rect.left) / (rect.right - rect.left) * n)));
  for (const [offset, weight] of [[0, 1.6],[-1,.56],[1,.56],[-2,.22],[2,.22]]) {
    const i = index + offset;
    if (i < 0 || i >= n || !Number.isFinite(pile.surface[i])) continue;
    pile.profile[i] = Math.min(ICON_SNOW_MAX_DEPTH, pile.profile[i] + amount * weight);
  }
}

export function fixedIconSurface(icon) {
  const n = icon.contour?.length || 0;
  return Array.from({length:n}, (_,i) => iconContactY(icon,
    icon.left + (i+.5) * (icon.right-icon.left) / n));
}

export function iconRectChanged(a, b) {
  if (!a || !b) return true;
  // Explorer accessibility geometry can fluctuate by 1-4 pixels even though
  // the real desktop shortcut has not moved. Compare to the *original*
  // frozen rectangle; accumulate displacement rather than chasing samples.
  const delta = Math.max(Math.abs(a.left-b.left),Math.abs(a.top-b.top),
    Math.abs(a.right-b.right),Math.abs(a.bottom-b.bottom));
  if (delta >= 5.5) return true;
  if (a.contour?.length !== b.contour?.length) return true;
  let substantial=0;
  for (let i=0;i<a.contour.length;i++) {
    const previous=a.contour[i], current=b.contour[i];
    if ((previous<0)!==(current<0) || (previous>=0 && current>=0 &&
        Math.abs(previous-current)>60)) substantial++;
  }
  return substantial>Math.max(4,Math.floor(a.contour.length*.28));
}

export function syncIconSnow(piles, icons, onDisplaced) {
  const current = new Map(icons.map(icon => [icon.id, icon]));
  let changed = false;
  for (const [id, pile] of piles) {
    const next = current.get(id);
    if (!next || iconRectChanged(pile.rect, next)) {
      onDisplaced?.(pile);
      piles.delete(id);
      changed = true;
    }
    // Intentional: do NOT set pile.rect = next. The frozen contact
    // coordinates keep snow stationary while Explorer's UIA bounds jitter.
  }
  return changed;
}

// Split at alpha gaps or steep silhouette changes so a snow cap never draws
// a straight vertical wall down a folder side or through a logo notch.
export function snowCapSegments(rect, profile, fixedSurface = null) {
  const cell = (rect.right - rect.left) / profile.length;
  if (!(cell > 0)) return [];
  const maxStep = Math.min(2.7, Math.max(1.4, cell * 0.85));
  const segments = [];
  let current = [];
  const flush = () => {
    // Short fragments look like icy spikes rather than an organic snow cap.
    if (current.length >= 5) segments.push(current);
    current = [];
  };
  for (let i = 0; i < profile.length; i++) {
    const depth = profile[i];
    const y = fixedSurface ? fixedSurface[i] :
      iconContactY(rect, rect.left + (i + .5) * cell);
    if (!(depth >= .8) || y === null) { flush(); continue; }
    if (current.length && Math.abs(current[current.length - 1].y - y) > maxStep)
      flush();
    current.push({x: rect.left + (i + .5) * cell, y, depth});
  }
  flush();
  return segments.map(segment => {
    // Preserve the calibrated, shallow outer contact edge but remove
    // pixel-scale jaggies from the snow TOP. Round both ends gently.
    return segment.map((point, i) => {
      const a = segment[Math.max(0, i - 2)].depth;
      const b = segment[Math.max(0, i - 1)].depth;
      const c = point.depth;
      const d = segment[Math.min(segment.length - 1, i + 1)].depth;
      const e = segment[Math.min(segment.length - 1, i + 2)].depth;
      const smooth = (a + 2*b + 3*c + 2*d + e) / 9;
      const edge = Math.min(1, (i+1)*.55, (segment.length-i)*.55);
      return {...point, depth: Math.max(.6, Math.min(ICON_SNOW_MAX_DEPTH,
        smooth * edge))};
    });
  });
}

function curvedLine(ctx, points) {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i=1;i<points.length;i++) {
    const last = points[i-1], next = points[i];
    ctx.quadraticCurveTo(last.x, last.y, (last.x+next.x)/2, (last.y+next.y)/2);
  }
  const end=points[points.length-1];
  ctx.lineTo(end.x,end.y);
}

export function paintIconSnow(ctx, piles, now = 0) {
  for (const {rect, profile, surface} of piles.values()) {
    const segments=snowCapSegments(rect, profile, surface);
    for (const segment of segments) {
      const top=segment.map(p=>({x:p.x,y:p.y-p.depth}));
      const bottom=segment.slice().reverse().map(p=>({x:p.x,y:p.y-0.15}));
      const minY=Math.min(...top.map(p=>p.y));
      const maxY=Math.max(...bottom.map(p=>p.y));
      ctx.save();
      ctx.beginPath();
      curvedLine(ctx,top);
      for(let i=0;i<bottom.length;i++) {
        const p=bottom[i];
        if(!i)ctx.lineTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
      }
      ctx.closePath();
      const fill=ctx.createLinearGradient(0,minY,0,Math.max(minY+1,maxY));
      fill.addColorStop(0,'#ffffff');
      fill.addColorStop(.53,'#f2f7ff');
      fill.addColorStop(1,'#c3d4e9');
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle='#ffffffa8';
      ctx.lineWidth=.65;
      ctx.beginPath();
      curvedLine(ctx,top);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Icon drag must be handled on the FIRST mouse movement (usually < 30 ms),
// instead of waiting for the relatively slow UI Automation icon re-scan.
export function createIconDragMonitor() {
  let candidate = null;
  const blocked = new Map();
  return {
    update(pointer, icons, windows, now, release) {
      if (!pointer) return false;
      if (!pointer.pressed) { candidate = null; return false; }
      if (!candidate) {
        // Prefer the icon the cursor is actually clicking, excluding the app
        // windows in front of it. Include the label immediately below artwork.
        if (iconObscuredByWindow(windows,pointer.x,pointer.y)) return false;
        const icon=icons.find(i=>pointer.x>=i.left-5 && pointer.x<i.right+5 &&
          pointer.y>=i.top-3 && pointer.y<i.bottom+28);
        if(icon)candidate={id:icon.id,x:pointer.x,y:pointer.y,moved:false};
        return false;
      }
      if (candidate.moved) { blocked.set(candidate.id,now+650); return false; }
      if (Math.hypot(pointer.x-candidate.x,pointer.y-candidate.y)<5) return false;
      candidate.moved=true;
      blocked.set(candidate.id,now+650);
      release?.(candidate.id);
      return true;
    },
    isBlocked(id, now) { return (blocked.get(id)??0)>now; },
    reset(){candidate=null;blocked.clear();}
  };
}
