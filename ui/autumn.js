// Independent Autumn engine: natural leaf sprites, fall/flutter, window/taskbar
// piles, plough pickup, and mouse vortex interaction. No snow/rain state is shared.
import { landing, bottomTaskbarAt } from './geometry.js';
import { clipPrecipitation } from './precipitation-mask.js';
import { iconSnowLanding, preferIconHit, iconContactY, iconRectChanged } from './desktop-icon-snow.js';
import { createLeafSprites, drawLeaf, drawAutumnMound } from './autumn-art.js';
import { advanceLeaf, pointerImpulse, sweepLeafItems, pileLayer,
  settledLeafOffset, leafPileProfile, settledLeafVisualSize } from './autumn-physics.js';

const random=(min,max)=>min+Math.random()*(max-min);
const MAX_LEAVES=320, MAX_PILE=460;
const COLUMN=6;

export function createAutumn() {
  let width=0,height=0,time=0,fraction=0,ready=false;
  let falling=[],rectangles=[],taskbars=[],piles=new Map();
  let desktopIcons=[],iconLeaves=new Map();
  let cursor={x:-10000,y:-10000};
  let sprites;

  function spritesReady() { return sprites ??= createLeafSprites(); }
  function floorAt(x) {
    return bottomTaskbarAt(taskbars,x,height) ??
      {id:'ground',left:0,right:width,top:height,bottom:height+1};
  }
  function makeLeaf(y) {
    return {
      x:random(-20,width+20),y:y??random(-70,-10),
      vx:random(-30,30),vy:random(18,75),
      size:random(7.5,16.5),variant:Math.floor(random(0,12)),
      angle:random(-Math.PI,Math.PI),flip:random(0,Math.PI*2),
      spin:random(-2.5,2.5),phase:random(0,Math.PI*2),
      weight:random(.3,1.5),
    };
  }
  function makePile(rect) {
    let pile=piles.get(rect.id);
    if(!pile) {
      pile={rect,items:[]};
      piles.set(rect.id,pile);
    }
    return pile;
  }
  function settle(leaf,rect,x) {
    if(rect.taskbar && !taskbars.some(t=>t.id===rect.id)) return;
    const pile=makePile(rect);
    // Replace only the oldest settled leaf if pile budget is exhausted.
    if(pile.items.length>=MAX_PILE) pile.items.shift();
    const offset=settledLeafOffset(pile.items,x-rect.left,rect.right-rect.left,Math.random());
    pile.items.push({
      offset,size:leaf.size*random(.94,1.16),variant:leaf.variant,
      angle:random(-2.4,2.4),
      layer:pileLayer(pile.items,offset),
      flip:random(-.55,.55),
    });
  }
  function clearIconLeaves() { iconLeaves.clear(); desktopIcons=[]; }
  function clear() {
    falling=[]; piles.clear(); clearIconLeaves(); fraction=0;ready=false;
    time=0;
    cursor={x:-10000,y:-10000};
  }
  function resize(w,h) {
    width=w;height=h;
    // Old coordinates are not reliable after a monitor/DPI change.
    clear();
    spritesReady();
  }
  function syncGeometry(next,minimized=[],icons=[]) {
    rectangles=next;
    taskbars=rectangles.filter(r=>r.taskbar);
    desktopIcons=icons;
    const availableIcons = new Map(icons.map(icon=>[icon.id,icon]));
    for(const [id,pile] of iconLeaves) {
      const nextIcon=availableIcons.get(id);
      if(!nextIcon || iconRectChanged(pile.icon,nextIcon)) {
        // Moved or removed shortcuts shake their leaves loose.
        if(nextIcon) for(const item of pile.items) {
          if(falling.length>=MAX_LEAVES) break;
          const leaf=makeLeaf(pile.icon.top-8);
          leaf.x=item.x;leaf.size=item.size;leaf.variant=item.variant;
          leaf.vx=random(-80,80);leaf.vy=-random(35,85);
          falling.push(leaf);
        }
        iconLeaves.delete(id);
      }
    }
    const byId=new Map(rectangles.map(r=>[r.id,r]));
    for(const [id,pile] of piles) {
      if(id==='ground') continue;
      const nextRect=byId.get(id);
      if(!nextRect) {
        if(minimized.includes(id)) {
          // Real leaf shower: each leaf falls separately from last visible rim.
          for(const item of pile.items) {
            if(falling.length>=MAX_LEAVES) break;
            const leaf=makeLeaf(pile.rect.top-12-item.layer*2.1);
            leaf.x=pile.rect.left+item.offset;
            leaf.variant=item.variant;leaf.size=item.size;
            leaf.vx=random(-100,100);leaf.vy=random(-90,-15);
            falling.push(leaf);
          }
        }
        piles.delete(id);
        continue;
      }
      const dx=nextRect.left-pile.rect.left,dy=nextRect.top-pile.rect.top;
      // Leaf piles follow gently moved windows, but shake loose on a quick yank.
      if((Math.abs(dx)>24||Math.abs(dy)>16) && !nextRect.taskbar) {
        for(let i=pile.items.length-1;i>=0;i--) {
          if(Math.random()>.34||falling.length>=MAX_LEAVES) continue;
          const item=pile.items.splice(i,1)[0];
          const leaf=makeLeaf(Math.min(pile.rect.top,nextRect.top)-10-item.layer*2.1);
          leaf.x=nextRect.left+item.offset;
          leaf.size=item.size;leaf.variant=item.variant;
          leaf.vx=random(-90,90)-dx*1.8;leaf.vy=random(-110,-35);
          falling.push(leaf);
        }
      }
      pile.rect=nextRect;
      // Crop settled leaves if the user's window was resized.
      const span=nextRect.right-nextRect.left;
      pile.items=pile.items.filter(p=>p.offset>=0&&p.offset<span);
    }
  }
  function settleIcon(leaf, hit) {
    const icon=hit.icon;
    let pile=iconLeaves.get(icon.id);
    if(!pile) { pile={icon:{...icon,contour:[...icon.contour]},items:[]};iconLeaves.set(icon.id,pile); }
    if(pile.items.length>=16) pile.items.shift();
    pile.items.push({
      x:hit.x,variant:leaf.variant,size:Math.min(10.5,Math.max(5.5,leaf.size*.70)),
      angle:random(-1.1,1.1),offset:random(-1.8,1.8)
    });
  }

  function onPointer(next,dt) {
    if(!next||!Number.isFinite(next.x)||!Number.isFinite(next.y)) return;
    const old=cursor;cursor={x:next.x,y:next.y};
    const dx=next.x-old.x,dy=next.y-old.y;
    if(old.x<0||old.y<0||Math.abs(dx)>350||Math.abs(dy)>350) return;
    const interval=Math.max(.012,dt||.016);
    const vx=Math.max(-900,Math.min(900,dx/interval));
    const vy=Math.max(-900,Math.min(900,dy/interval));
    const speed=Math.hypot(vx,vy);
    if(speed<45) return;
    // Movement swirls already falling leaves in either direction.
    for(const leaf of falling) pointerImpulse(leaf,next,vx,vy,115);
    if(speed>105) for(const pile of iconLeaves.values()) {
      for(let i=pile.items.length-1;i>=0;i--) {
        const item=pile.items[i];
        const y=iconContactY(pile.icon,item.x);
        if(y===null||Math.hypot(next.x-item.x,next.y-y)>48||Math.random()>.5)continue;
        pile.items.splice(i,1);
        if(falling.length>=MAX_LEAVES) continue;
        const leaf=makeLeaf(y-5);leaf.x=item.x;
        leaf.size=item.size;leaf.variant=item.variant;
        leaf.vx=Math.max(-240,Math.min(240,vx*.25+random(-40,40)));
        leaf.vy=-random(80,200);
        falling.push(leaf);
      }
    }
    if(speed<105) return;
    let lofted=0;
    for(const pile of piles.values()) {
      const rect=pile.rect;
      const vertical=Math.abs(next.y-rect.top);
      if(vertical>78||next.x<rect.left-85||next.x>rect.right+85) continue;
      for(let i=pile.items.length-1;i>=0&&lofted<22;i--) {
        const item=pile.items[i],x=rect.left+item.offset;
        const distance=Math.hypot(x-next.x,rect.top-item.layer*2.1-next.y);
        if(distance>95||Math.random()>.52) continue;
        pile.items.splice(i,1);
        if(falling.length>=MAX_LEAVES) continue;
        const leaf=makeLeaf(rect.top-5-item.layer*2.1);
        leaf.x=x;
        leaf.variant=item.variant;leaf.size=item.size;
        leaf.angle=item.angle;
        leaf.vx=Math.max(-270,Math.min(270,vx*.27+random(-68,68)));
        leaf.vy=-random(105,255)+Math.min(0,vy*.17);
        falling.push(leaf);lofted++;
      }
    }
  }
  function update(dt,settings) {
    if(!settings.enabled||settings.weather!=='autumn'||settings.paused) return;
    const speed=Math.min(2.5,Math.max(.25,(settings.autumnSpeed??100)/100));
    const step=dt*speed;
    time+=step;
    const target=Math.max(8,Math.min(MAX_LEAVES,
      Math.round(width*height/7000*(settings.intensity??65)/100)));
    if(!ready) {
      ready=true;
      for(let i=0;i<target*.7;i++) falling.push(makeLeaf(random(-30,height)));
    }
    fraction+=step*(5+target*.105);
    while(fraction>=1) {
      fraction--;
      if(falling.length<target) falling.push(makeLeaf());
    }
    const wind=(settings.wind??0)*1.65;
    let kept=0;
    for(let i=0;i<falling.length;i++) {
      const leaf=falling[i];
      const x0=leaf.x,y0=leaf.y;
      advanceLeaf(leaf,step,wind,time);
      const hit=preferIconHit(
        landing(rectangles,x0,y0,leaf.x,leaf.y,settings.taskbar),
        settings.iconsAutumn ?
          iconSnowLanding(desktopIcons,rectangles,x0,y0,leaf.x,leaf.y):null);
      if(hit) {
        if(hit.icon) settleIcon(leaf,hit);
        else settle(leaf,hit.rect,hit.x);
        continue;
      }
      if(leaf.y>=height && y0<=height) {
        const floor=floorAt(leaf.x);
        if(floor.id==='ground'||settings.taskbar) settle(leaf,floor,leaf.x);
        continue;
      }
      if(leaf.x<-65) leaf.x+=width+130;
      else if(leaf.x>width+65) leaf.x-=width+130;
      if(leaf.y<height+45) falling[kept++]=leaf;
    }
    falling.length=kept;
  }
  function drawPile(ctx,pile,covers,now) {
    if(!pile.items.length) return;
    const rect=pile.rect,span=rect.right-rect.left;
    if(span<=0) return;
    ctx.save();
    // No leaf textures are ever painted into window or taskbar content.
    ctx.beginPath();
    ctx.rect(-120,-120,width+240,Math.max(0,rect.top+120));
    ctx.clip();
    for(const cover of covers) {
      if(cover.right<=rect.left||cover.left>=rect.right||
        cover.bottom<=rect.top-45||cover.top>=rect.top+1) continue;
      ctx.beginPath();
      ctx.rect(-120,-120,width+240,height+240);
      ctx.rect(cover.left,cover.top,cover.right-cover.left,cover.bottom-cover.top);
      ctx.clip('evenodd');
    }

    const {step,heights}=leafPileProfile(pile.items,span);
    let crest=0;
    for(const h of heights) crest=Math.max(crest,h);
    if(crest>1.1) {
      // Density-based, tapered irregular foundation: no uniform flat stripe.
      ctx.beginPath();
      ctx.moveTo(rect.left,rect.top+1);
      ctx.lineTo(rect.left,rect.top-heights[0]);
      for(let i=1;i<heights.length;i++) {
        const prev=rect.left+Math.min(span,(i-1)*step);
        const x=rect.left+Math.min(span,i*step);
        ctx.quadraticCurveTo((prev+x)*.5,rect.top-heights[i-1],
          x,rect.top-heights[i]);
      }
      ctx.lineTo(rect.right,rect.top+1);
      ctx.closePath();
      const fill=ctx.createLinearGradient(0,rect.top-crest-2,0,rect.top+2);
      fill.addColorStop(0,'#d4a04e');
      fill.addColorStop(.38,'#a96a32');
      fill.addColorStop(.72,'#754325');
      fill.addColorStop(1,'#3d291f');
      ctx.fillStyle=fill;
      ctx.fill();
    }
    const atlas=spritesReady();
    // Small, flattened, overlapping leaves: visually stacked on the foundation.
    for(const item of pile.items) {
      const x=rect.left+item.offset;
      if(x<-32||x>width+32)continue;
      const bin=Math.max(0,Math.min(heights.length-1,Math.floor(item.offset/step)));
      const rise=Math.min(heights[bin]+5,3+(item.layer??0)*3.0);
      const y=rect.top-1-rise;
      const size=settledLeafVisualSize(item.size,item.layer);
      drawLeaf(ctx,atlas[item.variant],x,y,size,item.angle,item.flip,
        .86+Math.min(.12,(item.layer??0)*.02),.78);
    }
    ctx.restore();
  }

  function paint(ctx,now) {
    const atlas=spritesReady();
    ctx.save();
    // Exactly like snow and rain, FALLING leaves are hidden behind app surfaces.
    clipPrecipitation(ctx,rectangles,width,height);
    for(const leaf of falling) {
      drawLeaf(ctx,atlas[leaf.variant],leaf.x,leaf.y,leaf.size,
        leaf.angle,leaf.flip,.92);
    }
    ctx.restore();
    // Leaves sitting on exposed desktop icon artwork: tiny caps, not labels.
    if(iconLeaves.size) {
      ctx.save();
      clipPrecipitation(ctx,rectangles,width,height);
      for(const pile of iconLeaves.values()) {
        for(const item of pile.items) {
          const y=iconContactY(pile.icon,item.x);
          if(y===null)continue;
          drawLeaf(ctx,atlas[item.variant],item.x+item.offset,
            y-item.size*.28,item.size,item.angle,0,.88,.86);
        }
      }
      ctx.restore();
    }
    // Settled leaves are visible on the TOP edges only; obey z-order.
    const ground=piles.get('ground');
    if(ground) drawPile(ctx,ground,rectangles,now);
    for(let i=rectangles.length-1;i>=0;i--) {
      const rect=rectangles[i];
      const pile=piles.get(rect.id);
      if(pile) drawPile(ctx,pile,rectangles.slice(0,i),now);
    }
  }
  function sweep(previousBlade,blade) {
    let gathered=0;
    for(const pile of piles.values()) {
      if(!pile.rect.taskbar && pile.rect.id!=='ground') continue;
      gathered+=sweepLeafItems(pile.items,pile.rect,previousBlade,blade);
    }
    return gathered;
  }
  function needsSweep() {
    let n=0;
    for(const pile of piles.values()) if(pile.rect.taskbar||pile.rect.id==='ground') n+=pile.items.length;
    return n>=110;
  }
  return {
    resize,clear,syncGeometry,onPointer,update,paint,sweep,needsSweep,clearIconLeaves,
    active:()=>falling.length>0||iconLeaves.size>0||[...piles.values()].some(p=>p.items.length>0),
    fast:()=>falling.length>0,
    drawMound:(ctx,x,y,load,now)=>drawAutumnMound(ctx,spritesReady(),x,y,load,now),
    stats:()=>({falling:falling.length,settled:[...piles.values()].reduce((s,p)=>s+p.items.length,0),
      iconLeaves:[...iconLeaves.values()].reduce((s,p)=>s+p.items.length,0),
      piles:piles.size}),
  };
}
