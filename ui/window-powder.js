// On vertical window movement, release the entire resting bank as a shower.
// Removing the stored profile is important: even tiny retained depths render
// as a disconnected hairline when the window moves again.
export function shakeSnowOffWindow(profile, dy, minDisplacement = 1.8) {
  if (Math.abs(dy) < minDisplacement) return [];
  const powder = [];
  const groupSize = 3;
  for (let start = 0; start < profile.length; start += groupSize) {
    let mass = 0;
    const end = Math.min(start + groupSize, profile.length);
    for (let i = start; i < end; i++) {
      mass += profile[i];
      profile[i] = 0;
    }
    if (mass < 0.15) continue;
    const count = Math.min(3, Math.max(1, Math.ceil(mass / 6)));
    for (let p = 0; p < count; p++) {
      powder.push({ column: start + (end - start) * (p + 0.5) / count,
        mass: mass / count });
    }
  }
  return powder;
}
