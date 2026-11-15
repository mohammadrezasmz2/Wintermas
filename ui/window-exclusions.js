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

// Determine which APP is actually visible along the lower desktop edge.
// EnumWindows/rectangles are ordered front-to-back; do not let a hidden
// SolidWorks window suppress the plough when another maximized app covers it.
import { safeBottomFloor } from './taskbar-actors.js';

export function bottomExclusionMasks(rectangles, entries, height) {
  const excluded=normalizeBottomEdgeApps(entries);
  if (!excluded.length || !rectangles.length) return [];
  const boundaries=new Set();
  for (const rect of rectangles) {
    if (rect.taskbar) continue;
    boundaries.add(Math.max(0,rect.left));
    boundaries.add(Math.max(0,rect.right));
  }
  const xs=[...boundaries].filter(Number.isFinite).sort((a,b)=>a-b);
  const masks=[];
  for(let i=0;i<xs.length-1;i++){
    const left=xs[i],right=xs[i+1],x=(left+right)/2;
    if (right-left<.1) continue;
    const floor=safeBottomFloor(rectangles,x,height);
    // Some app frames stop a handful of pixels before the work-area edge.
    // Treat the closest visible app within 55px of that edge as foreground.
    const first=rectangles.find(r=>!r.taskbar&&
      x>=r.left && x<r.right && r.top<floor &&
      r.bottom>=floor-55);
    if (!first || !isExcludedBottomApp(first,excluded)) continue;
    const previous=masks[masks.length-1];
    if(previous && Math.abs(previous.right-left)<.1){
      previous.right=right;
    } else {
      masks.push({id:'bottom-exclusion-'+first.id,
        left,right,top:0,bottom:height+64,taskbar:false});
    }
  }
  return masks;
}

export function bottomExcludedAt(rectangles, entries, x, height) {
  const inferredHeight=height??Math.max(1,...rectangles.map(r=>r.bottom));
  return bottomExclusionMasks(rectangles,entries,inferredHeight)
    .some(r=>x>=r.left&&x<r.right);
}

export function bottomMaskedAt(masks,x) {
  return masks.some(mask=>x>=mask.left&&x<mask.right);
}
