function oval(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

let ballSprite;
function makeBallSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 80;
  const ctx = canvas.getContext('2d');
  const x = 40, y = 40, radius = 39;
  const ice = ctx.createRadialGradient(x - radius * .35, y - radius * .4, 1, x, y, radius);
  ice.addColorStop(0, '#fff');
  ice.addColorStop(.58, '#eff5fc');
  ice.addColorStop(1, '#91a8c5');
  oval(ctx, x, y, radius, radius * .97, ice);
  const grains = Math.ceil(radius * 3);
  for (let i = 0; i < grains; i++) {
    const r = Math.sqrt((i + .5) / (grains + 3)) * radius;
    const angle = i * 2.39996;
    const grain = 0.4 + (i % 5) * 0.14;
    oval(ctx, x + Math.cos(angle) * r, y + Math.sin(angle) * r,
      grain, grain * .65, i % 2 ? '#fbfdffae' : '#809ab966');
  }
  return canvas;
}

export function drawBall(ctx, x, y, radius, rotation = 0) {
  ballSprite ??= makeBallSprite();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(ballSprite, -radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

export function makeSnowGrain(ctx) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 64;
  const grain = tile.getContext('2d');
  for (let i = 0; i < 960; i++) {
    const x = ((i * 613) % 4093) / 64;
    const y = ((i * 967) % 4079) / 64;
    grain.fillStyle = i % 3 ? '#ffffff6b' : '#637f9b48';
    grain.fillRect(x, y, i % 7 === 0 ? 1.35 : .7, .7);
  }
  return ctx.createPattern(tile, 'repeat');
}

export function drawSnowman(ctx, head, middle) {
  const { x, y, size: r } = head;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r, r);
  const hat = ctx.createLinearGradient(-.55, -1.5, .55, -.65);
  hat.addColorStop(0, '#354659');
  hat.addColorStop(1, '#121b2a');
  ctx.fillStyle = hat;
  ctx.beginPath();
  ctx.roundRect(-.48, -1.43, .96, .63, .11);
  ctx.fill();
  ctx.fillStyle = '#b63e52';
  ctx.fillRect(-.48, -.99, .96, .15);
  oval(ctx, 0, -.81, .75, .13, '#233043');
  oval(ctx, -.31, -.19, .105, .12, '#263344');
  oval(ctx, .31, -.19, .105, .12, '#263344');
  ctx.fillStyle = '#ed812e';
  ctx.beginPath();
  ctx.moveTo(-.1, .02); ctx.lineTo(.74, .16); ctx.lineTo(-.08, .23); ctx.fill();
  for (let i = -2; i <= 2; i++) oval(ctx, i * .14, .47 - i * i * .028, .05, .05, '#263344');
  oval(ctx, 0, 1, .78, .23, '#b63645');
  ctx.fillStyle = '#d54a51';
  ctx.fillRect(.34, 1, .28, .63);
  ctx.restore();
  ctx.save();
  ctx.translate(middle.x, middle.y);
  ctx.scale(middle.size, middle.size);
  ctx.strokeStyle = '#68462f';
  ctx.lineWidth = .12;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * .78, -.05);
    ctx.quadraticCurveTo(side * 1.14, -.28, side * 1.58, -.61);
    ctx.lineTo(side * 1.65, -.85);
    ctx.moveTo(side * 1.4, -.48);
    ctx.lineTo(side * 1.74, -.43);
    ctx.stroke();
  }
  ctx.restore();
  oval(ctx, middle.x, middle.y - middle.size * .03, 1.8, 1.8, '#263344');
  oval(ctx, middle.x, middle.y + middle.size * .39, 1.7, 1.7, '#263344');
}

export function drawPlough(ctx, x, y, heap, texture, now) {
  ctx.save();
  ctx.translate(x, y);
  let peak = 0;
  for (const depth of heap) peak = Math.max(peak, depth);
  peak = Math.min(11, peak);
  if (peak > .3) {
    const fill = ctx.createLinearGradient(0, -peak, 0, 0);
    fill.addColorStop(0, '#fcfdff');
    fill.addColorStop(.43, '#e8f1fb');
    fill.addColorStop(1, '#91a8c4');
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-30, -Math.min(11, heap[0]));
    for (let i = 1; i < heap.length; i++) {
      const left = Math.min(11, heap[i - 1]), right = Math.min(11, heap[i]);
      ctx.quadraticCurveTo(-30 - (i - .5) * 3, -left,
        -30 - i * 3, -(left + right) / 2);
    }
    ctx.lineTo(-30 - heap.length * 3, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (texture) {
      ctx.fillStyle = texture;
      ctx.fill();
    }
  }
  ctx.shadowColor = '#091321aa';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#172231';
  ctx.beginPath(); ctx.roundRect(-22, -13, 59, 14, 7); ctx.fill();
  ctx.shadowBlur = ctx.shadowOffsetY = 0;
  // Highlighted rubber tread and metal track casing.
  ctx.strokeStyle = '#91a3b1';
  ctx.lineWidth = .9;
  ctx.beginPath(); ctx.roundRect(-22, -13, 59, 14, 7); ctx.stroke();
  ctx.fillStyle = '#29394b';
  ctx.beginPath(); ctx.roundRect(-21, -11, 57, 9, 5); ctx.fill();
  for (const wheel of [-11, 6, 25]) {
    oval(ctx, wheel, -6, 10, 8, '#172231');
    oval(ctx, wheel, -6, 6, 5, '#5a6979');
    ctx.save();
    ctx.translate(wheel, -6);
    ctx.rotate(x / 7);
    ctx.strokeStyle = '#a4b3c0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let spoke = 0; spoke < 5; spoke++) {
      const angle = spoke * Math.PI * 2 / 5;
      ctx.moveTo(Math.cos(angle) * 2.4, Math.sin(angle) * 2.4);
      ctx.lineTo(Math.cos(angle) * 5.3, Math.sin(angle) * 4.4);
    }
    ctx.stroke();
    ctx.restore();
    oval(ctx, wheel, -6, 2, 2, '#b8c3c7');
  }
  const paint = ctx.createLinearGradient(0, -35, 0, -8);
  paint.addColorStop(0, '#ffe184'); paint.addColorStop(.5, '#f0a12a'); paint.addColorStop(1, '#b26415');
  ctx.fillStyle = paint;
  ctx.beginPath(); ctx.roundRect(-20, -23, 58, 13, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(2, -38, 23, 20, 4); ctx.fill();
  ctx.fillStyle = '#344d65';
  ctx.beginPath(); ctx.roundRect(5, -35, 16, 12, 2); ctx.fill();
  const glass = ctx.createLinearGradient(5, -35, 22, -23);
  glass.addColorStop(0, '#d9f4ff');
  glass.addColorStop(.45, '#8ec2dc');
  glass.addColorStop(1, '#294a67');
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.roundRect(5, -35, 16, 12, 2); ctx.fill();
  ctx.strokeStyle = '#e2b66a'; ctx.lineWidth = 1.1;
  ctx.strokeRect(6, -34, 14, 10);
  ctx.fillStyle = '#ffffffa8'; ctx.fillRect(8, -33, 2.2, 8);
  ctx.fillStyle = '#c2e4f5aa'; ctx.fillRect(12, -33, 1, 6);
  ctx.fillStyle = '#784417';
  for (let i = 0; i < 4; i++) ctx.fillRect(-16 + i * 3, -20, 1.35, 5);
  ctx.fillStyle = '#fce8b1'; ctx.fillRect(-17, -12, 49, 1);
  ctx.fillStyle = '#b62c32'; ctx.fillRect(33, -20, 3, 4);
  // Crisp machined trim, door seam, and front headlamp.
  ctx.strokeStyle = '#fff1bf'; ctx.lineWidth = .7;
  ctx.beginPath(); ctx.moveTo(3, -22); ctx.lineTo(3, -10); ctx.stroke();
  ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.roundRect(-20, -20, 5, 4, 1); ctx.fill();
  ctx.fillStyle = '#ad681b'; ctx.fillRect(23, -18, 11, 2);
  ctx.fillStyle = '#f9e2a8'; ctx.fillRect(11, -41, 9, 1.3);
  const pulse = Math.max(0, Math.cos(now / 82)) ** 4;
  oval(ctx, 15, -40, 4, 2, '#e59226');
  if (pulse > .03) {
    ctx.globalAlpha = pulse;
    const light = ctx.createRadialGradient(15, -41, 1, 15, -41, 19);
    light.addColorStop(0, '#fff2b0e8');
    light.addColorStop(.27, '#ffc158a0');
    light.addColorStop(1, '#ffab2500');
    oval(ctx, 15, -41, 19, 19, light);
    oval(ctx, 15, -41, 3.4, 1.7, '#fff1b5');
    ctx.globalAlpha = 1;
  }
  oval(ctx, -20, -21, 3, 2, '#fff1b6');
  ctx.fillStyle = '#677685';
  ctx.beginPath(); ctx.moveTo(-20, -17); ctx.lineTo(-32, -22);
  ctx.lineTo(-37, -4); ctx.lineTo(-20, -8); ctx.fill();
  ctx.strokeStyle = '#c0ccd9'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-33, -20); ctx.lineTo(-37, -3); ctx.lineTo(-25, -4); ctx.stroke();
  ctx.strokeStyle = '#f0f6ffbb'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(-31, -18); ctx.lineTo(-35, -5); ctx.stroke();
  ctx.restore();
}

const santaSprite = new Image();
santaSprite.src = new URL('./santa.svg', import.meta.url).href;
const santaFrames = new Image();
let santaAtlas;
santaFrames.addEventListener('load', () => {
  const raster = document.createElement('canvas');
  raster.width = santaFrames.naturalWidth;
  raster.height = santaFrames.naturalHeight;
  raster.getContext('2d').drawImage(santaFrames, 0, 0);
  santaAtlas = raster;
}, { once: true });
santaFrames.src = new URL('./santa-frames.svg', import.meta.url).href;

export function drawSanta(ctx, x, y, time, tilt = 0) {
  if (!santaSprite.complete || !santaSprite.naturalWidth) return;
  const width = 216;
  const height = width * santaSprite.naturalHeight / santaSprite.naturalWidth;
  ctx.save();
  ctx.translate(x, y + Math.sin(time * .004) * 3);
  ctx.rotate(tilt * .72);
  if (santaAtlas) {
    const frame = Math.floor(time / 50) % 8;
    ctx.drawImage(santaAtlas, (frame % 4) * 330, Math.floor(frame / 4) * 110, 330, 110,
      -52, -height / 2, width, height);
  } else ctx.drawImage(santaSprite, -52, -height / 2, width, height);
  ctx.restore();
}

