import { landing, bottomTaskbarAt } from './geometry.js';
import { bottomExclusionMasks, bottomMaskedAt } from './window-exclusions.js';
import { snowStep, snowStepInPlace } from './snow-motion.js';
import { resizeProfile } from './snow-profile.js';
import { drawPlough, drawSanta, drawSnowman, drawBall, makeSnowGrain } from './snow-art.js';
import { drawGarland, drawTree, drawGift } from './christmas-decor.js';
import { createSnowRenderer } from './snow-renderer.js';
import { makeRope, brushRope, stepRope } from './garland-physics.js';
import { createRain } from './rain.js';
import { createAutumn } from './autumn.js';
import { createFramePacer } from './frame-pacing.js';
import { createPerfMonitor } from './perf-monitor.js';
import { clipPrecipitation } from './precipitation-mask.js';
import { shedOnWindowMotion, naturalSnowHeights, keepBallAboveTaskbar, canStackBall, needsAutoPlough, sweepSnowProfile, bladeTouchesBall } from './snow-behavior.js';
import { santaStops, bladeCrosses, isOnBottomSurface } from './santa-visit.js';
import { shouldReleaseWindowSnow } from './window-snow.js';
import { shakeSnowOffWindow } from './window-powder.js';
import { titlebarWindowAt, draggedEnough, hideMovingWindowSnow } from './window-drag.js';
import { ploughBaselineForFloor, santaCenterForFloor, safeBottomFloor } from './taskbar-actors.js';
import { snowDiameter, powderShares, setVisibleSnowDiameter } from './snow-diameter.js';
import { dropTreeAt, fallTree } from './tree-physics.js';
import { iconContactY, iconSnowLanding, preferIconHit, placeIconSnow,
  syncIconSnow, paintIconSnow, createIconDragMonitor } from './desktop-icon-snow.js';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const snowCanvas = document.querySelector('#snow');
let snowRenderer;
try { snowRenderer = createSnowRenderer(snowCanvas); }
catch (error) { console.warn('Snow renderer:', error.message); }
snowCanvas.hidden = !snowRenderer;
document.documentElement.dataset.snowBackend = snowRenderer ? 'webgl' : 'canvas2d';
snowCanvas.addEventListener('webglcontextlost', () => {
  snowRenderer = undefined;
  snowCanvas.hidden = true;
  document.documentElement.dataset.snowBackend = 'canvas2d';
});
const snowGrain = makeSnowGrain(ctx);
const random = (min, max) => min + Math.random() * (max - min);
const column = 6;
let width, height, previous, nextFrame, fraction = 0;
let previousScene, sceneVisible = false;
let settings = { enabled: false, intensity: 65, wind: 15, taskbar: true, paused: true };
let rectangles = [], mouse = { x: -1000, y: -1000 }, particles = [], accents = [], balls = [];
let taskbars = [], bottomMasks = [];
let desktopIcons = [];
const iconPiles = new Map();
const iconDrag = createIconDragMonitor();
let ground, plough, snowReady = false;
let nextAutoPloughCheck = 0, lastPloughAt = -60_000;
let lastDesktopSample;
let movingWindowDrag;
const movingWindowHoldUntil = new Map();
let grabbed, grabOffset, capturing = false;
let placement;
let heldTree, frameRequest;
const garlands = [], trees = [];
let gifts = [];
const piles = new Map();
const celebratedSnowmen = new WeakSet();
const santaPendingSnowmen = new Set();
let nextSantaVisitAt = 0;

// ---- v0.2: smooth pacing, dirty redraws, rain weather, diagnostics ----
const rain = createRain(document.querySelector('#rain'));
const autumn = createAutumn();
let sceneDirty = false;
const diagnostics = entry => window.wintermas?.log?.(entry);
const pacer = createFramePacer(frame, {
  onModeChange: mode => diagnostics({ type: 'pacing', mode }),
});
const perf = createPerfMonitor(diagnostics, () => ({
  pacing: pacer.mode, refreshMs: +pacer.refreshMs.toFixed(2),
  snow: document.documentElement.dataset.snowBackend, rain: rain.stats(),
  weather: settings.weather ?? 'snow', flakes: particles.length, piles: piles.size,
  icons: desktopIcons.length, iconBanks: iconPiles.size,
  windows: rectangles.length, width, height, dpr: devicePixelRatio,
}));

function geometryChanged(before, after) {
  if (before.length !== after.length) return true;
  for (let i = 0; i < before.length; i++) {
    const a = before[i], b = after[i];
    if (a.id !== b.id || a.left !== b.left || a.top !== b.top || a.right !== b.right || a.bottom !== b.bottom) return true;
  }
  return false;
}

// Redraw a scene with no moving parts only as often as its content can change:
// pile rasters refresh every 90 ms, decoration lights twinkle and need ~30 fps.
function staticSceneInterval() {
  return garlands.length || trees.length || placement ? 32 : 90;
}

function applyWeather(before, next) {
  if ((before.weather ?? 'snow') === (next.weather ?? 'snow')) return;
  // Clear both weather engines immediately. Old flakes, snowbanks and snowballs
  // must not remain in Rain; old drops and wet window edges must not remain in Snow.
  rain.clear();
  autumn.clear();
  particles = [];
  accents = [];
  balls = [];
  gifts = [];
  santaPendingSnowmen.clear();
  nextSantaVisitAt = 0;
  grabbed = undefined;
  plough = undefined;
  fraction = 0;
  piles.clear();
  iconPiles.clear();
  iconDrag.reset();
  movingWindowDrag = undefined;
  movingWindowHoldUntil.clear();
  if (ground) {
    ground.profile.fill(0);
    ground.raster = undefined;
  }
  capturePointer(false);
  snowReady = false;
  sceneDirty = true;
}

function updateWeather(dt) {
  rain.update(dt, settings, rectangles, settings.iconsRain ? desktopIcons : []);
  rain.draw(rectangles, settings.taskbar);
}

function resize() {
  // Scene contains snowbanks and the plough: unlike particle layers it needs crisp edges.
  const scale = Math.max(1, Math.min(devicePixelRatio, 2, Math.sqrt(8_000_000 / (innerWidth * innerHeight))));
  if (width === innerWidth && height === innerHeight &&
      canvas.width === Math.round(width * scale) && canvas.height === Math.round(height * scale)) return;
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const particleScale = Math.min(devicePixelRatio, 2, Math.sqrt(3_000_000 / (width * height)));
  snowRenderer?.resize(width, height, particleScale);
  rain.resize(width, height, particleScale);
  autumn.resize(width, height);
  iconPiles.clear();
  iconDrag.reset();
  bottomMasks = bottomExclusionMasks(rectangles,settings.bottomEdgeExcludeApps,height);
  sceneDirty = true;
  const rect = { id: 'ground', left: 0, right: width, top: height, bottom: height + 1 };
  ground = { rect, profile: new Float32Array(Math.ceil(width / column)), kind: 'snow' };
  snowReady = false;
}

function bottomSurfaceAt(x) {
  return bottomTaskbarAt(taskbars, x, height) ?? ground.rect;
}

function releaseSnow(x, y, depth, vx, vy, avoidId = null) {
  // A heavy window bank turns into MANY uniform-size powder flakes, rather
  // than one giant clump whose rendered diameter depends on accumulated mass.
  const shares = powderShares(depth, Math.max(0, 780 - accents.length));
  const diameter = snowDiameter(settings.snowDiameter);
  for (const deposit of shares) {
    accents.push({
      kind: 'chunk', x: x + random(-5, 5), y: y + random(-7, 7),
      vx: vx + random(-35, 35), vy: vy + random(-40, 20),
      alpha: 0.72, deposit,
      avoidId, avoidFor: avoidId ? 0.75 : 0,
      size: diameter,
    });
  }
}

function spill(pile, avoidId = null) {
  // Each three adjacent columns become one falling flurry on minimize.
  for (let index = 0; index < pile.profile.length; index += 3) {
    let depth = 0, count = 0;
    for (let i = index; i < Math.min(index + 3, pile.profile.length); i++) {
      depth += pile.profile[i];
      count++;
    }
    if (depth < 0.12) continue;
    const x = pile.rect.left + (index + count / 2) * column + random(-5, 5);
    const y = pile.rect.top - depth / count - random(2, 9);
    releaseSnow(x, y, depth * 0.9, random(-85, 85), random(-90, -12), avoidId);
  }
}

// React to titlebar input, not only window-geometry events. This protects
// against the 1-2 DWM frames when a rapidly dragged window has already moved
// but the native tracker still reports its previous rectangle.
function updateWindowDrag(next, now, nativeMoving = null) {
  if (settings.weather !== 'snow' || !next) return;
  if (!next.pressed) {
    if (movingWindowDrag?.moved)
      movingWindowHoldUntil.set(movingWindowDrag.id, now + 340);
    movingWindowDrag = undefined;
    return;
  }
  // Native WM_ENTERSIZEMOVE tracking supplies the real HWND even if a fast
  // mouse move outruns our next sampled window rectangle. It takes precedence
  // over the pointer-based titlebar heuristic used by custom titlebars.
  if (nativeMoving && rectangles.some(r => r.id === nativeMoving && !r.taskbar)) {
    if (!movingWindowDrag || movingWindowDrag.id !== nativeMoving)
      movingWindowDrag = { id: nativeMoving, startX: next.x,
        startY: next.y, moved: true };
    movingWindowDrag.moved = true;
    const pile = piles.get(nativeMoving);
    if (pile) {
      spill(pile, nativeMoving);
      piles.delete(nativeMoving);
      sceneDirty = true;
    }
    movingWindowHoldUntil.set(nativeMoving, now + 340);
    return;
  }
  if (!mouse.pressed) {
    const candidate = titlebarWindowAt(rectangles, next);
    movingWindowDrag = candidate ? {
      id: candidate.id, startX: next.x, startY: next.y, moved: false,
    } : undefined;
  }
  const drag = movingWindowDrag;
  if (!drag) return;
  if (!drag.moved && draggedEnough(drag, next)) {
    drag.moved = true;
    const pile = piles.get(drag.id);
    if (pile) {
      // The old ridge should become a powder shower at its ORIGINAL location,
      // not a stale line that follows the cursor a few frames later.
      spill(pile, drag.id);
      piles.delete(drag.id);
    }
    sceneDirty = true;
  }
  if (drag.moved) movingWindowHoldUntil.set(drag.id, now + 340);
}

function releaseIconBank(bank) {
  if (settings.weather !== 'snow' || !settings.enabled || settings.paused) return;
  const { rect, profile } = bank;
  const cell = (rect.right - rect.left) / profile.length;
  for (let i = 0; i < profile.length; i += 3) {
    let mass = 0;
    for (let j = i; j < Math.min(i + 3, profile.length); j++) mass += profile[j];
    if (mass < 1.3) continue;
    const x = rect.left + (i + 1.5) * cell;
    const y = iconContactY(rect, Math.min(rect.right - .01, x)) ?? rect.top;
    releaseSnow(x, y - mass * .20, mass * .55, random(-34, 34),
      random(-55, -8));
  }
}

function desktop(frame) {
  if (!frame.rectangles) return;
  const now = performance.now();
  const elapsed = Math.max(0.012, (now - (lastDesktopSample ?? now)) / 1000);
  lastDesktopSample = now;
  if (placement || geometryChanged(rectangles, frame.rectangles)) sceneDirty = true;
  if (settings.weather === 'snow' && settings.iconsSnow && frame.mouse) {
    if (iconDrag.update(frame.mouse, desktopIcons, rectangles, now, id => {
      const pile = iconPiles.get(id);
      if (pile) {
        releaseIconBank(pile);
        iconPiles.delete(id);
      }
    })) sceneDirty = true;
  }
  rectangles = frame.rectangles;
  taskbars = rectangles.filter(rect => rect.taskbar);
  bottomMasks = bottomExclusionMasks(rectangles,settings.bottomEdgeExcludeApps,height);
  // Desktop shortcuts have their own tiny silhouette-following snowbanks.
  // Their bounds exclude text labels; when moved or removed they release
  // powder, rather than leaving frozen fragments on the wallpaper.
  const nextIcons = Array.isArray(frame.icons) ? frame.icons : [];
  if (settings.weather === 'snow' && settings.iconsSnow) {
    if (syncIconSnow(iconPiles, nextIcons, releaseIconBank) ||
        nextIcons.length !== desktopIcons.length) sceneDirty = true;
  } else if (iconPiles.size) {
    iconPiles.clear();
    sceneDirty = true;
  }
  desktopIcons = nextIcons;
  updateWindowDrag(frame.mouse, now, frame.moving);
  if (settings.weather === 'autumn') {
    autumn.syncGeometry(rectangles, frame.minimized,
      settings.iconsAutumn ? desktopIcons : []);
    autumn.onPointer(frame.mouse, elapsed);
  } else updatePointer(frame.mouse, elapsed);
  mouse = frame.mouse;
  const byId = new Map(rectangles.map(rect => [rect.id, rect]));
  for (const [id, pile] of piles) {
    const next = byId.get(id);
    if (pile.rect.taskbar && (!settings.taskbar || settings.paused)) {
      piles.delete(id);
    } else if (!next) {
      // A disappearing window must NEVER take its accumulated snow with it.
      // Release its last visible bank into independent particles first, then
      // delete the now-invalid HWND pile. Includes both Close and Minimize.
      if (shouldReleaseWindowSnow(pile, next, settings)) spill(pile, id);
      piles.delete(id);
      movingWindowHoldUntil.delete(id);
      sceneDirty = true;
    } else {
      pile.lastSeen = now;
      const old = pile.rect;
      const oldWidth = old.right - old.left;
      const newWidth = next.right - next.left;
      if (Math.abs(oldWidth - newWidth) > 1) {
        const { retained, detached } = resizeProfile(pile.profile, old, next, column);
        for (const { x, depth } of detached) {
          if (depth < 0.05) continue;
          releaseSnow(x, old.top - depth / 2, depth, (next.left - old.left) / elapsed * 0.18, -24);
        }
        pile.profile = retained;
        pile.raster = undefined;
      }
      if (!next.taskbar) {
        const dy = next.top - old.top;
        const dx = next.left - old.left;
        if (Math.abs(dy) >= 1.8) {
          const powder = shakeSnowOffWindow(pile.profile, dy);
          pile.noSettleUntil = now + 340;
          movingWindowHoldUntil.set(id, now + 340);
          pile.raster = undefined;
          // Spread individual powder puffs across the whole former ridge.
          for (const particle of powder) {
            const x = next.left + particle.column * column + random(-6, 6);
            const y = Math.min(next.top, old.top) - random(9, 28);
            if (accents.length >= 760) break;
            releaseSnow(x, y, particle.mass, random(-110, 110),
              random(-145, -55), id);
            // All released flakes use the same diameter as active snowfall.
          }
        } else {
          const motion = shedOnWindowMotion(pile.profile, {
            dx, dy, lastVx: pile.vx ?? 0, lastVy: pile.vy ?? 0,
          }, elapsed);
          pile.vx = motion.vx;
          pile.vy = motion.vy;
          for (const chunk of motion.dislodged) {
            const x = next.left + (chunk.index + 0.5) * column;
            releaseSnow(x, next.top - Math.max(8, pile.profile[chunk.index]) -
              random(7, 16), chunk.amount, chunk.vx + random(-55, 55),
              chunk.vy - random(50, 100), id);
          }
        }
        if (dx || dy) pile.raster = undefined;
      }
      pile.rect = next;
    }
  }
}

function configure(next) {
  const wasEnabled = settings.enabled;
  applyWeather(settings, next);
  if ((!next.taskbar || next.paused) && settings.taskbar && !settings.paused) {
    for (const [id, pile] of piles) {
      if (pile.rect.taskbar) piles.delete(id);
    }
  }
  if (next.paused && !settings.paused) {
    particles = [];
    fraction = 0;
    snowReady = false;
  }
  const diameterChanged = snowDiameter(settings.snowDiameter) !== snowDiameter(next.snowDiameter);
  settings = next;
  bottomMasks = bottomExclusionMasks(rectangles,settings.bottomEdgeExcludeApps,height);
  // Icons are opt-in separately for each seasonal theme. Disabling a mode
  // immediately removes existing snow, wet glints, or leaves from shortcuts.
  if (!next.iconsSnow) { iconPiles.clear(); iconDrag.reset(); }
  if (!next.iconsRain) rain.clearIconWet();
  if (!next.iconsAutumn) autumn.clearIconLeaves();
  sceneDirty = true;
  if (diameterChanged) {
    setVisibleSnowDiameter(particles, accents, settings.snowDiameter);
    sceneDirty = true;
  }
  if (next.enabled && !wasEnabled) {
    previous = nextFrame = undefined;
    frameRequest = setTimeout(frame, 0);
  } else if (!next.enabled && wasEnabled) {
    clearTimeout(frameRequest);
    pacer.cancel();
    rain.clear();
    cancelPlacement();
    grabbed = heldTree = undefined;
    ctx.clearRect(0, 0, width, height);
    snowRenderer?.draw([], rectangles, settings.taskbar);
    sceneVisible = false;
  }
}
function addPile(hit, amount = 1) {
  const { x } = hit;
  const rect = hit.rect.id === 'ground' ? bottomTaskbarAt(taskbars, x, height) ?? hit.rect : hit.rect;
  if (rect.taskbar && (!settings.taskbar || settings.paused)) return;
  // Excluded programs (SolidWorks, CAD editors, etc.) must not accumulate
  // hidden snow at the bottom while their window is open.
  if ((rect.taskbar || rect.id === 'ground') &&
      bottomMaskedAt(bottomMasks, x)) return;
  // Do not paint a new ridge using an obsolete rectangle while moving.
  if (hideMovingWindowSnow(rect.id, movingWindowDrag, movingWindowHoldUntil,
      performance.now())) return;
  if (rect.id !== 'ground' && !piles.has(rect.id)) {
    piles.set(rect.id, { rect, profile: new Float32Array(Math.ceil((rect.right - rect.left) / column)), kind: 'snow' });
  }
  const targetPile = rect.id === 'ground' ? ground : piles.get(rect.id);
  // Do not immediately regrow the thin line while a window is being dragged.
  if (targetPile.noSettleUntil && performance.now() < targetPile.noSettleUntil) return;
  const { profile } = targetPile;
  const center = Math.max(0, Math.min(profile.length - 1, Math.floor((x - rect.left) / column)));
  for (let dx = -2; dx <= 2; dx++) {
    const i = center + dx;
    if (i < 0 || i >= profile.length) continue;
    if (rect.id === 'ground' && bottomTaskbarAt(taskbars, (i + .5) * column, height)) continue;
    const limit = rect.id === 'ground' ? 20 : 13;
    const irregularLimit = limit * (0.82 + 0.18 * Math.sin(i * 0.53 + rect.left * 0.003) ** 2);
    profile[i] = Math.min(irregularLimit, profile[i] + (3 - Math.abs(dx)) * 0.38 * amount);
  }
}

function spawnFlake() {
  const depth = Math.random() ** 1.65;
  return {
    kind: 'snow', x: random(0, width), y: -14, phase: random(0, Math.PI * 2),
    alpha: 0.72, size: snowDiameter(settings.snowDiameter),
    fall: 36 + depth * 106, vx: random(-7, 7),
    sway: random(4, 19), rate: random(0.6, 1.8), foreground: Math.random() < 0.18,
  };
}

function updateParticles(dt) {
  if (settings.weather === 'autumn') {
    autumn.update(dt, settings);
    updateAutumnPlough(dt);
    return;
  }
  const budget = snowRenderer ? 950 : 360;
  if (!settings.paused && settings.intensity > 0 && settings.weather !== 'rain') {
    if (!snowReady) {
      snowReady = true;
      const count = Math.min(Math.floor(budget * .65), Math.round(width * height / 3200 * settings.intensity / 100));
      for (let i = 0; i < count; i++) {
        const flake = spawnFlake();
        flake.y = random(-10, height);
        particles.push(flake);
      }
    }
    fraction += (snowRenderer ? 110 : 76) * settings.intensity / 100 * dt * Math.min(1.5, width / 1450) * ((settings.snowSpeed ?? 100) / 100);
    while (fraction >= 1) {
      fraction--;
      if (particles.length < budget) particles.push(spawnFlake());
    }
  }
  const byId = new Map(rectangles.map(rect => [rect.id, rect]));
  const landableIcons = settings.iconsSnow ? desktopIcons.filter(icon =>
    !iconDrag.isBlocked(icon.id, performance.now())) : [];
  const wind = settings.wind * 0.62;
  // In-place compaction: same rules as before, without a new array and motion object every frame.
  let kept = 0;
  for (let index = 0; index < particles.length; index++) {
    const p = particles[index];
    const x0 = p.x, y0 = p.y;
    snowStepInPlace(p, wind + p.vx, dt * ((settings.snowSpeed ?? 100) / 100));
    const hit = p.foreground ? null : preferIconHit(
      landing(rectangles, x0, y0, p.x, p.y, settings.taskbar),
      iconSnowLanding(landableIcons, rectangles, x0, y0, p.x, p.y));
    if (hit) {
      if (hit.icon) placeIconSnow(iconPiles, hit);
      else addPile(hit);
      continue;
    }
    if (y0 <= height && p.y >= height) {
      addPile({ rect: ground.rect, x: p.x }, 1.25);
      continue;
    }
    if (p.x < -24) p.x = width + 23;
    else if (p.x > width + 24) p.x = -23;
    if (p.y < height + 28) particles[kept++] = p;
  }
  particles.length = kept;
  const trail = [];
  accents = accents.filter(p => {
    if (p.kind === 'santa') {
      // Santa and sleigh travel on the LOWER edge, not in the middle of the desktop.
      p.age += dt;
      p.x = -175 + p.age * 190;
      const x = Math.max(0, Math.min(width - 1, p.x));
      p.y = santaCenterForFloor(safeBottomFloor(taskbars, x, height));
      p.tilt = 0;
      while (p.stopIndex < p.stops.length && p.x >= p.stops[p.stopIndex].x) {
        const stop = p.stops[p.stopIndex++];
        const support = bottomSurfaceAt(stop.x);
        if (stop.kind === 'gift' && gifts.length < 24) {
          gifts.push({ x: stop.x, y: support.top - 8, spin: 0, vx: 0, vy: 0,
            support: support.id, offset: stop.x - support.left,
            color: ['#ba354e', '#3d8b6c', '#4368a7'][p.stopIndex % 3], fromSanta: true });
        } else if (stop.kind === 'tree') {
          trees.push({ anchor: { x: stop.x, y: support.top }, color: 'classic',
            fromSanta: true, onBottom: true, falling: false, vy: 0 });
          if (trees.length > 16) trees.shift();
        }
        sceneDirty = true;
      }
      if (Math.random() < dt * 18) trail.push({
        kind: 'magic', x: p.x - 45, y: p.y + 6, vx: random(-48, -12), vy: random(-35, 4),
        life: random(.28, .62), size: random(.7, 1.7),
      });
      return p.x < width + 170;
    }
    if (p.deposit !== undefined) {
      const x0 = p.x, y0 = p.y;
      p.vy += dt * 420;
      p.x = Math.max(0, Math.min(width - 0.01, p.x + p.vx * dt));
      p.y += p.vy * dt;
      p.avoidFor = Math.max(0, (p.avoidFor ?? 0) - dt);
      const landingRects = p.avoidFor && p.avoidId
        ? rectangles.filter(rect => rect.id !== p.avoidId) : rectangles;
      const hit = preferIconHit(
        landing(landingRects, x0, y0, p.x, p.y, settings.taskbar),
        iconSnowLanding(landableIcons, landingRects, x0, y0, p.x, p.y));
      const surface = hit ?? (p.y >= height ? { rect: bottomSurfaceAt(p.x), x: p.x } : null);
      if (!surface) return true;
      if (surface.icon) placeIconSnow(iconPiles, surface, p.deposit / 3.42);
      else addPile(surface, p.deposit / 3.42);
      return false;
    }
    p.life -= dt;
    if (p.vx !== undefined) {      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += dt * 195;
    }
    return p.life > 0 && p.y < height + 60;
  });
  accents.push(...trail);
  updateTrees(dt);
  updateSnowProps(dt, byId);
  updateGifts(dt, byId);
  dispatchQueuedSantaVisit();
}

function updateTrees(dt) {
  for (const tree of trees) {
    if (tree === heldTree?.tree || plough?.carriedTrees.includes(tree)) continue;
    if (tree.anchor?.id && !rectangles.some(r => r.id === tree.anchor.id)) {
      // The former support vanished; let this tree fall rather than freeze.
      tree.anchor = { x: tree.lastX ?? width / 2, y: tree.lastY ?? 0 };
      tree.falling = true;
      tree.vy = 0;
    }
    const world = resolveAnchor(tree.anchor);
    if (world) { tree.lastX = world.x; tree.lastY = world.y; }
    if (fallTree(tree, dt, rectangles, x => bottomSurfaceAt(x).top)) {
      const next = resolveAnchor(tree.anchor);
      if (next) { tree.lastX = next.x; tree.lastY = next.y; }
      sceneDirty = true;
    }
  }
}

function updateGifts(dt, byId) {
  for (const gift of gifts) {
    if (plough?.carriedGifts.includes(gift)) continue;
    if (gift.support) {
      const support = gift.support === 'ground' ? ground.rect : byId.get(gift.support);
      if (support && (!support.taskbar || settings.taskbar)) {
        gift.x = support.left + gift.offset;
        gift.y = support.top - 8;
        if (gift.x >= support.left && gift.x <= support.right) continue;
      }
      gift.support = null;
    }
    const oldX = gift.x, oldBottom = gift.y + 8;
    gift.vy += dt * 395;
    gift.x += gift.vx * dt;
    gift.y += gift.vy * dt;
    gift.spin += dt * 2;
    const hit = landing(rectangles, oldX, oldBottom, gift.x, gift.y + 8, settings.taskbar);
    const floor = bottomSurfaceAt(gift.x);
    const support = hit?.rect ?? (gift.y + 8 >= floor.top ? floor : null);
    if (!support) continue;
    gift.y = support.top - 8;
    if (gift.vy > 100) {
      gift.vy *= -.34;
      gift.vx *= .58;
    } else {
      gift.support = support.id;
      gift.offset = gift.x - support.left;
      gift.vx = gift.vy = 0;
    }
  }
  gifts = gifts.filter(gift => gift.x > -40 && gift.x < width + 40);
}

function anchorAt(point) {
  const rect = rectangles.find(rect => !rect.taskbar && point.x >= rect.left &&
    point.x < rect.right && point.y >= rect.top - 6 && point.y < rect.bottom);
  return rect ? { id: rect.id, x: point.x - rect.left, y: point.y - rect.top } : { x: point.x, y: point.y };
}

function resolveAnchor(anchor) {
  if (!anchor.id) return anchor;
  const rect = rectangles.find(rect => rect.id === anchor.id);
  return rect && { x: rect.left + anchor.x, y: rect.top + anchor.y };
}

function cancelPlacement() {
  placement = undefined;
  capturePointer(false);
}

function updatePointer(next, elapsed) {
  const clicked = next.pressed && !mouse.pressed;
  if (placement) {
    if (performance.now() > placement.deadline) {
      cancelPlacement();
      return;
    }
    const inside = next.x >= 0 && next.x < width && next.y >= 0 && next.y < height;
    capturePointer(inside);
    if (!inside || !clicked) return;
    const anchor = anchorAt(next);
    placement.deadline = performance.now() + 25000;
    if (placement.kind === 'tree') {
      trees.push({ ...dropTreeAt(next, rectangles), color: placement.color });
      if (trees.length > 16) trees.shift();
      cancelPlacement();
    } else if (placement.start) {
      const a = resolveAnchor(placement.start);
      if (!a || Math.hypot(a.x - next.x, a.y - next.y) < 18) return;
      garlands.push({ a: placement.start, b: anchor, color: placement.color, rope: makeRope(a, next) });
      if (garlands.length > 24) garlands.shift();
      if (next.control) placement.start = anchor;
      else cancelPlacement();
    } else placement.start = anchor;
    return;
  }
  const dx = next.x - mouse.x;
  if (!next.pressed) {
    for (const garland of garlands) {
      if (resolveAnchor(garland.a) && resolveAnchor(garland.b)) brushRope(garland.rope, mouse, next);
    }
  }
  if (heldTree) {
    const { tree, offset } = heldTree;
    const point = { x: next.x + offset.x, y: next.y + offset.y };
    if (next.pressed) {
      tree.anchor = point;
      tree.falling = false;
      tree.onBottom = false;
      tree.vy = 0;
      const target = Math.max(-.28, Math.min(.28, -dx / elapsed * .001));
      tree.leanTarget = target;
    }
    if (!next.pressed) {
      Object.assign(tree, dropTreeAt(point, rectangles));
      tree.leanTarget = 0;
      heldTree = undefined;
      capturePointer(false);
      sceneDirty = true;
    }
    return;
  }
  if (!grabbed && (!next.pressed || clicked)) {
    const tree = trees.findLast(candidate => {
      if (plough?.carriedTrees.includes(candidate)) return false;
      const point = resolveAnchor(candidate.anchor);
      if (!point) return false;
      const fromBase = point.y - next.y;
      return fromBase >= 0 && fromBase <= 115 &&
        Math.abs(point.x - next.x) < Math.max(10, 42 * (1 - fromBase / 122));
    });
    if (tree && !plough?.carriedTrees.includes(tree)) {
      capturePointer(true);
      if (clicked) {
        const point = resolveAnchor(tree.anchor);
        heldTree = { tree, offset: { x: point.x - next.x, y: point.y - next.y } };
      }
      return;
    }
  }
  const gift = gifts.findLast(item => item.support && Math.abs(item.x - next.x) < 12 &&
    next.y > item.y - 17 && next.y < item.y + 10);
  if (gift && !grabbed) {
    capturePointer(true);
    if (clicked) {
      gifts.splice(gifts.indexOf(gift), 1);
      for (let i = 0; i < 24; i++) accents.push({
        kind: 'magic', x: gift.x, y: gift.y, vx: random(-125, 125), vy: random(-205, -48),
        life: random(.55, 1.05), size: random(.8, 2.5),
      });
      capturePointer(false);
    }
    return;
  }
  updateBallPointer(next, elapsed);
}

function paintDecor(now, dt) {
  for (const garland of garlands) {
    const a = resolveAnchor(garland.a), b = resolveAnchor(garland.b);
    if (!a || !b) continue;
    stepRope(garland.rope, a, b, dt);
    drawGarland(ctx, a, b, garland.color, now, false, garland.rope.nodes);
  }
  for (const tree of trees) {
    const point = resolveAnchor(tree.anchor);
    tree.tilt ??= 0;
    tree.velocity = ((tree.velocity ?? 0) + ((tree.leanTarget ?? 0) - tree.tilt) * 47 * dt) * Math.exp(-4.1 * dt);
    tree.tilt = Math.max(-.34, Math.min(.34, tree.tilt + tree.velocity * dt));
    if (point) drawTree(ctx, point.x, point.y, tree.color, now, tree.tilt);
  }
  for (const gift of gifts) drawGift(ctx, gift);
  if (!placement || mouse.x < 0 || mouse.y < 0 || mouse.x >= width || mouse.y >= height) return;
  const start = placement.start && resolveAnchor(placement.start);
  if (start) drawGarland(ctx, start, mouse, placement.color, now, true);
  if (placement.kind === 'tree') drawTree(ctx, mouse.x, mouse.y, placement.color, now);
  const label = placement.kind === 'tree' ? 'Click to place the tree' :
    placement.start ? 'Ctrl+click: add · Click: finish' : 'Click to attach the first end';
  ctx.fillStyle = '#122a23';
  ctx.fillRect(Math.min(mouse.x + 10, width - 200), Math.max(0, mouse.y - 33), 188, 24);
  ctx.font = '12px Segoe UI';
  ctx.fillStyle = '#ecfff1';
  ctx.fillText(label, Math.min(mouse.x + 18, width - 192), Math.max(16, mouse.y - 17));
}

function updatePileRaster(pile, now) {
  const { rect, profile } = pile;
  const rasterWidth = Math.ceil(rect.right - rect.left);
  if (rasterWidth < 1) return null;
  const cache = pile.raster ??= { canvas: document.createElement('canvas') };
  const rasterScale = Math.min(2, Math.max(1, devicePixelRatio));
  const resized = cache.width !== rasterWidth || cache.scale !== rasterScale || cache.profile?.length !== profile.length;
  if (!resized && now - cache.updatedAt < 90) return cache;
  if (!resized && !profile.some((depth, i) => depth !== cache.profile[i])) return cache;

  const ridge = naturalSnowHeights(profile, rect.left * 0.007 + rect.top * 0.002);
  const maxDepth = Math.max(5, ...ridge);
  const rasterHeight = Math.max(24, Math.ceil(maxDepth) + 2);
  const surface = cache.canvas;
  if (surface.width !== Math.ceil(rasterWidth * rasterScale)) surface.width = Math.ceil(rasterWidth * rasterScale);
  if (surface.height !== Math.ceil(rasterHeight * rasterScale)) surface.height = Math.ceil(rasterHeight * rasterScale);
  const paint = surface.getContext('2d');
  paint.setTransform(rasterScale, 0, 0, rasterScale, 0, 0);
  paint.imageSmoothingEnabled = true;
  paint.imageSmoothingQuality = 'high';
  const baseline = rasterHeight - 1;
  paint.clearRect(0, 0, rasterWidth, rasterHeight);
  const gradient = paint.createLinearGradient(0, baseline - maxDepth, 0, baseline + 1);
  gradient.addColorStop(0, '#fbfdff');
  gradient.addColorStop(0.55, '#e8eef9');
  gradient.addColorStop(1, '#c0cfe7');
  paint.beginPath();
  paint.moveTo(0, baseline);
  paint.lineTo(0, baseline - ridge[0]);
  for (let i = 0; i < ridge.length; i++) {
    const x = Math.min(rasterWidth, (i + 0.5) * column);
    const right = Math.min(rasterWidth, (i + 1) * column);
    paint.quadraticCurveTo(x, baseline - ridge[i], right,
      baseline - (ridge[i] + (ridge[i + 1] ?? ridge[i])) / 2);
  }
  paint.lineTo(rasterWidth, baseline);
  paint.closePath();
  paint.fillStyle = gradient;
  paint.fill();
  if (snowGrain) {
    paint.fillStyle = snowGrain;
    paint.fill();
  }
  cache.width = rasterWidth;
  cache.height = rasterHeight;
  cache.scale = rasterScale;
  cache.baseline = baseline;
  cache.profile = profile.slice();
  cache.updatedAt = now;
  return cache;
}

function paintProfile(pile, covers, now) {
  const { rect, profile } = pile;
  // Subpixel residue must not appear as a bright horizontal hairline.
  if (!profile.some(depth => depth > 1.15)) return;
  const raster = updatePileRaster(pile, now);
  if (!raster) return;
  const top = rect.top - raster.baseline;
  ctx.save();
  // Snow rests ABOVE a window; none of the white raster may spill into its
  // titlebar, document area or CAD work surface.
  if (!rect.taskbar && rect.id !== 'ground') {
    ctx.beginPath();
    ctx.rect(-128, -128, width + 256, height + 256);
    ctx.rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
    ctx.clip('evenodd');
  }
  for (const cover of covers) {
    if (cover.right <= rect.left || cover.left >= rect.right || cover.bottom <= top || cover.top >= rect.top + 1) continue;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.rect(cover.left, cover.top, cover.right - cover.left, cover.bottom - cover.top);
    ctx.clip('evenodd');
  }
  ctx.drawImage(raster.canvas, rect.left, top, raster.width, raster.height);
  ctx.restore();
}

function paintPiles(now) {
  // The taskbar ridge is ON TOP of the taskbar, not inside window content.
  // Do not allow normal app frames to erase this lower snowbank. Only an
  // explicitly excluded app (if visibly exposed at the bottom) may mask it.
  paintProfile(ground, [...taskbars, ...bottomMasks], now);
  // Do not paint stale piles for windows omitted by the native tracker.
  rectangles.forEach((rect, z) => {
    const pile = piles.get(rect.id);
    if (!pile || hideMovingWindowSnow(rect.id, movingWindowDrag,
        movingWindowHoldUntil, now)) return;
    const covers = rectangles.slice(0, z);
    paintProfile(pile, rect.taskbar ?
      [...covers.filter(cover => cover.taskbar), ...bottomMasks] : covers, now);
  });
}

function stackRoot(ball) {
  while (ball.stack) ball = ball.stack;
  return ball;
}

function stackMembers(root) {
  const members = [root];
  let top = root;
  while ((top = balls.find(ball => ball.stack === top && !ball.broken))) members.push(top);
  return members;
}

function alignStack(root) {
  const members = stackMembers(root);
  for (let i = 1; i < members.length; i++) {
    const base = members[i - 1];
    const ball = members[i];
    ball.x = base.x;
    ball.y = base.y - base.size - ball.size + 2;
    ball.support = root.support;
  }
}

function launchSantaVisit(snowmanXs) {
  if (accents.some(p => p.kind === 'santa')) return false;
  accents.push({ kind: 'santa', x: -175, y: santaCenterForFloor(safeBottomFloor(taskbars, 0, height)),
    age: 0, stops: santaStops(snowmanXs, width), stopIndex: 0, alpha: 1 });
  sceneDirty = true;
  return true;
}

function dispatchQueuedSantaVisit() {
  if (!nextSantaVisitAt || performance.now() < nextSantaVisitAt ||
      settings.weather === 'rain' || settings.paused || !settings.enabled ||
      accents.some(p => p.kind === 'santa')) return;
  const people = [...santaPendingSnowmen].filter(root =>
    balls.includes(root) && !root.broken && stackMembers(root).length >= 3);
  santaPendingSnowmen.clear();
  nextSantaVisitAt = 0;
  if (people.length) launchSantaVisit(people.map(root => root.x));
}

function updateAutumnPlough(dt) {
  if (plough) {
    const previousX = plough.x;
    plough.x -= 245 * dt;
    const picked = autumn.sweep(previousX - 38, plough.x - 38);
    // Real collected leaves make the pile grow gradually, not a white mound.
    plough.load = Math.min(1800, Math.max(0,
      plough.load + picked * 17 - (picked ? 0 : dt * 7)));
    if (plough.x < -150) plough = undefined;
  } else if (settings.enabled && !settings.paused && settings.taskbar &&
      performance.now() >= nextAutoPloughCheck) {
    nextAutoPloughCheck = performance.now() + 1700;
    if (performance.now() - lastPloughAt > 30_000 && autumn.needsSweep()) {
      startPlough();
    }
  }
}

function startPlough() {
  if (plough || settings.weather === 'rain') return;
  plough = { x: width + 70, load: 0, carried: [], carriedGifts: [], carriedTrees: [] };
  lastPloughAt = performance.now();
}

function settleOnSnowball(ball, base) {
  ball.size = Math.min(ball.size, base.size * 0.86);
  ball.stack = base;
  ball.support = base.support;
  ball.previousSupport = base.previousSupport;
  ball.x = base.x;
  ball.y = base.y - base.size - ball.size + 2;
  ball.vx = ball.vy = 0;
  ball.thrown = false;
  const root = stackRoot(ball);
  if (stackMembers(root).length >= 3 && !celebratedSnowmen.has(root)) {
    celebratedSnowmen.add(root);
    santaPendingSnowmen.add(root);
    if (!nextSantaVisitAt) nextSantaVisitAt = performance.now() + 1100;
  }
}

function findSnowballBase(ball) {
  if (stackMembers(ball).length !== 1) return null;
  return balls.findLast(other => other !== ball && !balls.some(child => child.stack === other) &&
    stackRoot(other) !== ball && stackMembers(stackRoot(other)).length < 3 && canStackBall(ball, other));
}

function updateSnowProps(dt, byId) {
  if (plough) {
    const previousX = plough.x;
    plough.x -= 245 * dt;
    const previousBlade = previousX - 38;
    const blade = plough.x - 38;
    let gatheredArea = 0;
    for (const pile of [ground, ...piles.values()]) {
      if (pile !== ground && !pile.rect.taskbar) continue;
      const swept = sweepSnowProfile(pile, previousBlade, blade, column);
      gatheredArea += swept.area;
    }
    // Load is accumulated swept snow AREA, not a fixed triangle of pixels.
    // Snow visibly grows in front of the blade and slowly subsides in clear areas.
    if (gatheredArea > 0) {
      plough.load = Math.min(1800, plough.load + gatheredArea * 0.72);
      if (Math.random() < 0.65 && accents.length < 780) {
        const frontX = Math.max(0, Math.min(width - 1, blade));
        accents.push({
          kind: 'chunk', x: blade - random(0, 20), y: bottomSurfaceAt(frontX).top - random(5, 20),
          vx: random(-115, -30), vy: random(-115, -40),
          size: snowDiameter(settings.snowDiameter), alpha: 0.72, life: 0.6,
        });
      }
    } else plough.load = Math.max(0, plough.load - dt * 28);

    // Sweep snowballs AND entire snowmen by their bottom/root snowball.
    for (const root of balls) {
      if (root.stack || root.broken || root === grabbed || plough.carried.includes(root)) continue;
      const floor = bottomSurfaceAt(root.x).top;
      if (!bladeTouchesBall(root, previousBlade, blade, floor)) continue;
      plough.carried.push(root);
      plough.load = Math.min(1800, plough.load + Math.PI * root.size ** 2 * 0.33);
      root.support = null;
    }
    // Carried decorations follow the blade and leave with the machine.
    for (const gift of gifts) {
      if (plough.carriedGifts.includes(gift) || gift === undefined) continue;
      if (!isOnBottomSurface(gift.y + 8, gift.x, x => bottomSurfaceAt(x).top, 18)) continue;
      if (bladeCrosses(previousBlade, blade, gift.x, 10)) {
        gift.support = null;
        plough.carriedGifts.push(gift);
      }
    }
    for (const tree of trees) {
      if (plough.carriedTrees.includes(tree) || tree === heldTree?.tree) continue;
      const anchor = resolveAnchor(tree.anchor);
      if (!anchor) continue;
      // Santa trees are taskbar-bound even if the work area moves a few pixels.
      const nearFloor = tree.fromSanta ||
        isOnBottomSurface(anchor.y, anchor.x, x => bottomSurfaceAt(x).top, 42);
      if (!nearFloor) continue;
      if (bladeCrosses(previousBlade, blade, anchor.x, 55)) {
        tree.anchor = { x: anchor.x, y: anchor.y };
        tree.leanTarget = -0.2;
        tree.falling = false;
        tree.onBottom = false;
        tree.vy = 0;
        plough.carriedTrees.push(tree);
      }
    }
    let carriedOffset = 0;
    for (const root of plough.carried) {
      const nextX = plough.x - 50 - root.size - carriedOffset;
      const floor = bottomSurfaceAt(Math.max(0, Math.min(width - 1, nextX))).top;
      root.x = nextX;
      root.y = floor - root.size;
      root.vx = root.vy = 0;
      root.rotation = (root.rotation ?? 0) - 245 * dt / Math.max(5, root.size);
      alignStack(root);
      carriedOffset += root.size * 1.7;
    }
    for (const gift of plough.carriedGifts) {
      gift.x = plough.x - 56 - carriedOffset;
      gift.y = bottomSurfaceAt(Math.max(0, Math.min(width - 1, gift.x))).top - 8;
      gift.vx = gift.vy = 0;
      carriedOffset += 24;
    }
    for (const tree of plough.carriedTrees) {
      const x = plough.x - 83 - carriedOffset;
      tree.anchor = { x, y: bottomSurfaceAt(Math.max(0, Math.min(width - 1, x))).top };
      tree.falling = false;
      tree.onBottom = false;
      tree.leanTarget = -0.08;
      carriedOffset += 75;
    }
    if (plough.x < -110 - carriedOffset) {
      const carried = new Set(plough.carried);
      const carriedGifts = new Set(plough.carriedGifts);
      const carriedTrees = new Set(plough.carriedTrees);
      balls = balls.filter(ball => !carried.has(stackRoot(ball)));
      gifts = gifts.filter(gift => !carriedGifts.has(gift));
      for (let i = trees.length - 1; i >= 0; i--) {
        if (carriedTrees.has(trees[i])) trees.splice(i, 1);
      }
      plough = undefined;
    }
  } else if (settings.weather !== 'rain' && settings.enabled && !settings.paused &&
      settings.taskbar && performance.now() >= nextAutoPloughCheck) {
    nextAutoPloughCheck = performance.now() + 1600;
    if (performance.now() - lastPloughAt > 32_000 &&
        needsAutoPlough(piles.values(), ground)) {
      startPlough();
    }
  }
  for (const ball of balls) {
    if (ball === grabbed || plough?.carried.includes(ball)) continue;
    if (ball.stack) {
      if (balls.includes(ball.stack)) continue;
      ball.stack = null;
      ball.support = null;
    }
    if (ball.support) {
      const rect = ball.support === 'ground' ? bottomSurfaceAt(ball.x) : byId.get(ball.support);
      if (rect) {
        ball.support = rect.id;
        ball.x += rect.left - ball.previousSupport.left;
        ball.y = rect.top - ball.size;
        ball.previousSupport = rect;
        ball.x += ball.vx * dt;
        if (!balls.some(part => part.stack === ball)) {
          ball.rotation = (ball.rotation ?? 0) + ball.vx * dt / ball.size;
        }
        ball.vx *= Math.exp(-dt * 1.9);
        keepBallAboveTaskbar(ball, taskbars, height);
        if (ball.x >= rect.left + ball.size * 0.28 && ball.x <= rect.right - ball.size * 0.28) continue;
      }
      ball.support = null;
      ball.vy = 35;
    }
    const oldX = ball.x;
    const oldBottom = ball.y + ball.size;
    ball.vy += dt * 510;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const hit = landing(rectangles, oldX, oldBottom, ball.x, ball.y + ball.size, settings.taskbar);
    const members = stackMembers(ball);
    const base = members.length === 1 && balls.find(other => other !== ball && !other.broken &&
      stackRoot(other) !== ball && !balls.some(child => child.stack === other) &&
      stackMembers(stackRoot(other)).length < 3 && canStackBall(ball, other));
    if (base && Math.hypot(ball.vx, ball.vy) < 310) {
      settleOnSnowball(ball, base);
      continue;
    }
    const floor = bottomSurfaceAt(ball.x);
    const support = hit?.rect ?? (ball.y + ball.size >= floor.top ? floor : null);
    if (support) {
      ball.y = support.top - ball.size;
      ball.x = Math.max(ball.size * 0.35, Math.min(width - ball.size * 0.35, ball.x));
      const impactSpeed = Math.hypot(ball.vx * 0.65, ball.vy);
      if (ball.thrown && impactSpeed > (members.length > 1 ? 265 : 330)) {
        alignStack(ball);
        for (const part of members) {
          addPile({ rect: support, x: hit?.x ?? ball.x }, part.size * 0.33);
          for (let n = 0; n < 16; n++) {
            releaseSnow(part.x, part.y + part.size * 0.4, random(0.25, 1.5),
              ball.vx * 0.25 + random(-155, 155), random(-210, -45));
          }
          part.broken = true;
        }
        continue;
      }
      if (ball.vy > 105) {
        ball.vy *= -0.27;
        ball.vx *= 0.76;
      } else {
        ball.support = support.id;
        ball.previousSupport = support;
        ball.vy = 0;
      }
    }
    keepBallAboveTaskbar(ball, taskbars, height);
  }
  balls = balls.filter(ball => {
    const root = stackRoot(ball);
    return !ball.broken && root.x >= -80 && root.x <= width + 80;
  });
  for (const ball of balls) if (!ball.stack) {
    keepBallAboveTaskbar(ball, taskbars, height);
    alignStack(ball);
    if (stackMembers(ball).length >= 3 && !celebratedSnowmen.has(ball)) {
      celebratedSnowmen.add(ball);
      santaPendingSnowmen.add(ball);
      if (!nextSantaVisitAt) nextSantaVisitAt = performance.now() + 1100;
    }
  }
}

function capturePointer(value) {
  if (capturing === value) return;
  capturing = value;
  wintermas.snowballPointer(value);
}

function snowAt(point, tolerance = 2) {
  const surfaces = [...rectangles.map(rect => piles.get(rect.id)), ground];
  for (const pile of surfaces) {
    if (pile?.kind !== 'snow') continue;
    const index = Math.floor((point.x - pile.rect.left) / column);
    const depth = pile.profile[index];
    if (depth >= 1 && point.y < pile.rect.top + (tolerance > 2 ? 4 : 0) &&
        point.y >= pile.rect.top - depth - tolerance) {
      return { pile, index };
    }
  }
  return null;
}

function rollOnSnow(ball, point, travel) {
  const radius = Math.min(30, ball.size);
  const contact = snowAt({ x: point.x, y: point.y + radius - 1 }, 7) ?? snowAt(point, 7);
  if (!contact || travel < 0.1) return;
  const { pile, index } = contact;
  const reach = Math.ceil(radius / column);
  let gathered = 0;
  for (let i = Math.max(0, index - reach); i <= Math.min(pile.profile.length - 1, index + reach); i++) {
    const amount = Math.min(pile.profile[i], travel * 0.16 * (1 - Math.abs(i - index) / (reach + 1)));
    pile.profile[i] -= amount;
    gathered += amount * column;
  }
  ball.size = Math.min(34, Math.sqrt(ball.size ** 2 + gathered * 0.85));
  ball.y = pile.rect.top - ball.size + 1;
}

function updateBallPointer(next, dt) {

  const hovered = balls.findLast(ball => Math.hypot(ball.x - next.x, ball.y - next.y) <= ball.size + 3);
  // Clicking ordinary GUI controls must never create snow from the pointer.
  // Creating a new ball from a snowbank requires an explicit Ctrl+click;
  // the existing Make Snowball button still works without this shortcut.
  const snow = next.control ? snowAt(next) : null;
  if (!next.pressed || grabbed) capturePointer(Boolean(grabbed || hovered || snow));
  if (next.pressed && !mouse.pressed && (hovered || (next.control && snow))) {
    const root = hovered && stackRoot(hovered);
    const assembled = root && stackMembers(root).length >= 3;
    grabbed = assembled ? root : hovered;
    if (!grabbed) {
      const { pile, index } = snow;
      pile.profile[index] -= Math.min(1, pile.profile[index]);
      grabbed = { x: next.x, y: pile.rect.top - 6, size: 6, rotation: 0 };
      balls.push(grabbed);
      if (balls.length > 24) balls.shift();
    }
    grabOffset = assembled ? { x: grabbed.x - next.x, y: grabbed.y - next.y } : { x: 0, y: 0 };
    Object.assign(grabbed, { support: null, stack: null, vx: 0, vy: 0, thrown: false });
    return;
  }
  if (!grabbed) {
    if (next.pressed || mouse.pressed) return;
    const dx = next.x - mouse.x;
    if (Math.abs(dx) < 0.4) return;
    for (const ball of balls) {
      if (!ball.support || ball.stack || stackMembers(ball).length > 1) continue;
      const oldSide = mouse.x - ball.x;
      const side = next.x - ball.x;
      const rim = ball.size + 3;
      if (Math.abs(next.y - ball.y) > ball.size * 0.73 ||
          (dx > 0 ? oldSide > -rim || side < -rim : oldSide < rim || side > rim)) continue;
      ball.vx = dx > 0 ? Math.min(360, Math.max(45, dx / dt * 0.62)) :
        -Math.min(360, Math.max(45, -dx / dt * 0.62));
    }
    return;
  }
  if (!next.pressed) {
    const ball = grabbed;
    const base = findSnowballBase(ball);
    if (base) {
      settleOnSnowball(ball, base);
      grabbed = undefined;
      capturePointer(false);
      sceneDirty = true;
      return;
    }
    const bottom = ball.y + ball.size;
    const slow = Math.hypot(ball.vx, ball.vy) < 175;
    const aboveBall = balls.some(other => stackRoot(other) !== ball && other.support &&
      Math.abs(other.x - ball.x) < other.size * 0.72 &&
      Math.abs(bottom - (other.y - other.size)) < 16);
    const floor = bottomSurfaceAt(ball.x);
    const support = slow && !aboveBall && (landing([...rectangles, ground.rect], ball.x, bottom - 12,
      ball.x, bottom + 16, settings.taskbar)?.rect ?? (bottom >= floor.top - 12 ? floor : null));
    if (support && ball.x > support.left && ball.x < support.right) {
      Object.assign(ball, { support: support.id, previousSupport: support,
        y: support.top - ball.size, vx: 0, vy: 0, thrown: false });
      alignStack(ball);
    } else ball.thrown = true;
    keepBallAboveTaskbar(ball, taskbars, height);
    grabbed = undefined;
    capturePointer(Boolean(hovered || snow));
    return;
  }
  const clamp = value => Math.max(-1600, Math.min(1600, value));
  grabbed.vx = grabbed.vx * 0.5 + clamp((next.x - mouse.x) / dt) * 0.5;
  grabbed.vy = grabbed.vy * 0.5 + clamp((next.y - mouse.y) / dt) * 0.5;
  grabbed.x = next.x + grabOffset.x;
  grabbed.y = next.y + grabOffset.y;
  grabbed.rotation = (grabbed.rotation ?? 0) + (next.x - mouse.x) / grabbed.size;
  if (stackMembers(grabbed).length === 1) {
    rollOnSnow(grabbed, next, Math.hypot(next.x - mouse.x, next.y - mouse.y));
  }
  keepBallAboveTaskbar(grabbed, taskbars, height);
  alignStack(grabbed);
}

function paintSnowProps(now) {
  for (const ball of balls) {
    drawBall(ctx, ball.x, ball.y, ball.size, ball.rotation);
  }
  for (const head of balls) {
    if (head.stack?.stack && !head.stack.stack.stack) drawSnowman(ctx, head, head.stack);
  }
}

function paintBottomPlough(now) {
  if (plough) {
    const x = Math.max(0, Math.min(width - 1, plough.x));
    // Draw the mound baseline at the taskbar edge. The old -4 offset left
    // a dark strip between the accumulated snow and the ground.
    const floorY = safeBottomFloor(taskbars, x, height);
    const vehicleY = ploughBaselineForFloor(floorY);
    if (settings.weather === 'autumn') {
      // Leaf heap must contact the actual floor; the vehicle art extends
      // below its own origin, so use a separate safe vehicle baseline.
      autumn.drawMound(ctx, plough.x, floorY - 1, plough.load, now);
      drawPlough(ctx, plough.x, vehicleY, 0, snowGrain, now);
    } else drawPlough(ctx, plough.x, vehicleY, plough.load, snowGrain, now);
  }

}

// Paint flake sprites once. The soft edge keeps distant flakes from reading as white dots.
const flakeSprite = document.createElement('canvas');
flakeSprite.width = flakeSprite.height = 32;
const flakeContext = flakeSprite.getContext('2d');
const flakeLight = flakeContext.createRadialGradient(15, 14, 0, 16, 16, 16);
flakeLight.addColorStop(0, '#f9fcff');
flakeLight.addColorStop(0.43, '#eaf2ffdb');
flakeLight.addColorStop(0.75, '#d5e3fa57');
flakeLight.addColorStop(1, '#c6dbfb00');
flakeContext.fillStyle = flakeLight;
flakeContext.fillRect(0, 0, 32, 32);

function paintParticle(p, now) {
  const { x, y, size, kind } = p;
  ctx.globalAlpha = p.alpha ?? Math.min(1, p.life * 2.5);
  if (kind === 'snow' || kind === 'chunk') {
    const span = size * 1.48;
    ctx.drawImage(flakeSprite, x - span / 2, y - span / 2, span, span);
  } else if (kind === 'magic') {
    ctx.fillStyle = '#ffd989';
    ctx.beginPath();
    ctx.moveTo(x - size * 1.9, y); ctx.lineTo(x, y - size * .42);
    ctx.lineTo(x + size * 1.9, y); ctx.lineTo(x, y + size * .42); ctx.fill();
    ctx.fillRect(x - .45, y - size * 1.75, .9, size * 3.5);
  } else if (kind === 'santa') {
    drawSanta(ctx, x, y, now, p.tilt ?? 0);
  }
  ctx.globalAlpha = 1;
}

function paintSnowFallback() {
  // Use exactly the same flake sprite and diameter as window powder.
  for (const flake of particles) paintParticle(flake, 0);
}

function frame(timestamp) {
  // Vsync timestamps can sit slightly before a timer-driven frame; never let time run backwards.
  const now = Math.max(typeof timestamp === 'number' ? timestamp : performance.now(), previous ?? -Infinity);
  const interval = 1000 / 60;
  if (settings.paused && !autumn.active() && !particles.length && !accents.length && !balls.length && !gifts.length &&
      !placement && !plough && !garlands.length && !trees.length && !piles.size &&
      !iconPiles.size && !ground.profile.some(Boolean) && !rain.active()) {
    // Clear the last animation frame once, then avoid sending empty frames to DWM.
    if (previous !== undefined || !document.documentElement.dataset.rendered) {
      ctx.clearRect(0, 0, width, height);
      snowRenderer?.draw([], rectangles, settings.taskbar);
      sceneVisible = false;
      document.documentElement.dataset.rendered = 'true';
    }
    previous = undefined;
    nextFrame = undefined;
    frameRequest = setTimeout(frame, 80);
    return;
  }
  // The transparent overlay can receive compositor callbacks at an unrelated cadence.
  nextFrame = nextFrame === undefined || now - nextFrame >= interval
    ? now + interval : nextFrame + interval;
  const dt = Math.min(0.045, (now - (previous ?? now)) / 1000);
  previous = now;
  perf.record(now);
  updateParticles(dt);
  snowRenderer?.draw(particles, rectangles, settings.taskbar);
  updateWeather(dt);
  const sceneNeeded = !snowRenderer && particles.length || accents.length || balls.length ||
    gifts.length || placement || plough || garlands.length || trees.length || piles.size ||
    iconPiles.size || ground.profile.some(Boolean) || rain.needsScene() || autumn.active();
  const fastScene = !snowRenderer && particles.length || grabbed || heldTree || plough ||
    accents.length || balls.some(ball => !ball.support || Math.abs(ball.vx) > 1) ||
    gifts.some(gift => !gift.support) || garlands.some(garland => garland.rope.active > 0) ||
    trees.some(tree => tree.falling || Math.abs(tree.tilt ?? 0) > .003 ||
      Math.abs(tree.velocity ?? 0) > .02) ||
    rain.fast() || autumn.fast();
  if (sceneNeeded && (fastScene || sceneDirty || previousScene === undefined ||
      now - previousScene >= staticSceneInterval())) {
    const sceneDt = Math.min(.08, (now - (previousScene ?? now)) / 1000);
    previousScene = now;
    sceneDirty = false;
    drawScene(now, sceneDt);
    sceneVisible = true;
  } else if (!sceneNeeded && sceneVisible) {
    ctx.clearRect(0, 0, width, height);
    sceneVisible = false;
    previousScene = undefined;
  }
  if (!document.documentElement.dataset.rendered) document.documentElement.dataset.rendered = 'true';
  pacer.schedule(nextFrame);
}

function drawScene(now, dt) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (!settings.taskbar) {
    for (const rect of rectangles) {
      if (!rect.taskbar) continue;
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.rect(rect.left, rect.top - 1, rect.right - rect.left, rect.bottom - rect.top + 1);
      ctx.clip('evenodd');
    }
  }
  // Clip only precipitation. Snowbanks remain visible above window top edges.
  ctx.save();
  clipPrecipitation(ctx, rectangles, width, height);
  if (!snowRenderer && particles.length) paintSnowFallback();
  for (const p of accents) if (p.kind === 'chunk') paintParticle(p, now);
  ctx.restore();
  paintPiles(now);
  if (settings.weather === 'snow' && settings.iconsSnow && iconPiles.size) {
    ctx.save();
    // Keep shortcut snow behind any application window that covers it.
    clipPrecipitation(ctx, rectangles, width, height);
    paintIconSnow(ctx, iconPiles, now);
    ctx.restore();
  }
  if (settings.weather === 'autumn') autumn.paint(ctx, now, bottomMasks);
  rain.paint(ctx, rectangles);
  for (const p of accents) if (p.kind !== 'chunk' && p.kind !== 'santa') paintParticle(p, now);
  // Snowballs, Christmas trees and decorations remain behind ALL apps.
  ctx.save();
  clipPrecipitation(ctx, rectangles, width, height);
  paintSnowProps(now);
  if (settings.weather !== 'autumn') paintDecor(now, dt);
  ctx.restore();
  // TASKBAR actors need a separate layer. The former shared window mask
  // erased the plough/sleigh whenever an ordinary app occupied the work
  // area above the taskbar, even while its snow ridge remained visible.
  ctx.save();
  clipPrecipitation(ctx, [...taskbars, ...bottomMasks], width, height);
  for (const p of accents) if (p.kind === 'santa') paintParticle(p, now);
  paintBottomPlough(now);
  ctx.restore();
  ctx.restore();
}
wintermas.onDesktop(desktop);
wintermas.onSettings(configure);
wintermas.onAction(action => {
  if (settings.weather === 'rain' && ['clear', 'snowball', 'santa', 'reset', 'gather'].includes(action)) return;
  if (action?.placement === 'garland' || action?.placement === 'tree') {
    placement = { kind: action.placement, color: action.color, deadline: performance.now() + 25000 };
    return;
  }
  if (action === 'decor-cancel' || action === 'decor-reset') {
    cancelPlacement();
    if (action === 'decor-reset') {
      heldTree = undefined;
      garlands.length = trees.length = 0;
      gifts = [];
    }
  } else if (action === 'reset') {
    piles.clear();
    iconPiles.clear();
    iconDrag.reset();
    movingWindowDrag = undefined;
    movingWindowHoldUntil.clear();
    ground.profile.fill(0);
    ground.raster = undefined;
    particles = [];
    accents = [];
    balls = [];
    gifts = [];
    santaPendingSnowmen.clear();
    nextSantaVisitAt = 0;
    grabbed = undefined;
    plough = undefined;
    fraction = 0;
    autumn.clear();
    cancelPlacement();
  } else if (action === 'clear') {
    startPlough();
  } else if (action === 'santa') {
    const snowmen = balls.filter(root => !root.stack && !root.broken &&
      stackMembers(root).length >= 3);
    launchSantaVisit(snowmen.map(root => root.x));
  } else if (action === 'gather') {
    const pile = [...piles.values(), ground].find(candidate =>
      mouse.x >= candidate.rect.left && mouse.x < candidate.rect.right &&
      Math.abs(candidate.rect.top - mouse.y) < 52 && candidate.kind === 'snow');
    if (!pile) return;
    const center = Math.floor((mouse.x - pile.rect.left) / column);
    const first = Math.max(0, center - 4);
    const end = Math.min(pile.profile.length, center + 5);
    const gathered = pile.profile.slice(first, end).reduce((sum, depth) => sum + depth, 0);
    if (gathered < 3) return;
    for (let i = first; i < end; i++) pile.profile[i] *= .35;
    const size = Math.max(10, Math.min(26, Math.sqrt(gathered) * 3.8));
    const ball = { x: mouse.x, y: pile.rect.top - size, size, vx: 0, vy: 0,
      support: pile.rect.id, previousSupport: pile.rect };
    keepBallAboveTaskbar(ball, taskbars, height);
    balls.push(ball);
  } else if (action === 'snowball') {
    const ledge = rectangles.find(rect => !rect.taskbar && rect.top > height * 0.18 && rect.right - rect.left > 140);
    const x = ledge ? (Math.max(0, ledge.left) + Math.min(width, ledge.right)) / 2 : width * 0.45;
    const y = (ledge?.top ?? height * 0.72) - 95;
    const ball = { x, y, size: random(15, 22), vx: random(-22, 22), vy: -15 };
    keepBallAboveTaskbar(ball, taskbars, height);
    balls.push(ball);
  }
  if (balls.length > 24) balls.splice(balls.findIndex(ball => ball !== grabbed), 1);
});
wintermas.settings().then(configure).catch(console.error);
addEventListener('resize', resize);
resize();
document.documentElement.dataset.ready = 'true';




