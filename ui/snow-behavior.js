// Testable desktop snow physics shared by the renderer and the animation controller.
export const SNOWBANK_CAP = 13;

// Snow keeps its momentum when a window is yanked upward: the window rises,
// but loose snow is left behind and falls. Gentle drags keep the bank intact.
// Release from the WHOLE rim, not just the first/last 100 profile columns.
export function shedOnWindowMotion(profile, motion, dt) {
  const { dx, dy, lastVx = 0, lastVy = 0 } = motion;
  const time = Math.max(0.012, dt);
  const vx = dx / time, vy = dy / time;
  const acceleration = Math.hypot(vx - lastVx, vy - lastVy) / time;
  const dislodged = [];
  if (!profile.length || Math.abs(dx) + Math.abs(dy) < 1 ||
      (Math.hypot(vx, vy) < 260 && acceleration < 4600 &&
        !(dy < -1.8 && vy < -105))) {
    return { vx, vy, dislodged };
  }
  const upward = dy < -2;
  const sideways = Math.abs(dx) > 2;
  const vertical = upward || Math.abs(dy) > 6;
  const intensity = Math.min(0.74, Math.max(0.06,
    (upward ? 0.12 + Math.abs(dy) / 85 : 0) +
    (sideways ? Math.abs(dx) / 240 : 0) +
    (vertical && !upward ? Math.abs(dy) / 250 : 0) +
    Math.max(0, acceleration - 4600) / 90000));
  // Upward movement shakes snow loose at regular intervals all along the rim.
  const stride = Math.max(2, Math.ceil(profile.length / (vertical ? 40 : 25)));
  for (let start = 0; start < profile.length; start += stride) {
    const end = Math.min(profile.length, start + stride);
    const fraction = (start + end) / (2 * profile.length);
    // For horizontal motion, eject more from the trailing edge.
    const weight = vertical ? 0.82 + Math.sin(fraction * 19) * 0.12 :
      (vx > 0 ? 1 - fraction * 0.65 : 0.35 + fraction * 0.65);
    let amount = 0;
    for (let i = start; i < end; i++) {
      const detached = profile[i] * intensity * weight;
      profile[i] -= detached;
      amount += detached;
    }
    if (amount < 0.25) continue;
    const index = Math.floor((start + end - 1) / 2);
    dislodged.push({
      index, amount,
      // Retain a fraction of the window's movement, so the snow lags behind.
      vx: Math.max(-300, Math.min(300, vx * 0.15)),
      vy: upward ? Math.max(-20, Math.min(160, -vy * 0.17)) :
        Math.max(-130, Math.min(80, vy * 0.1 - 70)),
    });
  }
  return { vx, vy, dislodged };
}

export function naturalSnowHeights(profile, seed = 0) {
  const values = new Float32Array(profile.length);
  for (let i = 0; i < profile.length; i++) {
    const a = profile[Math.max(0, i - 2)];
    const b = profile[Math.max(0, i - 1)];
    const c = profile[i];
    const d = profile[Math.min(profile.length - 1, i + 1)];
    const e = profile[Math.min(profile.length - 1, i + 2)];
    const smooth = a * 0.09 + b * 0.22 + c * 0.38 + d * 0.22 + e * 0.09;
    const ripple = Math.sin(i * 0.41 + seed) * 0.38 + Math.sin(i * 0.97 + seed * 0.7) * 0.22;
    values[i] = Math.max(0, Math.min(SNOWBANK_CAP * 1.8, smooth + (smooth > 0.7 ? ripple : 0)));
  }
  return values;
}

// A snowball must never overlap the Windows taskbar. Return the usable floor
// even if the particle crossed it in one physics tick or was dragged there.
export function keepBallAboveTaskbar(ball, taskbars, screenHeight) {
  let floor = screenHeight;
  for (const taskbar of taskbars) {
    if (!taskbar.taskbar || taskbar.bottom < screenHeight - 2) continue;
    if (ball.x + ball.size <= taskbar.left || ball.x - ball.size >= taskbar.right) continue;
    floor = Math.min(floor, taskbar.top);
  }
  if (ball.y + ball.size > floor) {
    ball.y = floor - ball.size;
    if (ball.vy > 0) ball.vy = 0;
  }
  return floor;
}

export function canStackBall(top, base) {
  if (!base || base === top || !base.support || base.broken) return false;
  const horizontal = Math.abs(top.x - base.x);
  const vertical = Math.abs((top.y + top.size) - (base.y - base.size));
  return horizontal < Math.max(14, base.size * 0.85) &&
    vertical < Math.max(30, top.size * 1.4);
}

export function needsAutoPlough(piles, ground) {
  const beds = [...piles].filter(pile => pile.rect.taskbar);
  if (!beds.length && ground) beds.push(ground);
  for (const pile of beds) {
    const depths = pile.profile;
    if (depths.length < 8) continue;
    let covered = 0, total = 0;
    for (const height of depths) {
      total += height;
      if (height >= 7) covered++;
    }
    if (covered / depths.length >= 0.62 && total / depths.length >= 8.2) return true;
  }
  return false;
}

// Sweep the complete distance travelled by the blade this frame. Return
// material actually removed; only collected material can grow the visible mound.
export function sweepSnowProfile(pile, previousBlade, blade, column) {
  const from = Math.min(previousBlade, blade) - 3;
  const to = Math.max(previousBlade, blade) + 7;
  let area = 0;
  let cells = 0;
  for (let i = 0; i < pile.profile.length; i++) {
    const x = pile.rect.left + (i + 0.5) * column;
    if (x < from || x > to) continue;
    const depth = pile.profile[i];
    if (depth <= 0) continue;
    pile.profile[i] = 0;
    area += depth * column;
    cells++;
  }
  return { area, cells };
}

// The blade travels left. It touches grounded balls and the base of a
// snowman; attached stack members are then moved together with that base.
export function bladeTouchesBall(ball, previousBlade, blade, floor) {
  return ball.y + ball.size >= floor - 28 &&
    ball.y - ball.size < floor + 2 &&
    ball.x + ball.size >= Math.min(previousBlade, blade) - 5 &&
    ball.x - ball.size <= Math.max(previousBlade, blade) + 12;
}

export function moundHeight(load) {
  return Math.min(23, 23 * Math.sqrt(Math.max(0, load) / 1800));
}
