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

function maple(ctx) {
  ctx.moveTo(0, -45);
  ctx.lineTo(8, -23); ctx.lineTo(22, -40); ctx.lineTo(22, -19);
  ctx.lineTo(41, -23); ctx.lineTo(30, -8); ctx.lineTo(42, 2);
  ctx.lineTo(26, 8); ctx.lineTo(32, 26); ctx.lineTo(14, 21);
  ctx.lineTo(6, 34); ctx.lineTo(3, 27); ctx.lineTo(0, 43);
  ctx.lineTo(-4, 27); ctx.lineTo(-12, 34); ctx.lineTo(-18, 21);
  ctx.lineTo(-34, 24); ctx.lineTo(-26, 7); ctx.lineTo(-41, 0);
  ctx.lineTo(-29, -9); ctx.lineTo(-39, -24); ctx.lineTo(-21, -18);
  ctx.lineTo(-22, -39); ctx.lineTo(-8, -22);
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
    ctx.scale(1.02,1.02);
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
export function drawLeaf(ctx, sprite, x, y, size, angle, flip=0, alpha=1) {
  if (!sprite || size<=0) return;
  ctx.save(); ctx.globalAlpha*=alpha;
  ctx.translate(x,y);ctx.rotate(angle);
  ctx.scale(.36+.64*Math.abs(Math.cos(flip)),1);
  const diameter=size*2.8;
  ctx.drawImage(sprite,-diameter/2,-diameter/2,diameter,diameter);
  ctx.restore();
}
export function drawAutumnMound(ctx, sprites, x, y, load, now) {
  if (load<2) return;
  const fullness=Math.min(1,load/1800),length=19+76*Math.sqrt(fullness);
  const peak=3+23*Math.sqrt(fullness);
  ctx.save();ctx.translate(x,y);
  const n=Math.round(8+fullness*50);
  // Layered individual leaf sprites rather than a flat white snowbank.
  for(let i=0;i<n;i++) {
    const t=(i*.61803398875)%1;
    const h=peak*Math.pow(Math.sin(Math.PI*t),.6);
    const size=5+((i*7)%8);
    const yy=-Math.max(2,h*(.4+(i%5)/8));
    const xx=-39-t*length+Math.sin(i*12.3)*4;
    drawLeaf(ctx,sprites[(i*7+3)%sprites.length],xx,
      yy+Math.sin(now*.008+i*1.61)*.65,size,
      i*.83+Math.sin(now*.005+i)*.16,0,1);
  }
  // A few leaves peel away from the moving pile at its tip.
  for(let i=0;i<9;i++) {
    const t=(now*.00032+i/9)%1;
    const x=-39-length*.3-t*28;
    const y=-peak-5-Math.sin(Math.PI*t)*9;
    drawLeaf(ctx,sprites[(i*5)%sprites.length],x,y,
      3+(i%3),t*6.28+i,t*3.6,(1-t)*.8);
  }
  ctx.restore();
}
