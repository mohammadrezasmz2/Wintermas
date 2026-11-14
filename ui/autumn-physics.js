// Pure helpers: weather velocity, cursor aerodynamics, leaf stacking, blade sweep.
export function advanceLeaf(leaf, dt, wind=0, time=0) {
  const flutter=Math.sin(time*2.7+leaf.phase+leaf.y*.011);
  const sway=Math.sin(time*1.6+leaf.phase*1.8);
  leaf.vx += (wind*1.65+sway*32-leaf.vx*.7)*dt;
  leaf.vy=Math.min(185,leaf.vy+(28+leaf.weight*32)*dt);
  leaf.x+=(leaf.vx+flutter*16)*dt;
  leaf.y+=(leaf.vy+Math.abs(flutter)*9)*dt;
  leaf.angle+=(leaf.spin+flutter*.45)*dt;
  leaf.flip+=dt*(1.6+leaf.weight*.65);
  return leaf;
}

export function pointerImpulse(leaf, point, vx, vy, radius=98) {
  const dx=leaf.x-point.x,dy=leaf.y-point.y;
  const d=Math.hypot(dx,dy);
  if(d>radius) return false;
  const speed=Math.hypot(vx,vy);
  if(speed<45) return false;
  const factor=Math.pow(1-d/radius,1.25);
  // Cursor sweeps leaves along its velocity and creates a lifting vortex.
  leaf.vx=Math.max(-280,Math.min(280,leaf.vx+vx*.17*factor+dx/(d+1)*80*factor));
  leaf.vy=Math.max(-300,Math.min(220,leaf.vy+vy*.11*factor-210*factor));
  leaf.spin=Math.max(-9,Math.min(9,leaf.spin+vx*.005*factor));
  return true;
}

export function sweepLeafItems(items,rect,previousBlade,blade) {
  const from=Math.min(previousBlade,blade)-12;
  const to=Math.max(previousBlade,blade)+16;
  let picked=0;
  for(let i=items.length-1;i>=0;i--) {
    const x=rect.left+items[i].offset;
    if(x+items[i].size*.45<from||x-items[i].size*.45>to) continue;
    picked++;
    items.splice(i,1);
  }
  return picked;
}

export function pileLayer(items,offset) {
  // Local density is the height of the loose leaf pile, not a flat surface.
  let near=0;
  for(const p of items) if(Math.abs(p.offset-offset)<18) near++;
  return Math.min(7,Math.floor(near/4));
}
