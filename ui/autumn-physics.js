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

// A falling leaf tends to slide a few pixels into a nearby loose cluster.
// Limit this movement to avoid conspicuous jumps after window drags.
export function settledLeafOffset(items, offset, span, randomValue=.5) {
  const clamp = n => Math.max(0, Math.min(Math.max(0,span-1), n));
  let sum=0, weight=0;
  for(let i=items.length-1;i>=0;i--) {
    const distance=Math.abs(items[i].offset-offset);
    if(distance>=27)continue;
    const w=1-distance/27;
    sum+=items[i].offset*w;
    weight+=w;
  }
  const center=weight>1.1?offset*.67+(sum/weight)*.33:offset;
  return clamp(center+(Math.max(0,Math.min(1,randomValue))-.5)*11);
}

// Heightfield for an irregular pile: sparse areas taper to nothing while
// dense clusters build rounded ridges. A linear row never becomes a solid bar.
export function leafPileProfile(items, width, step=9) {
  const bins = new Float32Array(Math.max(2,Math.ceil(width/step)+1));
  for(const item of items) {
    const position=Math.max(0,Math.min(bins.length-1.001,item.offset/step));
    const i=Math.floor(position),blend=position-i;
    bins[i]+=1-blend;
    if(i+1<bins.length)bins[i+1]+=blend;
  }
  const heights=new Float32Array(bins.length);
  for(let i=0;i<bins.length;i++) {
    const density=(bins[i]??0)*.42+
      (bins[i-1]??0)*.23+(bins[i+1]??0)*.23+
      (bins[i-2]??0)*.06+(bins[i+2]??0)*.06;
    const height=Math.max(0,density*3.5-1.2);
    const waviness=.86+.14*Math.cos(i*1.67);
    const edge=Math.min(1,(i+.15)*.65,(bins.length-i-.15)*.65);
    heights[i]=Math.min(22,height*waviness*Math.max(0,edge));
  }
  return {step,heights};
}
