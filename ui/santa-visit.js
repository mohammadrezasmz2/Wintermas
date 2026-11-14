// Deterministic plans let Santa visit supported snowmen, or leave one tree.
export function santaStops(snowmanXs, width) {
  const clamp = x => Math.max(60, Math.min(width - 60, x));
  const people = [...snowmanXs].filter(x => x >= 0 && x < width).sort((a, b) => a - b);
  if (!people.length) return [{ kind: 'tree', x: clamp(width * 0.54) }];
  const stops = [];
  for (const x of people.slice(0, 6)) {
    for (const offset of [-65, 59, 92]) {
      const target = clamp(x + offset);
      if (!stops.some(stop => Math.abs(stop.x - target) < 17)) {
        stops.push({ kind: 'gift', x: target });
      }
    }
  }
  return stops.sort((a, b) => a.x - b.x);
}

// Sweep interval intersects an object radius, irrespective of the blade's step size.
export function bladeCrosses(previousBlade, currentBlade, x, radius = 0) {
  return x + radius >= Math.min(previousBlade, currentBlade) - 5 &&
    x - radius <= Math.max(previousBlade, currentBlade) + 12;
}

export function isOnBottomSurface(y, x, floorAt, tolerance = 23) {
  return Math.abs(y - floorAt(x)) <= tolerance;
}
