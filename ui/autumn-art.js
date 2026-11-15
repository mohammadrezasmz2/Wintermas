// Warm, individually textured autumn leaves. The sprite atlas is rendered once
// at high resolution so tiny falling leaves keep delicate veins and natural edges.
const PALETTES = [
  ['#eda52d', '#fbe08a', '#b65e21', '#77401c'],
  ['#d66d21', '#f5b146', '#91391e', '#7d311d'],
  ['#b64123', '#e97b37', '#762c20', '#53281d'],
  ['#e8b83f', '#ffdf7e', '#a87525', '#684321'],
  ['#9d5726', '#c88b39', '#61381e', '#432a1b'],
  ['#d97f2b', '#f9c15d', '#9d411b', '#5c3920'],
];
const SIZE = 128;
function rand(seed) {
  let n = seed | 0;
  return () => {
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}

// Five broad, asymmetrical lobes attached to one long petiole. The previous
// nine narrow radial points looked like a yellow sun rather than a real maple.
function maple(ctx) {
  ctx.moveTo(0, -44);
  ctx.bezierCurveTo(7,-34,9,-25,10,-19);
  ctx.bezierCurveTo(15,-25,21,-30,27,-31);
  ctx.bezierCurveTo(26,-24,22,-17,19,-12);
  ctx.bezierCurveTo(26,-13,33,-13,40,-9);
  ctx.bezierCurveTo(35,-1,28,5,18,9);
  ctx.bezierCurveTo(20,15,17,23,9,29);
  ctx.bezierCurveTo(5,26,3,31,1,37);
  ctx.bezierCurveTo(-3,32,-6,27,-9,24);
  ctx.bezierCurveTo(-17,24,-19,16,-17,9);
  ctx.bezierCurveTo(-26,6,-35,0,-38,-7);
  ctx.bezierCurveTo(-34,-12,-27,-12,-20,-11);
  ctx.bezierCurveTo(-24,-17,-27,-24,-25,-30);
  ctx.bezierCurveTo(-19,-29,-14,-24,-9,-19);
  ctx.bezierCurveTo(-9,-27,-5,-38,0,-44);
  ctx.closePath();
}

function oval(ctx) {
  ctx.moveTo(0,-45);
  ctx.bezierCurveTo(26,-40,37,-15,30,10);
  ctx.bezierCurveTo(24,27,9,35,0,42);
  ctx.bezierCurveTo(-13,31,-28,20,-32,4);
  ctx.bezierCurveTo(-39,-17,-25,-41,0,-45);
  ctx.closePath();
}
function oak(ctx) {
  ctx.moveTo(0,-43);
  ctx.bezierCurveTo(18,-42,13,-31,23,-28);
  ctx.bezierCurveTo(41,-27,32,-16,34,-10);
  ctx.bezierCurveTo(42,0,30,8,31,15);
  ctx.bezierCurveTo(31,27,14,24,11,35);
  ctx.quadraticCurveTo(5,40,0,42);
  ctx.bezierCurveTo(-8,34,-22,36,-21,23);
  ctx.bezierCurveTo(-36,21,-35,13,-28,4);
  ctx.bezierCurveTo(-37,-9,-30,-15,-24,-20);
  ctx.bezierCurveTo(-32,-33,-17,-36,-13,-33);
  ctx.quadraticCurveTo(-5,-46,0,-43);
  ctx.closePath();
}
export function createLeafSprites() {
  const paths = [maple, oval, oak];
  const sprites = [];
  for (let i=0; i<12; i++) {
    const sprite=document.createElement('canvas');
    sprite.width=sprite.height=SIZE;
    const ctx=sprite.getContext('2d');
    const rnd=rand(733+i*97);
    const shades=PALETTES[i%PALETTES.length];
    ctx.translate(SIZE/2,SIZE/2);
    // A slight irregular lean breaks the identical radial silhouette.
    ctx.rotate(Math.sin(i*3.31)*.055);
    ctx.scale(i%4===0?.97:1.02,1.01);
    ctx.shadowColor='#35170f77'; ctx.shadowBlur=5;
    ctx.shadowOffsetX=1; ctx.shadowOffsetY=2;
    ctx.beginPath(); paths[i%3](ctx);
    const pigment=ctx.createLinearGradient(-32,-44,30,42);
    pigment.addColorStop(0,shades[1]);
    pigment.addColorStop(.36,shades[0]);
    pigment.addColorStop(.71,shades[2]);
    pigment.addColorStop(1,shades[3]);
    ctx.fillStyle=pigment; ctx.fill();
    ctx.shadowColor='transparent';ctx.shadowBlur=0;
    ctx.save();ctx.clip();
    // Veined translucent pigments: blotches and fine freckles keep foliage
    // textured rather than an icon-like solid colour.
    for(let n=0;n<210;n++) {
      const x=rnd()*78-39,y=rnd()*80-40;
      ctx.fillStyle=n%3===0?'#fff4ac1e':n%3===1?'#52211120':'#e05b172e';
      ctx.beginPath();ctx.ellipse(x,y,.5+rnd()*4,.4+rnd()*2.7,
        rnd()*Math.PI,0,Math.PI*2);ctx.fill();
    }
    ctx.lineCap='round';
    ctx.strokeStyle='#fff3b274';ctx.lineWidth=1.65;
    ctx.beginPath();ctx.moveTo(0,38);ctx.quadraticCurveTo(-3,-1,0,-40);ctx.stroke();
    ctx.strokeStyle='#78361f99';ctx.lineWidth=.9;
    ctx.beginPath();ctx.moveTo(1,39);ctx.quadraticCurveTo(1,0,2,-35);ctx.stroke();
    for(let n=0;n<7;n++) {
      const y=-32+n*9, x=(n%2 ? -1 : 1)*(12+n*.7);
      ctx.strokeStyle=n%2?'#fff5ca7f':'#80321f99';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,y+4);
      ctx.quadraticCurveTo(x*.48,y-5,x,y-14);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,y+7);
      ctx.quadraticCurveTo(-x*.53,y-2,-x,y-12);ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle='#fff1bd69';ctx.lineWidth=.9;
    ctx.beginPath();paths[i%3](ctx);ctx.stroke();
    // Stem ends at a point; do not add a rectangular sprite background.
    ctx.strokeStyle=shades[3];ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(0,34);ctx.quadraticCurveTo(3,45,5,50);ctx.stroke();
    sprites.push(sprite);
  }
  return sprites;
}
export function drawLeaf(ctx, sprite, x, y, size, angle, flip=0, alpha=1, squash=1) {
  if (!sprite || size<=0) return;
  ctx.save(); ctx.globalAlpha*=alpha;
  ctx.translate(x,y);ctx.rotate(angle);
  ctx.scale(.36+.64*Math.abs(Math.cos(flip)),squash);
  const diameter=size*2.55;
  ctx.drawImage(sprite,-diameter/2,-diameter/2,diameter,diameter);
  ctx.restore();
}
export function drawAutumnMound(ctx, sprites, x, y, load, now) {
  if (load < 2 || !sprites.length) return;
  const fullness = Math.min(1, load / 1800);
  const length = 18 + 78 * Math.sqrt(fullness);
  const peak = 7 + 19 * Math.sqrt(fullness);
  ctx.save();
  ctx.translate(x, y);
  // The right edge is at the actual blade contact (-36, -20 to 0).
  // A continuous foundation closes the air gap above and below the blade.
  ctx.beginPath();
  ctx.moveTo(-35, 1);
  ctx.lineTo(-35, -Math.min(23, 12 + peak * .46));
  ctx.bezierCurveTo(-42, -peak - 2, -56, -peak - 2, -68, -peak * .82);
  ctx.bezierCurveTo(-80 - length * .19, -peak * .6,
    -34 - length * .78, -4, -36 - length, 1);
  ctx.closePath();
  const earth = ctx.createLinearGradient(0,-peak-5,0,3);
  earth.addColorStop(0,'#d7a042');
  earth.addColorStop(.32,'#b36b2e');
  earth.addColorStop(.8,'#7a4224');
  earth.addColorStop(1,'#4c2b1d');
  ctx.fillStyle=earth;ctx.fill();
  // Keep every individual leaf within the silhouette so the heap appears
  // layered and solid, not a loose cloud of disconnected star-shaped icons.
  ctx.save();
  ctx.clip();
  const count = 28 + Math.floor(fullness * 125);
  for(let i=0;i<count;i++) {
    const t = (i * .61803398875 + .13) % 1;
    const h = peak * Math.pow(1-t,.55);
    const px = -38 - t*length + Math.sin(i*4.19)*3;
    const py = -1 - h*(.12 + ((i*11)%17)/18);
    const size = 3.0 + ((i*7)%9)*.31;
    drawLeaf(ctx,sprites[(i*7+4)%sprites.length],px,
      py + Math.sin(now*.008+i*.6)*.35,size,
      i*.65 + Math.sin(i*2.1)*.24,i*.15,.88,.64);
  }
  ctx.restore();
  // Small leaf tufts at the crest tie the textured heap to the blade.
  for(let i=0;i<12;i++) {
    const t=i/11;
    const px=-37-t*length*.8;
    const py=-Math.max(3, peak*(1-t*.8))+
      Math.sin(now*.005+i*2.1)*.55;
    drawLeaf(ctx,sprites[(i*5+2)%sprites.length],px,py,
      3.0+(i%4)*.7,.3+i*1.17,0,.94,.64);
  }
  // A handful of detached small leaves fly in front of the working blade.
  for(let i=0;i<7;i++) {
    const t=(now*.00031+i/7)%1;
    drawLeaf(ctx,sprites[(i*5)%sprites.length],
      -43-t*(length*.52),-peak-2-Math.sin(Math.PI*t)*7,
      2.8+(i%3)*.45,t*4.8+i,t*3.6,(1-t)*fullness*.7,.76);
  }
  ctx.restore();
}
