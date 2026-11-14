// Testable desktop snow physics shared by the renderer and the animation controller.
export const SNOWBANK_CAP = 13;

// Shift-driven inertia removes a little snow from the trailing rim and from
// multiple spots across the edge. The rest of the profile remains attached.
export function shedOnWindowMotion(profile, motion, dt) {
  const { dx, dy, lastVx = 0, lastVy = 0 } = motion;
  const time = Math.max(0.008, dt);
  const vx = dx / time, vy = dy / time;
  const speed = Math.hypot(vx, vy);
  const acceleration = Math.hypot(vx - lastVx, vy - lastVy) / time;
  const dislodged = [];
  if (speed < 320 && acceleration < 3800) return { vx, vy, dislodged };
  if (!profile.length) return { vx, vy, dislodged };
  const strength = Math.min(0.3, 0.045 + Math.max(0, speed - 320) / 5400 +
    Math.max(0, acceleration - 3800) / 95000);
  const count = Math.min(16, Math.max(3, Math.round(profile.length / 36)));
  const anchor = vx > 0 ? 0 : profile.length - 1;
  for (let n = 0; n < count; n++) {
    const fraction = (n + 0.5) / count;
    const index = Math.max(0, Math.min(profile.length - 1,
      Math.round(anchor + (vx > 0 ? 1 : -1) * fraction * Math.min(profile.length - 1, 100))));
    const amount = Math.min(profile[index], profile[index] * strength * (1 - fraction * 0.65));
    if (amount < 0.16) continue;
    profile[index] -= amount;
    dislodged.push({ index, amount, vx: Math.max(-290, Math.min(290, -vx * 0.23)),
      vy: Math.max(-230, Math.min(130, -vy * 0.32 - Math.min(130, acceleration * 0.005))) });
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
