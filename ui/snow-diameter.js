// Shared visual diameter for all regular snowflakes and snow released from
// window piles. Snowball props remain a separate interactive object.
export const DEFAULT_SNOW_DIAMETER = 5;
export const MIN_SNOW_DIAMETER = 2;
export const MAX_SNOW_DIAMETER = 12;

export function snowDiameter(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(MIN_SNOW_DIAMETER, Math.min(MAX_SNOW_DIAMETER, numeric))
    : DEFAULT_SNOW_DIAMETER;
}

// Mass is separate from visual radius: large piles release MORE tiny flakes,
// never a single oversized chunk. Keep mass conserved in supported capacity.
export function powderShares(depth, remaining = 6) {
  if (!(depth > 0.03) || remaining <= 0) return [];
  const count = Math.min(6, remaining, Math.max(1, Math.ceil(depth / 2.2)));
  return Array.from({ length: count }, () => depth / count);
}

export function setVisibleSnowDiameter(flakes, accents, setting) {
  const diameter = snowDiameter(setting);
  for (const flake of flakes) flake.size = diameter;
  for (const accent of accents) {
    if (accent.kind === 'chunk') accent.size = diameter;
  }
  return diameter;
}
