// Rain weather: falling streaks, splashes on window edges, wet edges that drip at the corners.
// Self-contained so the snow code paths stay untouched; overlay.js only calls the methods below.
import { landing } from './geometry.js';
import { createRainRenderer, RAIN_GPU_BUDGET } from './rain-renderer.js';
import { clipPrecipitation } from './precipitation-mask.js';

const random = (min, max) => min + Math.random() * (max - min);
const CPU_BUDGET = 520;
const SPLASH_LIMIT = 900;

export function createRain(canvas) {
  let renderer = null, triedRenderer = false;
  let width = 0, height = 0, scale = 1;
  let drops = [], splashes = [], fraction = 0, ready = false;
  const wet = new Map();

  canvas.addEventListener('webglcontextlost', () => {
    renderer = null;
    canvas.hidden = true;
  });

  function ensureRenderer() {
    if (triedRenderer) return renderer;
    triedRenderer = true;
    try { renderer = createRainRenderer(canvas); }
    catch (error) { console.warn('Rain renderer:', error.message); renderer = null; }
    canvas.hidden = !renderer;
    renderer?.resize(width, height, scale);
    return renderer;
  }

  function spawnDrop(y) {
    const depth = Math.random() ** 1.4;
    return {
      x: random(-30, width + 30), y: y ?? random(-90, -20), depth,
      vx: 0, vy: 760 + depth * 940 + random(-40, 40),
      length: 13 + depth * 34, width: 0.7 + depth * 1.25, alpha: 0.11 + depth * 0.42,
      foreground: Math.random() < 0.14,
    };
  }

  function splash(x, y, drop) {
    if (splashes.length >= SPLASH_LIMIT) return;
    const count = drop.depth > 0.55 ? 3 : drop.depth > 0.25 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const life = random(0.18, 0.36);
      splashes.push({
        kind: 'drop', x, y: y - 0.5, floor: y + 0.5, vx: random(-75, 75) + drop.vx * 0.12,
        vy: -random(55, 180) * (0.55 + drop.depth * 0.6), life, max: life, size: 0.6 + drop.depth * 0.9,
      });
    }
    if (Math.random() < 0.45) splashes.push({ kind: 'ring', x, y, life: 0.26, max: 0.26, size: 2 + drop.depth * 4 });
  }

  function wetten(id) {
    const entry = wet.get(id) ?? { level: 0 };
    entry.level = Math.min(1, entry.level + 0.018);
    wet.set(id, entry);
  }

  function update(dt, settings, rectangles) {
    const raining = settings.enabled && settings.weather === 'rain' && !settings.paused && settings.intensity > 0;
    const speed = Math.max(0.25, Math.min(2.5, (settings.rainSpeed ?? 100) / 100));
    if (raining) {
      ensureRenderer();
      const budget = renderer ? RAIN_GPU_BUDGET : CPU_BUDGET;
      const target = Math.min(budget, Math.round(width * height / 1500 * settings.intensity / 100));
      if (!ready) {
        ready = true;
        for (let i = drops.length; i < target * 0.8; i++) drops.push(spawnDrop(random(-60, height)));
      }
      fraction += target * 1300 / (height + 90) * dt * speed;
      while (fraction >= 1) {
        fraction--;
        if (drops.length < target) drops.push(spawnDrop());
      }
    } else {
      ready = false;
      fraction = 0;
    }

    const wind = settings.wind;
    let kept = 0;
    for (let index = 0; index < drops.length; index++) {
      const d = drops[index];
      const x0 = d.x, y0 = d.y;
      d.vx = wind * (2.2 + d.depth * 2.6);
      d.x += d.vx * dt * speed;
      d.y += d.vy * dt * speed;
      if (!d.foreground) {
        const hit = landing(rectangles, x0, y0, d.x, d.y, settings.taskbar);
        if (hit) {
          splash(hit.x, hit.rect.top, d);
          wetten(hit.rect.id);
          continue;
        }
      }
      if (d.y - d.length > height) continue;
      if (d.x < -40) d.x += width + 80;
      else if (d.x > width + 40) d.x -= width + 80;
      drops[kept++] = d;
    }
    drops.length = kept;

    kept = 0;
    for (let index = 0; index < splashes.length; index++) {
      const s = splashes[index];
      s.life -= dt;
      if (s.life <= 0) continue;
      if (s.kind !== 'ring') {
        const x0 = s.x, y0 = s.y;
        s.vy += 980 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        // Splash droplets land back on the edge they came from instead of sliding down the window.
        if (s.kind === 'drop' && s.vy > 0 && s.y > s.floor) continue;
        if (s.kind === 'drip') {
          const hit = landing(rectangles, x0, y0, s.x, s.y, settings.taskbar);
          if (hit) {
            splash(hit.x, hit.rect.top, { depth: 0.3, vx: 0 });
            continue;
          }
          if (s.y > height + 10) continue;
        }
      }
      splashes[kept++] = s;
    }
    splashes.length = kept;

    if (wet.size) {
      const present = new Map(rectangles.map(rect => [rect.id, rect]));
      for (const [id, entry] of wet) {
        const rect = present.get(id);
        entry.level -= dt * (raining ? 0.05 : 0.12);
        if (!rect || entry.level <= 0.01) {
          wet.delete(id);
          continue;
        }
        if (!rect.taskbar && entry.level > 0.3 && splashes.length < SPLASH_LIMIT &&
            Math.random() < dt * entry.level * 1.6) {
          const left = Math.random() < 0.5;
          splashes.push({
            kind: 'drip', x: left ? rect.left + 1.5 : rect.right - 1.5, y: rect.top + 1,
            vx: left ? -6 : 6, vy: 20, life: 3, max: 3, size: 1 + entry.level,
          });
        }
      }
    }
  }

  function paintWetEdges(ctx, rectangles) {
    for (let z = 0; z < rectangles.length; z++) {
      const rect = rectangles[z];
      const entry = wet.get(rect.id);
      if (!entry) continue;
      const level = Math.min(1, entry.level);
      const top = rect.top - 2.6;
      ctx.save();
      for (let i = 0; i < z; i++) {
        const cover = rectangles[i];
        if (cover.right <= rect.left || cover.left >= rect.right || cover.bottom <= top || cover.top >= rect.top + 1) continue;
        ctx.beginPath();
        ctx.rect(-10, -10, width + 20, height + 20);
        ctx.rect(cover.left, cover.top, cover.right - cover.left, cover.bottom - cover.top);
        ctx.clip('evenodd');
      }
      ctx.fillStyle = `rgba(232, 243, 255, ${0.2 * level})`;
      ctx.fillRect(rect.left, top, rect.right - rect.left, 1);
      ctx.fillStyle = `rgba(178, 207, 242, ${0.36 * level})`;
      ctx.fillRect(rect.left, top + 1, rect.right - rect.left, 1.6);
      ctx.restore();
    }
  }

  function paintSplashes(ctx) {
    ctx.lineCap = 'round';
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      let any = false;
      for (const s of splashes) {
        if (s.kind === 'ring') continue;
        const fade = s.life / s.max;
        if (s.kind !== 'drip' && Math.min(2, Math.floor(fade * 3)) !== band) continue;
        if (s.kind === 'drip' && band !== 2) continue;
        const k = s.kind === 'drip' ? 0.012 : 0.02;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * k, s.y - s.vy * k - (s.kind === 'drip' ? s.size * 2 : 0));
        any = true;
      }
      if (!any) continue;
      ctx.lineWidth = band === 2 ? 1.3 : 1.05;
      ctx.strokeStyle = `rgba(214, 231, 252, ${0.24 + band * 0.2})`;
      ctx.stroke();
    }
    ctx.lineWidth = 0.9;
    for (const s of splashes) {
      if (s.kind !== 'ring') continue;
      const t = 1 - s.life / s.max;
      ctx.strokeStyle = `rgba(206, 226, 250, ${0.45 * (1 - t)})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.size * (0.4 + t * 1.4), s.size * (0.12 + t * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function paintDropsFallback(ctx) {
    ctx.lineCap = 'round';
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      let any = false;
      for (const d of drops) {
        if (Math.min(2, Math.floor(d.depth * 3)) !== band) continue;
        const speed = Math.hypot(d.vx, d.vy) || 1;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.vx / speed * d.length, d.y - d.vy / speed * d.length);
        any = true;
      }
      if (!any) continue;
      ctx.lineWidth = 0.8 + band * 0.5;
      ctx.strokeStyle = `rgba(196, 216, 244, ${0.16 + band * 0.14})`;
      ctx.stroke();
    }
  }

  return {
    resize(nextWidth, nextHeight, nextScale) {
      width = nextWidth;
      height = nextHeight;
      scale = nextScale;
      renderer?.resize(width, height, scale);
    },
    update,
    draw(rectangles, taskbar) {
      renderer?.draw(drops, rectangles, taskbar);
    },
    paint(ctx, rectangles) {
      ctx.save();
      clipPrecipitation(ctx, rectangles, width, height);
      if (!renderer && drops.length) paintDropsFallback(ctx);
      if (splashes.length) paintSplashes(ctx);
      ctx.restore();
      if (wet.size) paintWetEdges(ctx, rectangles);
    },
    clear() {
      drops = [];
      splashes = [];
      wet.clear();
      fraction = 0;
      ready = false;
      renderer?.clear();
    },
    active: () => drops.length > 0 || splashes.length > 0 || wet.size > 0,
    needsScene: () => splashes.length > 0 || wet.size > 0 || (!renderer && drops.length > 0),
    fast: () => splashes.length > 0 || (!renderer && drops.length > 0),
    stats: () => ({ drops: drops.length, splashes: splashes.length, wet: wet.size,
      backend: renderer ? 'webgl' : triedRenderer ? 'canvas2d' : 'idle' }),
  };
}
